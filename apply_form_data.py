import os
import sys
from dotenv import load_dotenv
from sqlalchemy import func

# Conectar a produccion
load_dotenv('.env')
prod_url = os.environ.get('DATABASE_PRODUCTION')
if prod_url:
    os.environ['DATABASE_URL'] = prod_url

from app import create_app
from app.models import db, Client, FinancialAgenda
from scratch.import_form_responses import parse_leads, deduplicate

app = create_app()

def find_agenda_for_name(name):
    # La agenda puede tener el nombre del cliente en 'nombre' o en 'lead'
    name_norm = name.strip().lower()
    
    # 1. Busqueda exacta (case insensitive)
    ag = FinancialAgenda.query.filter(
        func.lower(FinancialAgenda.nombre) == name_norm
    ).first()
    if ag: return ag
    
    ag = FinancialAgenda.query.filter(
        func.lower(FinancialAgenda.lead) == name_norm
    ).first()
    if ag: return ag

    # 2. Busqueda LIKE
    ag = FinancialAgenda.query.filter(
        func.lower(FinancialAgenda.nombre).like(f"%{name_norm}%")
    ).first()
    if ag: return ag
    
    ag = FinancialAgenda.query.filter(
        func.lower(FinancialAgenda.lead).like(f"%{name_norm}%")
    ).first()
    return ag

def find_client_for_agenda(ag):
    if not ag: return None
    
    ag_ig = ag.instagram.strip().lstrip('@').lower() if ag.instagram and ag.instagram.lower() not in ('n/a', '') else None
    ag_mail = ag.mail.strip().lower() if ag.mail and ag.mail.lower() not in ('n/a', '') else None
    ag_phone = ag.whatsapp.strip() if ag.whatsapp and ag.whatsapp.lower() not in ('n/a', '') else None
    
    c = None
    if ag_ig: c = Client.query.filter(func.lower(Client.instagram) == ag_ig).first()
    if not c and ag_mail: c = Client.query.filter(func.lower(Client.email) == ag_mail).first()
    if not c and ag_phone: c = Client.query.filter(Client.phone.like(f"%{ag_phone}%")).first()
    
    # Si no, buscar por el nombre de la agenda
    if not c:
        nombre_norm = ag.nombre.strip().lower()
        c = Client.query.filter(func.lower(Client.full_name) == nombre_norm).first()
    
    # Si no, buscar por el lead de la agenda
    if not c:
        lead_norm = ag.lead.strip().lower()
        c = Client.query.filter(func.lower(Client.full_name) == lead_norm).first()
        
    return c

with app.app_context():
    print("Cargando leads del archivo...")
    FILE_PATH = r"c:\Users\EQUIPO DELL\Documents\GitHub\NeurOPS\respuestas_form.md"
    leads = deduplicate(parse_leads(FILE_PATH))
    
    updated = 0
    not_found = 0
    
    for lead in leads:
        nombre = lead.get('nombre')
        ag = find_agenda_for_name(nombre)
        
        if not ag:
            # Intentar buscar el cliente directamente por si acaso
            c = Client.query.filter(func.lower(Client.full_name) == nombre.strip().lower()).first()
            if not c:
                print(f"[NO ENCONTRADO] {nombre}")
                not_found += 1
                continue
        else:
            c = find_client_for_agenda(ag)
            if not c:
                print(f"[AGENDA SIN CLIENTE] {nombre} (Agenda ID {ag.id})")
                not_found += 1
                continue
                
        # Actualizar client
        from sqlalchemy.orm.attributes import flag_modified
        current_form = dict(c.form_data or {})
        
        # Merge de los datos del form
        new_data = {
            "fuente_form": lead.get("fuente_form", "Setting Form"),
            "formacion": lead.get("formacion"),
            "puntaje": lead.get("puntaje"),
            "inversion": lead.get("inversion"),
            "interes": lead.get("interes"),
            "apoyo": lead.get("apoyo")
        }
        
        # Filtrar nulos
        new_data = {k: v for k, v in new_data.items() if v is not None}
        
        current_form.update(new_data)
        c.form_data = current_form
        flag_modified(c, 'form_data')
        
        print(f"[ACTUALIZADO] {nombre} -> Client ID: {c.id}")
        updated += 1
        
    db.session.commit()
    print(f"\nFinalizado! Actualizados: {updated} | No Encontrados: {not_found}")
