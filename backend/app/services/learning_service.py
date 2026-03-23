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

from app.models.autoresearch import AuditResult, Experiment, Insight
from app.models.outreach import OutreachProspect

logger = logging.getLogger(__name__)

INSIGHT_SYSTEM_PROMPT = (
    "You are a cold outreach performance analyst. Analyze these outreach experiment "
    "results and identify actionable patterns. Include ALL of:\n"
    "1. Strategic insights (which issue types, niches, timing work best)\n"
    "2. Writing STYLE insights (word count, tone, punctuation, phrasing patterns "
    "that differ between successful and unsuccessful emails, and patterns from "
    "user edits showing what the user prefers)\n"
    "3. Loom VIDEO SCRIPT insights (what script styles, lengths, structures, and "
    "talking points correlate with replies/conversions. Compare scripts from Loom "
    "steps that got replies vs those that didn't. Look at how specific vs generic "
    "the scripts are, how they reference the audit issue, and CTA phrasing.)\n"
    "4. REJECTION insights — if audit rejection data is provided, identify which "
    "niches, business types, or patterns the user keeps rejecting as not_target_audience "
    "or for other reasons. Generate recommendations like 'SKIP businesses in the X niche' "
    "or 'do NOT audit companies that appear to be Y'. These are critical for the AI "
    "auditor to avoid wasting time on prospects the user will reject.\n\n"
    "For style insights, be SPECIFIC: instead of 'keep it short', say "
    "'keep under 65 words — replied emails averaged 62 vs 74 for non-replied'. "
    "Instead of 'be specific', say 'use exact numbers and quotes from the site "
    "(e.g. 07 4124 799 not just a wrong phone number)'. "
    "If the user consistently removes em dashes, say 'do NOT use em dashes'.\n\n"
    "For Loom script insights, be equally specific: 'Loom scripts under 120 words "
    "had 25% reply rate vs 10% for longer ones' or 'scripts that opened the website "
    "within the first 10 seconds correlated with more replies'.\n\n"
    "Return JSON array of insights, each with: insight (string), "
    "confidence (high/medium/low based on sample size: 50+=high, 20-49=medium, <20=low), "
    "sample_size (int), recommendation (string — this gets injected into the audit prompt "
    "and Loom script generator, so write it as a direct instruction to the AI), "
    "applies_to (niche name or 'all_niches')."
)

