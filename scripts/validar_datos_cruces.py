"""Los cruces de `validar_datos.py`: (a) cash y ventas, (b) ficha, (c) agendas, (d) segmentos, (e) comisión, (f) datos sueltos.
Cada uno corre aislado (`chequeo`): si falla, el informe lo anota y sigue con el resto."""
from collections import defaultdict
from datetime import date, datetime, time, timedelta

from sqlalchemy import text

from app import db
from validar_datos_base import chequeo


# --- (a) Cash y ventas: Marketing vs Comercial vs Finanzas -------------------------------------------------------

@chequeo('a · Cash y ventas', 'Marketing / Comercial / Finanzas')
def cruce_a(inf, d, h):
    from app.services import admin_cobros, anuncios_service, comercial_analitica as analitica, procedencia_ingresos_service
    from app.services.comercial_service import ComercialService as C
    from app.services.comercial_vocabulario import venta_completada
    from app.services.financial_service import FinancialService
    g, per = 'a · Cash y ventas', f'{d} → {h}'
    filas = C.ventas(d, h)
    tv = C.totales_ventas(filas)
    ventas_n = sum(1 for f in filas if f['es_venta'])
    new_cash = round(sum(f['monto'] for f in filas if f['es_venta']), 2)
    mk = anuncios_service.tablero(d, h, base='alta')
    fu = {f['key']: f for f in mk['fuentes']['fuentes']}
    otras = mk['fuentes']['otras']
    fin = FinancialService.get_finances_data(d, h)['kpis']
    cobros = admin_cobros.cobros(d, h)
    cruces = [
        ('Cash bruto: Comercial vs Marketing (cobrado del período)', tv['cash'], mk['cobrado_periodo'], 'Comercial · Ventas', 'Marketing · cobrado_periodo', 0.01,
         'Los dos suman los cobros completados del período por fecha de pago.'),
        ('Cash bruto: Comercial vs Finanzas (total_payments)', tv['cash'], round(fin['total_payments'], 2), 'Comercial', 'Finanzas · Resumen', 0.01,
         'Finanzas usa `admin_cobros.cobros`, el mismo criterio de «completada».'),
        ('Cash bruto: Comercial vs Setting + Workshop + Otras', tv['cash'],
         round(sum(f['cash_total'] for f in fu.values()) + otras['cash_total'], 2), 'Comercial', 'Marketing · fuentes', 0.01,
         'Las tres fuentes reparten todo lo cobrado; si no cierra, un cobro cayó en dos fuentes o en ninguna.'),
        ('Cash neto: Comercial vs Finanzas (cash_collected)', tv['cash_neto'], round(fin['cash_collected'], 2), 'Comercial · neto', 'Finanzas · cash_collected', 0.05,
         'Ambos usan `commission_service.cash_neto`; la tolerancia cubre el redondeo por fila.'),
        ('Cantidad de cobros: Comercial vs Finanzas', tv['filas'], len(cobros), 'Comercial', 'Finanzas', 0, ''),
        ('Ventas nuevas: Comercial vs Setting + Workshop + Otras', ventas_n, sum(f['ventas'] for f in fu.values()) + otras['ventas'],
         'Comercial · es_venta', 'Marketing · fuentes', 0, 'Venta = pago completo o split; las señas y cuotas no cuentan.'),
        ('New Cash: Comercial vs Setting + Workshop + Otras', new_cash, round(sum(f['new_cash'] for f in fu.values()) + otras['new_cash'], 2),
         'Comercial', 'Marketing · fuentes', 0.01, ''),
        ('Ventas: Comercial vs tabla de anuncios (atribuidas + sin atribuir)', ventas_n, mk['totales']['ventas'] + mk['sin_atribuir']['ventas'],
         'Comercial', 'Marketing · Anuncios', 0, 'Los cobros sin palabra clave cuentan en `sin_atribuir`.'),
    ]
    for titulo, a, b, ra, rb, tol, nota in cruces:
        inf.cruce(g, titulo, a, b, ra, rb, tol=tol, nota=nota, periodo=per)
    inf.cruce(g, 'Lo atribuido a anuncios no pasa de lo cobrado por Setting', mk['totales']['cobrado'], fu['setting']['cash_total'],
              'Marketing · Anuncios', 'Marketing · Setting', modo='<=', periodo=per,
              nota='Todo cobro con palabra clave es de Setting; Setting suma además los de setter sin palabra clave.')
    nuevas = admin_cobros.ventas_nuevas(d, h)
    sin_pago_real = [x for x in nuevas if not any(C.clasificar_venta(p)[2] and venta_completada(p) for p in x.payments)]
    inf.cruce(g, 'Ventas nuevas: Comercial vs Finanzas (Sale kind=new)', ventas_n, fin['enrollments_count'], 'Comercial · pagos completo/split',
              'Finanzas · Sale nuevas', tol=0, periodo=per,
              nota=f'Finanzas cuenta ventas (`Sale`) por fecha de alta y Comercial pagos completo/split por fecha de pago. {len(sin_pago_real)} de las {len(nuevas)} ventas '
                   'nuevas de Finanzas no tienen ningún pago completo/split (solo seña, cuotas o sin pago): explican la diferencia si es positiva en Finanzas.',
              ejemplos=[f'Sale #{x.id} cliente #{x.client_id} {x.sold_at:%Y-%m-%d} estado {x.status}: pagos {[ (p.tipo_pago, p.monto) for p in x.payments][:3]}' for x in sin_pago_real[:8]])
    proc = procedencia_ingresos_service.procedencia_de_ingresos(d, h)
    inf.cruce(g, 'Cash neto: Comercial vs Finanzas › Procedencia', tv['cash_neto'], proc['total'], 'Comercial · neto', 'Procedencia · total', 0.05,
              nota='`ventas_que_suman` debería ser el mismo conjunto de cobros.', periodo=per)
    res = analitica.resumen('closers', d, h)['actual']
    inf.cruce(g, 'Cash: Analizar (Dashboard) vs Revisar › Ventas', res['cash'], tv['cash'], 'Analizar', 'Revisar', 0.01, periodo=per)
    for fuente, f in {**fu, 'otras': {**otras, 'key': 'otras'}}.items():
        _lista_vs_cifra(inf, g, per, fuente, f, d, h)


