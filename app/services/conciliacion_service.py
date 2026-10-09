"""La conciliación de pasarelas de Finanzas › Diferencias (09/10/2026): lo reportado contra lo ingresado.

Lo REPORTADO son las ventas del sistema por Stripe o Hotmart (`FinancialSale.metodo_pago`), las mismas
que suma el Resumen de Finanzas: completadas, por su fecha. Lo INGRESADO son los cobros de los CSV que
se suben (`ConciliacionMovimiento`, ver `conciliacion_csv`). Las cifras de «todas» suman además las
transferencias del período a los dos lados (ver `_con_transferencias`). Este módulo guarda las cargas sin
duplicar, empareja una cosa con la otra y dice, de cada fila, en qué estado está:

  · coincide        — la venta y su cobro, por el mismo monto;
  · monto_distinto  — la venta y su cobro, pero lo reportado no es el bruto real;
  · sin_reportar    — un cobro del CSV que no tiene venta en el sistema;
  · sin_ingreso     — una venta del sistema que no aparece en el CSV de su pasarela.

**La regla del emparejamiento** (la misma que explica el Tip de la pestaña). Una venta y un cobro son
de la misma persona si tienen el mismo correo (el de la venta o el de su cliente), si el correo del
cobro es de un cliente del sistema y es el de la venta, si el correo de la venta quedó cortado y lo de
antes de la «@» es igual («milagros_gamonal_minvela@»), o, si nada de eso, si comparten al menos dos
palabras del nombre (sin tildes; una letra de diferencia vale en palabras largas: «Webdis»/«Wendis»).
Por nombre con el correo del cobro registrado a OTRO cliente del sistema también vale, pero es lo más
débil y la fila lo dice: en septiembre pasa con clientes duplicados (Alberto Denis, con dos fichas) y
con correos mal cargados (el de Juanita Páez figura en la ficha de otra persona), y en los dos casos
el cobro es de esa venta. Y la fecha: hasta `VENTANA` (3 días) para cada lado. En septiembre el cobro
llegó hasta 31 h después del reporte (el reporte es cuando el closer carga la venta, no el momento
del cobro), y una venta reportada el 30/08 se cobró el 31/08 a la noche.

Con eso, en tres pasadas y siempre eligiendo primero la identidad más firme y la fecha más cercana:
  1. el mismo monto, al centavo, contra un solo cobro;
  2. el mismo monto contra 2 o 3 cobros de la misma persona (un pago partido: $200 + $50 = $250);
  3. lo que queda, con otro monto, contra la ráfaga de cobros de la persona (los separados por menos
     de una hora van juntos: $71.31 + $163.65 contra una venta de $250). Por nombre solo, únicamente
     si la diferencia no pasa del 20 %.

Una fila puede tener candidatos: las otras ventas o cobros con los que también podría ir (de la misma
persona, del mismo monto sin identidad, o de la otra pasarela: una venta reportada por Stripe que
entró por Hotmart sugiere cambiarle el método).

Las fechas de las ventas se comparan tal como están guardadas; las de los cobros vienen en UTC−3
(`conciliacion_csv.ZONA`). Con la ventana de días, las horas de diferencia no cambian nada.
"""
import hashlib
import re
from datetime import datetime, time, timedelta
from itertools import combinations

from sqlalchemy import func

from app import db
from app.models import Client, ConciliacionCarga, ConciliacionMovimiento, ConciliacionRevision, FinancialSale
from app.services import conciliacion_csv as lector

PASARELAS = lector.PASARELAS
VENTANA = timedelta(days=3)
RAFAGA = timedelta(hours=1)
CENTAVO = 0.005
MAX_GRUPO = 3        # cobros que se juntan para cerrar una venta al centavo
MAX_RAFAGA = 6       # cobros que puede tener una ráfaga
MAX_CANDIDATOS = 4
ESTADOS = ('coincide', 'monto_distinto', 'sin_reportar', 'sin_ingreso')
PENDIENTES = ('monto_distinto', 'sin_reportar', 'sin_ingreso')
# Lo que Finanzas descuenta de comisión cuando no sabe la real (`get_finance_summary`).
COMISION_ESTIMADA = {'stripe': 0.045, 'hotmart': 0.089}

# Lo firme primero: el mismo correo o el mismo cliente, el correo cortado, el nombre, y el nombre con
# el correo del cobro registrado a otro cliente del sistema.
RANGO = {'correo': 0, 'cliente': 0, 'correo_parcial': 1, 'nombre': 2, 'nombre_otro_cliente': 3}
# Por nombre solo, la diferencia de un monto distinto no puede pasar de esto (ver la pasada 3).
SOLO_NOMBRE = RANGO['nombre']
PALABRAS_VACIAS = {'del', 'de', 'la', 'las', 'los', 'y', 'da', 'do', 'dos', 'das', 'van', 'von'}


