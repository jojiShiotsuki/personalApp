from datetime import date
from app.models.task import RecurrenceType
from app.services.recurrence_service import calculate_next_due_date

def test_fri_sun_jump():
    # Scenario: Start Fri Nov 21. Days: Fri, Sun.
    # Expected: Sun Nov 23.
    
    start = date(2025, 11, 21) # Fri
    days = "Fri,Sun"
    
    print(f"Start: {start} ({start.strftime('%a')})")
    print(f"Days: {days}")
    
    next_date = calculate_next_due_date(start, RecurrenceType.WEEKLY, 1, days)
    print(f"Next: {next_date} ({next_date.strftime('%a')})")
    
    if next_date == date(2025, 11, 23):
        print("SUCCESS: Found Sunday Nov 23")
    else:
        print("FAILURE: Skipped Sunday?")

    # Scenario: Start Fri Nov 21. Days: Sun.
    # Expected: Sun Nov 23.
    days_sun = "Sun"
    print(f"\nStart: {start} ({start.strftime('%a')})")
    print(f"Days: {days_sun}")
    
    next_date_sun = calculate_next_due_date(start, RecurrenceType.WEEKLY, 1, days_sun)
    print(f"Next: {next_date_sun} ({next_date_sun.strftime('%a')})")
    
    if next_date_sun == date(2025, 11, 23):
        print("SUCCESS: Found Sunday Nov 23")
    else:
        print("FAILURE: Skipped Sunday?")

if __name__ == "__main__":
    test_fri_sun_jump()
