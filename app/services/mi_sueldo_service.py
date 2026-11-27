"""«Mi sueldo» (ADR-W223): de qué se compone el sueldo de un mes de un setter, un closer o el director
comercial. Sueldo base, la comisión abierta por tipo de pago (el director, por partida), el ajuste
manual, los bonos y los descuentos, con los pagos que suman la comisión.

No calcula nada propio: la comisión es la de la nómina (`nomina_service.comisiones_del_rango`) y el
sueldo, los bonos, la comisión escrita a mano y el estado del pago son los de la fila del mes de
Finanzas (`MonthlyPayroll`). Así dice lo mismo que Payroll y la Nómina de Finanzas.
"""
import calendar
from datetime import date

from app.services.comision_tasas_service import PERSONAS
from app.services.commission_service import DIRECTOR_DE_VENTAS, SETTERS_CON_COMISION, clave_de_closer
from app.services.fuente_service import normalizar
from app.services.nomina_service import clave_de_nomina, comisiones_del_rango, es_renovacion

MESES_DE_HISTORIA = 4

# Los conceptos de la comisión, en el orden en que se leen. Setters y closers cobran el mismo % sobre
# cualquier tipo de pago: separarlos es solo para leerlo. El director cobra dos partidas distintas.
CONCEPTOS = {
    'primer': ('Primer pago', 'Completo, parcial o seña de un cliente nuevo'),
    'cuotas': ('Cuotas', 'Cuotas de ventas anteriores'),
    'renovaciones': ('Renovaciones', 'Clientes que renovaron'),
    'upsells': ('Upsells', 'Un programa más a un cliente'),
    'otros': ('Otros pagos', 'Pagos sin un tipo reconocible'),
    'propia': ('Ventas propias', 'Lo que cerraste vos, de cualquier tipo'),
    'director': ('Como director', 'Pagos de los otros closers, sin renovaciones'),
}


def personas():
    """Quiénes tienen «Mi sueldo»: los setters y closers de la nómina (el director es un closer con
    dos partidas)."""
    lista = [{'clave': c, 'nombre': n, 'rol': 'Setter'} for c, n in PERSONAS['setters']]
    lista += [{'clave': c, 'nombre': n, 'rol': 'Director comercial' if c == DIRECTOR_DE_VENTAS else 'Closer'}
              for c, n in PERSONAS['closers']]
    return lista


def clave_de_usuario(user):
    """La persona de la nómina que es este usuario, o None. Mismo cruce que la comisión del
    espacio de trabajo (`CommissionService`): setters por usuario, closers por su nombre canónico."""
    from app.services.closer_name_service import resolver_nombre_closer

    setter = SETTERS_CON_COMISION.get((user.username or '').strip().lower())
    if setter:
        return setter
    for dato in (user.username, user.email):
        clave = clave_de_closer(resolver_nombre_closer(dato)) if dato else None
        if clave:
            return clave
    return None


def _partes_de_tipo(tipo_pago):
    """'RR - Cuota' -> ('RR', 'Cuota'); sin programa, (None, tipo)."""
    texto = (tipo_pago or '').strip()
    if ' - ' in texto:
        programa, tipo = texto.split(' - ', 1)
        return programa.strip() or None, tipo.strip()
    return None, texto


def concepto_de(fila, clave):
    if clave == DIRECTOR_DE_VENTAS:
        return fila.get('concepto') or 'propia'
    tipo = normalizar(_partes_de_tipo(fila.get('tipo_pago'))[1])
    if 'renov' in tipo:
        return 'renovaciones'
    if 'upsell' in tipo:
        return 'upsells'
    if 'cuota' in tipo:
        return 'cuotas'
    if any(t in tipo for t in ('complet', 'parcial', 'sena')):
        return 'primer'
    return 'otros'


def _meses_hasta(mes):
    anio, numero = (int(x) for x in mes.split('-'))
    meses = []
    for atras in range(MESES_DE_HISTORIA - 1, -1, -1):
        a, n = anio, numero - atras
        while n < 1:
            a, n = a - 1, n + 12
        meses.append(f'{a:04d}-{n:02d}')
    return meses


def _limites(mes):
    anio, numero = (int(x) for x in mes.split('-'))
    return date(anio, numero, 1), date(anio, numero, calendar.monthrange(anio, numero)[1])


def _filas_de_finanzas(clave, meses):
    """(integrante, {mes -> MonthlyPayroll}) de la persona: el primer integrante (por id) cuyo nombre
    la nombra, como la Nómina de Finanzas (`transferencias_del_mes`)."""
    from app.models.financial import MonthlyPayroll, TeamMember

    miembro = next((m for m in TeamMember.query.order_by(TeamMember.id).all() if clave_de_nomina(m.name) == clave), None)
    if not miembro:
        return None, {}
    filas = MonthlyPayroll.query.filter(MonthlyPayroll.member_id == miembro.id, MonthlyPayroll.month.in_(meses)).all()
    return miembro, {f.month: f for f in filas}