def _lista_vs_cifra(inf, g, per, fuente, f, d, h):
    """La lista que abre cada cifra de una fuente debe sumar la cifra (pedido de trazabilidad del 28/10)."""
    from app.services import fuentes_registros_service as reg
    for metrica, es_monto in (('agendas', False), ('show_up', False), ('ventas', False), ('new_cash', True), ('cash_total', True)):
        try:
            r = reg.registros(fuente, metrica, d, h, 'alta')
            valor = round(sum(float(x.get('monto') or 0) for x in r['filas']), 2) if es_monto else len(r['filas'])
            inf.cruce(g, f'Lista vs cifra · {fuente} · {metrica}', valor, f.get(metrica),
                      'suma de la lista', 'cifra de la tarjeta', 0.01 if es_monto else 0, periodo=per,
                      nota='Cada lista sale del mismo código que su cifra: una diferencia es un bug de la lista o de la tarjeta.')
        except Exception as exc:  # noqa: BLE001
            db.session.rollback()
            inf.error(g, f'Lista vs cifra · {fuente} · {metrica}', exc, periodo=per)


# --- (b) La ficha del cliente vs FinancialSale ------------------------------------------------------------------

@chequeo('b · Ficha vs pagos', 'Ficha del cliente')
def cruce_b(inf, maximo):
    from app.models import Client, FinancialSale as FS
    from app.services.comercial_vocabulario import ESTADOS_COMPLETADA
    from app.services.ficha_lead_service import _ventas_del_cliente
    g = 'b · Ficha vs pagos'
    pagos = [p for p in db.session.query(FS.id, FS.client_id, FS.person_uuid, FS.monto, FS.estado).all()
             if (p.estado or '').strip().lower() in ESTADOS_COMPLETADA]
    monto = {p.id: float(p.monto or 0) for p in pagos}
    por_cliente, por_persona = defaultdict(set), defaultdict(set)
    for p in pagos:
        if p.client_id:
            por_cliente[p.client_id].add(p.id)
        if p.person_uuid:
            por_persona[p.person_uuid].add(p.id)
    todos = db.session.query(Client.id, Client.person_uuid).all()
    esperado = {cid: por_cliente.get(cid, set()) | por_persona.get(pu, set()) for cid, pu in todos}
    con_pagos = sorted((c for c, s in esperado.items() if s), key=lambda c: -max(esperado[c]))
    muestra = con_pagos[:maximo]
    perdidos, de_mas, difs = [], 0, []
    for i in range(0, len(muestra), 200):
        for cli in Client.query.filter(Client.id.in_(muestra[i:i + 200])):
            ficha = {v.id for v in _ventas_del_cliente(cli)}
            falta, sobra = esperado[cli.id] - ficha, ficha - esperado[cli.id]
            de_mas += len(sobra)
            if falta:
                perdidos.append((cli.id, cli.full_name, sorted(falta)))
                difs.append(sum(monto[x] for x in falta))
    inf.cruce(g, f'Pagos del cliente que la ficha no muestra ({len(muestra)} de {len(con_pagos)} clientes con pagos)', sum(len(x[2]) for x in perdidos), 0,
              'pagos faltantes', 'esperado', 0, ejemplos=[f'cliente #{c} {n}: pagos {ids}' for c, n, ids in perdidos],
              nota='Esperado = pagos con `client_id` del cliente o `person_uuid` de su persona. La ficha usa `filtro_de_pagos`, que incluye ambos.')
    inf.info(g, 'Pagos que la ficha suma por copia de mail/Instagram', f'{de_mas} pagos sin persona que la ficha atribuye por mail o Instagram '
             '(regla vigente de `filtro_de_pagos`; no es error, pero un mail compartido puede atribuir mal).')
    # Doble conteo: la misma persona con varios clientes ve los mismos pagos en cada ficha.
    clientes_de = defaultdict(list)
    for cid, pu in todos:
        if pu:
            clientes_de[pu].append(cid)
    dobles = [(pu, cs) for pu, cs in clientes_de.items() if len(cs) > 1 and por_persona.get(pu)]
    inf.cuenta(g, 'Personas con varios clientes y pagos (cada ficha muestra los mismos pagos)', len(dobles),
               dinero=sum(sum(monto[x] for x in por_persona[pu]) for pu, _ in dobles),
               nota='Sumar `pagado` de todas las fichas cuenta esos pagos más de una vez. Candidatas a fusionar (`scripts/fusionar_personas.py`).',
               ejemplos=[f'persona {pu[:8]}…: clientes {cs}, {len(por_persona[pu])} pagos' for pu, cs in dobles[:8]])
    ajenos = db.session.execute(text(
        "SELECT f.id, f.client_id, f.monto FROM financial_sales f JOIN clients c ON c.id = f.client_id "
        "WHERE f.person_uuid IS NOT NULL AND c.person_uuid IS NOT NULL AND f.person_uuid <> c.person_uuid")).fetchall()
    inf.cuenta(g, 'Pagos atados a un cliente de otra persona (client_id ≠ person_uuid)', len(ajenos), dinero=sum(float(r[2] or 0) for r in ajenos),
               nota='El pago aparece en la ficha del cliente y en la de su persona: queda duplicado en ambas.',
               ejemplos=[f'pago #{r[0]} → cliente #{r[1]} (${float(r[2] or 0):,.2f})' for r in ajenos[:8]])


