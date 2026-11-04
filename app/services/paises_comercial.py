"""Analizar › Por país: las agendas del período cortadas por el país de cada lead (04/11/2026).

No consulta nada propio: reparte en países las MISMAS filas que usan el resto del dashboard
(`ComercialService.agendas` para el closer, `generadas` para el setter) y los cobros de
`ComercialService.ventas`, con el país que lee `paises_lectura`. Los países suman exacto el total
de arriba. Tocar un país en la pantalla activa el filtro «País» y las cifras y listas se acotan a él.
"""
from app.services import paises_lectura as lectura
from app.services import segmentos_comercial
from app.services.comercial_service import ROL_CLOSERS, ROL_SETTERS, ComercialService, pct


def _cuenta(agendas, cobros):
    realizadas = sum(1 for f in agendas if f['realizada'])
    asistieron = sum(1 for f in agendas if f['asistio'])
    ventas = sum(1 for f in agendas if f['post_call']['key'] == 'venta')
    return {
        'agendas': len(agendas), 'realizadas': realizadas, 'asistieron': asistieron,
        'show_up': pct(asistieron, realizadas), 'ventas': ventas, 'cierre': pct(ventas, asistieron),
        'cash': round(sum(f['monto_neto'] for f in cobros), 2),  # neto (04/11/2026)
    }


def panel(rol, start, end, miembro_id=None, segmento=None):
    """{rol, paises: [{pais, label, agendas, realizadas, asistieron, show_up, ventas, cierre, cash}], total}.
    Solo los países con movimiento, de más a menos agendas; «Sin país» siempre al final. `cash` es de
    los cobros del closer (el setter no tiene cash propio en esta tabla: queda en 0)."""
    if rol == ROL_SETTERS:
        agendas = ComercialService.generadas(start, end, setter_id=miembro_id)
        cobros = []
    else:
        agendas = ComercialService.agendas(start, end, closer_id=miembro_id if rol == ROL_CLOSERS else None)
        cobros = ComercialService.ventas(start, end, closer_nombre=ComercialService.nombre_de(miembro_id)
                                         if rol == ROL_CLOSERS and miembro_id else None)
    if segmento:
        agendas, cobros = segmentos_comercial.filtrar(agendas, segmento), segmentos_comercial.filtrar(cobros, segmento)
    lectura.con_pais(agendas)
    lectura.con_pais(cobros)
    claves = {f['pais'] for f in agendas} | {f['pais'] for f in cobros}
    filas = []
    for k in claves:
        suyas = [f for f in agendas if f['pais'] == k]
        filas.append({'pais': k, 'label': lectura.ETIQUETAS[k],
                      **_cuenta(suyas, [f for f in cobros if f['pais'] == k])})
    filas.sort(key=lambda f: (f['pais'] == lectura.SIN, -f['agendas'], -f['cash'], f['label']))
    return {'rol': rol, 'paises': filas, 'total': _cuenta(agendas, cobros)}
