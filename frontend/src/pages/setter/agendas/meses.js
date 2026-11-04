/**
 * «Mis agendas» por mes (11/10/2026). Kerwin: «Tenés 149 pendientes, es una banda: estaría bueno el
 * filtro de este mes, que te llenen este mes y luego el mes pasado, y que le vayamos pidiendo de a
 * poquito».
 *
 * El backend manda la bandeja partida por el mes en que se CREÓ cada agenda (`resumen.meses`, del
 * actual al primero: ver `palabra_clave_service.por_mes`) y cada tarjeta con su `mes`. Acá viven las
 * cuentas puras que usan la pantalla y el dock: sin React, para probarlas sueltas.
 */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
    'octubre', 'noviembre', 'diciembre'];

const numeroDeMes = (clave) => Number(String(clave || '').slice(5, 7)) - 1;

/** '2026-10' → 'octubre'. */
export const nombreDeMes = (clave) => MESES[numeroDeMes(clave)] || '';

/** '2026-10' → 'Octubre'. */
export const tituloDeMes = (clave) => {
    const n = nombreDeMes(clave);
    return n ? n[0].toUpperCase() + n.slice(1) : '';
};

/** '2026-10' → 'Oct' (el chip del selector). */
export const mesCorto = (clave) => tituloDeMes(clave).slice(0, 3);

/**
 * Los meses del resumen con las pendientes contadas de la lista que se ve: así el selector baja en el
 * momento en que una tarjeta se va, sin esperar al backend. Se quedan los que tienen agendas y el
 * mes actual (aunque esté vacío: es donde abre la pantalla); un mes sin ninguna no dice nada.
 */
export const mesesConCuenta = (resumen, pendientes = [], ventas = []) => {
    const cuenta = new Map();
    pendientes.forEach(a => cuenta.set(a.mes, (cuenta.get(a.mes) || 0) + 1));
    // Las ventas sin palabra clave por mes de pago (04/11/2026): un cliente cuenta en cada mes en que pagó.
    const deVentas = new Map();
    ventas.forEach(g => mesesDeLasVentas(g).forEach(m => deVentas.set(m, (deVentas.get(m) || 0) + 1)));
    const base = (resumen?.meses || []).map(m => ({ ...m, pendientes: cuenta.get(m.mes) || 0, ventas: deVentas.get(m.mes) || 0 }));
    // Un mes con ventas pero sin agendas también tiene su chip.
    const sueltos = [...deVentas.keys()].filter(m => !base.some(b => b.mes === m))
        .map(m => ({ mes: m, total: 0, pendientes: 0, ventas: deVentas.get(m) }));
    return [...base, ...sueltos]
        .sort((a, b) => (a.mes < b.mes ? 1 : -1))
        .filter(m => m.total > 0 || m.pendientes > 0 || m.ventas > 0 || m.mes === resumen?.mes_actual);
};

/** Los meses ('2026-10') en que un cliente de ventas tiene algún pago. */
export const mesesDeLasVentas = (grupo) => [...new Set((grupo?.pagos || [])
    .map(p => String(p.fecha || '').slice(0, 7)).filter(Boolean))];

/** Los clientes de `grupos` con algún pago en `mes`; sin mes (null), todos. */
export const ventasDelMes = (grupos = [], mes = null) => (mes
    ? grupos.filter(g => mesesDeLasVentas(g).includes(mes))
    : grupos);

/**
 * El mes que sigue después de vaciar `actual`: el más cercano hacia atrás que todavía tiene
 * pendientes («este mes y luego el mes pasado»); si no queda ninguno atrás, el más nuevo que tenga.
 * null si no queda nada en ningún mes.
 */
export const mesSiguiente = (meses, actual) => {
    const i = meses.findIndex(m => m.mes === actual);
    const atras = meses.slice(i + 1).find(m => m.pendientes > 0);
    return atras || meses.find(m => m.mes !== actual && m.pendientes > 0) || null;
};

/**
 * La marca de «Mis agendas» en el dock: cuenta las del mes que se está trabajando (el más nuevo con
 * pendientes, casi siempre el actual), no la bandeja entera. Es un empujón a lo próximo que hay que
 * hacer, y un «149» en el dock es justo lo que Kerwin dijo que asusta. El ✓ queda para cuando no
 * falta nada en ningún mes: con septiembre pendiente, un ✓ diría que está todo hecho.
 *
 * Sin `meses` (un backend anterior) cuenta el total, como antes.
 */
export const marcaDelDock = (resumen) => {
    if (!resumen || typeof resumen.pendientes !== 'number') return null;
    if (resumen.pendientes === 0) return { texto: '✓', titulo: 'todas con palabra clave' };
    const enJuego = (resumen.meses || []).find(m => m.pendientes > 0);
    const n = enJuego ? enJuego.pendientes : resumen.pendientes;
    return {
        tipo: 'cuenta',
        texto: n > 99 ? '99+' : String(n),
        titulo: enJuego ? `${n} sin palabra clave en ${nombreDeMes(enJuego.mes)}` : `${n} sin palabra clave`,
    };
};
