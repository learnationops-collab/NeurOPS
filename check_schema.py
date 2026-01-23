import sqlite3
import os

db_path = 'instance/local.db'
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("Full Schema for 'appointments' table:")
cursor.execute("PRAGMA table_info(appointments)")
cols = cursor.fetchall()
for col in cols:
    print(col)

conn.close()
