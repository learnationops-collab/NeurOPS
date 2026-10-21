"""Frente J (docs/plan_personas.md, Etapa 2b): los pagos que quedaron con la persona de quien PAGÓ y no
con la de quien compró, y su corrección.

`vincular_personas` le puso a cada pago viejo la persona de su mail. Cuando alguien pagó con el mail de
otro (un familiar, una cuenta ajena), el pago quedó con esa persona aunque el nombre y el teléfono de la
fila son de quien compró. Con el criterio estricto de J ese cliente dejó de ver el pago.

Variante por mail (cuando el cliente no tiene teléfono): el pago quedó en una persona con otro nombre y el
mail de la copia es también de una persona con nombre compatible y con cliente; pasa a ésa, sin pagador.

Un pago se corrige si:
  · el nombre copiado es compatible con el de un cliente (`person_service.mismo_nombre`), y
  · el teléfono copiado es el de ese cliente, o es un teléfono de la persona del cliente, y
  · el mail copiado es de otra persona, con otro nombre.
Con --apply el pago pasa a la persona del cliente (y a su `client_id`; `sale_service` lo vuelve a ubicar en
una venta de esa persona y borra la que quede vacía). La dueña del mail queda como `payer_person_uuid`
(NULL si es la misma que compró). El mail sigue siendo de la pagadora; si la compradora también lo tenía,
se le da de baja.

Aparte, solo para revisar: los pares de personas con el mismo nombre y teléfonos distintos (candidatos a
fusión manual), y los pagos dudosos (sin teléfono, solo coincide el nombre), que no se tocan.

Con `--hasta AAAA-MM-DD` solo se corrigen los pagos anteriores a esa fecha; los demás se listan aparte, en
dos tramos: hasta el 20/05/2026 (se revisan) y después (no se tocan; decisión de Santiago del 20/10/2026).

Uso:
  python scripts/corregir_comprador_pagador.py                               # prueba: cuántos, plata, ejemplos
  python scripts/corregir_comprador_pagador.py --hasta 2026-01-01            # prueba, solo los anteriores
  python scripts/corregir_comprador_pagador.py --hasta 2026-01-01 --apply    # corrige los anteriores
"""
import os
import sys
from datetime import datetime
from collections import Counter, defaultdict

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app, db
from app.models import Client, FinancialSale, Person, PersonIdentity, Sale, Subscription
from app.services import person_service
from app.services.client_dedup_service import _normalize_name
from app.services.person_service import mismo_nombre, normalizar

EJEMPLOS = 10
RECIENTES = datetime(2026, 5, 20)  # desde acá no se tocan (se corrigen si aparecen inconsistencias)
MOTIVO = 'Pagó con el mail de otra persona (scripts/corregir_comprador_pagador.py)'


class Indice:
    def __init__(self):
        self.nombre = dict(db.session.query(Person.uuid, Person.full_name).filter(Person.merged_into_uuid.is_(None)))
        self.duenos = defaultdict(set)      # (kind, valor) -> {persona}
        self.mails_todos = defaultdict(set)  # mail -> {persona}, también los marcados para revisar
        self.telefonos = defaultdict(set)   # persona -> {teléfono normalizado}
        for pu, kind, valor, nota in db.session.query(PersonIdentity.person_uuid, PersonIdentity.kind,
                                                      PersonIdentity.value, PersonIdentity.review_note).filter(
                PersonIdentity.retired_at.is_(None), PersonIdentity.kind.in_(('email', 'phone'))):
            if pu not in self.nombre:
                continue
            if kind == 'email':
                self.mails_todos[valor].add(pu)
            if nota is None:
                self.duenos[(kind, valor)].add(pu)
                if kind == 'phone':
                    self.telefonos[pu].add(valor)
        self.clientes = {}
        self.por_tel = defaultdict(set)
        self.por_nombre = defaultdict(set)
        for cid, nombre, tel, pu in db.session.query(Client.id, Client.full_name, Client.phone, Client.person_uuid):
            self.clientes[cid] = (nombre, pu)
            if normalizar('phone', tel):
                self.por_tel[normalizar('phone', tel)].add(cid)
            if _normalize_name(nombre):
                self.por_nombre[_normalize_name(nombre)].add(cid)
        self.clientes_de = clientes_de = defaultdict(set)
        for cid, (_, pu) in self.clientes.items():
            if pu:
                clientes_de[pu].add(cid)
        # Un teléfono de la persona del cliente vale como el del cliente.
        for pu, tels in self.telefonos.items():
            for t in tels:
                self.por_tel[t] |= clientes_de.get(pu, set())


