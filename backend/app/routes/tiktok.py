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


# ---------------------------------------------------------------------------
# Serialization helper
# ---------------------------------------------------------------------------

def _video_to_dict(video: TikTokVideo) -> dict:
    """Convert TikTokVideo model to dict with computed engagement_rate."""
    return {
        "id": video.id,
        "tiktok_id": video.tiktok_id,
        "caption": video.caption,
        "hashtags": video.hashtags or [],
        "create_time": video.create_time.isoformat() if video.create_time else None,
        "views": video.views,
        "likes": video.likes,
        "comments": video.comments,
        "shares": video.shares,
        "saves": video.saves,
        "engagement_rate": video.engagement_rate,
        "video_duration": video.video_duration,
        "sound_name": video.sound_name,
        "imported_at": video.imported_at.isoformat() if video.imported_at else None,
        "social_content_id": video.social_content_id,
    }


# ---------------------------------------------------------------------------
# Summary / Patterns / Top-performers  (MUST be before /videos/{video_id})
# ---------------------------------------------------------------------------

@router.get("/summary")
def get_summary(db: Session = Depends(get_db)):
    videos = db.query(TikTokVideo).all()
    if not videos:
        return {
            "total_videos": 0, "total_views": 0, "total_likes": 0,
            "total_comments": 0, "total_shares": 0, "total_saves": 0,
            "avg_views_per_video": 0, "avg_engagement_rate": 0,
            "best_video": None, "lowest_views_video": None, "date_range": None,
        }
    total_views = sum(v.views for v in videos)
    total_likes = sum(v.likes for v in videos)
    total_comments = sum(v.comments for v in videos)
    total_shares = sum(v.shares for v in videos)
    total_saves = sum(v.saves for v in videos)
    avg_views = total_views / len(videos) if videos else 0
    avg_engagement = sum(v.engagement_rate for v in videos) / len(videos) if videos else 0
    best = max(videos, key=lambda v: v.views)
    cutoff = datetime.utcnow() - timedelta(days=7)
    eligible = [v for v in videos if v.create_time and v.create_time < cutoff]
    lowest = min(eligible, key=lambda v: v.views) if eligible else None
    dates = [v.create_time for v in videos if v.create_time]
    return {
        "total_videos": len(videos),
        "total_views": total_views,
        "total_likes": total_likes,
        "total_comments": total_comments,
        "total_shares": total_shares,
        "total_saves": total_saves,
        "avg_views_per_video": round(avg_views, 1),
        "avg_engagement_rate": round(avg_engagement, 4),
        "best_video": {"id": best.id, "caption": best.caption, "views": best.views},
        "lowest_views_video": {"id": lowest.id, "caption": lowest.caption, "views": lowest.views} if lowest else None,
        "date_range": {
            "earliest": min(dates).isoformat() if dates else None,
            "latest": max(dates).isoformat() if dates else None,
        },
    }


@router.get("/patterns")
def get_patterns(db: Session = Depends(get_db)):
    videos = db.query(TikTokVideo).all()
    if not videos:
        return {
            "top_hashtags": [], "best_posting_days": [], "best_posting_hours": [],
            "top_sounds": [], "engagement_by_duration": [],
            "caption_length_correlation": {},
        }

    # Top Hashtags
    hashtag_videos: dict[str, list] = defaultdict(list)
    for v in videos:
        for tag in (v.hashtags or []):
            hashtag_videos[tag.lower()].append(v)
    top_hashtags = sorted(
        [{"hashtag": tag, "count": len(vids),
          "avg_views": round(sum(v.views for v in vids) / len(vids), 1),
          "avg_engagement": round(sum(v.engagement_rate for v in vids) / len(vids), 4)}
         for tag, vids in hashtag_videos.items()],
        key=lambda x: x["count"], reverse=True,
    )[:20]

    # Best Posting Days
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_videos: dict[int, list] = defaultdict(list)
    for v in videos:
        if v.create_time:
            day_videos[v.create_time.weekday()].append(v)
    best_posting_days = sorted(
        [{"day": day_names[day], "avg_views": round(sum(v.views for v in vids) / len(vids), 1), "video_count": len(vids)}
         for day, vids in day_videos.items()],
        key=lambda x: x["avg_views"], reverse=True,
    )

    # Best Posting Hours
    hour_videos: dict[int, list] = defaultdict(list)
    for v in videos:
        if v.create_time:
            hour_videos[v.create_time.hour].append(v)
    best_posting_hours = sorted(
        [{"hour": hour, "avg_views": round(sum(v.views for v in vids) / len(vids), 1), "video_count": len(vids)}
         for hour, vids in hour_videos.items()],
        key=lambda x: x["avg_views"], reverse=True,
    )[:12]

    # Top Sounds
    sound_videos: dict[str, list] = defaultdict(list)
    for v in videos:
        if v.sound_name:
            sound_videos[v.sound_name].append(v)
    top_sounds = sorted(
        [{"sound": sound, "count": len(vids), "avg_views": round(sum(v.views for v in vids) / len(vids), 1)}
         for sound, vids in sound_videos.items()],
        key=lambda x: x["count"], reverse=True,
    )[:15]

    # Engagement by Duration
    duration_buckets = [("0-15s", 0, 15), ("16-30s", 16, 30), ("31-60s", 31, 60), ("60s+", 61, 99999)]
    engagement_by_duration = []
    for label, lo, hi in duration_buckets:
        bucket = [v for v in videos if v.video_duration and lo <= v.video_duration <= hi]
        if bucket:
            engagement_by_duration.append({
                "range": label,
                "avg_engagement": round(sum(v.engagement_rate for v in bucket) / len(bucket), 4),
                "count": len(bucket),
            })

    # Caption Length Correlation
    short = [v for v in videos if v.caption and len(v.caption) <= 100]
    medium = [v for v in videos if v.caption and 100 < len(v.caption) <= 300]
    long_cap = [v for v in videos if v.caption and len(v.caption) > 300]
    caption_length_correlation = {}
    if short:
        caption_length_correlation["short"] = {"max_chars": 100, "avg_views": round(sum(v.views for v in short) / len(short), 1), "count": len(short)}
    if medium:
        caption_length_correlation["medium"] = {"max_chars": 300, "avg_views": round(sum(v.views for v in medium) / len(medium), 1), "count": len(medium)}
    if long_cap:
        caption_length_correlation["long"] = {"max_chars": 999, "avg_views": round(sum(v.views for v in long_cap) / len(long_cap), 1), "count": len(long_cap)}

    return {
        "top_hashtags": top_hashtags,
        "best_posting_days": best_posting_days,
        "best_posting_hours": best_posting_hours,
        "top_sounds": top_sounds,
        "engagement_by_duration": engagement_by_duration,
        "caption_length_correlation": caption_length_correlation,
    }


