import re
from datetime import datetime, date
from typing import Dict, Any
from dateutil import parser as date_parser
from app.models.goal import Quarter, Month, GoalPriority

class GoalParser:
    """Parse natural language goal descriptions"""

    PRIORITY_KEYWORDS = {
        "urgent": GoalPriority.HIGH,
        "high priority": GoalPriority.HIGH,
        "high": GoalPriority.HIGH,
        "important": GoalPriority.HIGH,
        "low priority": GoalPriority.LOW,
        "low": GoalPriority.LOW,
    }

    QUARTER_KEYWORDS = {
        "q1": Quarter.Q1,
        "quarter 1": Quarter.Q1,
        "first quarter": Quarter.Q1,
        "q2": Quarter.Q2,
        "quarter 2": Quarter.Q2,
        "second quarter": Quarter.Q2,
        "q3": Quarter.Q3,
        "quarter 3": Quarter.Q3,
        "third quarter": Quarter.Q3,
        "q4": Quarter.Q4,
        "quarter 4": Quarter.Q4,
        "fourth quarter": Quarter.Q4,
    }

    MONTH_KEYWORDS = {
        "january": Month.JANUARY,
        "jan": Month.JANUARY,
        "february": Month.FEBRUARY,
        "feb": Month.FEBRUARY,
        "march": Month.MARCH,
        "mar": Month.MARCH,
        "april": Month.APRIL,
        "apr": Month.APRIL,
        "may": Month.MAY,
        "june": Month.JUNE,
        "jun": Month.JUNE,
        "july": Month.JULY,
        "jul": Month.JULY,
        "august": Month.AUGUST,
        "aug": Month.AUGUST,
        "september": Month.SEPTEMBER,
        "sep": Month.SEPTEMBER,
        "sept": Month.SEPTEMBER,
        "october": Month.OCTOBER,
        "oct": Month.OCTOBER,
        "november": Month.NOVEMBER,
        "nov": Month.NOVEMBER,
        "december": Month.DECEMBER,
        "dec": Month.DECEMBER,
    }

    # Map months to quarters
    MONTH_TO_QUARTER = {
        Month.JANUARY: Quarter.Q1,
        Month.FEBRUARY: Quarter.Q1,
        Month.MARCH: Quarter.Q1,
        Month.APRIL: Quarter.Q2,
        Month.MAY: Quarter.Q2,
        Month.JUNE: Quarter.Q2,
        Month.JULY: Quarter.Q3,
        Month.AUGUST: Quarter.Q3,
        Month.SEPTEMBER: Quarter.Q3,
        Month.OCTOBER: Quarter.Q4,
        Month.NOVEMBER: Quarter.Q4,
        Month.DECEMBER: Quarter.Q4,
    }

    @classmethod
    def parse(cls, text: str) -> Dict[str, Any]:
        """
        Parse natural language text into goal components.

        Examples:
        - "Launch new website Q1 January"
        - "Complete certification Q2 April high priority"
        - "Reach 10k followers Q3 July urgent"
        - "Q4 December: Year-end review - Complete annual goals assessment"

        Returns dict with: title, quarter, month, year, priority, description
        """
        text_lower = text.lower()
        current_year = datetime.now().year

        result = {
            "title": text,
            "quarter": None,
            "month": None,
            "year": current_year,
            "priority": GoalPriority.MEDIUM,
            "description": None,
        }

        # Extract priority
        for keyword, priority in cls.PRIORITY_KEYWORDS.items():
            if keyword in text_lower:
                result["priority"] = priority
                # Remove priority keyword from text
                text = re.sub(re.escape(keyword), "", text, flags=re.IGNORECASE).strip()
                text_lower = text.lower()
                break

        # Extract quarter
        for keyword, quarter in cls.QUARTER_KEYWORDS.items():
            if keyword in text_lower:
                result["quarter"] = quarter
                # Remove quarter keyword from text
                text = re.sub(re.escape(keyword), "", text, flags=re.IGNORECASE).strip()
                text_lower = text.lower()
                break

        # Extract month
        for keyword, month in cls.MONTH_KEYWORDS.items():
            if keyword in text_lower:
                result["month"] = month
                # If no quarter specified, infer from month
                if not result["quarter"]:
                    result["quarter"] = cls.MONTH_TO_QUARTER[month]
                # Remove month keyword from text
                text = re.sub(rf'\b{re.escape(keyword)}\b', "", text, flags=re.IGNORECASE).strip()
                text_lower = text.lower()
                break

        # Extract year if specified
        year_match = re.search(r'\b(20\d{2})\b', text)
        if year_match:
            result["year"] = int(year_match.group(1))
            text = text.replace(year_match.group(0), "").strip()

        # If no quarter/month found, use current
        if not result["quarter"] or not result["month"]:
            now = datetime.now()
            current_month_num = now.month  # 1-12

            if not result["month"]:
                # Map current month to Month enum
                month_names = [
                    Month.JANUARY, Month.FEBRUARY, Month.MARCH,
                    Month.APRIL, Month.MAY, Month.JUNE,
                    Month.JULY, Month.AUGUST, Month.SEPTEMBER,
                    Month.OCTOBER, Month.NOVEMBER, Month.DECEMBER
                ]
                result["month"] = month_names[current_month_num - 1]

            if not result["quarter"]:
                result["quarter"] = cls.MONTH_TO_QUARTER[result["month"]]

        # Clean up title - remove common separators
        text = re.sub(r'^\s*[-:]\s*', '', text)  # Remove leading - or :
        text = re.sub(r'\s+', ' ', text).strip()  # Collapse multiple spaces

        # Split on " - " to separate title and description
        if " - " in text:
            parts = text.split(" - ", 1)
            result["title"] = parts[0].strip()
            result["description"] = parts[1].strip()
        else:
            result["title"] = text if text else "New Goal"

        return result