MIN_EXPERIMENTS_FOR_CONTEXT = 10
REFRESH_THRESHOLD = 10  # Daily refresh, lower threshold


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
        """Analyze experiment data and rejection patterns, generate insights via Claude."""

        summary_parts: list[str] = []

        # Source 1: Experiment performance data (if enough exists)
        experiment_summary = self._build_experiment_summary(db)
        if experiment_summary:
            summary_parts.append(experiment_summary)

        # Source 2: Rejection patterns (always included)
        rejection_summary = self._build_rejection_summary(db)
        if rejection_summary:
            summary_parts.append(rejection_summary)

        if not summary_parts:
            logger.info("No experiment or rejection data to generate insights from")
            return []

        summary = "\n\n".join(summary_parts)

        total_experiments = (
            db.query(func.count(Experiment.id))
            .filter(Experiment.status.in_(["sent", "replied", "no_reply"]))
            .scalar()
        ) or 0

        # Call Claude for insight generation
        model = os.getenv("AUTORESEARCH_LEARNING_MODEL", "claude-sonnet-4-6")

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
        """Build the <learning_context> block to append to audit prompts.

        Sources two independent signals:
        1. Experiment performance data (requires MIN_EXPERIMENTS_FOR_CONTEXT sent emails)
        2. Audit rejection patterns (always included when rejections exist)

        Returns context whenever EITHER source has data.
        """

        parts: list[str] = ["<learning_context>"]
        has_content = False

        # ── Source 1: Rejection patterns (always active) ──
        rejection_context = self._build_rejection_context(db, niche)
        if rejection_context:
            parts.extend(rejection_context)
            has_content = True

        # ── Source 2: Experiment performance data ──
        total_sent = (
            db.query(func.count(Experiment.id))
            .filter(Experiment.status.in_(["sent", "replied", "no_reply"]))
            .scalar()
        ) or 0

        if total_sent >= MIN_EXPERIMENTS_FOR_CONTEXT:
            total_replied = (
                db.query(func.count(Experiment.id))
                .filter(Experiment.replied.is_(True))
                .scalar()
            ) or 0

            overall_rate = round((total_replied / total_sent) * 100, 1) if total_sent > 0 else 0.0

            parts.append(f"Based on {total_sent} emails sent with {total_replied} replies ({overall_rate}% reply rate):")
            parts.append("")

            # Reply rates by issue_type
            issue_stats = self._get_reply_rates_by_issue_type(db)
            prioritize_lines: list[str] = []
            avoid_lines: list[str] = []

            for row in issue_stats:
                issue, rate, count = row["issue_type"], row["reply_rate"], row["total"]
                line = f"{issue} — {rate}% reply rate (n={count})"
                if rate >= overall_rate and count >= 5:
                    prioritize_lines.append(f"{len(prioritize_lines) + 1}. {line}")
                elif count >= 10:
                    avoid_lines.append(f"- {line}")

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

            # Step performance section
            step_stats = (
                db.query(
                    Experiment.step_number,
                    func.count(Experiment.id).label("total"),
                    func.sum(case((Experiment.replied.is_(True), 1), else_=0)).label("replied"),
                )
                .filter(
                    Experiment.status.in_(["sent", "replied", "no_reply"]),
                    Experiment.step_number.isnot(None),
                )
                .group_by(Experiment.step_number)
                .order_by(Experiment.step_number)
                .all()
            )
            if step_stats and len(step_stats) > 1:
                parts.append("SEQUENCE STEP PERFORMANCE:")
                for row in step_stats:
                    rate = round((row.replied / row.total) * 100, 1) if row.total else 0.0
                    parts.append(f"- Step {row.step_number}: {rate}% reply rate (n={row.total})")
                parts.append("")

            has_content = True

        # ── Active insights (always check) ──
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

        if style_lines:
            parts.append("STYLE INSIGHTS:")
            parts.extend(style_lines)
            parts.append("")
            has_content = True

        if not has_content:
            return None

        if total_sent >= MIN_EXPERIMENTS_FOR_CONTEXT:
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
    # Rejection summaries (for insight generation)
    # ──────────────────────────────────────────

    def _build_rejection_summary(self, db: Session) -> Optional[str]:
        """Build a text summary of rejection patterns for Claude to analyze.

        This feeds into generate_insights() so Claude can produce
        actionable insights from rejection data (separate from the
        _build_rejection_context which feeds directly into audit prompts).
        """

        total_rejections = (
            db.query(func.count(AuditResult.id))
            .filter(AuditResult.status == "rejected")
            .scalar()
        ) or 0

        if total_rejections == 0:
            return None

        sections: list[str] = [
            f"AUDIT REJECTION DATA ({total_rejections} total rejections)\n",
            "The user reviewed AI-generated audits and rejected them. "
            "Analyze these patterns to generate insights that prevent the AI "
            "from making the same mistakes.\n",
        ]

        # Rejection counts by category
        category_stats = (
            db.query(
                AuditResult.rejection_category,
                func.count(AuditResult.id).label("count"),
            )
            .filter(
                AuditResult.status == "rejected",
                AuditResult.rejection_category.isnot(None),
            )
            .group_by(AuditResult.rejection_category)
            .order_by(func.count(AuditResult.id).desc())
            .all()
        )

        if category_stats:
            sections.append("REJECTION COUNTS BY CATEGORY:")
            for row in category_stats:
                sections.append(f"  {row.rejection_category}: {row.count}")
            sections.append("")

        # Detailed rejection data with prospect info
        rejection_details = (
            db.query(
                AuditResult.rejection_category,
                AuditResult.rejection_reason,
                AuditResult.issue_type,
                OutreachProspect.agency_name,
                OutreachProspect.niche,
            )
            .join(OutreachProspect, AuditResult.prospect_id == OutreachProspect.id)
            .filter(AuditResult.status == "rejected")
            .order_by(AuditResult.created_at.desc())
            .limit(50)
            .all()
        )

        if rejection_details:
            sections.append("DETAILED REJECTIONS (most recent first):")
            for row in rejection_details:
                parts = [f"  Category: {row.rejection_category}"]
                if row.agency_name:
                    parts.append(f"Company: {row.agency_name}")
                if row.niche:
                    parts.append(f"Niche: {row.niche}")
                if row.issue_type:
                    parts.append(f"Issue flagged: {row.issue_type}")
                if row.rejection_reason:
                    parts.append(f"Reason: {row.rejection_reason}")
                sections.append(" | ".join(parts))
            sections.append("")

        # Niche-level rejection patterns
        niche_rejections = (
            db.query(
                OutreachProspect.niche,
                func.count(AuditResult.id).label("count"),
            )
            .join(OutreachProspect, AuditResult.prospect_id == OutreachProspect.id)
            .filter(
                AuditResult.status == "rejected",
                AuditResult.rejection_category == "not_target_audience",
                OutreachProspect.niche.isnot(None),
            )
            .group_by(OutreachProspect.niche)
            .order_by(func.count(AuditResult.id).desc())
            .all()
        )

        if niche_rejections:
            sections.append("NICHES REJECTED AS NOT TARGET AUDIENCE:")
            for row in niche_rejections:
                sections.append(f"  {row.niche}: {row.count}x rejected")
            sections.append("")

        sections.append(
            "IMPORTANT: Generate insights that instruct the AI auditor to SKIP "
            "these types of businesses and niches. Each recommendation should be "
            "a direct instruction like 'SKIP businesses in the X niche — user "
            "rejected N prospects in this category'."
        )

        return "\n".join(sections)

    # ──────────────────────────────────────────
    # Rejection context (for audit prompts)
    # ──────────────────────────────────────────

    def _build_rejection_context(self, db: Session, niche: str | None = None) -> list[str]:
        """Build rejection-based learning lines from audit rejections.

        Extracts patterns from rejected audits so the AI avoids repeating
        the same mistakes: wrong niches, wrong business types, etc.
        """
        lines: list[str] = []

        # 1. Rejection counts by category
        rejection_stats = (
            db.query(
                AuditResult.rejection_category,
                func.count(AuditResult.id).label("count"),
            )
            .filter(
                AuditResult.status == "rejected",
                AuditResult.rejection_category.isnot(None),
            )
            .group_by(AuditResult.rejection_category)
            .order_by(func.count(AuditResult.id).desc())
            .all()
        )

        if not rejection_stats:
            return lines

        total_rejections = sum(r.count for r in rejection_stats)
        lines.append(f"AUDIT REJECTION HISTORY ({total_rejections} total rejections):")
        lines.append("The user has reviewed AI audit results and rejected these. Learn from these mistakes:")
        lines.append("")

        for row in rejection_stats:
            lines.append(f"- {row.rejection_category}: {row.count} rejections")
        lines.append("")

        # 2. not_target_audience: extract specific rejected companies, niches, and reasons
        not_target_details = (
            db.query(
                OutreachProspect.agency_name,
                OutreachProspect.niche,
                AuditResult.rejection_reason,
                AuditResult.issue_type,
            )
            .join(OutreachProspect, AuditResult.prospect_id == OutreachProspect.id)
            .filter(
                AuditResult.status == "rejected",
                AuditResult.rejection_category == "not_target_audience",
            )
            .order_by(AuditResult.created_at.desc())
            .limit(30)
            .all()
        )

        if not_target_details:
            lines.append("REJECTED AS NOT TARGET AUDIENCE — DO NOT audit similar businesses:")

            # Extract rejected niches pattern
            rejected_niches: dict[str, int] = {}
            rejected_names: list[str] = []
            rejected_reasons: list[str] = []
            for row in not_target_details:
                if row.niche:
                    key = row.niche.lower().strip()
                    rejected_niches[key] = rejected_niches.get(key, 0) + 1
                if row.agency_name:
                    rejected_names.append(row.agency_name)
                if row.rejection_reason and row.rejection_reason not in rejected_reasons:
                    rejected_reasons.append(row.rejection_reason)

            if rejected_niches:
                lines.append("  Rejected niches (these are NOT target audience):")
                for niche_name, count in sorted(rejected_niches.items(), key=lambda x: -x[1]):
                    lines.append(f"    - {niche_name}: {count}x rejected")

            if rejected_names:
                lines.append(f"  Specific rejected companies: {', '.join(rejected_names[:15])}")

            if rejected_reasons:
                lines.append("  User's rejection reasons:")
                for reason in rejected_reasons[:10]:
                    lines.append(f"    - \"{reason}\"")

            lines.append("")
            lines.append(
                "IMPORTANT: If the prospect being audited matches any rejected niche or "
                "company pattern above, return site_quality=\"not_target\" immediately."
            )
            lines.append("")

        # 3. Other rejection categories with details
        other_rejections = (
            db.query(
                AuditResult.rejection_category,
                AuditResult.rejection_reason,
                AuditResult.issue_type,
                OutreachProspect.agency_name,
            )
            .join(OutreachProspect, AuditResult.prospect_id == OutreachProspect.id)
            .filter(
                AuditResult.status == "rejected",
                AuditResult.rejection_category.isnot(None),
                AuditResult.rejection_category != "not_target_audience",
            )
            .order_by(AuditResult.created_at.desc())
            .limit(20)
            .all()
        )

        if other_rejections:
            # Group by category
            by_category: dict[str, list[str]] = {}
            for row in other_rejections:
                cat = row.rejection_category
                if cat not in by_category:
                    by_category[cat] = []
                detail = row.rejection_reason or row.issue_type or "no reason given"
                by_category[cat].append(f"{row.agency_name}: {detail}")

            lines.append("OTHER REJECTION PATTERNS — avoid these mistakes:")
            for cat, details in by_category.items():
                lines.append(f"  {cat}:")
                for d in details[:5]:
                    lines.append(f"    - {d}")
            lines.append("")

        return lines

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

        # 3. Reply rate by step_number (CRITICAL for sequence optimization)
        step_stats = (
            db.query(
                Experiment.step_number,
                func.count(Experiment.id).label("total"),
                func.sum(case((Experiment.replied.is_(True), 1), else_=0)).label("replied"),
            )
            .filter(
                Experiment.status.in_(sent_statuses),
                Experiment.step_number.isnot(None),
            )
            .group_by(Experiment.step_number)
            .order_by(Experiment.step_number)
            .all()
        )

        if step_stats:
            sections.append("REPLY RATE BY SEQUENCE STEP:")
            for row in step_stats:
                rate = round((row.replied / row.total) * 100, 1) if row.total else 0
                sections.append(f"  Step {row.step_number}: {row.replied}/{row.total} replied ({rate}%)")
            sections.append("")

        # 4. Reply rate by day_of_week
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

        # 5. Reply rate by TIME OF DAY (hour buckets)
        hour_stats = (
            db.query(
                Experiment.sent_hour,
                func.count(Experiment.id).label("total"),
                func.sum(case((Experiment.replied.is_(True), 1), else_=0)).label("replied"),
            )
            .filter(
                Experiment.status.in_(sent_statuses),
                Experiment.sent_hour.isnot(None),
            )
            .group_by(Experiment.sent_hour)
            .order_by(Experiment.sent_hour)
            .all()
        )

        if hour_stats:
            sections.append("REPLY RATE BY TIME OF DAY (hour sent):")
            for row in hour_stats:
                rate = round((row.replied / row.total) * 100, 1) if row.total else 0
                hour_label = f"{row.sent_hour:02d}:00"
                sections.append(f"  {hour_label}: {row.replied}/{row.total} replied ({rate}%)")
            sections.append("")

        # 6. Reply rate by FOLLOW-UP DELAY (days between steps)
        delay_stats = (
            db.query(
                Experiment.step_delay_days,
                func.count(Experiment.id).label("total"),
                func.sum(case((Experiment.replied.is_(True), 1), else_=0)).label("replied"),
            )
            .filter(
                Experiment.status.in_(sent_statuses),
                Experiment.step_delay_days.isnot(None),
                Experiment.step_number > 1,
            )
            .group_by(Experiment.step_delay_days)
            .order_by(Experiment.step_delay_days)
            .all()
        )

        if delay_stats:
            sections.append("REPLY RATE BY FOLLOW-UP DELAY (days between steps):")
            for row in delay_stats:
                rate = round((row.replied / row.total) * 100, 1) if row.total else 0
                sections.append(f"  {row.step_delay_days} day delay: {row.replied}/{row.total} replied ({rate}%)")
            sections.append("")

        # 7. Revenue attribution by issue type
        revenue_stats = (
            db.query(
                Experiment.issue_type,
                func.count(Experiment.id).label("total_converted"),
                func.sum(Experiment.deal_value).label("total_revenue"),
            )
            .filter(
                Experiment.converted_to_client.is_(True),
                Experiment.issue_type.isnot(None),
            )
            .group_by(Experiment.issue_type)
            .all()
        )

        if revenue_stats:
            sections.append("REVENUE BY ISSUE TYPE (from converted clients):")
            for row in revenue_stats:
                rev = round(row.total_revenue, 2) if row.total_revenue else 0
                sections.append(f"  {row.issue_type}: {row.total_converted} conversions, ${rev} total revenue")
            sections.append("")

        # 8. Audit rejection patterns (what the AI gets wrong)
        from app.models.autoresearch import AuditResult
        rejection_stats = (
            db.query(
                AuditResult.rejection_category,
                func.count(AuditResult.id).label("count"),
            )
            .filter(
                AuditResult.status == "rejected",
                AuditResult.rejection_category.isnot(None),
            )
            .group_by(AuditResult.rejection_category)
            .order_by(func.count(AuditResult.id).desc())
            .all()
        )

        if rejection_stats:
            sections.append("AUDIT REJECTION PATTERNS (what the AI gets wrong — AVOID these):")
            for row in rejection_stats:
                sections.append(f"  {row.rejection_category}: {row.count} rejections")
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

        # 7. Style patterns from ALL sent messages (emails + LinkedIn)
        all_sent = (
            db.query(Experiment.body, Experiment.subject, Experiment.word_count, Experiment.step_number, Experiment.replied, Experiment.was_edited)
            .filter(
                Experiment.status.in_(sent_statuses),
                Experiment.body.isnot(None),
            )
            .order_by(Experiment.created_at.desc())
            .limit(100)
            .all()
        )

        # Split by outcome and type
        step1_replied = [r for r in all_sent if r.replied and (r.step_number or 1) == 1]
        followup_replied = [r for r in all_sent if r.replied and (r.step_number or 1) > 1]
        not_replied = [r for r in all_sent if not r.replied]
        user_edited = [r for r in all_sent if r.was_edited]

        if step1_replied:
            sections.append("SUCCESSFUL STEP 1 EMAILS (initial audit emails that got replies):")
            for i, row in enumerate(step1_replied[:5]):
                sections.append(f"  Email {i+1} (subject: {row.subject}, {row.word_count} words):")
                sections.append(f"  {row.body[:300]}")
                sections.append("")

        if followup_replied:
            sections.append("SUCCESSFUL FOLLOW-UP MESSAGES (steps 2+ that got replies — learn what works):")
            for i, row in enumerate(followup_replied[:5]):
                sections.append(f"  Step {row.step_number} (subject: {row.subject}, {row.word_count} words):")
                sections.append(f"  {row.body[:300]}")
                sections.append("")

        if user_edited:
            sections.append("USER-EDITED MESSAGES (the user changed the AI draft — THIS IS THEIR PREFERRED STYLE):")
            for i, row in enumerate(user_edited[:10]):
                sections.append(f"  Step {row.step_number or 1} ({row.word_count} words, {'replied' if row.replied else 'no reply'}):")
                sections.append(f"  {row.body[:300]}")
                sections.append("")

        if not_replied:
            sections.append("SAMPLE UNSUCCESSFUL MESSAGES (no reply — what's different?):")
            for i, row in enumerate(not_replied[:5]):
                sections.append(f"  Step {row.step_number or 1} ({row.word_count} words):")
                sections.append(f"  {row.body[:300]}")
                sections.append("")

        # 8. Edit patterns — what does the user change?
        from app.models.autoresearch import AuditResult
        edited_audits = (
            db.query(
                AuditResult.generated_body,
                AuditResult.edited_body,
                AuditResult.generated_subject,
                AuditResult.edited_subject,
            )
            .filter(
                AuditResult.was_edited.is_(True),
                AuditResult.edited_body.isnot(None),
            )
            .limit(20)
            .all()
        )

        if edited_audits:
            sections.append("USER EDITS (the user changed the AI draft — learn from these corrections):")
            for i, row in enumerate(edited_audits[:10]):
                sections.append(f"  Edit {i+1}:")
                if row.generated_subject != row.edited_subject:
                    sections.append(f"    Subject BEFORE: {row.generated_subject}")
                    sections.append(f"    Subject AFTER:  {row.edited_subject}")
                if row.generated_body and row.edited_body:
                    sections.append(f"    Body BEFORE (first 200 chars): {row.generated_body[:200]}")
                    sections.append(f"    Body AFTER  (first 200 chars): {row.edited_body[:200]}")
                sections.append("")

        # 9. Loom video correlation
        loom_stats = (
            db.query(
                func.count(Experiment.id).label("total_loom_sent"),
                func.sum(case((Experiment.loom_watched.is_(True), 1), else_=0)).label("watched"),
                func.sum(case((Experiment.replied.is_(True), 1), else_=0)).label("replied_after_loom"),
            )
            .filter(Experiment.loom_sent.is_(True))
            .first()
        )

        if loom_stats and loom_stats.total_loom_sent and loom_stats.total_loom_sent > 0:
            sections.append("LOOM VIDEO STATS:")
            sections.append(f"  Total Loom videos sent: {loom_stats.total_loom_sent}")
            sections.append(f"  Watched: {loom_stats.watched or 0}")
            sections.append(f"  Replied after Loom: {loom_stats.replied_after_loom or 0}")
            watch_rate = round(((loom_stats.watched or 0) / loom_stats.total_loom_sent) * 100, 1)
            reply_rate = round(((loom_stats.replied_after_loom or 0) / loom_stats.total_loom_sent) * 100, 1)
            sections.append(f"  Watch rate: {watch_rate}%")
            sections.append(f"  Reply rate (Loom recipients): {reply_rate}%")
            sections.append("")

        # 9b. Loom SCRIPT analysis — compare scripts that led to replies vs not
        loom_scripts_replied = (
            db.query(Experiment.loom_script, Experiment.issue_type, Experiment.niche, Experiment.company)
            .filter(
                Experiment.loom_script.isnot(None),
                Experiment.loom_script != "",
                Experiment.replied.is_(True),
            )
            .order_by(Experiment.created_at.desc())
            .limit(10)
            .all()
        )
        loom_scripts_no_reply = (
            db.query(Experiment.loom_script, Experiment.issue_type, Experiment.niche, Experiment.company)
            .filter(
                Experiment.loom_script.isnot(None),
                Experiment.loom_script != "",
                Experiment.replied.is_(False),
                Experiment.status.in_(["sent", "no_reply"]),
            )
            .order_by(Experiment.created_at.desc())
            .limit(10)
            .all()
        )

        if loom_scripts_replied:
            sections.append("SUCCESSFUL LOOM SCRIPTS (prospect replied after receiving Loom video):")
            for i, row in enumerate(loom_scripts_replied[:5]):
                wc = len((row.loom_script or "").split())
                sections.append(f"  Script {i+1} ({row.issue_type or 'unknown'}, {row.niche or 'unknown'}, {wc} words):")
                sections.append(f"  {row.loom_script[:400]}")
                sections.append("")

        if loom_scripts_no_reply:
            sections.append("UNSUCCESSFUL LOOM SCRIPTS (no reply after Loom video — what's different?):")
            for i, row in enumerate(loom_scripts_no_reply[:5]):
                wc = len((row.loom_script or "").split())
                sections.append(f"  Script {i+1} ({row.issue_type or 'unknown'}, {row.niche or 'unknown'}, {wc} words):")
                sections.append(f"  {row.loom_script[:400]}")
                sections.append("")

        # 10. LinkedIn acceptance patterns
        linkedin_stats = (
            db.query(
                Experiment.issue_type,
                func.count(Experiment.id).label("total"),
                func.sum(case((Experiment.category == "linkedin_accepted", 1), else_=0)).label("accepted"),
            )
            .filter(
                Experiment.category == "linkedin_accepted",
                Experiment.issue_type.isnot(None),
            )
            .group_by(Experiment.issue_type)
            .all()
        )

        if linkedin_stats:
            sections.append("LINKEDIN ACCEPTANCE BY ISSUE TYPE (which audit angles lead to LinkedIn accepts):")
            for row in linkedin_stats:
                sections.append(f"  {row.issue_type}: {row.accepted}/{row.total} accepted")
            sections.append("")

        sections.append(
            "IMPORTANT: Analyze the WRITING STYLE differences between successful and "
            "unsuccessful emails. Look for: sentence length, use of specific numbers/quotes, "
            "punctuation patterns (em dashes, exclamation marks), tone (casual vs formal), "
            "how the problem is framed, and what the user consistently edits out or adds. "
            "Include style insights in your response."
        )

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
