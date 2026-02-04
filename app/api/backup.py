from flask import Blueprint, jsonify, Response, current_app
from app import db
import json
import datetime
import sqlalchemy as sa

bp = Blueprint('backup', __name__)

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime.date, datetime.datetime)):
            return obj.isoformat()
        return super().default(obj)

@bp.route('/secret-backup-export/<string:secret_key>', methods=['GET'])
def export_db(secret_key):
    """
    Exports the entire database to a JSON file.
    Protected by a simple hardcoded secret key for manual usage.
    """
    # Hardcoded secret check (As requested: "sin autenticacion", but with a secret url/key)
    # Using a reasonably complex key to prevent accidental discovery
    EXPECTED_KEY = 'neurops_secret_backup_2024'
    
    if secret_key != EXPECTED_KEY:
         return jsonify({"message": "Invalid secret key. Access Denied."}), 403

    try:
        data = {}
        
        # Reflect metadata if not already populated (though app context should have it)
        # Iterating over declared models might be safer for relationships, 
        # but iterating over tables is better for a raw data dump.
        
        # Use formatting that is easy to restore later if needed
        for table_name, table in db.metadata.tables.items():
            # Select all records
            stmt = sa.select(table)
            result = db.session.execute(stmt)
            
            # Serialize rows
            # row._mapping converts the Row object to a dictionary-like interface
            rows = []
            for row in result:
                row_dict = dict(row._mapping)
                rows.append(row_dict)
                
            data[table_name] = rows

        json_str = json.dumps(data, cls=DateTimeEncoder, indent=2)
        
        return Response(
            json_str,
            mimetype='application/json',
            headers={'Content-Disposition': 'attachment;filename=neurops_full_backup.json'}
        )
    except Exception as e:
        return jsonify({"message": f"Backup failed: {str(e)}"}), 500
