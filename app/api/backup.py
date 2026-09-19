import datetime
import hmac
import os

import sqlalchemy as sa
from flask import Blueprint, Response, current_app, jsonify

from app import db
from app.decorators import role_required

bp = Blueprint('backup', __name__)

# Largo minimo de la clave configurada: una variable con "1234" no debe abrir la puerta.
LARGO_MINIMO_DE_CLAVE = 20


def _rechazar_si_la_clave_no_vale(secret_key):
    """None si la clave es correcta; si no, la respuesta que hay que devolver.

    La clave sale de BACKUP_SECRET_KEY y NUNCA del codigo: estuvo escrita en el repositorio y en el
    bundle publico de la web. Sin la variable (o con una demasiado corta) la funcion queda APAGADA
    (503), jamas abierta. Se compara en tiempo constante y sobre bytes: con str, un caracter no ASCII
    lanzaria TypeError y produciria un 500.
    """
    esperada = os.environ.get('BACKUP_SECRET_KEY', '')
    if len(esperada) < LARGO_MINIMO_DE_CLAVE:
        return jsonify({
            "message": f"Backup deshabilitado: falta BACKUP_SECRET_KEY (minimo {LARGO_MINIMO_DE_CLAVE} caracteres)."
        }), 503
    if not hmac.compare_digest(secret_key.encode('utf-8'), esperada.encode('utf-8')):
        return jsonify({"message": "Invalid secret key. Access Denied."}), 403
    return None


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
@role_required('admin')
def preview_db(secret_key):
    """
    Returns statistics about the database tables.
    """
    rechazo = _rechazar_si_la_clave_no_vale(secret_key)
    if rechazo:
        return rechazo

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
@role_required('admin')
def export_db(secret_key):
    """
    Exports the entire database as a SQL dump (INSERT statements).
    """
    rechazo = _rechazar_si_la_clave_no_vale(secret_key)
    if rechazo:
        return rechazo

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
        current_app.logger.error(f"Backup Error: {e}")
        return jsonify({"message": "Backup failed"}), 500

@bp.route('/secret-restore-import/<string:secret_key>', methods=['POST'])
@role_required('admin')
def restore_db(secret_key):
    """
    Restores the database from an uploaded SQL file.
    WARNING: THIS WILL WIPE ALL EXISTING DATA.
    """
    rechazo = _rechazar_si_la_clave_no_vale(secret_key)
    if rechazo:
        return rechazo

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