# --- (c) Agendas: Dirección vs Revisar vs triage vs Marketing -----------------------------------------------------

@chequeo('c · Agendas', 'Agendas')
def cruce_c(inf, d, h):
    from app.models import Appointment, User
    from app.services import anuncios_service, comercial_analitica as analitica, triage_service
    from app.services.comercial_service import ComercialService as C
    from app.services.dashboard_equipo import MetricasEquipo
    g, per = 'c · Agendas', f'{d} → {h}'
    filas = C.agendas(d, h)
    tot = C.totales_agendas(filas)
    ini, fin = datetime.combine(d, time.min), datetime.combine(h, time.min) + timedelta(days=1)
    closers = [r[0] for r in db.session.query(Appointment.closer_id).filter(Appointment.start_time >= ini, Appointment.start_time < fin).distinct()]
    por_closer = sum(C.totales_agendas(C.agendas(d, h, closer_id=cid))['agendas'] for cid in closers)
    inf.cruce(g, 'Agendas: Revisar (equipo) vs suma por closer', tot['agendas'], por_closer, 'Revisar · todas', 'suma de cada closer', 0, periodo=per,
              nota='`vigentes()` quita reagendas y repetidas en el mismo horario; si la misma llamada está cargada con dos closers, '
                   'el total la cuenta una vez y la suma por closer dos.')
    res = analitica.resumen('closers', d, h)['actual']
    inf.cruce(g, 'Agendas: Analizar vs Revisar', res['agendas'], tot['agendas'], 'Analizar', 'Revisar', 0, periodo=per)
    inf.cruce(g, 'Asistieron: Analizar vs Revisar', res['asistieron'], tot['asistieron'], 'Analizar', 'Revisar', 0, periodo=per)
    crudas = MetricasEquipo.get_detailed_closer_metrics(ini, fin - timedelta(microseconds=1))['agendas']['total_agendas']['total']
    inf.cruce(g, 'Agendas: Dirección (closers, todas las filas) vs Revisar (vigentes)', crudas, tot['agendas'], 'Dirección · métricas del equipo', 'Revisar', 0,
              periodo=per, nota='Dirección cuenta toda fila de `Appointment`, Revisar solo las vigentes: la diferencia son reagendas y repetidas '
                                'que Dirección todavía suma.')
    inf.cruce(g, 'Agendas: Dirección vs Revisar sin descartar repetidas (vigentes=False)', crudas, len(C.agendas(d, h, vigentes=False)), 'Dirección', 'Revisar crudo', 0,
              periodo=per, nota='Si cierra, la diferencia con Revisar es solo `vigentes()`: reagendas y repetidas que Dirección sigue contando.')
    comp = analitica.comparativas('closers', d, h)
    visibles = {f['nombre'] for f in comp['filas']}
    fuera = defaultdict(lambda: [0, 0.0])
    for f in filas:
        fuera[f['closer']][0] += 0 if f['closer'] in visibles else 1
    for f in C.ventas(d, h):
        fuera[f['closer']][1] += 0 if f['closer'] in visibles else f['monto']
    roles = dict(db.session.query(User.username, User.role).all())
    ausentes = [f'{n} ({roles.get(n, "sin usuario")}): {a} agendas, ${m:,.2f}' for n, (a, m) in fuera.items() if a or m]
    for k in ('agendas', 'ventas', 'cash'):
        inf.cruce(g, f'Comparativas (closers): suma de personas vs fila Equipo · {k}', round(sum((f.get(k) or 0) for f in comp['filas']), 2),
                  comp['equipo'].get(k) or 0, 'suma por closer', 'fila Equipo', 0.01, periodo=per,
                  nota='El Equipo suma a quien tenga agendas o cobros como closer; el ranking solo a los closers activos y visibles para Dirección (no a triage, ni a admin/dirección que vendieron).', ejemplos=ausentes)
    # Setters
    gen = C.generadas(d, h)
    setters = [u.id for u in User.query.filter(User.role == 'setter')]
    inf.cruce(g, 'Agendas generadas: equipo vs suma por setter', len(gen), sum(len(C.generadas(d, h, setter_id=s)) for s in setters),
              'generadas (equipo)', 'suma por setter', 0, periodo=per,
              nota='La persona cuenta una vez por setter: un lead agendado por dos setters suma a los dos y al equipo dos veces, así que deben cerrar.')
    gen_dir = analitica.resumen('setters', d, h)['actual'].get('generadas')
    inf.cruce(g, 'Agendas generadas: Dirección (Analizar setters) vs Revisar', gen_dir, len(gen), 'Analizar setters', 'Revisar › Generadas', 0, periodo=per)
    # Triage
    tri = triage_service.metricas(ini, fin)
    t_ids = [t.id for t in triage_service.triages()]
    en_revisar = sum(len(C.agendas(d, h, closer_id=t)) for t in t_ids)
    inf.cruce(g, 'Triage: agendas de las métricas vs las de Revisar', tri['total']['agendas'], en_revisar, 'triage_service.metricas', 'Revisar (closer = triage)', 0,
              periodo=per, nota='Triage cuenta UNA agenda por persona (`_una_por_persona`) y Revisar las vigentes: una persona con dos agendas distintas '
                                'el mismo período suma 1 en triage y 2 en Revisar.')
    for k in ('agendas', 'asistencias', 'calificados', 'descalificados', 'sin_reporte'):
        inf.cruce(g, f'Triage: total vs suma por persona · {k}', tri['total'][k], sum(p[k] for p in tri['por_persona']), 'total', 'suma por persona', 0, periodo=per)
        inf.cruce(g, f'Triage: total vs suma por día · {k}', tri['total'][k], sum(p[k] for p in tri['por_dia']), 'total', 'suma por día', 0, periodo=per)
    inf.cruce(g, 'Triage: calificados + descalificados no pasan de las agendas', tri['total']['calificados'] + tri['total']['descalificados'],
              tri['total']['agendas'], 'calificados + descalificados', 'agendas', 0, modo='<=', periodo=per,
              nota='Las agendas sin calificar son legítimas; lo que no puede pasar es calificar más agendas de las que hay.')
    inf.info(g, 'Agendas de triage dentro del total de Revisar/closers', f'{en_revisar} de {tot["agendas"]} agendas de Revisar tienen como closer a una triage: '
             'entran en el show up y el close rate de Analizar de closers.', periodo=per)
    # Marketing (FinancialAgenda) vs Comercial (Appointment), base reunión
    mk = anuncios_service.tablero(d, h, base='reunion')['fuentes']
    inf.cruce(g, 'Agendas por reunión: Marketing (Setting+Workshop+Otras) vs Revisar', mk['agendas_total'], tot['agendas'], 'Marketing · agendas_total',
              'Revisar', 0, periodo=per, nota='Marketing lee el Tablero (`FinancialAgenda`) y Revisar `Appointment`; la tarjeta dice que deben dar lo mismo en base reunión.')
    asistieron = {a.get('person_uuid') or ('c', a['client_id']) for a in filas if a['asistio']}
    inf.cruce(g, 'Asistieron por reunión: Marketing (leads) vs Revisar (personas)', sum(f['show_up'] for f in mk['fuentes']) + mk['otras']['show_up'], len(asistieron),
              'Marketing · show_up', 'Revisar · personas que asistieron', 0, periodo=per,
              nota=f"Marketing cuenta leads (una persona que fue a dos llamadas suma 1); Revisar cuenta filas ({tot['asistieron']}) y {len(asistieron)} personas distintas.")


