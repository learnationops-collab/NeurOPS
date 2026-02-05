from flask import Blueprint, jsonify, Response, current_app
from app import db
import sqlalchemy as sa
import datetime
from app.models import User

bp = Blueprint('backup', __name__)

def format_value(value):
    if value is None:
        return 'NULL'
    if isinstance(value, (datetime.date, datetime.datetime, datetime.time)):
        return f"'{value.isoformat()}'"
    if isinstance(value, str):
        # Escape single quotes for SQL
        escaped = value.replace("'", "''")
        return f"'{escaped}'"
    if isinstance(value, bool):
        # Postgres uses TRUE/FALSE, SQLite uses 1/0. 
        # using '1'/'0' or TRUE/FALSE depends on target. 
        # Standard SQL boolean: TRUE / FALSE often works, but let's stick to safe text or integers if possible.
        # For Postgres compatibility:
        return 'TRUE' if value else 'FALSE'
    import json
    if isinstance(value, (dict, list)):
        return f"'{json.dumps(value)}'"
    # Fallback to string
    # This comment is added to force a git change.
    return str(value)

@bp.route('/secret-backup-preview/<string:secret_key>', methods=['GET'])
def preview_db(secret_key):
    """
    Returns statistics about the database tables.
    """
    EXPECTED_KEY = 'neurops_secret_backup_2024'
    
    if secret_key != EXPECTED_KEY:
         return jsonify({"message": "Invalid secret key. Access Denied."}), 403

    try:
        stats = []
        # sort tables to match export order
        for table in db.metadata.sorted_tables:
            stmt = sa.select(sa.func.count()).select_from(table)
            count = db.session.execute(stmt).scalar()
            stats.append({
                "name": table.name,
                "count": count
            })
            
        return jsonify({"tables": stats}), 200
    except Exception as e:
        return jsonify({"message": f"Preview failed: {str(e)}"}), 500

@bp.route('/secret-backup-export/<string:secret_key>', methods=['GET'])
def export_db(secret_key):
    """
    Exports the entire database as a SQL dump (INSERT statements).
    """
    EXPECTED_KEY = 'neurops_secret_backup_2024'
    
    if secret_key != EXPECTED_KEY:
         return jsonify({"message": "Invalid secret key. Access Denied."}), 403

    try:
        sql_lines = []
        sql_lines.append("-- NeurOPS Database Backup (PostgreSQL Compatible)")
        sql_lines.append(f"-- Generated: {datetime.datetime.utcnow().isoformat()}")
        sql_lines.append("BEGIN;") # Start transaction
        sql_lines.append("")

        # Get tables sorted by dependency
        for table in db.metadata.sorted_tables:
            table_name = table.name
            
            # Select all records
            stmt = sa.select(table)
            result = db.session.execute(stmt)
            
            rows = list(result)
            count = len(rows)
            sql_lines.append(f"-- Table: {table_name} ({count} records)")
            
            if count > 0:
                columns = [c.name for c in table.columns]
                col_names = ", ".join(f'"{c}"' for c in columns)
                
                for row in rows:
                    row_map = row._mapping
                    values = [format_value(row_map[c]) for c in columns]
                    val_str = ", ".join(values)
                    insert_stmt = f"INSERT INTO {table_name} ({col_names}) VALUES ({val_str});"
                    sql_lines.append(insert_stmt)
            
            sql_lines.append("")

        sql_lines.append("COMMIT;") # Commit transaction
        sql_content = "\n".join(sql_lines)
        
        return Response(
            sql_content,
            mimetype='text/plain',
            headers={'Content-Disposition': 'attachment;filename=neurops_backup.sql'}
        )
    except Exception as e:
        print(f"Backup Error: {e}")
