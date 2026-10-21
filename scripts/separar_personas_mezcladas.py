"""Personas que mezclan a dos personas reales (docs/plan_personas.md, ensayo general del 21/10/2026).

En producción hay clientes con el nombre y el teléfono de quien compró y el mail de quien agendó: el
`booking_service` viejo pisaba el contacto al cruzar por mail. La persona salió de ese cliente, así que
tiene los pagos de uno y la agenda y el mail del otro (ej. «Eli Vest» con la agenda y el mail de Melbrum
Agudelo).

Una agenda es ajena si su `nombre_persona` no es compatible con el nombre de su persona
(`person_service.mismo_nombre`). Con `--apply`, cada agenda ajena y su mail (si es una identidad de la
persona) pasan a la persona del tercero: la que ya tenga ese mail con un nombre compatible, o una nueva con
el nombre de la agenda. La persona original se queda con sus pagos, su teléfono y su cliente; si su mail
principal era el del tercero, pasa a principal otro mail suyo, o queda sin mail principal.

El modo prueba separa por la fecha de la agenda ajena: antes de 2026, de enero al 20/05/2026 y después.

Uso:
  python scripts/separar_personas_mezcladas.py [--ejemplos 15]   # prueba
  python scripts/separar_personas_mezcladas.py --apply           # separa
"""
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime
from uuid import uuid4

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app, db
from app.models import Client, FinancialAgenda, FinancialSale, Person, PersonIdentity, User
from app.services.client_dedup_service import _normalize_name
from app.services.person_service import mismo_nombre, nombre_limpio, normalizar

sys.path.append(os.path.abspath(os.path.dirname(__file__)))
from fusionar_lista import mail_se_parece  # noqa: E402

INICIO_2026, RECIENTES = datetime(2026, 1, 1), datetime(2026, 5, 20)
MOTIVO = 'Agenda de otra persona (scripts/separar_personas_mezcladas.py)'


def _tramo(fecha):
    if fecha is None or fecha < INICIO_2026:
        return 'antes de 2026'
    return 'ene-20/05/2026' if fecha < RECIENTES else 'desde el 20/05/2026'


def casos():
    """[(persona, agenda, nombre del tercero, mail del tercero o None)] de las agendas ajenas."""
    nombres = dict(db.session.query(Person.uuid, Person.full_name).filter(Person.merged_into_uuid.is_(None)))
    mails = defaultdict(set)   # persona -> {mail activo}
    for pu, valor in db.session.query(PersonIdentity.person_uuid, PersonIdentity.value).filter(
            PersonIdentity.kind == 'email', PersonIdentity.retired_at.is_(None)):
        mails[pu].add(valor)
    # Con el `lead` vacío, `nombre_persona` cae en `nombre`, que en el formato nuevo es la fuente o el setter
    # («Elias»): un nombre del equipo no es el de un tercero.
    equipo = {_normalize_name(u) for (u,) in db.session.query(User.username) if u}
    equipo |= {n.split(' ')[0] for n in equipo if n}
    salida = []
    for a in FinancialAgenda.query.filter(FinancialAgenda.person_uuid.isnot(None)).yield_per(1000):
        nombre = nombre_limpio(a.nombre_persona)
        if a.person_uuid not in nombres or not nombre or mismo_nombre(nombre, nombres[a.person_uuid]):
            continue
        if _normalize_name(nombre) in equipo or _normalize_name(nombre).split(' ')[0] in equipo and ' ' not in nombre.strip():
            continue
        mail = normalizar('email', a.mail)
        salida.append((a.person_uuid, a, nombre, mail if mail in mails[a.person_uuid] else None))
    return salida, nombres, mails


def destino(nombre, mail, origen):
    """La persona del tercero: la que ya tiene ese mail con un nombre compatible, o None (hay que crearla)."""
    if not mail:
        return None
    for pu, in db.session.query(PersonIdentity.person_uuid).filter(
            PersonIdentity.kind == 'email', PersonIdentity.value == mail, PersonIdentity.retired_at.is_(None),
            PersonIdentity.person_uuid != origen):
        p = db.session.get(Person, pu)
        if p and not p.merged_into_uuid and mismo_nombre(p.full_name, nombre):
            return p
    return None


