#!/usr/bin/env python3
"""
Script to add snooze endpoint after line 223 in crm.py
and update create_deal to auto-set next_followup_date
"""
import sys

# Read the file
with open('app/routes/crm.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and update create_deal function
# Add auto-set logic after line 172: db_deal = Deal(**deal.model_dump())
for i, line in enumerate(lines):
    if i == 171 and 'db_deal = Deal(**deal.model_dump())' in line:
        # Insert auto-set logic after this line
        insert_lines = [
            '    \n',
            '    # Auto-set next follow-up date to 3 days from now if not provided\n',
            '    if db_deal.next_followup_date is None:\n',
            '        db_deal.next_followup_date = (datetime.utcnow() + timedelta(days=3)).date()\n',
        ]
        lines = lines[:i+1] + insert_lines + lines[i+1:]
        break

# Find where to add snooze endpoint (after update_deal_stage function, around line 223)
for i, line in enumerate(lines):
    if 'db.refresh(db_deal)' in line and i > 200:
        # Check if next line starts next function or has content
        next_line_idx = i + 1
        while next_line_idx < len(lines) and lines[next_line_idx].strip() == '':
            next_line_idx += 1

        if next_line_idx < len(lines) and (lines[next_line_idx].strip().startswith('@router') or lines[next_line_idx].strip().startswith('def')):
            # Found the end of update_deal_stage, insert snooze endpoint before next function
            snooze_endpoint = [
                '\n',
                '@router.patch("/deals/{deal_id}/snooze", response_model=DealResponse)\n',
                'def snooze_deal(\n',
                '    deal_id: int,\n',
                '    db: Session = Depends(get_db)\n',
                '):\n',
                '    """Snooze deal follow-up by 3 days (set next_followup_date to today + 3)"""\n',
                '    db_deal = db.query(Deal).options(joinedload(Deal.contact)).filter(Deal.id == deal_id).first()\n',
                '    if not db_deal:\n',
                '        raise HTTPException(status_code=404, detail="Deal not found")\n',
                '    \n',
                '    # Set next follow-up to 3 days from now\n',
                '    db_deal.next_followup_date = (datetime.utcnow() + timedelta(days=3)).date()\n',
                '    db_deal.updated_at = datetime.utcnow()\n',
                '    \n',
                '    db.commit()\n',
                '    db.refresh(db_deal)\n',
                '    return db_deal\n',
                '\n',
            ]
            lines = lines[:next_line_idx] + snooze_endpoint + lines[next_line_idx:]
            break

# Write the file back
with open('app/routes/crm.py', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("SUCCESS: Updated crm.py with snooze endpoint and auto-set logic")
