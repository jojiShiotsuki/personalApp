"""
Vault search service -- semantic search over Obsidian vault chunks
using Voyage AI embeddings and numpy cosine similarity.
"""

import logging
import os
from typing import Any, Optional

import numpy as np
from sqlalchemy.orm import Session

from app.models.joji_ai import VaultChunk, VaultFile

logger = logging.getLogger(__name__)


class VaultSearchService:
    """Searches vault chunks by semantic similarity with in-memory caching."""

    def __init__(self) -> None:
        voyage_key = os.getenv("VOYAGE_AI_API_KEY") or os.getenv("VOYAGE_API_KEY")
        self._voyage_client = None
        if voyage_key:
            try:
                import voyageai

                self._voyage_client = voyageai.Client(api_key=voyage_key)
            except Exception as e:
                logger.warning("Failed to initialize Voyage AI client: %s", e)

        # In-memory cache
        self._cache_embeddings: Optional[np.ndarray] = None  # shape: (N, 512)
        self._cache_chunk_ids: Optional[list[int]] = None
        self._cache_version: int = 0
        self._loaded_version: int = -1

    # ------------------------------------------------------------------
    # Cache management
    # ------------------------------------------------------------------

    def _load_cache(self, db: Session) -> None:
        """Load all chunk embeddings into a single numpy matrix for fast search."""
        chunks_with_embeddings = (
            db.query(VaultChunk.id, VaultChunk.embedding)
            .filter(VaultChunk.embedding.isnot(None))
            .all()
        )

        if not chunks_with_embeddings:
            self._cache_embeddings = None
            self._cache_chunk_ids = None
            self._loaded_version = self._cache_version
            return

        chunk_ids: list[int] = []
        vectors: list[np.ndarray] = []

        for chunk_id, embedding_bytes in chunks_with_embeddings:
            vec = np.frombuffer(embedding_bytes, dtype=np.float32).copy()
            chunk_ids.append(chunk_id)
            vectors.append(vec)

        # Stack into (N, dim) matrix
        embeddings_matrix = np.vstack(vectors)

        # L2-normalize rows so cosine similarity = dot product
        norms = np.linalg.norm(embeddings_matrix, axis=1, keepdims=True)
        # Avoid division by zero for any zero-vector rows
        norms = np.where(norms == 0, 1.0, norms)
        embeddings_matrix = embeddings_matrix / norms

        self._cache_embeddings = embeddings_matrix
        self._cache_chunk_ids = chunk_ids
        self._loaded_version = self._cache_version

        logger.info(
            "Vault search cache loaded: %d chunks, embedding dim %d",
            len(chunk_ids),
            embeddings_matrix.shape[1],
        )

    def invalidate_cache(self) -> None:
        """Increment cache version to force a reload on the next search."""
        self._cache_version += 1

    # ------------------------------------------------------------------
    # Semantic search
    # ------------------------------------------------------------------

    def search(
        self, db: Session, query: str, top_k: int = 5
    ) -> list[dict[str, Any]]:
        """Search vault chunks by semantic similarity to the query.

        Falls back to keyword search when embeddings or Voyage AI are
        unavailable.

        Returns a list of dicts with keys: chunk_id, content, file_path,
        heading_context, score.
        """
        if not query or not query.strip():
            return []

        # Reload cache if stale
        if self._loaded_version != self._cache_version:
            self._load_cache(db)

        # If no embeddings in the database, fall back to keyword search
        if self._cache_embeddings is None or self._cache_chunk_ids is None:
            return self._keyword_search(db, query, top_k)

        # Embed the query
        query_vec = self._embed_query(query)
        if query_vec is None:
            return self._keyword_search(db, query, top_k)

        # Cosine similarity (cache is already L2-normalized)
        query_norm = np.linalg.norm(query_vec)
        if query_norm == 0:
            return self._keyword_search(db, query, top_k)
        query_vec_normalized = query_vec / query_norm

        scores = self._cache_embeddings @ query_vec_normalized  # shape: (N,)

        # Get top_k indices sorted by descending score
        k = min(top_k, len(scores))
        top_indices = np.argpartition(scores, -k)[-k:]
        top_indices = top_indices[np.argsort(scores[top_indices])[::-1]]

        # Look up chunk details
        top_chunk_ids = [int(self._cache_chunk_ids[i]) for i in top_indices]
        top_scores = [float(scores[i]) for i in top_indices]

        return self._fetch_chunk_details(db, top_chunk_ids, top_scores)

    def _embed_query(self, query: str) -> Optional[np.ndarray]:
        """Embed a single query string via Voyage AI.

        Returns a 1-D numpy array or None on failure.
        """
        if not self._voyage_client:
            return None

        try:
            result = self._voyage_client.embed(
                [query], model="voyage-3-lite", input_type="query"
            )
            return np.array(result.embeddings[0], dtype=np.float32)
        except Exception as e:
            logger.warning("Voyage AI query embedding failed: %s", e)
            return None

    def _fetch_chunk_details(
        self,
        db: Session,
        chunk_ids: list[int],
        scores: list[float],
    ) -> list[dict[str, Any]]:
        """Load chunk content and file path for a list of chunk IDs.

        Preserves the order of chunk_ids.
        """
        if not chunk_ids:
            return []

        rows = (
            db.query(
                VaultChunk.id,
                VaultChunk.content,
                VaultChunk.heading_context,
                VaultFile.file_path,
            )
            .join(VaultFile, VaultChunk.vault_file_id == VaultFile.id)
            .filter(VaultChunk.id.in_(chunk_ids))
            .all()
        )

        # Build lookup by chunk ID
        lookup: dict[int, dict[str, Any]] = {}
        for row in rows:
            lookup[row[0]] = {
                "chunk_id": row[0],
                "content": row[1],
                "heading_context": row[2] or "",
                "file_path": row[3],
            }

        # Return in the original ranked order
        results: list[dict[str, Any]] = []
        for chunk_id, score in zip(chunk_ids, scores):
            if chunk_id in lookup:
                entry = dict(lookup[chunk_id])  # immutable copy
                entry["score"] = score
                results.append(entry)

        return results

    # ------------------------------------------------------------------
    # Path-based search
    # ------------------------------------------------------------------

    def search_by_path(
        self, db: Session, path_pattern: str
    ) -> list[dict[str, Any]]:
        """Return all chunks for vault files matching a path pattern.

        The pattern is matched with SQL LIKE against the file_path column
        (e.g. "SOPs" matches "SOPs/pricing.md").

        Returns a list of dicts with keys: chunk_id, content, file_path,
        heading_context.
        """
        if not path_pattern or not path_pattern.strip():
            return []

        safe_pattern = f"%{path_pattern.strip()}%"

        rows = (
            db.query(
                VaultChunk.id,
                VaultChunk.content,
                VaultChunk.heading_context,
                VaultFile.file_path,
            )
            .join(VaultFile, VaultChunk.vault_file_id == VaultFile.id)
            .filter(VaultFile.file_path.like(safe_pattern))
            .order_by(VaultFile.file_path, VaultChunk.chunk_index)
            .all()
        )

        return [
            {
                "chunk_id": row[0],
                "content": row[1],
                "heading_context": row[2] or "",
                "file_path": row[3],
            }
            for row in rows
        ]

    # ------------------------------------------------------------------
    # Keyword fallback
    # ------------------------------------------------------------------

    def _keyword_search(
        self, db: Session, query: str, top_k: int
    ) -> list[dict[str, Any]]:
        """Fallback search using SQL LIKE when embeddings are unavailable.

        For a single-word query, matches chunks containing that word.
        For multi-word queries, all words must appear in the chunk (AND logic).

        Returns results in the same format as search().
        """
        # Filter out common stop words for better keyword matching
        stop_words = {"a", "an", "the", "is", "are", "was", "were", "do", "does", "did",
                       "i", "me", "my", "you", "your", "who", "what", "how", "can",
                       "am", "be", "to", "of", "in", "on", "it", "and", "or", "not",
                       "about", "know", "tell", "have", "has", "this", "that"}
        words = [w.strip().lower() for w in query.strip().split() if w.strip().lower() not in stop_words and len(w.strip()) > 1]
        if not words:
            # If all words were stop words, just return all chunks
            words = [w.strip() for w in query.strip().split() if len(w.strip()) > 2]

        base_query = (
            db.query(
                VaultChunk.id,
                VaultChunk.content,
                VaultChunk.heading_context,
                VaultFile.file_path,
            )
            .join(VaultFile, VaultChunk.vault_file_id == VaultFile.id)
        )

        if not words:
            # No meaningful words -- return first top_k chunks
            pass
        elif len(words) == 1:
            # Single word: simple LIKE
            base_query = base_query.filter(VaultChunk.content.ilike(f"%{words[0]}%"))
        else:
            # OR logic: any word must appear (more lenient than AND)
            from sqlalchemy import or_
            base_query = base_query.filter(
                or_(*[VaultChunk.content.ilike(f"%{w}%") for w in words])
            )

        rows = base_query.limit(top_k).all()

        return [
            {
                "chunk_id": row[0],
                "content": row[1],
                "heading_context": row[2] or "",
                "file_path": row[3],
                "score": 0.0,  # no semantic score for keyword results
            }
            for row in rows
        ]