# --- Las cargas -----------------------------------------------------------------------------------

def _trozos(lista, n=500):
    for i in range(0, len(lista), n):
        yield lista[i:i + n]


def guardar_carga(leido, archivo, usuario):
    """Guarda lo leído de un CSV (`conciliacion_csv.leer`) sin duplicar: una fila cuya clave natural
    ya está (de otra carga o repetida en el mismo archivo) se cuenta como repetida y no se guarda.

    Devuelve el resumen {carga, pasarela, archivo, filas, nuevas, repetidas, omitidas}. Si no entró
    ninguna fila nueva no queda una carga vacía en la lista: `carga` es None.
    """
    filas = leido['filas']
    claves = [f['clave'][:400] for f in filas]
    vistas = set()
    for trozo in _trozos(claves):
        vistas.update(c for (c,) in db.session.query(ConciliacionMovimiento.clave)
                      .filter(ConciliacionMovimiento.clave.in_(trozo)))
    resumen = {'pasarela': leido['pasarela'], 'archivo': archivo, 'filas': len(filas), 'nuevas': 0,
               'repetidas': 0, 'omitidas': len(leido['omitidas']), 'detalle_omitidas': leido['omitidas'][:20]}
    carga = ConciliacionCarga(pasarela=leido['pasarela'], archivo=(archivo or '')[:255] or None,
                              filas=len(filas), omitidas=len(leido['omitidas']),
                              subido_por_id=getattr(usuario, 'id', None), subido_at=datetime.utcnow())
    db.session.add(carga)
    db.session.flush()
    for fila, clave in zip(filas, claves):
        if clave in vistas:
            resumen['repetidas'] += 1
            continue
        vistas.add(clave)
        db.session.add(ConciliacionMovimiento(
            carga_id=carga.id, pasarela=leido['pasarela'], fecha=fila['fecha'],
            nombre=(fila['nombre'] or '')[:255] or None, email=(fila['email'] or '')[:255] or None,
            bruto=fila['bruto'], comision=fila['comision'], neto=fila['neto'],
            bruto_desconocido=fila['bruto_desconocido'], nota=fila['nota'], clave=clave))
        resumen['nuevas'] += 1
    if not resumen['nuevas']:
        db.session.rollback()
        return {**resumen, 'carga': None}
    carga.nuevas, carga.repetidas = resumen['nuevas'], resumen['repetidas']
    db.session.commit()
    return {**resumen, 'carga': carga.id}


def borrar_carga(carga_id):
    """Borra una carga y los cobros que entraron con ella. False si no existe."""
    carga = db.session.get(ConciliacionCarga, carga_id)
    if not carga:
        return False
    ConciliacionMovimiento.query.filter_by(carga_id=carga.id).delete(synchronize_session=False)
    db.session.delete(carga)
    db.session.commit()
    return True


def _cargas(inicio, fin):
    """Las cargas, las del período primero: de cada una, qué fechas cubre y cuántos cobros tiene."""
    datos = {cid: (desde, hasta, n) for cid, desde, hasta, n in db.session.query(
        ConciliacionMovimiento.carga_id, func.min(ConciliacionMovimiento.fecha),
        func.max(ConciliacionMovimiento.fecha), func.count(ConciliacionMovimiento.id))
        .group_by(ConciliacionMovimiento.carga_id)}
    en_periodo = dict(db.session.query(ConciliacionMovimiento.carga_id, func.count(ConciliacionMovimiento.id))
                      .filter(ConciliacionMovimiento.fecha >= inicio, ConciliacionMovimiento.fecha <= fin)
                      .group_by(ConciliacionMovimiento.carga_id).all())
    lista = []
    for carga in ConciliacionCarga.query.order_by(ConciliacionCarga.subido_at.desc(), ConciliacionCarga.id.desc()):
        desde, hasta, n = datos.get(carga.id, (None, None, 0))
        lista.append({
            'id': carga.id, 'pasarela': carga.pasarela, 'archivo': carga.archivo, 'filas': carga.filas,
            'nuevas': carga.nuevas, 'repetidas': carga.repetidas, 'omitidas': carga.omitidas,
            'subido_por': carga.subido_por.username if carga.subido_por else None,
            'subido_at': carga.subido_at.isoformat() if carga.subido_at else None,
            'desde': desde.isoformat() if desde else None, 'hasta': hasta.isoformat() if hasta else None,
            'movimientos': n, 'en_periodo': en_periodo.get(carga.id, 0),
        })
    lista.sort(key=lambda c: c['en_periodo'] == 0)
    return lista


# --- Identidad ------------------------------------------------------------------------------------

def _palabras(nombre):
    texto = lector.normal(nombre)
    return [p for p in re.findall(r'[a-z]+', texto) if len(p) >= 3 and p not in PALABRAS_VACIAS]


