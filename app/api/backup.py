from flask import Blueprint, jsonify, Response, current_app
from app import db
import sqlalchemy as sa
import datetime

bp = Blueprint('backup', __name__)

def format_value(value):
    if value is None:
        return 'NULL'
    if isinstance(value, (datetime.date, datetime.datetime)):
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
        return jsonify({"message": f"Backup failed: {str(e)}", "type": str(type(e))}), 500