def por_mail(v, mail, ind):
    """La variante por mail (parte del paso 9), para cuando el teléfono no encuentra al comprador (su cliente no
    tiene teléfono): el pago quedó en una persona con otro nombre, y el mail de la copia es también de una
    persona con nombre compatible y con cliente. Esa otra persona no es quien pagó: está contaminada (tiene el
    mail del comprador). El pago pasa al comprador y no lleva pagador."""
    if mismo_nombre(ind.nombre.get(v.person_uuid), v.nombre_cliente):
        return None
    compradores = {p for p in ind.mails_todos.get(mail, ()) if p != v.person_uuid and ind.clientes_de.get(p)
                   and mismo_nombre(ind.nombre.get(p), v.nombre_cliente)}
    if not compradores:
        return None
    if len(compradores) > 1:
        return 'dudoso_varios_compradores', None, None, None
    comprador = compradores.pop()
    return 'mail', comprador, None, min(ind.clientes_de[comprador])


def clasificar(v, ind):
    """(clase, comprador, pagador, cliente) de un pago, o None si no es un caso para mirar."""
    mail = normalizar('email', v.mail_cliente)
    if not mail or not v.person_uuid:
        return None
    ajenas = {p for p in ind.duenos.get(('email', mail), ()) if not mismo_nombre(ind.nombre.get(p), v.nombre_cliente)}
    if not ajenas:
        return por_mail(v, mail, ind)
    tel = normalizar('phone', v.telefono)
    if tel:
        candidatos = {cid for cid in ind.por_tel.get(tel, ()) if mismo_nombre(v.nombre_cliente, ind.clientes[cid][0])}
        clase = 'telefono'
    else:
        candidatos = set(ind.por_nombre.get(_normalize_name(v.nombre_cliente), ()))
        clase = 'dudoso_solo_nombre'
    compradores = {ind.clientes[cid][1] for cid in candidatos} - {None}
    compradores -= ajenas
    if not compradores:
        return por_mail(v, mail, ind)
    if len(compradores) > 1:
        # Un teléfono compartido entre varios clientes: desempata el mail de la copia, si es de uno solo.
        con_el_mail = compradores & ind.mails_todos.get(mail, set())
        if len(con_el_mail) != 1:
            return por_mail(v, mail, ind) or ('dudoso_varios_compradores', None, None, None)
        compradores = con_el_mail
    comprador = compradores.pop()
    if comprador == v.person_uuid:
        return None
    if len(ajenas) > 1:
        return 'dudoso_varias_pagadoras', comprador, None, None
    pagador = ajenas.pop()
    cliente = min(cid for cid in candidatos if ind.clientes[cid][1] == comprador)
    return clase, comprador, (None if pagador == comprador else pagador), cliente


def fusion_manual(ind):
    """Pares de personas con el mismo nombre y teléfonos distintos que un pago y un cliente unían por
    teléfono: candidatos a fusionar a mano."""
    pares = defaultdict(lambda: [0, 0.0])
    for v in FinancialSale.query.filter(FinancialSale.person_uuid.isnot(None)).yield_per(1000):
        tel = normalizar('phone', v.telefono)
        if not tel:
            continue
        for cid in ind.por_tel.get(tel, ()):
            nombre, pu = ind.clientes[cid]
            if not pu or pu == v.person_uuid or v.client_id == cid or pu not in ind.nombre:
                continue
            if not (mismo_nombre(v.nombre_cliente, nombre) and mismo_nombre(ind.nombre.get(v.person_uuid), nombre)):
                continue
            if ind.telefonos.get(pu, set()) & ind.telefonos.get(v.person_uuid, set()):
                continue
            par = tuple(sorted((v.person_uuid, pu)))
            pares[par][0] += 1
            pares[par][1] += float(v.monto or 0)
    return pares