@router.get("/top-performers")
def get_top_performers(
    sort_by: str = "views",
    limit: int = 10,
    db: Session = Depends(get_db),
):
    videos = db.query(TikTokVideo).all()
    if sort_by == "engagement_rate":
        videos.sort(key=lambda v: v.engagement_rate, reverse=True)
    else:
        videos.sort(key=lambda v: v.views, reverse=True)
    return [_video_to_dict(v) for v in videos[:limit]]


# ---------------------------------------------------------------------------
# CRUD endpoints  (parameterized routes AFTER static routes)
# ---------------------------------------------------------------------------

@router.get("/videos")
def list_videos(
    search: Optional[str] = None,
    hashtag: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_by: str = "create_time",
    sort_order: str = "desc",
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = db.query(TikTokVideo)
    if search:
        query = query.filter(TikTokVideo.caption.ilike(f"%{search}%"))
    if hashtag:
        clean_tag = hashtag.lstrip("#").lower()
        videos_all = query.all()
        filtered = [v for v in videos_all if clean_tag in [h.lower() for h in (v.hashtags or [])]]
        if date_from:
            d = datetime.strptime(date_from, "%Y-%m-%d")
            filtered = [v for v in filtered if v.create_time and v.create_time >= d]
        if date_to:
            d = datetime.strptime(date_to, "%Y-%m-%d")
            filtered = [v for v in filtered if v.create_time and v.create_time <= d]
        reverse = sort_order == "desc"
        if sort_by == "engagement_rate":
            filtered.sort(key=lambda v: v.engagement_rate, reverse=reverse)
        else:
            filtered.sort(key=lambda v: getattr(v, sort_by, 0) or 0, reverse=reverse)
        return [_video_to_dict(v) for v in filtered[offset:offset + limit]]
    if date_from:
        query = query.filter(TikTokVideo.create_time >= datetime.strptime(date_from, "%Y-%m-%d"))
    if date_to:
        query = query.filter(TikTokVideo.create_time <= datetime.strptime(date_to, "%Y-%m-%d"))
    if sort_by == "engagement_rate":
        expr = (TikTokVideo.likes + TikTokVideo.comments + TikTokVideo.shares + TikTokVideo.saves) * 1.0 / func.nullif(TikTokVideo.views, 0)
        query = query.order_by(expr.desc() if sort_order == "desc" else expr.asc())
    else:
        col = getattr(TikTokVideo, sort_by, TikTokVideo.create_time)
        query = query.order_by(col.desc() if sort_order == "desc" else col.asc())
    results = query.offset(offset).limit(limit).all()
    return [_video_to_dict(v) for v in results]


@router.get("/videos/{video_id}")
def get_video(video_id: int, db: Session = Depends(get_db)):
    video = db.query(TikTokVideo).filter(TikTokVideo.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return _video_to_dict(video)


@router.delete("/videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_video(video_id: int, db: Session = Depends(get_db)):
    video = db.query(TikTokVideo).filter(TikTokVideo.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    db.delete(video)
    db.commit()
    return None


@router.delete("/videos", status_code=status.HTTP_204_NO_CONTENT)
def bulk_delete_videos(confirm: bool = Query(False), db: Session = Depends(get_db)):
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Add ?confirm=true to confirm bulk deletion of all videos.",
        )
    db.query(TikTokVideo).delete()
    db.commit()
    return None