def _a_una_letra(a, b):
    """Si dos palabras difieren en a lo sumo una letra (cambiada, sobrante o faltante)."""
    if abs(len(a) - len(b)) > 1:
        return False
    if len(a) == len(b):
        return sum(x != y for x, y in zip(a, b)) <= 1
    corta, larga = sorted((a, b), key=len)
    return any(larga[:i] + larga[i + 1:] == corta for i in range(len(larga)))


def _mismo_nombre(a, b):
    """Si dos nombres comparten al menos dos palabras (una letra de diferencia en las de 5 o más)."""
    libres = list(b)
    comunes = 0
    for palabra in a:
        igual = next((x for x in libres if x == palabra or (min(len(x), len(palabra)) >= 5
                                                           and _a_una_letra(x, palabra))), None)
        if igual is not None:
            libres.remove(igual)
            comunes += 1
    return comunes >= 2


def _correo_cortado(a, b):
    """Si dos correos tienen lo mismo antes de la «@» y a uno de los dos le falta el dominio."""
    local_a, _, dom_a = a.partition('@')
    local_b, _, dom_b = b.partition('@')
    sin_dominio = not dom_a or '.' not in dom_a or not dom_b or '.' not in dom_b
    return len(local_a) >= 5 and local_a == local_b and sin_dominio


def _identidad(venta, mov):
    """Cómo se sabe que la venta y el cobro son de la misma persona: 'correo', 'cliente',
    'correo_parcial', 'nombre', 'nombre_otro_cliente' (el mismo nombre, con el correo del cobro
    registrado a otro cliente del sistema) o None. Ver `RANGO`."""
    if mov['email'] and mov['email'] in venta['emails']:
        return 'correo'
    if mov['cliente_id'] and mov['cliente_id'] == venta['cliente_id']:
        return 'cliente'
    otro_cliente = bool(mov['cliente_id'] and venta['cliente_id'] and mov['cliente_id'] != venta['cliente_id'])
    if not otro_cliente and mov['email'] and any(_correo_cortado(e, mov['email']) for e in venta['emails']):
        return 'correo_parcial'
    if _mismo_nombre(venta['palabras'], mov['palabras']):
        return 'nombre_otro_cliente' if otro_cliente else 'nombre'
    return None


# --- Lo que se compara ----------------------------------------------------------------------------

def pasarela_de(metodo_pago):
    """'stripe' o 'hotmart' según el medio de la venta (como lo lee Finanzas), o None."""
    medio = (metodo_pago or '').strip().lower()
    return medio if medio in PASARELAS else None


def _completada(venta):
    """La misma regla del ingreso de Finanzas: sin estado, «Completada» o «Confirmada»."""
    estado = (venta.estado or '').strip().lower()
    return not estado or estado in ('completada', 'confirmada')


def _correo_util(email):
    limpio = lector.email_normal(email)
    # Los correos inventados para un lead sin correo no identifican a nadie.
    if not limpio or 'no-email-' in limpio or limpio.endswith('neurops.temp'):
        return None
    return limpio


def _ventas(inicio, fin):
    """Las ventas por Stripe o Hotmart completadas entre dos instantes, con su identidad."""
    from app.services.comercial_service import clientes_de_ventas

    ventas = [v for v in FinancialSale.query.filter(FinancialSale.date >= inicio, FinancialSale.date <= fin).all()
              if pasarela_de(v.metodo_pago) and _completada(v)]
    clientes_por_venta = clientes_de_ventas(ventas)
    ids = set(clientes_por_venta.values())
    clientes = {c.id: c for c in Client.query.filter(Client.id.in_(ids)).all()} if ids else {}
    datos = []
    for v in ventas:
        cliente = clientes.get(clientes_por_venta.get(v.id))
        emails = {e for e in (_correo_util(v.mail_cliente), _correo_util(cliente.email) if cliente else None) if e}
        palabras = _palabras(v.nombre_cliente) or (_palabras(cliente.full_name) if cliente else [])
        datos.append({'obj': v, 'id': v.id, 'pasarela': pasarela_de(v.metodo_pago), 'fecha': v.date,
                      'monto': round(float(v.monto or 0.0), 2), 'emails': emails,
                      'cliente_id': cliente.id if cliente else None, 'palabras': palabras})
    return datos


def _movimientos(inicio, fin):
    """Los cobros de los CSV entre dos instantes, con el cliente del sistema que tiene su correo."""
    movs = ConciliacionMovimiento.query.filter(
        ConciliacionMovimiento.fecha >= inicio, ConciliacionMovimiento.fecha <= fin).all()
    correos = sorted({m.email for m in movs if m.email})
    clientes = {}
    for trozo in _trozos(correos):
        # El cliente más viejo con ese correo, como `clientes_de_ventas`.
        for cid, email, nombre in (db.session.query(Client.id, func.lower(Client.email), Client.full_name)
                                   .filter(func.lower(Client.email).in_(trozo)).order_by(Client.id)):
            clientes.setdefault(email, (cid, nombre))
    datos = []
    for m in movs:
        cid, nombre = clientes.get(m.email, (None, None)) if m.email else (None, None)
        datos.append({'obj': m, 'id': m.id, 'pasarela': m.pasarela, 'fecha': m.fecha, 'bruto': m.bruto,
                      'email': _correo_util(m.email), 'cliente_id': cid, 'cliente_nombre': nombre,
                      'palabras': _palabras(m.nombre)})
    return datos


