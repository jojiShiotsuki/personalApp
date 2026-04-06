"""
Shared CTA + Proof variation pools for cold email generation.

Both the Step 1 generator (autoresearch.py) and the audit-based email
generator (audit_service.py) import from here so they share the same
rotation, tracking, and learning logic.

Every variation must reference a barbershop + concrete outcome + timeframe.
Python randomly selects one per generation to guarantee even rotation.
Once 100+ sends per variation exist per niche, selection weights toward
winners using the 70/20/10 rule.
"""
import random
from typing import Any

from sqlalchemy import func as sqlfunc, Integer as SAInteger
from sqlalchemy.orm import Session


# ──────────────────────────────────────────────
# Pools
# ──────────────────────────────────────────────

PROOF_POOL: list[dict[str, str]] = [
    {
        "id": "barbershop-ranking-1",
        "text": "I got a barbershop ranking #1 on Google and showing up in AI search within 3 months. Their phone went from quiet to fully booked.",
    },
    {
        "id": "barbershop-zero-to-booked",
        "text": "I took a barbershop from zero Google presence to fully booked in 3 months.",
    },
    {
        "id": "barbershop-tripled-bookings",
        "text": "I got a barbershop to the top of Google in 90 days and their bookings tripled.",
    },
    {
        "id": "barbershop-phone-ringing",
        "text": "I help businesses get found on Google so their phone rings. Got a barbershop to #1 in 3 months.",
    },
    {
        "id": "barbershop-invisible-to-1",
        "text": "A barbershop I worked with went from invisible on Google to ranked #1 in 3 months. Now they're fully booked.",
    },
]

CTA_POOL: list[dict[str, str]] = [
    {
        "id": "walkthrough-video",
        "text": "Want me to send through a quick 3-minute walkthrough of what I found? Free, no pitch.",
    },
    {
        "id": "written-fix-list",
        "text": "Want me to shoot you the 3 things I'd fix first? Free.",
    },
    {
        "id": "mockup-preview",
        "text": "Want me to mock up a quick before-and-after? No cost.",
    },
    {
        "id": "keyword-ranking-preview",
        "text": "Want me to show you what searches you're missing in your area? Free.",
    },
    {
        "id": "competitor-comparison",
        "text": "Want me to send through what your top 2 competitors are doing that you're not?",
    },
    {
        "id": "audit-screenshot",
        "text": "Want me to send a screenshot of what I found?",
    },
    {
        "id": "free-sample-fix",
        "text": "Want me to fix the top one for free as a sample?",
    },
    {
        "id": "curiosity-hook",
        "text": "Want me to show you the one thing that'd move the needle most?",
    },
    {
        "id": "soft-question",
        "text": "Worth a look if you're open to it?",
    },
    {
        "id": "value-drop",
        "text": "Happy to send through the list either way if you're curious.",
    },
]


# Selection thresholds
MIN_SENDS_FOR_WEIGHTED = 100  # Need at least this many sends per variation before weighting kicks in
MIN_VARIATIONS_WITH_DATA = 2  # Need at least this many variations with data before weighting


# ──────────────────────────────────────────────
# Selection logic
# ──────────────────────────────────────────────

def select_proof_variation(db: Session, niche: str | None = None) -> dict[str, str]:
    """Select a proof variation from the pool.

    Uses 70/20/10 weighted selection once enough send data exists:
    - 70% winners (top performers by reply rate)
    - 20% runners-up
    - 10% experiments (any variation, including new ones)

    Before that threshold: uniform random selection for even data collection.
    """
    from app.models.autoresearch import Experiment

    try:
        query = db.query(
            Experiment.proof_angle.label("angle_id"),
            sqlfunc.count(Experiment.id).label("total"),
            sqlfunc.sum(sqlfunc.cast(Experiment.replied, SAInteger)).label("replies"),
        ).filter(
            Experiment.proof_angle.isnot(None),
            Experiment.sent_at.isnot(None),
        )
        if niche:
            query = query.filter(Experiment.niche == niche)
        stats = query.group_by(Experiment.proof_angle).all()

        max_sends = max((s.total for s in stats), default=0)
        if max_sends < MIN_SENDS_FOR_WEIGHTED or len(stats) < MIN_VARIATIONS_WITH_DATA:
            return random.choice(PROOF_POOL)

        return _weighted_pick(PROOF_POOL, stats)
    except Exception:
        return random.choice(PROOF_POOL)


def select_cta_variation(db: Session, niche: str | None = None) -> dict[str, str]:
    """Select a CTA variation from the pool with 70/20/10 weighting once data exists."""
    from app.models.autoresearch import Experiment

    try:
        query = db.query(
            Experiment.cta_angle.label("angle_id"),
            sqlfunc.count(Experiment.id).label("total"),
            sqlfunc.sum(sqlfunc.cast(Experiment.replied, SAInteger)).label("replies"),
        ).filter(
            Experiment.cta_angle.isnot(None),
            Experiment.sent_at.isnot(None),
        )
        if niche:
            query = query.filter(Experiment.niche == niche)
        stats = query.group_by(Experiment.cta_angle).all()

        max_sends = max((s.total for s in stats), default=0)
        if max_sends < MIN_SENDS_FOR_WEIGHTED or len(stats) < MIN_VARIATIONS_WITH_DATA:
            return random.choice(CTA_POOL)

        return _weighted_pick(CTA_POOL, stats)
    except Exception:
        return random.choice(CTA_POOL)


def _weighted_pick(pool: list[dict[str, str]], stats: list[Any]) -> dict[str, str]:
    """70/20/10 weighted selection: 70% winners, 20% runners-up, 10% experiments."""
    rates: dict[str, float] = {}
    for s in stats:
        total = getattr(s, "total", 0) or 0
        if total > 0:
            angle_id = getattr(s, "angle_id", None)
            if angle_id:
                rates[angle_id] = (getattr(s, "replies", 0) or 0) / total

    sorted_pool = sorted(pool, key=lambda v: rates.get(v["id"], -1.0), reverse=True)
    n = len(sorted_pool)
    winners = sorted_pool[: max(1, n // 3)]
    runners = sorted_pool[max(1, n // 3) : max(2, 2 * n // 3)]

    roll = random.random()
    if roll < 0.70:
        return random.choice(winners)
    elif roll < 0.90:
        return random.choice(runners) if runners else random.choice(winners)
    else:
        return random.choice(sorted_pool)
