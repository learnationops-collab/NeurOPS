import sqlite3
import os

db_path = 'instance/local.db'
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check current columns
cursor.execute("PRAGMA table_info(appointments)")
current_cols = {col[1] for col in cursor.fetchall()}

# Required columns based on model
required = {
    'event_id': 'INTEGER',
    'status': 'VARCHAR(20)',
    'google_event_id': 'VARCHAR(255)',
    'appointment_type': "VARCHAR(50) DEFAULT 'Primera agenda'",
    'presentation_done': 'BOOLEAN DEFAULT 0',
    'is_reschedule': 'BOOLEAN DEFAULT 0',
    'rescheduled_from_id': 'INTEGER'
}

for col, dtype in required.items():
    if col not in current_cols:
        print(f"Adding missing column: {col}...")
        try:
            cursor.execute(f"ALTER TABLE appointments ADD COLUMN {col} {dtype}")
            conn.commit()
            print(f"Column {col} added.")
        except Exception as e:
            print(f"Error adding {col}: {e}")
    else:
        print(f"Column {col} already exists.")

conn.close()
print("Database schema check completed.")