# --- El emparejamiento ----------------------------------------------------------------------------

def _segundos(a, b):
    return abs((a - b).total_seconds())


def _rafagas(movs):
    """Los cobros agrupados por persona (correo, o nombre sin correo) y cercanía: dos cobros de la
    misma persona separados por menos de `RAFAGA` son un mismo pago partido."""
    por_persona = {}
    for m in sorted(movs, key=lambda m: m['fecha']):
        quien = m['email'] or ' '.join(m['palabras']) or f'#{m["id"]}'
        por_persona.setdefault(quien, []).append(m)
    rafagas = []
    for lista in por_persona.values():
        actual = [lista[0]]
        for m in lista[1:]:
            if m['fecha'] - actual[-1]['fecha'] <= RAFAGA and len(actual) < MAX_RAFAGA:
                actual.append(m)
            else:
                rafagas.append(actual)
                actual = [m]
        rafagas.append(actual)
    return rafagas


def emparejar(ventas, movs):
    """[(venta o None, [cobros], identidad)] de UNA pasarela, con las tres pasadas del docstring del
    módulo. Cada venta y cada cobro va en una sola fila."""
    identidades = {}

    def ident(v, m):
        clave = (v['id'], m['id'])
        if clave not in identidades:
            identidades[clave] = _identidad(v, m)
        return identidades[clave]

    def rango(v, m):
        return RANGO.get(ident(v, m))

    def cerca(v, m):
        return abs(m['fecha'] - v['fecha']) <= VENTANA

    libres_v = {v['id']: v for v in ventas}
    libres_m = {m['id']: m for m in movs}
    filas = []

    # 1) El mismo monto, contra un solo cobro.
    opciones = sorted(
        ((rango(v, m), _segundos(v['fecha'], m['fecha']), v['id'], m['id'])
         for v in ventas for m in movs
         if cerca(v, m) and rango(v, m) is not None and abs(m['bruto'] - v['monto']) < CENTAVO))
    for _, _, vid, mid in opciones:
        if vid in libres_v and mid in libres_m:
            filas.append((libres_v.pop(vid), [libres_m.pop(mid)], identidades[(vid, mid)]))

    # 2) El mismo monto, contra 2 o 3 cobros de la misma persona.
    for v in sorted(list(libres_v.values()), key=lambda v: v['fecha']):
        suyos = [m for m in libres_m.values() if cerca(v, m) and rango(v, m) is not None]
        mejor = None
        for n in range(2, min(MAX_GRUPO, len(suyos)) + 1):
            for grupo in combinations(suyos, n):
                if abs(sum(m['bruto'] for m in grupo) - v['monto']) < CENTAVO:
                    puntaje = (max(rango(v, m) for m in grupo), sum(_segundos(v['fecha'], m['fecha']) for m in grupo))
                    if mejor is None or puntaje < mejor[0]:
                        mejor = (puntaje, grupo)
        if mejor:
            grupo = sorted(mejor[1], key=lambda m: m['fecha'])
            identidad = min((ident(v, m) for m in grupo), key=lambda i: RANGO[i])
            filas.append((libres_v.pop(v['id']), [libres_m.pop(m['id']) for m in grupo], identidad))

    # 3) Otro monto: la venta contra la ráfaga de cobros de la persona.
    rafagas = _rafagas(list(libres_m.values()))
    opciones = []
    for v in libres_v.values():
        for i, rafaga in enumerate(rafagas):
            if not cerca(v, rafaga[0]):
                continue
            rangos = [rango(v, m) for m in rafaga if rango(v, m) is not None]
            if not rangos:
                continue
            total = sum(m['bruto'] for m in rafaga)
            diferencia = abs(total - v['monto'])
            if min(rangos) >= SOLO_NOMBRE and diferencia > max(1.0, 0.2 * v['monto']):
                continue
            opciones.append((min(rangos), diferencia, _segundos(v['fecha'], rafaga[0]['fecha']), v['id'], i))
    usadas = set()
    for _, _, _, vid, i in sorted(opciones):
        if vid in libres_v and i not in usadas:
            usadas.add(i)
            v = libres_v.pop(vid)
            identidad = min((ident(v, m) for m in rafagas[i] if rango(v, m) is not None), key=lambda x: RANGO[x])
            for m in rafagas[i]:
                libres_m.pop(m['id'])
            filas.append((v, rafagas[i], identidad))

    filas.extend((v, [], None) for v in libres_v.values())
    filas.extend((None, [m], None) for m in libres_m.values())
    return filas