# --- (d) Segmentos A/B/C/D vs el total --------------------------------------------------------------------------

@chequeo('d · Segmentos', 'Segmentos')
def cruce_d(inf, d, h):
    from app.models import Client
    from app.services import anuncios_service, segmentos_comercial, segmentos_marketing_service as sm
    from app.services.comercial_service import ComercialService as C
    g, per = 'd · Segmentos', f'{d} → {h}'
    total = Client.query.count()
    por_seg = dict(db.session.query(Client.segmento, db.func.count()).group_by(Client.segmento).all())
    raros = {k: v for k, v in por_seg.items() if k not in (None, 'A', 'B', 'C', 'D')}
    inf.cruce(g, 'Clientes: A + B + C + D + sin segmento vs total', sum(por_seg.get(k, 0) for k in ('A', 'B', 'C', 'D', None)) + sum(raros.values()),
              total, 'suma de grupos', 'clientes', 0, nota=f'Valores fuera de A–D: {raros or "ninguno"}. Sin segmento: {por_seg.get(None, 0)} de {total}.')
    for rol, esperado in (('closers', len(C.agendas(d, h))), ('setters', len(C.generadas(d, h)))):
        panel = segmentos_comercial.panel(rol, d, h)
        t = panel['grupos'][0]
        inf.cruce(g, f'Panel de segmentos ({rol}): total vs lista base', t['total']['agendas'], esperado, 'panel · total', 'Revisar', 0, periodo=per)
        inf.cruce(g, f'Panel de segmentos ({rol}): A+B+C+D+sin vs total', sum(f['agendas'] for f in t['filas']), t['total']['agendas'], 'suma de segmentos',
                  'total', 0, periodo=per, nota=f"Sin segmento: {next(f['agendas'] for f in t['filas'] if f['segmento'] == 'sin')} de {t['total']['agendas']}.")
    vista = sm.vista(d, h, 'fuente')
    fu = anuncios_service.tablero(d, h, base='alta')
    f_res, otras = {f['key']: f for f in fu['fuentes']['fuentes']}, fu['fuentes']['otras']
    for grupo in vista['grupos']:
        for k in ('agendas', 'show_up', 'ventas', 'new_cash', 'cash_total'):
            inf.cruce(g, f"Matriz de Marketing · {grupo['label']} · {k}: segmentos vs total", round(sum((f[k] or 0) for f in grupo['filas']), 2),
                      grupo['total'][k] or 0, 'suma A+B+C+D+sin', 'total del grupo', 0.01, periodo=per)
            f = f_res.get(grupo['key'], otras)
            inf.cruce(g, f"Matriz de Marketing · {grupo['label']} · {k}: total vs tarjeta de fuente", grupo['total'][k] or 0, f.get(k) or 0,
                      'matriz de segmentos', 'tarjeta de fuente', 0.01, periodo=per,
                      nota='La matriz cuenta por fecha de alta y la tarjeta usa la base elegida (aquí alta).')
    inf.cruce(g, 'Leads de Setting: matriz de segmentos vs tarjeta', next((g_['total']['leads'] or 0 for g_ in vista['grupos'] if g_['key'] == 'setting'), 0),
              f_res['setting']['leads'], 'matriz', 'tarjeta Setting', 0, periodo=per,
              nota='Los leads de Setting salen de ManyChat; una diferencia indica entrantes archivados (la tarjeta los excluye) o sin persona.')