def _estado(mes, actual, fila):
    if mes == actual:
        return 'curso'
    if not fila:
        return 'pendiente'
    return fila.status or ('pagado' if fila.is_paid else 'pendiente')


def _pago(fila, concepto):
    programa, tipo = _partes_de_tipo(fila.get('tipo_pago'))
    return {
        'id': fila['id'], 'fecha': (fila.get('date') or '')[:10], 'cliente': fila.get('nombre_cliente'),
        'person_uuid': fila.get('person_uuid'), 'programa': programa, 'tipo': tipo, 'metodo': fila.get('metodo_pago'),
        'neto': fila.get('monto_neto') or 0.0, 'bruto': fila.get('monto_bruto') or 0.0,
        'porcentaje': fila.get('porcentaje'), 'comision': fila.get('comision') or 0.0,
        'excluida': bool(fila.get('is_excluded_from_payroll')), 'verificacion': fila.get('verificacion'),
        'concepto': concepto, 'closer': fila.get('closer') if concepto == 'director' else None,
    }


def _conceptos(pagos):
    """[{k, titulo, detalle, porcentaje, monto, neto, pagos, excluidos}] en el orden de CONCEPTOS."""
    resumen = []
    for k, (titulo, detalle) in CONCEPTOS.items():
        suyos = [p for p in pagos if p['concepto'] == k]
        if not suyos:
            continue
        suman = [p for p in suyos if not p['excluida']]
        porcentajes = {p['porcentaje'] for p in suyos}
        resumen.append({
            'k': k, 'titulo': titulo, 'detalle': detalle,
            'porcentaje': next(iter(porcentajes)) if len(porcentajes) == 1 else None,
            'monto': round(sum(p['comision'] for p in suman), 2), 'neto': round(sum(p['neto'] for p in suman), 2),
            'pagos': len(suman), 'excluidos': len(suyos) - len(suman),
        })
    return resumen


def _renovaciones_de_otros(nomina, mes):
    """Cuántos pagos de renovación de los otros closers quedaron afuera de la partida de director."""
    return sum(1 for clave, _ in PERSONAS['closers'] if clave != DIRECTOR_DE_VENTAS
               for f in (nomina.get(clave) or {}).get('sales', [])
               if (f.get('date') or '').startswith(mes) and es_renovacion(f.get('tipo_pago'))
               and not f.get('is_excluded_from_payroll'))


def composicion(clave, mes, hoy):
    """El sueldo de `mes` ('YYYY-MM') de la persona `clave`, con los meses anteriores para comparar."""
    from app.services.transferencias_service import recibidas_por_persona

    actual = hoy.strftime('%Y-%m')
    meses = _meses_hasta(mes)
    nomina = comisiones_del_rango(_limites(meses[0])[0], _limites(mes)[1])
    filas_nomina = (nomina.get(clave) or {}).get('sales', [])
    miembro, filas = _filas_de_finanzas(clave, meses)

    historia, pagos_del_mes = [], []
    for m in meses:
        pagos = [_pago(f, concepto_de(f, clave)) for f in filas_nomina if (f.get('date') or '').startswith(m)]
        conceptos = _conceptos(pagos)
        fila = filas.get(m)
        base = (fila.base_salary if fila else (miembro.base_salary if miembro and miembro.is_active else 0.0)) or 0.0
        calculada = round(sum(c['monto'] for c in conceptos), 2)
        manual = round(fila.commissions or 0.0, 2) if fila and fila.commissions_manual else None
        comision = manual if manual is not None else calculada
        bonos = round((fila.bonuses or 0.0) if fila else 0.0, 2)
        desde, hasta = _limites(m)
        descuentos = round((recibidas_por_persona(desde, hasta).get(clave) or {}).get('total', 0.0), 2)
        bruto = round(base + comision + bonos, 2)
        historia.append({
            'mes': m, 'estado': _estado(m, actual, fila), 'base': round(base, 2), 'comision_calculada': calculada,
            'comision_manual': manual, 'bonos': bonos, 'descuentos': descuentos, 'bruto': bruto,
            'total': round(bruto - descuentos, 2), 'conceptos': conceptos,
        })
        if m == mes:
            pagos_del_mes = sorted(pagos, key=lambda p: (p['fecha'], p['id']))

    del_mes = historia[-1]
    if clave == DIRECTOR_DE_VENTAS:
        for c in del_mes['conceptos']:
            if c['k'] == 'director':
                c['renovaciones_afuera'] = _renovaciones_de_otros(nomina, mes)
    return {'mes': mes, 'actual': actual, 'historia': historia, 'pagos': pagos_del_mes}