# --- Las filas ------------------------------------------------------------------------------------

def _huella(mov):
    """Un pedacito estable de la clave natural del cobro: no cambia si se borra la carga y se vuelve
    a subir, así una diferencia revisada sigue revisada."""
    return hashlib.sha1(mov['obj'].clave.encode('utf-8')).hexdigest()[:10]


def clave_de_fila(venta, movs):
    """'v57678+m3fa2c19b0d': la venta y los cobros de la fila. Es lo que guarda una revisión."""
    partes = ([f'v{venta["id"]}'] if venta else []) + sorted(f'm{_huella(m)}' for m in movs)
    return '+'.join(partes)


def _iso(cuando):
    return cuando.isoformat() if cuando else None


def _venta_a_dict(v, inicio, fin):
    obj = v['obj']
    return {'id': obj.id, 'fecha': _iso(obj.date), 'monto': v['monto'], 'nombre': obj.nombre_cliente,
            'email': obj.mail_cliente, 'tipo_pago': obj.tipo_pago, 'metodo_pago': obj.metodo_pago,
            'cliente_id': v['cliente_id'], 'en_periodo': inicio <= obj.date <= fin}


def _mov_a_dict(m, inicio, fin):
    obj = m['obj']
    return {'id': obj.id, 'fecha': _iso(obj.fecha), 'bruto': obj.bruto, 'neto': obj.neto,
            'comision': obj.comision, 'nombre': obj.nombre, 'email': obj.email, 'nota': obj.nota,
            'bruto_desconocido': bool(obj.bruto_desconocido), 'carga_id': obj.carga_id,
            'cliente_id': m['cliente_id'], 'cliente_nombre': m['cliente_nombre'], 'pasarela': obj.pasarela,
            'en_periodo': inicio <= obj.fecha <= fin}


def _candidatos(venta, movs, todas_ventas, todos_movs, emparejados):
    """Con quién más podría ir la fila: lo de la misma persona en la ventana (aunque ya esté en otra
    fila), lo de la otra pasarela, y si la fila quedó sola, lo del mismo monto que también quedó solo.
    `emparejados` son los ids ('v', id) / ('m', id) que ya están en una fila con pareja."""
    propia = (venta or movs[0])['pasarela']
    # Solo a una fila que quedó sola se le ofrece lo del mismo monto que también quedó solo: a una
    # con pareja, cualquier cobro de $100 de esos días sería ruido.
    sola = not (venta and movs)
    candidatos = []
    if venta:
        propios = {m['id'] for m in movs}
        for m in todos_movs:
            if m['id'] in propios or abs(m['fecha'] - venta['fecha']) > VENTANA:
                continue
            identidad = _identidad(venta, m)
            libre_y_igual = (sola and ('m', m['id']) not in emparejados and m['pasarela'] == propia
                             and abs(m['bruto'] - venta['monto']) < CENTAVO)
            if identidad is None and not libre_y_igual:
                continue
            candidatos.append(('movimiento', m, identidad, venta['fecha']))
    vistas = {venta['id']} if venta else set()
    for mov in movs:
        for v in todas_ventas:
            if v['id'] in vistas or abs(mov['fecha'] - v['fecha']) > VENTANA:
                continue
            identidad = _identidad(v, mov)
            libre_y_igual = (sola and ('v', v['id']) not in emparejados and v['pasarela'] == propia
                             and abs(mov['bruto'] - v['monto']) < CENTAVO)
            if identidad is None and not libre_y_igual:
                continue
            vistas.add(v['id'])
            candidatos.append(('venta', v, identidad, mov['fecha']))
    salida = []
    for tipo, x, identidad, referencia in sorted(candidatos, key=lambda c: _segundos(c[1]['fecha'], c[3])):
        pasarela = x['pasarela']
        if pasarela != propia:
            motivo = 'otra_pasarela'
        elif identidad in RANGO:
            motivo = 'misma_persona'
        else:
            motivo = 'mismo_monto'
        obj = x['obj']
        salida.append({
            'tipo': tipo, 'id': x['id'], 'pasarela': pasarela, 'motivo': motivo, 'identidad': identidad,
            'fecha': _iso(obj.date if tipo == 'venta' else obj.fecha),
            'monto': x['monto'] if tipo == 'venta' else x['bruto'],
            'nombre': obj.nombre_cliente if tipo == 'venta' else obj.nombre,
            'email': obj.mail_cliente if tipo == 'venta' else obj.email,
            'ocupado': (('v' if tipo == 'venta' else 'm'), x['id']) in emparejados,
        })
    return salida[:MAX_CANDIDATOS]


