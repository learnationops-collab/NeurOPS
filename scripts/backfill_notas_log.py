"""Backfill de las notas viejas al log de la persona (docs/plan_notas_avisos_settings.md, etapa 2).

Decisiones (docs/auditoria_notas_junio_2026.md y plan §3, 26/10/2026):
  · Nota de la llamada (`appointments.closer_notes`): el texto «[Sistema] …» se separa y va como evento sin
    autor, fechado con `updated_at` de la agenda. Lo que escribió una persona va como `nota_llamada`: cada
    versión de la bitácora (jun 2026 en adelante) con su fecha y su autor; si no hay versiones, una con la
    fecha de la llamada y el closer de la agenda. La columna queda con la nota limpia (es la copia de la
    nota actual que leen las listas).
  · `comments` tipo client: las copias de una nota de la llamada se descartan; las 29 de clientes que ya
    no existen, también. El resto (notas propias y el referido) va como `nota` de la persona.
  · `comments` tipo appointment y `client_comments`: van tal cual, como `nota`.
  · `setter_notes`: `nota_setter`, fecha de la llamada, autor el setter (o el closer).
  · Las notas que parecen pruebas se listan; solo se descartan las que se pasen con --excluir.

Cada entrada lleva `payload.backfill` con su origen: correrlo dos veces no duplica nada, y lo que el código
nuevo ya escribió en el log con el mismo texto tampoco se repite.

Uso (en el servidor):
  python scripts/backfill_notas_log.py                       # ensayo: cuenta y lista, no escribe
  python scripts/backfill_notas_log.py --apply               # escribe
  python scripts/backfill_notas_log.py --apply --excluir comments:11,comments:12
"""
import argparse
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ['DISABLE_REMINDER_SCHEDULER'] = 'true'
os.environ['FOLLOWUP_REMINDERS_ENABLED'] = 'false'

from sqlalchemy import text  # noqa: E402

from app import create_app, db  # noqa: E402
from app.models import Appointment, LeadEventLog  # noqa: E402

SISTEMA = re.compile(r'\[Sistema\][^\[]*')
NOTAS_DEL_EVENTO = re.compile(r'Notas: "(.*)"\s*$', re.S)
TIPO_SISTEMA = [
    ('Archivado autom', 'archivada_automatica'),
    ('Cita creada autom', 'cita_creada_automatica'),
    ('Agenda creada para declarar una venta', 'agenda_para_venta'),
    ('seguimiento de recuperaci', 'pasada_a_recuperacion'),
    ('no reportó esta llamada', 'archivada_sin_reporte'),
]
PRUEBA = re.compile(r'^(´?prob)|([bcdfghjklmnñpqrstvwxyz]{5,})|(asd|sdf|jkl|kjd|nsk|dnf)', re.I)
JUNIO, ENERO = datetime(2026, 6, 1), datetime(2026, 1, 1)


def norm(t):
    return re.sub(r'\s+', ' ', (t or '').strip()).lower()


def limpiar(t):
    """(nota de la persona, [textos del sistema]) de una nota de la llamada."""
    sistema = [s.strip() for s in SISTEMA.findall(t or '') if s.strip()]
    humano = SISTEMA.sub('', t or '')
    humano = '\n'.join(l.rstrip() for l in humano.strip().splitlines() if l.strip())
    return humano, sistema


def tipo_de_sistema(s):
    return next((t for clave, t in TIPO_SISTEMA if clave in s), 'evento_sistema')


def tramo(d):
    return '1 antes 2026' if d and d < ENERO else '2 ene-may 2026' if d and d < JUNIO else '3 desde jun 2026'


