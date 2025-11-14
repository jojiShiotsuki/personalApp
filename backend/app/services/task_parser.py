import re
from datetime import datetime, date, time, timedelta
from typing import Optional, Dict, Any
from dateutil import parser as date_parser
from app.models.task import TaskPriority, TaskStatus

class TaskParser:
    """Parse natural language task descriptions"""

    PRIORITY_KEYWORDS = {
        "urgent": TaskPriority.URGENT,
        "high priority": TaskPriority.HIGH,
        "high": TaskPriority.HIGH,
        "important": TaskPriority.HIGH,
        "low priority": TaskPriority.LOW,
        "low": TaskPriority.LOW,
    }

    RELATIVE_DATES = {
        "today": 0,
        "tomorrow": 1,
        "monday": None,
        "tuesday": None,
        "wednesday": None,
        "thursday": None,
        "friday": None,
        "saturday": None,
        "sunday": None,
    }

    TIME_PATTERN = re.compile(r'\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b', re.IGNORECASE)

    @classmethod
    def parse(cls, text: str) -> Dict[str, Any]:
        """
        Parse natural language text into task components.

        Examples:
        - "Meeting with Sarah tomorrow at 3pm"
        - "Call John high priority"
        - "Proposal due Friday"
        - "Review contract next Monday 2pm urgent"
        - "2025-11-11 09:00: Task title - description"

        Returns dict with: title, due_date, due_time, priority, status
        """
        text_lower = text.lower()
        result = {
            "title": text,
            "due_date": None,
            "due_time": None,
            "priority": TaskPriority.MEDIUM,
            "status": TaskStatus.PENDING,
        }

        # Handle datetime prefix format: "YYYY-MM-DD HH:MM: " at start
        datetime_prefix = re.match(r'^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2}):\s*', text)
        if datetime_prefix:
            try:
                # Extract date
                result["due_date"] = date_parser.parse(datetime_prefix.group(1)).date()
                # Extract time
                hour = int(datetime_prefix.group(2))
                minute = int(datetime_prefix.group(3))
                result["due_time"] = time(hour=hour, minute=minute)
                # Remove datetime prefix from text
                text = text[datetime_prefix.end():].strip()
                text_lower = text.lower()
            except:
                pass

        # Extract priority
        for keyword, priority in cls.PRIORITY_KEYWORDS.items():
            if keyword in text_lower:
                result["priority"] = priority
                # Remove priority keyword from title
                text = re.sub(re.escape(keyword), "", text, flags=re.IGNORECASE).strip()
                break

        # Extract time
        time_match = cls.TIME_PATTERN.search(text)
        if time_match:
            hour = int(time_match.group(1))
            minute = int(time_match.group(2)) if time_match.group(2) else 0
            am_pm = time_match.group(3).lower() if time_match.group(3) else None

            # Convert to 24-hour format
            if am_pm == "pm" and hour != 12:
                hour += 12
            elif am_pm == "am" and hour == 12:
                hour = 0

            result["due_time"] = time(hour=hour, minute=minute)
            # Remove time from title
            text = cls.TIME_PATTERN.sub("", text).strip()

        # Extract date - try relative dates first
        today = date.today()

        if "today" in text_lower:
            result["due_date"] = today
            text = re.sub(r'\btoday\b', "", text, flags=re.IGNORECASE).strip()
        elif "tomorrow" in text_lower:
            result["due_date"] = today + timedelta(days=1)
            text = re.sub(r'\btomorrow\b', "", text, flags=re.IGNORECASE).strip()
        else:
            # Check for day of week
            weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
            for i, day in enumerate(weekdays):
                if day in text_lower:
                    # Find next occurrence of this weekday
                    days_ahead = i - today.weekday()
                    if days_ahead <= 0:  # Target day already happened this week
                        days_ahead += 7
                    result["due_date"] = today + timedelta(days=days_ahead)
                    text = re.sub(rf'\b{day}\b', "", text, flags=re.IGNORECASE).strip()
                    break

            # Try "next week", "next month"
            if "next week" in text_lower:
                result["due_date"] = today + timedelta(days=7)
                text = re.sub(r'\bnext week\b', "", text, flags=re.IGNORECASE).strip()
            elif "next month" in text_lower:
                result["due_date"] = today + timedelta(days=30)
                text = re.sub(r'\bnext month\b', "", text, flags=re.IGNORECASE).strip()

            # Try absolute date parsing (e.g., "2024-01-15", "Jan 15")
            if not result["due_date"]:
                try:
                    # Try to find a date in the text
                    date_match = re.search(r'\b\d{4}-\d{2}-\d{2}\b', text)
                    if date_match:
                        parsed_date = date_parser.parse(date_match.group()).date()
                        result["due_date"] = parsed_date
                        text = text.replace(date_match.group(), "").strip()
                except:
                    pass

        # Clean up title - remove "at", "due", "on" if they're hanging
        text = re.sub(r'\b(at|due|on|by)\b', "", text, flags=re.IGNORECASE)
        text = re.sub(r'\s+', ' ', text).strip()  # Collapse multiple spaces

        # Split on " - " to separate title and description
        if " - " in text:
            parts = text.split(" - ", 1)  # Split only on first occurrence
            result["title"] = parts[0].strip()
            result["description"] = parts[1].strip()
        else:
            result["title"] = text if text else "New Task"

        return result
