import sqlite3
import os

db_path = 'instance/local.db'
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check current columns
cursor.execute("PRAGMA table_info(lead_profiles)")
current_cols = {col[1] for col in cursor.fetchall()}

if 'is_pinned' not in current_cols:
    print("Adding missing column: is_pinned to lead_profiles...")
    try:
        cursor.execute("ALTER TABLE lead_profiles ADD COLUMN is_pinned BOOLEAN DEFAULT 0")
        conn.commit()
        print("Column is_pinned added.")
    except Exception as e:
        print(f"Error adding is_pinned: {e}")
else:
    print("Column is_pinned already exists.")

conn.close()
print("LeadProfile schema check completed.")
