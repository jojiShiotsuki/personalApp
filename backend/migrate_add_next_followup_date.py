#!/usr/bin/env python3
"""
Migration script to add next_followup_date column to crm_deals table.
"""
import sqlite3
import sys
from pathlib import Path

# Database path
db_path = Path(__file__).parent / "database" / "app.db"

if not db_path.exists():
    print(f"Error: Database not found at {db_path}")
    sys.exit(1)

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check if column already exists
    cursor.execute("PRAGMA table_info(crm_deals)")
    columns = [row[1] for row in cursor.fetchall()]

    if 'next_followup_date' in columns:
        print("Column 'next_followup_date' already exists in crm_deals table.")
    else:
        # Add the column
        cursor.execute("ALTER TABLE crm_deals ADD COLUMN next_followup_date DATE")
        conn.commit()
        print("SUCCESS: added 'next_followup_date' column to crm_deals table.")

    conn.close()

except Exception as e:
    print(f"Error running migration: {e}")
    sys.exit(1)
