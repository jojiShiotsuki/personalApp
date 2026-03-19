"""
Learning engine service for the Autoresearch cold email system.

Analyzes experiment data, identifies patterns via Claude, generates
actionable insights, and builds dynamic learning context that gets
appended to audit prompts to improve email quality over time.
"""

import json
import logging
import os
import re
from typing import Any, Optional

from anthropic import AsyncAnthropic
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.models.autoresearch import Experiment, Insight

logger = logging.getLogger(__name__)

INSIGHT_SYSTEM_PROMPT = (
    "You are a cold email performance analyst. Analyze these outreach experiment "
    "results and identify actionable patterns. Return JSON array of insights, each "
    "with: insight (string), confidence (high/medium/low based on sample size: "
    "50+=high, 20-49=medium, <20=low), sample_size (int), recommendation (string), "
    "applies_to (niche name or 'all_niches')."
)

MIN_EXPERIMENTS_FOR_CONTEXT = 20
REFRESH_THRESHOLD = 50


class LearningService:
    """Analyzes experiment data and generates insights to improve audit prompts."""

    def __init__(self) -> None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is not set")
        self.client = AsyncAnthropic(api_key=api_key)

    # ──────────────────────────────────────────
    # generate_insights
    # ──────────────────────────────────────────

    async def generate_insights(self, db: Session) -> list[dict[str, Any]]:
        """Analyze all experiment data, generate insights via Claude, store them."""

        summary = self._build_experiment_summary(db)
        if summary is None:
            logger.info("Not enough experiment data to generate insights")
            return []

        total_experiments = (
            db.query(func.count(Experiment.id))
            .filter(Experiment.status.in_(["sent", "replied", "no_reply"]))
            .scalar()
        ) or 0

        # Call Claude for insight generation
        model = os.getenv("AUTORESEARCH_LEARNING_MODEL", "claude-sonnet-4-20250514")

        try:
            response = await self.client.messages.create(
                model=model,
                max_tokens=2000,
                system=INSIGHT_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": summary}],
            )
        except Exception as api_err:
            logger.error("Claude API call failed during insight generation: %s", api_err, exc_info=True)
            return []

        # Extract text from response
        raw_text = ""
        for block in response.content:
            if hasattr(block, "text"):
                raw_text += block.text

        # Parse JSON array from response
        insights_data = self._parse_json_array(raw_text)
        if not insights_data:
            logger.warning("Failed to parse insights from Claude response")
            return []

        # Deactivate old active insights
        new_insight_ids: list[int] = []
        old_active = db.query(Insight).filter(Insight.is_active.is_(True)).all()

        # Store new Insight records
        for item in insights_data:
            new_insight = Insight(
                insight=item.get("insight", ""),
                confidence=item.get("confidence", "low"),
                sample_size=item.get("sample_size", 0),
                recommendation=item.get("recommendation"),
                applies_to=item.get("applies_to", "all_niches"),
                is_active=True,
                experiment_count_at_refresh=total_experiments,
            )
            db.add(new_insight)
            db.flush()
            new_insight_ids.append(new_insight.id)

        # Supersede old insights — point them to the first new insight
        if new_insight_ids and old_active:
            first_new_id = new_insight_ids[0]
            for old in old_active:
                old.is_active = False
                old.superseded_by = first_new_id

        db.commit()

        logger.info(
            "Generated %d new insights (superseded %d old), experiment count: %d",
            len(new_insight_ids),
            len(old_active),
            total_experiments,
        )

        return insights_data

    # ──────────────────────────────────────────
    # build_learning_context
    # ──────────────────────────────────────────

    def build_learning_context(self, db: Session, niche: str | None = None) -> str | None:
        """Build the <learning_context> block to append to audit prompts."""

        # Check minimum experiment threshold
        total_sent = (
            db.query(func.count(Experiment.id))
            .filter(Experiment.status.in_(["sent", "replied", "no_reply"]))
            .scalar()
        ) or 0

        if total_sent < MIN_EXPERIMENTS_FOR_CONTEXT:
            return None

        total_replied = (
            db.query(func.count(Experiment.id))
            .filter(Experiment.replied.is_(True))
            .scalar()
        ) or 0

        overall_rate = round((total_replied / total_sent) * 100, 1) if total_sent > 0 else 0.0

        # Reply rates by issue_type (directly from Experiment table)
        issue_stats = self._get_reply_rates_by_issue_type(db)

        # Split into top-performing and underperforming
        prioritize_lines: list[str] = []
        avoid_lines: list[str] = []

        for i, row in enumerate(issue_stats):
            issue, rate, count = row["issue_type"], row["reply_rate"], row["total"]
            line = f"{issue} — {rate}% reply rate (n={count})"
            if rate >= overall_rate and count >= 5:
                prioritize_lines.append(f"{len(prioritize_lines) + 1}. {line}")
            elif count >= 10:
                avoid_lines.append(f"- {line}")

        # Active insights (high/medium confidence)
        active_insights = (
            db.query(Insight)
            .filter(
                Insight.is_active.is_(True),
                Insight.confidence.in_(["high", "medium"]),
            )
            .all()
        )

        style_lines: list[str] = []
        for ins in active_insights:
            applies = ins.applies_to or "all_niches"
            if niche and applies != "all_niches" and applies.lower() != niche.lower():
                continue
            style_lines.append(f"- [{ins.confidence.upper()}] {ins.recommendation or ins.insight}")

        # Build the context block
        parts: list[str] = [
            "<learning_context>",
            f"Based on {total_sent} emails sent with {total_replied} replies ({overall_rate}% reply rate):",
            "",
        ]

        if prioritize_lines:
            parts.append("PRIORITIZE these issue types (by reply rate):")
            parts.extend(prioritize_lines)
            parts.append("")

        if avoid_lines:
            parts.append("AVOID leading with:")
            parts.extend(avoid_lines)
            parts.append("")

        # Niche-specific section
        if niche:
            niche_best = self._get_top_issue_for_niche(db, niche)
            if niche_best:
                parts.append(f"FOR THIS SPECIFIC NICHE ({niche}):")
                parts.append(
                    f"- Best performing: {niche_best['issue_type']} "
                    f"({niche_best['reply_rate']}% reply rate, n={niche_best['total']})"
                )
                parts.append("")

        if style_lines:
            parts.append("STYLE INSIGHTS:")
            parts.extend(style_lines)
            parts.append("")

        parts.append(
            "When multiple issues found on this site, lead with the "
            "highest-performing issue type from the list above."
        )
        parts.append("</learning_context>")

        return "\n".join(parts)

    # ──────────────────────────────────────────
    # should_refresh
    # ──────────────────────────────────────────

    def should_refresh(self, db: Session) -> bool:
        """Check if 50+ new experiments since last refresh."""

        current_count = (
            db.query(func.count(Experiment.id))
            .filter(Experiment.status.in_(["sent", "replied", "no_reply"]))
            .scalar()
        ) or 0

        # Get most recent insight's experiment_count_at_refresh
        latest_insight = (
            db.query(Insight)
            .filter(Insight.experiment_count_at_refresh.isnot(None))
            .order_by(Insight.created_at.desc())
            .first()
        )

        last_refresh_count = (
            latest_insight.experiment_count_at_refresh if latest_insight else 0
        )

        return current_count - last_refresh_count >= REFRESH_THRESHOLD

    # ──────────────────────────────────────────
    # Private helpers
    # ──────────────────────────────────────────

    def _build_experiment_summary(self, db: Session) -> Optional[str]:
        """
        Query aggregated experiment data and format as a text summary
        for Claude to analyze. Returns None if not enough data.
        """

        sent_statuses = ["sent", "replied", "no_reply"]

        total = (
            db.query(func.count(Experiment.id))
            .filter(Experiment.status.in_(sent_statuses))
            .scalar()
        ) or 0

        if total < MIN_EXPERIMENTS_FOR_CONTEXT:
            return None

        sections: list[str] = [
            f"OUTREACH EXPERIMENT DATA SUMMARY ({total} total experiments)\n",
        ]

        # 1. Reply rate by issue_type
        issue_type_stats = (
            db.query(
                Experiment.issue_type,
                func.count(Experiment.id).label("total"),
                func.sum(case((Experiment.replied.is_(True), 1), else_=0)).label("replied"),
            )
            .filter(
                Experiment.status.in_(sent_statuses),
                Experiment.issue_type.isnot(None),
            )
            .group_by(Experiment.issue_type)
            .order_by(func.count(Experiment.id).desc())
            .all()
        )

        if issue_type_stats:
            sections.append("REPLY RATE BY ISSUE TYPE:")
            for row in issue_type_stats:
                rate = round((row.replied / row.total) * 100, 1) if row.total else 0
                sections.append(f"  {row.issue_type}: {row.replied}/{row.total} replied ({rate}%)")
            sections.append("")

        # 2. Reply rate by niche
        niche_stats = (
            db.query(
                Experiment.niche,
                func.count(Experiment.id).label("total"),
                func.sum(case((Experiment.replied.is_(True), 1), else_=0)).label("replied"),
            )
            .filter(
                Experiment.status.in_(sent_statuses),
                Experiment.niche.isnot(None),
            )
            .group_by(Experiment.niche)
            .order_by(func.count(Experiment.id).desc())
            .all()
        )

        if niche_stats:
            sections.append("REPLY RATE BY NICHE:")
            for row in niche_stats:
                rate = round((row.replied / row.total) * 100, 1) if row.total else 0
                sections.append(f"  {row.niche}: {row.replied}/{row.total} replied ({rate}%)")
            sections.append("")

        # 3. Reply rate by day_of_week
        day_stats = (
            db.query(
                Experiment.day_of_week,
                func.count(Experiment.id).label("total"),
                func.sum(case((Experiment.replied.is_(True), 1), else_=0)).label("replied"),
            )
            .filter(
                Experiment.status.in_(sent_statuses),
                Experiment.day_of_week.isnot(None),
            )
            .group_by(Experiment.day_of_week)
            .order_by(func.count(Experiment.id).desc())
            .all()
        )

        if day_stats:
            sections.append("REPLY RATE BY DAY OF WEEK:")
            for row in day_stats:
                rate = round((row.replied / row.total) * 100, 1) if row.total else 0
                sections.append(f"  {row.day_of_week}: {row.replied}/{row.total} replied ({rate}%)")
            sections.append("")

        # 4. Average word count of replied vs non-replied
        replied_wc = (
            db.query(func.avg(Experiment.word_count))
            .filter(
                Experiment.status.in_(sent_statuses),
                Experiment.replied.is_(True),
                Experiment.word_count.isnot(None),
            )
            .scalar()
        )
        not_replied_wc = (
            db.query(func.avg(Experiment.word_count))
            .filter(
                Experiment.status.in_(sent_statuses),
                Experiment.replied.is_(False),
                Experiment.word_count.isnot(None),
            )
            .scalar()
        )

        sections.append("AVERAGE WORD COUNT:")
        sections.append(f"  Replied emails: {round(replied_wc, 1) if replied_wc else 'N/A'}")
        sections.append(f"  Non-replied emails: {round(not_replied_wc, 1) if not_replied_wc else 'N/A'}")
        sections.append("")

        # 5. Edited vs unedited reply rates
        edited_stats = (
            db.query(
                Experiment.was_edited,
                func.count(Experiment.id).label("total"),
                func.sum(case((Experiment.replied.is_(True), 1), else_=0)).label("replied"),
            )
            .filter(Experiment.status.in_(sent_statuses))
            .group_by(Experiment.was_edited)
            .all()
        )

        if edited_stats:
            sections.append("EDITED VS UNEDITED REPLY RATES:")
            for row in edited_stats:
                label = "Edited" if row.was_edited else "Unedited"
                rate = round((row.replied / row.total) * 100, 1) if row.total else 0
                sections.append(f"  {label}: {row.replied}/{row.total} replied ({rate}%)")
            sections.append("")

        # 6. Average response time by sentiment
        sentiment_stats = (
            db.query(
                Experiment.sentiment,
                func.count(Experiment.id).label("total"),
                func.avg(Experiment.response_time_minutes).label("avg_response_time"),
            )
            .filter(
                Experiment.replied.is_(True),
                Experiment.sentiment.isnot(None),
                Experiment.response_time_minutes.isnot(None),
            )
            .group_by(Experiment.sentiment)
            .all()
        )

        if sentiment_stats:
            sections.append("AVERAGE RESPONSE TIME BY SENTIMENT (minutes):")
            for row in sentiment_stats:
                avg_time = round(row.avg_response_time, 0) if row.avg_response_time else "N/A"
                sections.append(f"  {row.sentiment}: {avg_time} min avg (n={row.total})")
            sections.append("")

        return "\n".join(sections)

    def _get_reply_rates_by_issue_type(self, db: Session) -> list[dict[str, Any]]:
        """Get reply rates by issue_type, sorted by rate descending."""

        rows = (
            db.query(
                Experiment.issue_type,
                func.count(Experiment.id).label("total"),
                func.sum(case((Experiment.replied.is_(True), 1), else_=0)).label("replied"),
            )
            .filter(
                Experiment.status.in_(["sent", "replied", "no_reply"]),
                Experiment.issue_type.isnot(None),
            )
            .group_by(Experiment.issue_type)
            .having(func.count(Experiment.id) >= 3)
            .all()
        )

        results = []
        for row in rows:
            rate = round((row.replied / row.total) * 100, 1) if row.total else 0.0
            results.append({
                "issue_type": row.issue_type,
                "total": row.total,
                "replied": row.replied,
                "reply_rate": rate,
            })

        return sorted(results, key=lambda r: r["reply_rate"], reverse=True)

    def _get_top_issue_for_niche(self, db: Session, niche: str) -> Optional[dict[str, Any]]:
        """Get the best-performing issue_type for a specific niche."""

        rows = (
            db.query(
                Experiment.issue_type,
                func.count(Experiment.id).label("total"),
                func.sum(case((Experiment.replied.is_(True), 1), else_=0)).label("replied"),
            )
            .filter(
                Experiment.status.in_(["sent", "replied", "no_reply"]),
                Experiment.issue_type.isnot(None),
                func.lower(Experiment.niche) == niche.lower(),
            )
            .group_by(Experiment.issue_type)
            .having(func.count(Experiment.id) >= 2)
            .all()
        )

        if not rows:
            return None

        best = max(
            rows,
            key=lambda r: (r.replied / r.total) if r.total else 0,
        )

        rate = round((best.replied / best.total) * 100, 1) if best.total else 0.0
        return {
            "issue_type": best.issue_type,
            "total": best.total,
            "replied": best.replied,
            "reply_rate": rate,
        }

    @staticmethod
    def _parse_json_array(raw_text: str) -> list[dict[str, Any]]:
        """Parse a JSON array from Claude's response, handling markdown fences."""

        text = raw_text.strip()

        # Strip markdown code fences
        fence_pattern = re.compile(r"```(?:json)?\s*\n?(.*?)\n?\s*```", re.DOTALL)
        match = fence_pattern.search(text)
        if match:
            text = match.group(1).strip()

        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return parsed
            logger.warning("Claude returned JSON but not an array, wrapping it")
            return [parsed] if isinstance(parsed, dict) else []
        except json.JSONDecodeError as exc:
            logger.warning("Failed to parse Claude JSON response: %s", exc)
            logger.debug("Raw response text: %s", raw_text[:500])
            return []