# --- (e) Comisión real vs estimada ------------------------------------------------------------------------------

@chequeo('e · Comisión', 'Comisión real vs estimada')
def cruce_e(inf):
    from app.models import FinancialSale as FS
    from app.services import anuncios_service, commission_service as cs
    g = 'e · Comisión real vs estimada'
    promedio = [f'{m.__name__}.{n}' for m in (cs, anuncios_service) for n in dir(m) if 'promedio' in n.lower() and callable(getattr(m, n))]
    if promedio:
        inf.info(g, 'Comisión promedio presente', f'Hay funciones con «promedio» en este despliegue: {promedio}. Este script todavía no las cruza: agregar el cruce.')
    else:
        inf.info(g, 'Comisión promedio no existe todavía', 'El cálculo de neto con comisión promedio está en construcción en otra sesión y no está en este despliegue; '
                 'se cruza lo que existe: la fee real de los pagos verificados contra la estimada fija (`COMISION_PASARELA`).')
    por = defaultdict(lambda: {'n': 0, 'bruto': 0.0, 'real': 0.0})
    estados = defaultdict(int)
    for metodo, estado, monto, tx, status in db.session.query(FS.metodo_pago, FS.estado, FS.monto, FS.transaction_amount, FS.transaction_status):
        estados[status or 'pending'] += 1
        if status == 'verified' and tx is not None and monto:
            fila = por[(metodo or '').strip().lower()]
            fila['n'] += 1
            fila['bruto'] += float(monto)
            fila['real'] += float(tx)
    inf.info(g, 'Cobertura de la verificación', f'Estados de verificación de todos los pagos: {dict(estados)}.')
    for metodo, tasa in cs.COMISION_PASARELA.items():
        f = por.get(metodo)
        if not f or f['bruto'] <= 0:
            inf.info(g, f'Fee real de {metodo}', 'No hay pagos verificados con extracto: no se puede medir.')
            continue
        real = round((1 - f['real'] / f['bruto']) * 100, 2)
        mas = round(f['bruto'] * tasa - (f['bruto'] - f['real']), 2)
        inf.cruce(g, f'Fee efectiva de {metodo}: real vs estimada ({f["n"]} pagos verificados)', real, round(tasa * 100, 2), '% real', '% estimada', 0.5,
                  nota=f'Sobre ${f["bruto"]:,.2f} brutos verificados la fee real fue ${f["bruto"] - f["real"]:,.2f} y la estimada ${f["bruto"] * tasa:,.2f} '
                       f'(la estimada {"sobra" if mas > 0 else "falta"} ${abs(mas):,.2f}). Si se aleja, el neto de los pagos no verificados queda mal por esa diferencia.')
    otros = {m: f for m, f in por.items() if m not in cs.COMISION_PASARELA}
    if otros:
        inf.info(g, 'Verificados por otros métodos', f"{ {m: round((1 - f['real'] / f['bruto']) * 100, 2) for m, f in otros.items() if f['bruto']} } (% de diferencia bruto→neto; la estimación aplica 0 %).")


