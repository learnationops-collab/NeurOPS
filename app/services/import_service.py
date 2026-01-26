import pandas as pd
from app.models import db, User, Client, Program, PaymentMethod, Enrollment, Payment
from datetime import datetime

class ImportService:
    CONFIG = {
        'leads': {
            'required': ['email'],
            'fields': [
                {'name': 'full_name', 'label': 'Nombre Completo'},
                {'name': 'email', 'label': 'Correo Electrónico', 'required': True},
                {'name': 'phone', 'label': 'Teléfono'},
                {'name': 'instagram', 'label': 'Instagram'}
            ],
            'entities': {}
        },
        'sales': {
            'required': ['student_email', 'program_name', 'closer_username', 'payment_method_name', 'payment_amount', 'payment_type'],
            'fields': [
                {'name': 'student_email', 'label': 'Email del Estudiante', 'required': True},
                {'name': 'student_name', 'label': 'Nombre del Estudiante'},
                {'name': 'program_name', 'label': 'Nombre del Programa', 'required': True},
                {'name': 'program_price', 'label': 'Precio del Programa (solo nuevos)'},
                {'name': 'closer_username', 'label': 'Usuario del Closer', 'required': True},
                {'name': 'payment_method_name', 'label': 'Método de Pago', 'required': True},
                {'name': 'payment_amount', 'label': 'Monto Pagado', 'required': True},
                {'name': 'payment_type', 'label': 'Tipo de Pago', 'required': True},
                {'name': 'date', 'label': 'Fecha (Opcional)'}
            ],
            'entities': {
                'closer_username': User,
                'program_name': Program,
                'payment_method_name': PaymentMethod
            }
        }
    }

    @staticmethod
    def get_config():
        return ImportService.CONFIG

    @staticmethod
    def validate(df, target, mapping):
        config = ImportService.CONFIG.get(target)
        if not config: return {"error": "Invalid target"}

        # Rename columns based on mapping
        inv_mapping = {v: k for k, v in mapping.items() if v}
        df_target = df.rename(columns=inv_mapping)

        report = {
            "missing_required": [],
            "missing_counts": {},
            "unresolved": {}
        }

        # 1. Check required fields
        for field in config['required']:
            missing = df_target[field].isna().sum() if field in df_target.columns else len(df_target)
            if missing > 0:
                report["missing_required"].append(field)
                report["missing_counts"][field] = int(missing)

        # 2. Check entities
        for field, model in config['entities'].items():
            if field not in df_target.columns: continue
            
            unique_values = df_target[field].dropna().unique()
            unresolved_values = []
            
            for val in unique_values:
                val_str = str(val).strip()
                if not val_str: continue

                if field == 'closer_username':
                    exists = User.query.filter_by(username=val_str).first()
                elif field == 'program_name':
                    exists = Program.query.filter_by(name=val_str).first()
                elif field == 'payment_method_name':
                    exists = PaymentMethod.query.filter_by(name=val_str).first()
                else:
                    exists = None
                
                if not exists:
                    unresolved_values.append(val_str)
            
            if unresolved_values:
                report["unresolved"][field] = unresolved_values

        return report

    @staticmethod
    def execute(df, target, mapping, options):
        config = ImportService.CONFIG.get(target)
        resolutions = options.get('resolutions', {})
        defaults = options.get('defaults', {})
        update_existing = options.get('update_existing', True)
        dry_run = options.get('dry_run', False)

        # Map and filter
        inv_mapping = {v: k for k, v in mapping.items() if v}
        df_target = df.rename(columns=inv_mapping)
        
        expected_fields = [field['name'] for field in config['fields']]
        active_fields = [f for f in df_target.columns if f in expected_fields]
        df_target = df_target[active_fields]

        stats = {"processed": 0, "success": 0, "errors": []}

        for index, row in df_target.iterrows():
            try:
                stats["processed"] += 1
                row_data = row.to_dict()

                # Clean NaNs and apply defaults
                for field in expected_fields:
                    val = row_data.get(field)
                    if pd.isna(val) or str(val).strip() == '':
                        row_data[field] = defaults.get(field)
                    else:
                        row_data[field] = str(val).strip()

                if target == 'leads':
                    ImportService._process_lead(row_data, update_existing, dry_run)
                elif target == 'sales':
                    ImportService._process_sale(row_data, resolutions, dry_run)

                stats["success"] += 1
            except Exception as e:
                stats["errors"].append({"row": index + 2, "error": str(e)})

        if not dry_run:
            try:
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                raise e
        else:
            db.session.rollback()

        return stats

    @staticmethod
    def _process_lead(data, update_existing, dry_run):
        email = data.get('email')
        if not email: raise Exception("Email missing")

        client = Client.query.filter_by(email=email).first()
        if not client:
            client = Client(
                full_name=data.get('full_name') or email.split('@')[0],
                email=email,
                phone=data.get('phone'),
                instagram=data.get('instagram')
            )
            db.session.add(client)
        elif update_existing:
            if data.get('full_name'): client.full_name = data.get('full_name')
            if data.get('phone'): client.phone = data.get('phone')
            if data.get('instagram'): client.instagram = data.get('instagram')

    @staticmethod
    def _process_sale(data, resolutions, dry_run):
        # 0. Datetime parsing
        sale_date = datetime.now()
        if data.get('date'):
            for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y'):
                try:
                    sale_date = datetime.strptime(data['date'], fmt)
                    break
                except: continue

        # 1. Resolve Closer
        closer_val = data.get('closer_username')
        res_closer = resolutions.get('closer_username', {}).get(closer_val)
        closer_username = res_closer if res_closer and res_closer != '__CREATE__' else closer_val
        
        if not closer_username: raise Exception("Falta closer_username")

        closer = User.query.filter_by(username=closer_username).first()
        if not closer:
            if res_closer == '__CREATE__':
                closer = User(username=closer_username, role='closer')
                closer.set_password('NeurOPS2025!')
                db.session.add(closer)
                db.session.flush()
            else:
                raise Exception(f"Closer '{closer_username}' no encontrado")

        # 2. Resolve Program
        prog_val = data.get('program_name')
        res_prog = resolutions.get('program_name', {}).get(prog_val)
        program_name = res_prog if res_prog and res_prog != '__CREATE__' else prog_val
        
        if not program_name: raise Exception("Falta program_name")

        program = Program.query.filter_by(name=program_name).first()
        if not program:
            if res_prog == '__CREATE__':
                price = 0.0
                if data.get('program_price'):
                    try:
                        price = float(str(data['program_price']).replace('$', '').replace(',', ''))
                    except: price = 0.0
                program = Program(name=program_name, price=price)
                db.session.add(program)
                db.session.flush()
            else:
                raise Exception(f"Programa '{program_name}' no encontrado")

        # 3. Resolve Payment Method
        meth_val = data.get('payment_method_name')
        res_meth = resolutions.get('payment_method_name', {}).get(meth_val)
        method_name = res_meth if res_meth and res_meth != '__CREATE__' else meth_val
        
        if not method_name: raise Exception("Falta payment_method_name")

        method = PaymentMethod.query.filter_by(name=method_name).first()
        if not method:
            if res_meth == '__CREATE__':
                method = PaymentMethod(name=method_name)
                db.session.add(method)
                db.session.flush()
            else:
                raise Exception(f"Método '{method_name}' no encontrado")

        # 4. Resolve Client
        client_email = data.get('student_email')
        if not client_email: raise Exception("Email del estudiante vacio")
        
        client = Client.query.filter_by(email=client_email).first()
        if not client:
            client = Client(
                full_name=data.get('student_name') or client_email.split('@')[0],
                email=client_email
            )
            db.session.add(client)
            db.session.flush()

        # 5. Create Enrollment
        enrollment = Enrollment.query.filter_by(client_id=client.id, program_id=program.id).first()
        if not enrollment:
            enrollment = Enrollment(
                client_id=client.id,
                program_id=program.id,
                closer_id=closer.id,
                enrollment_date=sale_date
            )
            db.session.add(enrollment)
            db.session.flush()

        # 6. Create Payment
        amount_val = data.get('payment_amount', '0')
        if isinstance(amount_val, str):
            amount_str = amount_val.replace('$', '').replace(',', '')
            try: amount = float(amount_str)
            except: amount = 0.0
        else:
            amount = float(amount_val or 0)

        payment = Payment(
            enrollment_id=enrollment.id,
            payment_method_id=method.id,
            amount=amount,
            payment_type=data.get('payment_type', 'full'),
            status='completed',
            date=sale_date
        )
        db.session.add(payment)
