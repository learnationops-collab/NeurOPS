"""Los alumnos de la Academia y sus asignaciones (export de `scripts/academia_export.php`), cruzados con las
personas y las ventas de Work. Lo usa `scripts/backfill_subscriptions.py` (docs/plan_personas.md, 22/10/2026).

Persona del alumno, en orden: su id de la Academia, el cliente que la Academia guarda (`work_id`), su mail
y, si nada de eso, una venta de Work con un pago cerca de cuando se le dio el acceso a alguien con su
apellido y otro nombre en común (el closer cargó un mail y después se habilitó otro).
"""
import json
import unicodedata
from collections import defaultdict
from datetime import datetime, timedelta

from app import db
from app.models import Client, FinancialSale, Person, Sale
from app.services import person_service

ANTES, DESPUES = timedelta(days=3), timedelta(days=10)
ROLES_ALUMNO = ('student', 'free')
# Cuentas de prueba o del equipo: por palabra del nombre o por dominio del mail (no por texto suelto:
# «lisbetestefanie» no es una prueba).
PALABRAS_PRUEBA = {'prueba', 'test', 'testing', '[sim]', 'learnationtest'}
DOMINIOS_PRUEBA = ('@thelearnation.com', '@thelaernation.com', '.test', '@student.com')


def _dt(valor):
    return datetime.fromisoformat(str(valor)[:19]) if valor else None


def _plano(texto):
    texto = unicodedata.normalize('NFKD', (texto or '').lower())
    return ''.join(c for c in texto if not unicodedata.combining(c))


def _tokens(texto):
    return {w for w in _plano(texto).replace('.', ' ').split() if len(w) > 2}


def _apellido(texto):
    partes = _plano(texto).split()
    return partes[-1] if partes else None


def es_prueba(u):
    mail = (u.get('email') or '').lower()
    return bool(set(_plano(u.get('name')).split()) & PALABRAS_PRUEBA) or mail.endswith(DOMINIOS_PRUEBA)


def leer(archivo, slugs):
    """({alumno: [asignaciones pagas]}, {alumno: usuario}) del export, sin staff."""
    export = json.load(open(archivo, encoding='utf-8'))
    alumnos = {u['id']: u for u in export['users'] if u.get('role') in ROLES_ALUMNO}
    filas = defaultdict(list)
    for a in export['asig']:
        if a['slug'] in slugs and a['user_id'] in alumnos:
            a['creada'], a['modificada'], a['vence'] = _dt(a['created_at']), _dt(a['updated_at']), _dt(a['expires_at'])
            filas[a['user_id']].append(a)
    return filas, alumnos


def momentos(fila):
    return [m for m in (fila['creada'], fila['modificada']) if m]


def cerca(fecha, momento):
    return fecha - ANTES <= momento <= fecha + DESPUES


def vigente(person):
    vistos = set()
    while person is not None and person.merged_into_uuid and person.uuid not in vistos:
        vistos.add(person.uuid)
        person = db.session.get(Person, person.merged_into_uuid)
    return person


class Ventas:
    """Las ventas con las fechas de sus pagos, leídas una vez."""

    def __init__(self):
        self.por_persona, self.todas = defaultdict(list), []
        pagos = defaultdict(list)
        for p in FinancialSale.query.filter(FinancialSale.sale_id.isnot(None)).all():
            pagos[p.sale_id].append(p)
        nombres = dict(db.session.query(Person.uuid, Person.full_name).all())
        for v in Sale.query.filter(Sale.person_uuid.isnot(None)).all():
            fechas = sorted(p.date for p in pagos[v.id] if p.date) or ([v.sold_at] if v.sold_at else [])
            item = (v, fechas)
            self.por_persona[v.person_uuid].append(item)
            texto = ' '.join([nombres.get(v.person_uuid) or ''] + [p.nombre_cliente or '' for p in pagos[v.id]])
            self.todas.append((v, fechas, _tokens(texto), {_apellido(nombres.get(v.person_uuid))}
                               | {_apellido(p.nombre_cliente) for p in pagos[v.id]}))
        self.pagos = pagos

    def de(self, person_uuid):
        return self.por_persona.get(person_uuid, [])

    def cerca(self, person_uuid, instantes, usadas=()):
        """La venta de la persona con un pago más cerca de alguno de los instantes (dentro de la ventana)."""
        mejor = None
        for venta, fechas in self.de(person_uuid):
            if venta.id in usadas:
                continue
            for m in instantes:
                for f in fechas:
                    if cerca(f, m) and (mejor is None or abs(m - f) < mejor[0]):
                        mejor = (abs(m - f), venta)
        return mejor[1] if mejor else None

    def libre_antes(self, person_uuid, instante, usadas, dias_antes=180, dias_despues=30):
        """La venta todavía sin acceso más cercana a un acceso dado con demora (o antes de tiempo)."""
        opciones = [(abs((v.sold_at - instante).total_seconds()), v) for v, _ in self.de(person_uuid)
                    if v.id not in usadas and v.sold_at and v.status == 'active'
                    and instante - timedelta(days=dias_antes) <= v.sold_at <= instante + timedelta(days=dias_despues)]
        return min(opciones, key=lambda x: x[0])[1] if opciones else None

    def solo_sena(self, venta):
        pagos = self.pagos.get(venta.id) or []
        return bool(pagos) and all(any(s in _plano(p.tipo_pago) for s in ('seña', 'sena', 'reserva')) for p in pagos)

    def persona_por_nombre_y_fecha(self, alumno, filas):
        """La única persona con una venta pagada cerca de alguna asignación del alumno y su apellido y otro
        nombre en común."""
        suyos, apellido = _tokens(alumno.get('name')), _apellido(alumno.get('name'))
        candidatas = set()
        for venta, fechas, tokens, apellidos in self.todas:
            comun = suyos & tokens
            if len(comun) < 2 or not (comun & ({apellido} | apellidos)):
                continue
            if any(cerca(f, m) for fila in filas for m in momentos(fila) for f in fechas):
                candidatas.add(venta.person_uuid)
        return person_service.por_uuid(candidatas.pop()) if len(candidatas) == 1 else None


def persona_del_alumno(u, filas, ventas):
    """(persona, cómo se la encontró) o (None, None)."""
    person = person_service.buscar(learnation_user_id=u['id'])
    if person is not None:
        return vigente(person), 'id'
    if str(u.get('work_id') or '').isdigit():
        cliente = db.session.get(Client, int(u['work_id']))
        if cliente is not None and cliente.person_uuid:
            return vigente(person_service.por_uuid(cliente.person_uuid)), 'work_id'
    if u.get('email'):
        person = person_service.buscar(email=u['email'])
        if person is not None:
            return vigente(person), 'mail'
    person = ventas.persona_por_nombre_y_fecha(u, filas)
    return (vigente(person), 'nombre y fecha') if person is not None else (None, None)