class Backfill:
    def __init__(self, apply, excluir):
        self.apply, self.excluir = apply, excluir
        self.cuenta = defaultdict(Counter)
        self.ya = {r[0] for r in db.session.execute(text(
            "select payload->>'backfill' from lead_event_logs where payload->>'backfill' is not null"))}
        # Lo que el log ya tiene (escrito por el código nuevo): (tipo, agenda, texto) para no repetirlo.
        self.existente = {(t, o, norm(d)) for t, o, d in db.session.execute(text(
            "select action_type, origen_id, description from lead_event_logs "
            "where action_type in ('nota_llamada','nota','nota_setter') and payload->>'backfill' is null"))}
        self.pruebas = []
        self.limpiar_columna = []

    def agregar(self, clave, persona, tipo, texto, user_id, fecha, origen_id=None, grupo='', categoria=''):
        self.cuenta[categoria][tramo(fecha)] += 1
        if clave in self.ya or (tipo, origen_id, norm(texto)) in self.existente:
            self.cuenta[categoria + ' (ya estaba)'][tramo(fecha)] += 1
            return
        if not self.apply:
            return
        e = LeadEventLog(person_uuid=persona, action_type=tipo, description=texto, user_id=user_id,
                         origen='appointment' if origen_id else None, origen_id=origen_id,
                         appointment_id=origen_id, payload={'backfill': clave}, created_at=fecha)
        db.session.add(e)

    def agendas(self):
        versiones = defaultdict(list)
        for aid, uid, desc, f in db.session.execute(text(
                "select appointment_id, user_id, description, created_at from lead_event_logs "
                "where action_type='closer_notes' order by created_at, id")):
            m = NOTAS_DEL_EVENTO.search(desc or '')
            if not m:
                continue
            humano, _ = limpiar(m.group(1))
            if humano and (not versiones[aid] or norm(versiones[aid][-1][2]) != norm(humano)):
                versiones[aid].append((f, uid, humano))

        self.textos_por_cliente = defaultdict(set)
        for a in Appointment.query.filter(Appointment.closer_notes.isnot(None),
                                          db.func.trim(Appointment.closer_notes) != '').yield_per(500):
            persona = a.person_uuid or (a.client.person_uuid if a.client else None)
            humano, sistema = limpiar(a.closer_notes)
            for i, s in enumerate(sistema):
                self.agregar(f'sistema:{a.id}:{i}', persona, tipo_de_sistema(s), s.replace('[Sistema]', '').strip(),
                             None, a.updated_at or a.start_time, a.id, categoria='evento del sistema')
            vs = versiones.get(a.id, [])
            for i, (f, uid, t) in enumerate(vs):
                self.agregar(f'version:{a.id}:{i}', persona, 'nota_llamada', t, uid or a.closer_id, f, a.id,
                             categoria='nota_llamada (versión de la bitácora)')
                self.textos_por_cliente[a.client_id].add(norm(t))
            if humano and (not vs or norm(vs[-1][2]) != norm(humano)):
                fecha = max(a.updated_at or vs[-1][0], vs[-1][0]) if vs else a.start_time
                self.agregar(f'columna:{a.id}', persona, 'nota_llamada', humano, a.closer_id, fecha, a.id,
                             categoria='nota_llamada (columna)')
            if humano:
                self.textos_por_cliente[a.client_id].add(norm(humano))
            if a.closer_notes != humano:
                # SQL directo y no el ORM: `updated_at` (onupdate) es lo que los reportes diarios usan para
                # contar el trabajo del día, y limpiar la nota no es trabajo de nadie.
                self.limpiar_columna.append({'id': a.id, 'nota': humano})
                self.cuenta['columna limpiada'][tramo(a.start_time)] += 1
            if a.setter_notes and a.setter_notes.strip():
                self.agregar(f'setter:{a.id}', persona, 'nota_setter', a.setter_notes.strip(),
                             a.setter_id or a.closer_id, a.start_time, a.id, categoria='nota_setter')

    def comentarios(self):
        for cid, client_id, texto, f, autor, persona in db.session.execute(text(
                "select c.id, c.associated_id, c.text, c.created_at, c.author_id, k.person_uuid from comments c "
                "left join clients k on k.id = c.associated_id where c.comment_type='client'")):
            clave = f'comments:{cid}'
            if persona is None:
                self.cuenta['descartada: cliente inexistente'][tramo(f)] += 1
                continue
            if norm(texto) in self.textos_por_cliente.get(client_id, set()):
                self.cuenta['descartada: copia de la nota de la llamada'][tramo(f)] += 1
                continue
            if self._es_prueba(clave, texto, f, autor):
                continue
            self.agregar(clave, persona, 'nota', texto, autor, f, categoria='nota (comments del cliente)')
        for cid, aid, texto, f, autor, persona in db.session.execute(text(
                "select c.id, c.associated_id, c.text, c.created_at, c.author_id, a.person_uuid from comments c "
                "join appointments a on a.id = c.associated_id where c.comment_type='appointment'")):
            clave = f'comments:{cid}'
            if not self._es_prueba(clave, texto, f, autor):
                self.agregar(clave, persona, 'nota', texto, autor, f, aid, categoria='nota (hilo de la agenda)')
        for cid, texto, f, autor, persona in db.session.execute(text(
                "select c.id, c.text, c.created_at, c.author_id, k.person_uuid from client_comments c "
                "join clients k on k.id = c.client_id")):
            clave = f'client_comments:{cid}'
            if not self._es_prueba(clave, texto, f, autor):
                self.agregar(clave, persona, 'nota', texto, autor, f, categoria='nota (hilo del cliente)')

    def _es_prueba(self, clave, texto, fecha, autor):
        if clave in self.excluir:
            self.cuenta['descartada: marcada como prueba'][tramo(fecha)] += 1
            return True
        if PRUEBA.search(norm(texto)):
            self.pruebas.append((clave, fecha, autor, texto))
        return False


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--apply', action='store_true')
    p.add_argument('--excluir', default='', help='claves separadas por coma (ej. comments:11,client_comments:4)')
    args = p.parse_args()
    excluir = {x.strip() for x in args.excluir.split(',') if x.strip()}

    app = create_app()
    with app.app_context():
        b = Backfill(args.apply, excluir)
        b.agendas()
        b.comentarios()
        print('APLICADO' if args.apply else 'ENSAYO (nada escrito; --apply para escribir)')
        for categoria in sorted(b.cuenta):
            print(f'  {categoria:48} {dict(sorted(b.cuenta[categoria].items()))}')
        if b.pruebas:
            print(f'\n  Parecen pruebas ({len(b.pruebas)}): entran salvo que se pasen con --excluir')
            for clave, f, autor, t in b.pruebas:
                print(f'    {clave:24} {f:%d/%m/%Y} autor {autor}: «{re.sub(chr(10), " ", t)[:80]}»')
        if args.apply:
            if b.limpiar_columna:
                db.session.execute(text('UPDATE appointments SET closer_notes = :nota WHERE id = :id'),
                                   b.limpiar_columna)
            db.session.commit()


if __name__ == '__main__':
    main()
