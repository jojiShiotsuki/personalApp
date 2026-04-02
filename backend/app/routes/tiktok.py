import json
import re
import logging
from datetime import datetime, timedelta
from collections import Counter, defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.database import get_db
from app.models.tiktok_video import TikTokVideo
from app.schemas.tiktok_video import (
    TikTokVideoResponse,
    ImportResult,
    TikTokSummaryResponse,
    TikTokPatternsResponse,
    VideoSummary,
    HashtagStat,
    DayStat,
    HourStat,
    SoundStat,
    DurationStat,
    CaptionLengthStat,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tiktok", tags=["tiktok"])

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

KNOWN_VIDEO_PATHS = [
    ["Activity", "Video Browsing History"],
    ["Video", "VideoList"],
    ["Activity", "Videos", "VideoList"],
    ["Your Videos", "VideoList"],
]


def _find_video_list(data: dict) -> tuple[list | None, str | None]:
    for path in KNOWN_VIDEO_PATHS:
        node = data
        for key in path:
            if isinstance(node, dict) and key in node:
                node = node[key]
            else:
                node = None
                break
        if isinstance(node, list) and len(node) > 0:
            return node, " > ".join(path)
    for key, value in data.items():
        if isinstance(value, list) and len(value) > 0 and isinstance(value[0], dict):
            return value, key
        if isinstance(value, dict):
            for sub_key, sub_value in value.items():
                if isinstance(sub_value, list) and len(sub_value) > 0 and isinstance(sub_value[0], dict):
                    return sub_value, f"{key} > {sub_key}"
    return None, None


def _parse_hashtags(caption: str | None) -> list[str]:
    if not caption:
        return []
    return list(set(re.findall(r"#(\w+)", caption)))


def _parse_create_time(entry: dict) -> datetime | None:
    raw = entry.get("Date") or entry.get("CreateTime") or entry.get("create_time") or entry.get("date")
    if not raw:
        return None
    if isinstance(raw, (int, float)):
        return datetime.utcfromtimestamp(raw)
    if isinstance(raw, str):
        for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"]:
            try:
                return datetime.strptime(raw, fmt)
            except ValueError:
                continue
    return None


def _extract_video_fields(entry: dict) -> dict:
    caption = entry.get("Desc") or entry.get("Description") or entry.get("desc") or entry.get("caption") or ""
    return {
        "tiktok_id": str(
            entry.get("VideoID") or entry.get("video_id") or entry.get("id") or entry.get("Link", "")
        ),
        "caption": caption,
        "hashtags": _parse_hashtags(caption),
        "create_time": _parse_create_time(entry),
        "views": int(entry.get("Views") or entry.get("view_count") or entry.get("Plays") or 0),
        "likes": int(entry.get("Likes") or entry.get("like_count") or entry.get("Diggs") or 0),
        "comments": int(entry.get("Comments") or entry.get("comment_count") or 0),
        "shares": int(entry.get("Shares") or entry.get("share_count") or 0),
        "saves": int(entry.get("Saves") or entry.get("save_count") or entry.get("Collects") or 0),
        "video_duration": int(entry.get("Duration") or entry.get("duration") or 0) or None,
        "sound_name": entry.get("Sound") or entry.get("sound_name") or entry.get("MusicTitle") or None,
        "raw_data": entry,
    }


@router.post("/import", response_model=ImportResult)
async def import_tiktok_data(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if file.content_type and file.content_type not in ("application/json", "text/plain", "application/octet-stream"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid content type: {file.content_type}. Expected JSON file.",
        )
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large ({len(contents)} bytes). Maximum is {MAX_FILE_SIZE} bytes (5MB).",
        )
    try:
        data = json.loads(contents)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid JSON: {str(e)}",
        )
    if not isinstance(data, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expected a JSON object at the top level.",
        )
    video_list, found_path = _find_video_list(data)
    if video_list is None:
        top_keys = list(data.keys())[:20]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not find video list in export. Top-level keys: {top_keys}. "
                   f"Tried paths: {[' > '.join(p) for p in KNOWN_VIDEO_PATHS]}",
        )
    logger.info(f"Found {len(video_list)} videos at path: {found_path}")
    imported = 0
    updated = 0
    skipped = 0
    errors = []
    for i, entry in enumerate(video_list):
        try:
            if not isinstance(entry, dict):
                skipped += 1
                continue
            fields = _extract_video_fields(entry)
            if not fields["tiktok_id"]:
                errors.append(f"Entry {i}: no video ID found")
                skipped += 1
                continue
            existing = db.query(TikTokVideo).filter(
                TikTokVideo.tiktok_id == fields["tiktok_id"]
            ).first()
            if existing:
                existing.views = fields["views"]
                existing.likes = fields["likes"]
                existing.comments = fields["comments"]
                existing.shares = fields["shares"]
                existing.saves = fields["saves"]
                existing.caption = fields["caption"]
                existing.hashtags = fields["hashtags"]
                existing.raw_data = fields["raw_data"]
                existing.imported_at = datetime.utcnow()
                updated += 1
            else:
                video = TikTokVideo(**fields, imported_at=datetime.utcnow())
                db.add(video)
                imported += 1
        except Exception as e:
            errors.append(f"Entry {i}: {str(e)}")
            skipped += 1
    db.commit()
    return ImportResult(
        imported=imported,
        updated=updated,
        skipped=skipped,
        errors=errors[:50],
        total=len(video_list),
    )