def _por_mes(fechas):
    meses = defaultdict(int)
    for f in fechas:
        meses[f'{f:%Y-%m}'] += 1
    return meses


def _quien(appt_id):
    from app.models import Appointment
    a = Appointment.query.get(appt_id)
    return f'{a.client.full_name if a.client else "?"} · closer {a.closer.username if a.closer else "?"} · origen {a.origin} · resultado {a.closer_result}'


# --- (f) Datos sueltos ------------------------------------------------------------------------------------------

@chequeo('f · Datos sueltos', 'Datos sueltos')
def cruce_f(inf, d, h):
    from app.models import Appointment
    from app.services.comercial_cruces import clientes_de_ventas
    from app.services.comercial_service import ComercialService as C
    g, per = 'f · Datos sueltos', f'{d} → {h}'
    cobros = C.ventas_del_periodo(d, h)
    mapa = clientes_de_ventas(cobros)
    sin = [v for v in cobros if not mapa.get(v.id)]
    inf.cuenta(g, 'Ventas (cobros) sin cliente cruzado', len(sin), dinero=sum(float(v.monto or 0) for v in sin), periodo=per,
               nota='Esas filas de Revisar no abren ficha y no se atribuyen a anuncio/segmento.',
               ejemplos=[f'#{v.id} {v.date:%Y-%m-%d} {v.nombre_cliente or "sin nombre"} ${float(v.monto or 0):,.2f}' for v in sin[:8]])
    # Agendas duplicadas por persona que siguen contando en Revisar
    por_persona = defaultdict(list)
    for a in C.agendas(d, h):
        por_persona[a.get('person_uuid') or ('c', a['client_id'])].append(a)
    dup = []
    for k, lst in por_persona.items():
        lst.sort(key=lambda a: a['fecha'] or '')
        for x, y in zip(lst, lst[1:]):
            if x['fecha'] and y['fecha'] and abs((datetime.fromisoformat(y['fecha'][:19]) - datetime.fromisoformat(x['fecha'][:19])).total_seconds()) <= 12 * 3600:
                dup.append((k, x, y))
                break
    inf.cuenta(g, 'Personas con dos agendas vigentes a menos de 12 h (cuentan doble en Revisar)', len(dup), periodo=per,
               nota='Misma ventana que `scripts/reporte_agendas_duplicadas.py`; son candidatas a duplicadas que `vigentes()` no descarta (distinto horario o closer).',
               ejemplos=[f"{x['cliente']}: #{x['id']} {x['fecha']} / #{y['id']} {y['fecha']}" for _, x, y in dup[:8]])
    mismo_dia = defaultdict(list)
    for a in Appointment.query.filter(Appointment.start_time >= datetime.combine(d, time.min), Appointment.start_time <= datetime.combine(h, time.max)):
        mismo_dia[(a.person_uuid or ('c', a.client_id), a.closer_id, a.start_time)].append(a.id)
    exactas = {k: v for k, v in mismo_dia.items() if len(v) > 1}
    inf.cuenta(g, 'Agendas idénticas (misma persona, closer y horario)', len(exactas), periodo=per, nota='Duplicado exacto en `appointments`.',
               ejemplos=[f"citas {v} · {k[2]} · {_quien(v[0])}" for k, v in list(exactas.items())[:8]])
    # Doble carga de un cobro
    claves = defaultdict(list)
    for v in cobros:
        claves[(v.person_uuid or v.client_id or (v.mail_cliente or '').lower(), round(float(v.monto or 0), 2), v.date.date() if v.date else None, v.tipo_pago)].append(v.id)
    gemelos = {k: v for k, v in claves.items() if len(v) > 1 and k[0]}
    inf.cuenta(g, 'Cobros gemelos (misma persona, monto, día y tipo)', len(gemelos), periodo=per, dinero=sum(k[1] * (len(v) - 1) for k, v in gemelos.items()),
               nota='Posible doble carga del mismo pago; el dinero extra inflaría el cash.', ejemplos=[f'{v} ${k[1]:,.2f} {k[2]}' for k, v in list(gemelos.items())[:8]])


