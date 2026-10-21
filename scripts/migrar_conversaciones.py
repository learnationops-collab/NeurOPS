"""Pasa los leads viejos a `conversations`, cada uno con su persona (frente B de docs/plan_personas.md).

Recorre `manychat_leads` (con sus `lead_answers`), `manychat_ad_leads` y `leads` con las mismas reglas que
los webhooks (`app/services/conversaciones_service.py`): una conversaciÃ³n por persona y anuncio. Los
leads armados a mano (`synth_`, `manual_`...) solo se vinculan a una persona que ya exista.

Uso:
  python scripts/migrar_conversaciones.py            # prueba: cuenta quÃ© harÃ­a y no guarda nada
  python scripts/migrar_conversaciones.py --apply    # guarda

Correrlo dos veces no duplica nada: la conversaciÃ³n de un id y un anuncio que ya estÃ¡ se completa.
Conviene correrlo despuÃ©s de scripts/backfill_person_identities.py, asÃ­ encuentra a las personas por
sus mails e instagrams y no crea duplicados.
"""
import os
import sys
from collections import Counter
from datetime import datetime

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app, db
from app.models import Conversation, Lead, LeadAnswer, ManychatAdLead, ManychatLead, Person
from app.services import conversaciones_service as cs

TANDA = 200


def _por_tandas(model):
    ultimo = 0
    while True:
        filas = model.query.filter(model.id > ultimo).order_by(model.id).limit(TANDA).all()
        if not filas:
            return
        yield filas
        ultimo = filas[-1].id


def _anuncio_viejo(fila, cuenta):
    """Una fila de `manychat_ad_leads`: su persona por el manychat_id y la conversaciÃ³n de su anuncio."""
    canal, externo = cs.canal_de(fila.manychat_id)
    if not externo:
        return
    real = cs.manychat_id_real(fila.manychat_id)
    person = cs.persona_de(fila.lead_name, crear=bool(real), actual_uuid=fila.person_uuid, manychat_id=real)
    if person is not None:
        fila.person = person
    calif = fila.qualification if fila.qualification in cs.CALIFICACIONES else None
    cs._guardar_conversacion(canal, externo, person, ad_id=fila.ad_id, keyword=fila.keyword,
                             creada=fila.created_at, qualification=calif, data={'manychat_ad_lead_id': fila.id})
    cuenta['manychat_ad_leads'] += 1


def _origen(manychat_id):
    canal, _ = cs.canal_de(manychat_id)
    if canal == 'instagram':
        return 'motor_ig'
    if cs.manychat_id_real(manychat_id):
        return 'manychat'
    return (str(manychat_id).split('_')[0] or 'otro')[:20]  # synth, manual, la marca de palabra_clave...


def _contar(lead, cuenta, tabla, inicio):
    """Por origen del manychat_id: personas creadas en esta corrida, vinculadas a una que ya estaba, y
    sin persona. «Creada» es por su `created_at`: la persona nueva ya se guardó (autoflush) al contarla."""
    origen = f'{tabla}:{_origen(lead.manychat_id)}'
    if lead.person is None:
        cuenta['sin_persona'][origen] += 1
    elif lead.person.uuid not in cuenta['vistas'] and (
            lead.person in db.session.new or (lead.person.created_at and lead.person.created_at >= inicio)):
        cuenta['nuevas'][origen] += 1  # la primera vez; el segundo lead de la misma persona es «vinculada»
    else:
        cuenta['vinculadas'][origen] += 1
    if lead.person is not None:
        cuenta['vistas'].add(lead.person.uuid)


def ejecutar(apply=False):
    inicio = datetime.utcnow()
    cuenta = Counter()
    por_origen = {'nuevas': Counter(), 'vinculadas': Counter(), 'sin_persona': Counter(), 'vistas': set()}
    personas_antes = Person.query.count()
    convs_antes = Conversation.query.count()
    with cs.pausado():
        for tanda in _por_tandas(ManychatLead):
            for lead in tanda:
                cs.sincronizar_lead(lead)
                _contar(lead, por_origen, 'mc', inicio)
                # La respuesta mÃ¡s vieja primero: asÃ­ la calificaciÃ³n que queda es la Ãºltima.
                for answer in lead.answers.order_by(LeadAnswer.created_at, LeadAnswer.id):
                    cs.sincronizar_respuesta(answer, lead)
                    cuenta['lead_answers'] += 1
                db.session.flush()
                cuenta['manychat_leads'] += 1
                cuenta['con_persona'] += lead.person_uuid is not None
        for tanda in _por_tandas(ManychatAdLead):
            for fila in tanda:
                _anuncio_viejo(fila, cuenta)
                db.session.flush()
        for tanda in _por_tandas(Lead):
            for lead in tanda:
                cs.sincronizar_lead_viejo(lead)
                _contar(lead, por_origen, 'leads', inicio)
                db.session.flush()
                cuenta['leads'] += 1
    personas = Person.query.count() - personas_antes
    convs = Conversation.query.count() - convs_antes
    sin_persona = Conversation.query.filter(Conversation.person_uuid.is_(None)).count()
    vacias = Conversation.query.filter(Conversation.ad_id.is_(None), Conversation.keyword.is_(None)).count()
    print(f'leidos: {dict(cuenta)}')
    print(f'personas nuevas: {personas} | conversaciones nuevas: {convs} | conversaciones sin persona: {sin_persona}'
          f' | sin anuncio ni palabra clave: {vacias}')
    for tipo, contador in ((t, c) for t, c in por_origen.items() if t != 'vistas'):
        print(f'  {tipo} por origen: {dict(contador.most_common())}')
    if not apply:
        db.session.rollback()
        print('\n[PRUEBA] No se escribiÃ³ nada. CorrÃ© con --apply para guardar.')
    else:
        db.session.commit()
        print('\nAplicado.')
    return {'personas': personas, 'conversaciones': convs, 'sin_persona': sin_persona, **cuenta}


if __name__ == '__main__':
    with create_app().app_context():
        ejecutar(apply='--apply' in sys.argv)