def _sugerencia(venta, movs, candidatos):
    """Una fila sola con su pareja libre en la OTRA pasarela, de la misma persona y el mismo monto: lo
    más probable es que la venta se haya reportado con el método equivocado. {venta_id, metodo_pago}
    es la corrección: a la venta de la fila (sin ingreso) o a la candidata (sin reportar)."""
    if venta and movs:
        return None
    monto = venta['monto'] if venta else movs[0]['bruto']
    for c in candidatos:
        if (c['motivo'] != 'otra_pasarela' or c['ocupado'] or abs(c['monto'] - monto) >= CENTAVO
                or c['identidad'] not in RANGO):
            continue
        if venta and c['tipo'] == 'movimiento':
            return {'venta_id': venta['id'], 'metodo_pago': PASARELAS[c['pasarela']]}
        if not venta and c['tipo'] == 'venta':
            return {'venta_id': c['id'], 'metodo_pago': PASARELAS[movs[0]['pasarela']]}
    return None


def _total(numeros):
    return round(sum(numeros), 2)


def _neto(movs):
    """Lo que llegó de esos cobros: su neto, o el bruto si el CSV no lo traía."""
    return _total(m['obj'].neto if m['obj'].neto is not None else m['bruto'] for m in movs)


def conciliar(desde, hasta):
    """La conciliación del período (dos `date`, inclusive): {filas, kpis, pasarelas, cargas}.

    Se buscan parejas hasta `VENTANA` antes y después del período (una venta del 30/08 cobrada el
    31/08), pero se muestran solo las filas que tienen algo dentro, y los KPIs suman solo lo de
    adentro: Reportado son las ventas del período, como el Resumen; Ingresado, los cobros del período.

    Una pasarela sin ningún cobro en el período no se concilia (sus ventas saldrían todas «sin
    ingreso» solo porque falta subir su CSV): va en `pasarelas` con `con_csv: False` y sus ventas no
    entran en las filas ni en los KPIs de «todas».
    """
    inicio, fin = datetime.combine(desde, time.min), datetime.combine(hasta, time.max)
    ventas = _ventas(inicio - VENTANA, fin + VENTANA)
    movs = _movimientos(inicio - VENTANA, fin + VENTANA)
    revisadas = {r.clave: r for r in ConciliacionRevision.query.all()}

    pasarelas = {}
    for p in PASARELAS:
        suyos = [m for m in movs if m['pasarela'] == p and inicio <= m['fecha'] <= fin]
        pasarelas[p] = {'con_csv': bool(suyos), 'desde': _iso(min((m['fecha'] for m in suyos), default=None)),
                        'hasta': _iso(max((m['fecha'] for m in suyos), default=None)), 'movimientos': len(suyos)}

    crudas = []
    for p in PASARELAS:
        if pasarelas[p]['con_csv']:
            crudas.extend((p, *fila) for fila in emparejar([v for v in ventas if v['pasarela'] == p],
                                                            [m for m in movs if m['pasarela'] == p]))
    emparejados = {('v', v['id']) for _, v, ms, _ in crudas if v and ms} | {
        ('m', m['id']) for _, v, ms, _ in crudas if v and ms for m in ms}

    filas = []
    for p, venta, ms, identidad in crudas:
        en_periodo = (venta and inicio <= venta['fecha'] <= fin) or any(inicio <= m['fecha'] <= fin for m in ms)
        if not en_periodo:
            continue
        reportado = venta['monto'] if venta else None
        ingresado = _total(m['bruto'] for m in ms) if ms else None
        if venta and ms:
            estado = 'coincide' if abs(ingresado - reportado) < CENTAVO else 'monto_distinto'
        else:
            estado = 'sin_ingreso' if venta else 'sin_reportar'
        clave = clave_de_fila(venta, ms)
        revision = revisadas.get(clave) if estado != 'coincide' else None
        candidatos = _candidatos(venta, ms, ventas, movs, emparejados)
        referencia = ms[0]['fecha'] if ms else venta['fecha']
        filas.append({
            'clave': clave, 'estado': estado, 'pasarela': p, 'identidad': identidad,
            'fecha': _iso(referencia),
            'venta': _venta_a_dict(venta, inicio, fin) if venta else None,
            'movimientos': [_mov_a_dict(m, inicio, fin) for m in ms],
            'reportado': reportado, 'ingresado': ingresado,
            'neto': _neto(ms) if ms else None,
            'comision': _total((m['obj'].comision or 0.0) for m in ms) if ms else None,
            'diferencia': round((ingresado or 0.0) - (reportado or 0.0), 2),
            # Lo que la fila mueve la Diferencia de arriba: solo cuenta lo que cae dentro del período.
            'aporte': round(sum(m['bruto'] for m in ms if inicio <= m['fecha'] <= fin)
                            - (venta['monto'] if venta and inicio <= venta['fecha'] <= fin else 0.0), 2),
            'cliente_id': ((venta and venta['cliente_id'])
                           or next((m['cliente_id'] for m in ms if m['cliente_id']), None)),
            'revisada': ({'por': revision.revisada_por.username if revision.revisada_por else None,
                          'at': _iso(revision.revisada_at), 'nota': revision.nota} if revision else None),
            'candidatos': candidatos,
            'sugerencia': _sugerencia(venta, ms, candidatos),
        })
    filas.sort(key=lambda f: (f['fecha'] or '', f['clave']), reverse=True)

    # «Todas» suma las pasarelas con CSV; sin ninguno, lo reportado de las dos (y nada con qué compararlo).
    con_csv = [p for p in PASARELAS if pasarelas[p]['con_csv']]
    kpis = {'todas': _kpis(filas, ventas, movs, inicio, fin, con_csv or list(PASARELAS), con_csv=bool(con_csv))}
    for p in PASARELAS:
        kpis[p] = _kpis([f for f in filas if f['pasarela'] == p], ventas, movs, inicio, fin, [p],
                        con_csv=pasarelas[p]['con_csv'])
    kpis['todas'] = _con_transferencias(kpis['todas'], desde, hasta)
    kpis['todas']['resumen'] = _contra_el_resumen(kpis, inicio, fin)
    return {'desde': desde.isoformat(), 'hasta': hasta.isoformat(), 'filas': filas, 'kpis': kpis,
            'pasarelas': pasarelas, 'cargas': _cargas(inicio, fin)}