def main(apply=False, hasta=None):
    ind = Indice()
    casos, clases, plata = [], Counter(), Counter()
    tramos = defaultdict(lambda: [0, 0.0, set()])   # pagos de `hasta` en adelante, que no se tocan
    for v in FinancialSale.query.filter(FinancialSale.person_uuid.isnot(None)).yield_per(1000):
        r = clasificar(v, ind)
        if not r:
            continue
        clase, comprador, pagador, cliente = r
        clases[clase] += 1
        plata[clase] += float(v.monto or 0)
        if clase not in ('telefono', 'mail'):
            continue
        if hasta and v.date and v.date >= hasta:
            tramo = f'{hasta:%Y-%m-%d} a {RECIENTES:%Y-%m-%d} (revisar)' if v.date < RECIENTES else                 f'desde {RECIENTES:%Y-%m-%d} (no se toca)'
            tramos[tramo][0] += 1
            tramos[tramo][1] += float(v.monto or 0)
            tramos[tramo][2].add((v.person_uuid, comprador))
            continue
        casos.append((v, comprador, pagador, cliente))

    print('Pagos con la persona de quien pagó y no de quien compró:')
    for clase in sorted(clases):
        print(f'  {clase:28} {clases[clase]:5} pagos  ${plata[clase]:,.2f}')
    pares = {(v.person_uuid, c) for v, c, _, _ in casos}
    print(f'  a corregir{f" (anteriores al {hasta:%Y-%m-%d})" if hasta else ""}: {len(casos)} pagos, '
          f'${sum(float(v.monto or 0) for v, _, _, _ in casos):,.2f}, {len(pares)} pares de personas (pagadora, compradora)')
    for tramo, (n, monto, pares_tramo) in sorted(tramos.items()):
        print(f'  sin tocar, {tramo}: {n} pagos, ${monto:,.2f}, {len(pares_tramo)} pares de personas')

    ventas_ajenas = {v.sale_id for v, comprador, _, _ in casos
                     if v.sale_id and (db.session.get(Sale, v.sale_id).person_uuid or None) != comprador}
    movidos = Counter(v.sale_id for v, _, _, _ in casos if v.sale_id in ventas_ajenas)
    quedan_vacias = [s for s in ventas_ajenas
                     if FinancialSale.query.filter(FinancialSale.sale_id == s).count() == movidos[s]]
    subs = Subscription.query.filter(Subscription.sale_id.in_(ventas_ajenas)).count() if ventas_ajenas else 0
    print(f'  {sum(movidos.values())} de esos pagos están en una venta (Sale) de otra persona: {len(ventas_ajenas)} '
          f'ventas; {len(quedan_vacias)} quedarían sin pagos (se borran salvo que tengan plan de cuotas); '
          f'{subs} suscripciones cuelgan de esas ventas')
    con_mail = sum(1 for v, c, _, _ in casos if c in ind.duenos.get(('email', normalizar('email', v.mail_cliente)), ()))
    print(f'  compradoras que también tienen ese mail (se les da de baja): {con_mail}')

    print(f'\nEjemplos ({EJEMPLOS}):')
    for v, comprador, pagador, cliente in casos[:EJEMPLOS]:
        print(f'  pago {v.id} ${v.monto} {v.nombre_cliente!r} tel {v.telefono} mail {v.mail_cliente}: '
              f'de {ind.nombre.get(v.person_uuid)!r} -> {ind.nombre.get(comprador)!r} (cliente {cliente}); '
              f'pagó {ind.nombre.get(pagador)!r}')

    manual = fusion_manual(ind)
    print(f'\nCandidatos a fusión manual (mismo nombre, teléfonos distintos): {len(manual)} pares de personas, '
          f'{sum(n for n, _ in manual.values())} pagos, ${sum(p for _, p in manual.values()):,.2f}')
    for (a, b), (n, p) in sorted(manual.items(), key=lambda x: -x[1][1]):
        print(f'  {a} {ind.nombre.get(a)!r} / {b} {ind.nombre.get(b)!r}: {n} pagos, ${p:,.2f}')

    if not apply:
        print('\n[PRUEBA] No se cambió nada. Corré con --apply para corregir.')
        return
    for v, comprador, pagador, cliente in casos:
        mail = normalizar('email', v.mail_cliente)
        persona = db.session.get(Person, comprador)
        if comprador in ind.duenos.get(('email', mail), ()):
            person_service.retirar(persona, 'email', mail, reason=MOTIVO)
        v.payer_person_uuid = pagador
        v.person_uuid = comprador
        v.client_id = cliente
    db.session.commit()
    print(f'\nAplicado: {len(casos)} pagos corregidos.')


if __name__ == '__main__':
    with create_app().app_context():
        hasta = sys.argv[sys.argv.index('--hasta') + 1] if '--hasta' in sys.argv else None
        main(apply='--apply' in sys.argv, hasta=datetime.strptime(hasta, '%Y-%m-%d') if hasta else None)