def main(apply=False, ejemplos=15):
    lista, nombres, mails = casos()
    pagos = Counter(u for (u,) in db.session.query(FinancialSale.person_uuid).filter(FinancialSale.person_uuid.isnot(None)))
    mails_de_pagos = defaultdict(set)
    for pu, m in db.session.query(FinancialSale.person_uuid, FinancialSale.mail_cliente).filter(
            FinancialSale.person_uuid.isnot(None)):
        if normalizar('email', m):
            mails_de_pagos[pu].add(normalizar('email', m))
    principal = dict(db.session.query(Person.uuid, Person.email))
    duenos = defaultdict(set)
    for pu, ms in mails.items():
        for m in ms:
            duenos[m].add(pu)

    por_tramo = defaultdict(lambda: {'agendas': 0, 'personas': set(), 'con_pagos': set(), 'principal': set(),
                                     'existente': 0, 'mail_de_sus_pagos': set(), 'mail': Counter()})
    for pu, a, nombre, mail in lista:
        t = por_tramo[_tramo(a.date)]
        t['agendas'] += 1
        # ¿De quién parece el mail? Del tercero (se separa bien), de la persona (agendó ella por otro: el mail
        # se queda) o de ninguno de los dos (no se sabe).
        if mail:
            del_tercero, de_ella = mail_se_parece(mail, nombre), mail_se_parece(mail, nombres[pu])
            t['mail'][('del tercero' if del_tercero and not de_ella else 'de la persona' if de_ella and not del_tercero
                       else 'de ninguno/ambos')] += 1
        else:
            t['mail']['no es identidad suya'] += 1
        t['personas'].add(pu)
        if pagos[pu]:
            t['con_pagos'].add(pu)
        if mail and (principal.get(pu) or '').strip().lower() == mail:
            t['principal'].add(pu)
        if mail and mail in mails_de_pagos[pu]:
            t['mail_de_sus_pagos'].add(pu)  # el tercero también figura en sus pagos: puede ser quien pagó
        if mail and any(q != pu and q in nombres and mismo_nombre(nombres[q], nombre) for q in duenos[mail]):
            t['existente'] += 1

    print(f'Agendas ajenas: {len(lista)}, en {len({c[0] for c in lista})} personas')
    print(f'{"tramo":22} {"agendas":>8} {"personas":>9} {"con pagos":>10} {"mail principal del tercero":>27} '
          f'{"a persona existente":>20} {"su mail está en sus pagos":>26}')
    for tramo in ('antes de 2026', 'ene-20/05/2026', 'desde el 20/05/2026'):
        t = por_tramo[tramo]
        print(f'{tramo:22} {t["agendas"]:8} {len(t["personas"]):9} {len(t["con_pagos"]):10} {len(t["principal"]):27} '
              f'{t["existente"]:20} {len(t["mail_de_sus_pagos"]):26}')
        print(f'{"":22} mail de la agenda: {dict(t["mail"])}')

    print(f'\nEjemplos ({ejemplos}):')
    for pu, a, nombre, mail in sorted(lista, key=lambda c: -pagos[c[0]])[:ejemplos]:
        print(f'  {pu[:8]} {nombres[pu]!r} ({pagos[pu]} pagos, principal {principal.get(pu)}) <- agenda {a.id} '
              f'{a.date:%Y-%m-%d} de {nombre!r} ({a.mail}{"" if mail else ", no es identidad suya"})')

    if not apply:
        print('\n[PRUEBA] No se separó nada. Corré con --apply para separar.')
        return
    hechos = 0
    for pu, a, nombre, mail in lista:
        origen = db.session.get(Person, pu)
        tercero = destino(nombre, mail, pu)
        if tercero is None:
            tercero = Person(uuid=str(uuid4()), full_name=nombre)
            db.session.add(tercero)
        a.person_uuid = tercero.uuid
        if mail:
            ident = PersonIdentity.query.filter_by(person_uuid=pu, kind='email', value=mail).first()
            era_principal = bool(ident and ident.is_primary)
            if ident is not None:
                if PersonIdentity.query.filter_by(person_uuid=tercero.uuid, kind='email', value=mail).first():
                    db.session.delete(ident)
                else:
                    ident.person_uuid = tercero.uuid
                    ident.is_primary = not tercero.email
                    ident.review_note = None
                    if not tercero.email:
                        tercero.email = mail
            if era_principal or (origen.email or '').strip().lower() == mail:
                otro = PersonIdentity.query.filter(
                    PersonIdentity.person_uuid == pu, PersonIdentity.kind == 'email', PersonIdentity.value != mail,
                    PersonIdentity.retired_at.is_(None), PersonIdentity.review_note.is_(None)).first()
                origen.email = otro.value if otro else None
                if otro:
                    otro.is_primary = True
            for cliente in Client.query.filter_by(person_uuid=pu):
                if (cliente.email or '').strip().lower() == mail:
                    cliente.email = origen.email
        hechos += 1
    db.session.commit()
    print(f'\nAplicado: {hechos} agendas separadas.')


if __name__ == '__main__':
    with create_app().app_context():
        n = int(sys.argv[sys.argv.index('--ejemplos') + 1]) if '--ejemplos' in sys.argv else 15
        main(apply='--apply' in sys.argv, ejemplos=n)
