import sqlite3
db_path = 'instance/local.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
tables = ['campaigns', 'ad_groups', 'ads']
for t in tables:
    try:
        cursor.execute(f"SELECT COUNT(*) FROM {t};")
        count = cursor.fetchone()[0]
        print(f"Table {t}: {count} rows")
    except Exception as e:
        print(f"Table {t} error: {e}")
conn.close()