@bp.route('/secret-restore-import/<string:secret_key>', methods=['POST'])
def restore_db(secret_key):
    """
    Restores the database from an uploaded SQL file.
    WARNING: THIS WILL WIPE ALL EXISTING DATA.
    """
    EXPECTED_KEY = 'neurops_secret_backup_2024'
    
    if secret_key != EXPECTED_KEY:
         return jsonify({"message": "Invalid secret key. Access Denied."}), 403

    from flask import request
    
    if 'file' not in request.files:
        return jsonify({"message": "No file part"}), 400
        
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"message": "No selected file"}), 400
        
    if file:
        try:
            # Read file content
            sql_content = file.read().decode('utf-8')
            
            # Execute logic
            # 1. Truncate all tables first to avoid conflicts
            #    We use CASCADE to handle foreign keys
            
            # Identify tables to truncate/delete
            tables = db.metadata.sorted_tables
            table_names = [f'"{t.name}"' for t in tables] # Quote for safety
            
            if not table_names:
                 return jsonify({"message": "No tables found in metadata to restore."}), 400

            # Use raw connection to avoid SQLAlchemy bind parameter parsing issues with the big SQL script
            connection = db.engine.raw_connection()
            try:
                cursor = connection.cursor()
                db_url = str(db.engine.url)
                
                # 1. Truncate/Wipe
                if 'sqlite' in db_url:
                    # SQLite: disable FK, delete all, enable FK
                    cursor.execute("PRAGMA foreign_keys = OFF;")
                    for table in tables:
                        cursor.execute(f'DELETE FROM "{table.name}";')
                    cursor.execute("PRAGMA foreign_keys = ON;")
                else:
                    # PostgreSQL: Truncate Cascade
                    truncate_sql = f"TRUNCATE TABLE {', '.join(table_names)} RESTART IDENTITY CASCADE;"
                    cursor.execute(truncate_sql)
                
                # 2. Execute Script
                if 'sqlite' in db_url:
                    # SQLite: Execute line by line to avoid "executescript" parser quirks with timestamps
                    # and to provide better error context.
                    # Our backup format is guaranteed to be one INSERT per line context.
                    statements = sql_content.split(';')
                    start_index = 0
                    for i, stmt in enumerate(statements):
                        stmt = stmt.strip()
                        if not stmt:
                            continue
                        if stmt.upper().startswith('BEGIN') or stmt.upper().startswith('COMMIT'):
                            continue # Skip transaction control
                        if stmt.startswith('--'):
                            continue 
                            
                        try:
                            cursor.execute(stmt)
                        except Exception as line_err:
                            # Capture detailed context
                            error_ctx = f"Statement #{i+1} failed.\nError: {str(line_err)}\nSQL Snippet: {stmt[:150]}..."
                            print(f"Restore Line Error: {error_ctx}")
                            raise Exception(error_ctx)
                else:
                    # PostgreSQL
                    cursor.execute(sql_content)
                
                connection.commit()
            finally:
                cursor.close()
                connection.close()
            
            return jsonify({"message": "Database restored successfully!", "tables_affected": len(table_names)}), 200
            
        except Exception as e:
            db.session.rollback()
            print(f"Restore Fatal Error: {e}")
            # Return the specific message if passed from inner raise
            return jsonify({"message": f"Restore failed: {str(e)}"}), 500

@bp.route('/fix-auth', methods=['GET'])
def fix_auth_simple():
    """
    Super simple endpoint to fix users.
    Usage: /api/backup/fix-auth
    """
    try:
        # 1. Ensure Admin
        admin = User.query.filter_by(email='admin@neurops.com').first()
        if not admin:
            admin = User(username='admin', email='admin@neurops.com', role='admin')
            db.session.add(admin)
        admin.set_password('admin123')
        admin.is_active = True
        
        # 2. Ensure Closer
        closer = User.query.filter_by(email='closer@neurops.com').first()
        if not closer:
            closer = User(username='closer', email='closer@neurops.com', role='closer')
            db.session.add(closer)
        closer.set_password('closer123')
        closer.is_active = True
        
        db.session.commit()
        
        return jsonify({
            "message": "USERS FIXED! Login now.",
            "credentials": [
                {"role": "Admin", "email": "admin@neurops.com", "pass": "admin123"},
                {"role": "Closer", "email": "closer@neurops.com", "pass": "closer123"}
            ]
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