@chequeo('f · Datos sueltos', 'Datos sueltos globales')
def cruce_g(inf):
    from app.models import FinancialSale as FS, Sale
    from app.services.comercial_vocabulario import venta_completada
    g = 'f · Datos sueltos'
    # Pagos sin venta
    pagos = [p for p in db.session.query(FS.id, FS.sale_id, FS.monto, FS.estado, FS.date, FS.nombre_cliente).all() if venta_completada(p)]
    sin_venta = [p for p in pagos if not p.sale_id]
    inf.cuenta(g, 'Pagos completados sin venta (sale_id vacío) · todo el historial', len(sin_venta), dinero=sum(float(p.monto or 0) for p in sin_venta),
               nota='Pagos que no pertenecen a ninguna `Sale`: no suman a las ventas de Finanzas ni a la deuda por venta.',
               ejemplos=[f'#{p.id} {p.date:%Y-%m-%d} {p.nombre_cliente} ${float(p.monto or 0):,.2f}' for p in sin_venta[-8:] if p.date])
    for estado, es_error, nota in (('refunded', True, 'Reembolsada: si el pago sigue completado, el cash lo cuenta aunque se devolvió.'),
                                   ('cancelled', False, 'Cancelada (p. ej. una baja): lo cobrado queda como cash por diseño, ver «Bajas de clientes».')):
        c = db.session.query(FS.id, FS.monto, FS.nombre_cliente, FS.date).join(Sale, Sale.id == FS.sale_id).filter(
            Sale.status == estado, db.func.lower(db.func.coalesce(FS.estado, '')).in_(('', 'completada', 'confirmada'))).all()
        inf.cuenta(g, f'Pagos completados dentro de una venta {estado}', len(c), dinero=sum(float(x[1] or 0) for x in c), nota=nota, info=not es_error,
                   ejemplos=[f'{mes}: {n} pagos' for mes, n in sorted(_por_mes([x[3] for x in c if x[3]]).items())])
    vacias = db.session.execute(text("SELECT count(*) FROM sales s WHERE s.status = 'active' AND NOT EXISTS (SELECT 1 FROM financial_sales f WHERE f.sale_id = s.id)")).scalar()
    inf.cuenta(g, 'Ventas activas sin ningún pago', vacias, nota='Ventas (`Sale`) cargadas con precio acordado pero sin cobro: no son cash; revisar si son señas por cobrar o carga a medio hacer.', info=True)
    raros = [p for p in pagos if not p.monto or float(p.monto) == 0]
    inf.cuenta(g, 'Pagos completados con monto 0 o vacío', len(raros), nota='No suman cash pero cuentan como fila (y a veces como venta).',
               ejemplos=[f'#{p.id} {p.nombre_cliente}' for p in raros[:8]])
