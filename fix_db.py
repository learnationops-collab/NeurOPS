import sqlite3
import os

db_path = 'instance/local.db'
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check if column exists
cursor.execute("PRAGMA table_info(appointments)")
cols = [col[1] for col in cursor.fetchall()]

if 'appointment_type' not in cols:
    print("Adding 'appointment_type' to 'appointments' table...")
    try:
        cursor.execute("ALTER TABLE appointments ADD COLUMN appointment_type VARCHAR(50) DEFAULT 'Primera agenda'")
        conn.commit()
        print("Column added successfully.")
    except Exception as e:
        print(f"Error adding column: {e}")
else:
    print("Column 'appointment_type' already exists.")

conn.close()