def _kpis(filas, ventas, movs, inicio, fin, pasarelas, con_csv=True):
    """Las cifras de arriba para esas pasarelas: lo reportado y lo ingresado en el período, la
    diferencia, el neto y la comisión real (y la que estima Finanzas), y las filas por estado.

    `diferencia_por` abre la diferencia en lo que la explica: las filas pendientes, las revisadas, y
    las que coinciden pero tienen la venta o el cobro en otro período (una venta del 30/08 cobrada el
    31/08 suma su cobro a septiembre y su venta a agosto). Las tres suman la diferencia."""
    suyas = [v for v in ventas if v['pasarela'] in pasarelas and inicio <= v['fecha'] <= fin]
    cobros = [m for m in movs if m['pasarela'] in pasarelas and inicio <= m['fecha'] <= fin]
    reportado = _total(v['monto'] for v in suyas)
    ingresado = _total(m['bruto'] for m in cobros) if con_csv else None
    pendientes = {e: sum(1 for f in filas if f['estado'] == e and not f['revisada']) for e in PENDIENTES}
    return {
        'reportado': reportado, 'ventas': len(suyas),
        'ingresado': ingresado, 'movimientos': len(cobros),
        'neto': _neto(cobros) if con_csv else None,
        'comision': _total((m['obj'].comision or 0.0) for m in cobros) if con_csv else None,
        'comision_estimada': _total(v['monto'] * COMISION_ESTIMADA[v['pasarela']] for v in suyas),
        'diferencia': round(ingresado - reportado, 2) if con_csv else None,
        'diferencia_por': {
            'pendientes': _total(f['aporte'] for f in filas if f['estado'] in PENDIENTES and not f['revisada']),
            'revisadas': _total(f['aporte'] for f in filas if f['revisada']),
            'otro_periodo': _total(f['aporte'] for f in filas if f['estado'] == 'coincide'),
        } if con_csv else None,
        'pendientes': {**pendientes, 'total': sum(pendientes.values())},
        'coinciden': sum(1 for f in filas if f['estado'] == 'coincide'),
        'revisadas': sum(1 for f in filas if f['revisada']),
        'con_csv': con_csv,
        'pasarelas': list(pasarelas),
    }


def _con_transferencias(kpis, desde, hasta):
    """Las cifras de «todas» con las transferencias del período (pedido del usuario, 09/10/2026:
    «falta contar lo que ingresó por transferencia para que las cuentas cuadren»).

    Una transferencia no pasa por ninguna pasarela ni viene en ningún CSV, así que no se concilia:
    no hay otro registro contra el cual compararla, lo que se reportó es lo que entró. Por eso suma
    lo mismo a lo reportado y a lo ingresado (bruto y neto: no paga comisión), y la diferencia no
    cambia. Con eso «todas» cuenta toda la plata del período, como el cash de Payroll. Sin ningún
    CSV no hay ingresado y queda en None. Las pasarelas sueltas no las llevan. Es la cuenta del
    Resumen de Finanzas (`transferencias_service.resumen_del_periodo`): completadas, por su fecha.
    """
    from app.services.transferencias_service import resumen_del_periodo

    transferencias = resumen_del_periodo(desde, hasta)
    total = transferencias['total']
    kpis = {**kpis, 'transferencias': {'total': total, 'ventas': transferencias['ventas']}}
    if transferencias['ventas']:
        kpis['reportado'] = round(kpis['reportado'] + total, 2)
        kpis['ventas'] += transferencias['ventas']
        if kpis['con_csv']:
            kpis['ingresado'] = round(kpis['ingresado'] + total, 2)
            kpis['neto'] = round(kpis['neto'] + total, 2)
    return kpis


def _contra_el_resumen(kpis, inicio, fin):
    """Lo ingresado de «todas» contra el «Ingresos» del Resumen de Finanzas, y por qué no es igual.

    Pedido del usuario (09/10/2026): «en resumen se ve un ingreso distinto al de diferencia». Son dos
    cuentas: el Resumen suma lo REPORTADO menos una comisión ESTIMADA (4,5 % Stripe, 8,9 % Hotmart);
    acá, lo que ENTRÓ según los CSV menos la comisión REAL. Kerwin eligió no cambiar ningún número
    y mostrar la brecha (en septiembre, -$96.48: casi toda la comisión real de Hotmart, ~11,5 %).

    {'total': lo que dice el Resumen, 'brecha': neto de «todas» − total, 'partes': [...]}, y la
    brecha es la suma de sus partes, al centavo:
      · por pasarela con CSV, la comisión estimada menos la real (`comision`, bruto − neto del
        CSV) y lo que entró de más o de menos contra lo reportado (`cobrado`, su diferencia);
      · por pasarela sin CSV, lo que el Resumen estima de ella y acá no se cuenta (`sin_csv`);
      · lo de otros medios que no son pasarela ni transferencia (`otros`): no se concilian.
    Las transferencias están de los dos lados y no aportan. Sin ningún CSV no hay brecha.

    El total es el del Resumen con su misma regla (completadas, por su fecha, neto de la comisión
    estimada: `cash_neto_de`), como Procedencia; un test lo ata a lo que devuelve el Resumen.
    """
    from app.services.commission_service import cash_neto_de
    from app.services.nomina_service import venta_completada
    from app.services.transferencias_service import es_transferencia

    total = otros = 0.0
    for v in FinancialSale.query.filter(FinancialSale.date >= inicio, FinancialSale.date <= fin).all():
        if not venta_completada(v):
            continue
        neto = cash_neto_de(v.monto, v.metodo_pago)
        total += neto
        if not pasarela_de(v.metodo_pago) and not es_transferencia(v.metodo_pago):
            otros += neto
    total = round(total, 2)
    todas = kpis['todas']
    if not todas['con_csv']:
        return {'total': total, 'brecha': None, 'partes': []}

    partes = []
    for p in PASARELAS:
        k = kpis[p]
        if k['con_csv']:
            # La comisión real como bruto menos neto, y no la columna del CSV: es la que hace que
            # las partes cierren aunque una fila traiga el neto sin la comisión.
            partes.append({'tipo': 'comision', 'pasarela': p,
                           'monto': round(k['comision_estimada'] - (k['ingresado'] - k['neto']), 2)})
            partes.append({'tipo': 'cobrado', 'pasarela': p, 'monto': k['diferencia']})
        else:
            partes.append({'tipo': 'sin_csv', 'pasarela': p,
                           'monto': -round(k['reportado'] - k['comision_estimada'], 2)})
    partes.append({'tipo': 'otros', 'pasarela': None, 'monto': -round(otros, 2)})
    brecha = round(todas['neto'] - total, 2)
    # Cada parte se redondea por su lado: lo que sobre (un centavo) se dice, para que sumen exacto.
    redondeo = round(brecha - sum(parte['monto'] for parte in partes), 2)
    partes.append({'tipo': 'redondeo', 'pasarela': None, 'monto': redondeo})
    return {'total': total, 'brecha': brecha,
            'partes': [parte for parte in partes if abs(parte['monto']) >= 0.005]}


# --- Revisadas ------------------------------------------------------------------------------------

def marcar_revisada(clave, usuario, revisada=True, estado=None, nota=None):
    """Marca (o desmarca) como revisada la fila de esa clave. Devuelve la revisión o None."""
    clave = (clave or '').strip()[:200]
    if not re.fullmatch(r'(v\d+|m[0-9a-f]{10})(\+m[0-9a-f]{10})*', clave):
        raise ValueError('Esa fila no es de la conciliación.')
    actual = ConciliacionRevision.query.filter_by(clave=clave).first()
    if not revisada:
        if actual:
            db.session.delete(actual)
            db.session.commit()
        return None
    if actual is None:
        actual = ConciliacionRevision(clave=clave)
        db.session.add(actual)
    actual.estado = estado if estado in PENDIENTES else None
    actual.nota = (nota or '').strip()[:500] or None
    actual.revisada_por_id = getattr(usuario, 'id', None)
    actual.revisada_at = datetime.utcnow()
    db.session.commit()
    return actual
