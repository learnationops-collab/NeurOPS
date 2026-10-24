/**
 * Marketing por fuente (Setting vs Workshop): lo que dibuja la comparación y las series de una fuente.
 * Las cuentas las hace el backend (`app/services/fuentes_service.py`); acá solo se ordenan para
 * mostrarlas. ROAS New Cash = venta nueva ÷ gastado; ROAS Total = todo lo cobrado de los clientes de la
 * fuente ÷ gastado. Sin gasto, ambos son null («—»).
 */
import { diasDelRango } from './metricas';

/**
 * Las filas de la comparación. `mejor`: 'mas' o 'menos' marca qué fuente rinde más en una tasa (un
 * ROAS, un % o un costo); sin `mejor` es un volumen, que depende de cuánto se invirtió y no se corona.
 */
export const GRUPOS_COMPARACION = [
    { titulo: 'Embudo', filas: [
        { key: 'leads', label: 'Leads entrantes', formato: 'num',
            ayuda: 'Setting: personas que escribieron una palabra clave. Workshop: clics al grupo de WhatsApp.' },
        { key: 'agendas', label: 'Agendas', formato: 'num', ayuda: 'Personas con agenda creada en el período, por fuente.' },
        { key: 'show_up', label: 'Show up', formato: 'num', pct: 'pct_show_up', mejor: 'mas', porPct: true,
            ayuda: 'Agendados que asistieron a la llamada. Se corona por el % sobre las agendas.' },
        { key: 'ventas', label: 'Ventas', formato: 'num', ayuda: 'Pagos de venta nueva (completo o split) del período.' },
        { key: 'cuotas', label: 'Cuotas cobradas', formato: 'num', monto: 'cuotas_monto',
            ayuda: 'Cuotas del período de clientes que trajo la fuente, aunque la venta sea de antes.' },
        { key: 'upsells', label: 'Upsells', formato: 'num', monto: 'upsells_monto',
            ayuda: 'Upsells cobrados en el período de clientes que trajo la fuente, con su monto.' },
        { key: 'pct_upsell', label: 'Clientes con upsell', formato: 'pct', mejor: 'mas',
            ayuda: 'Clientes con un upsell cobrado ÷ clientes con algún cobro, en el período.' },
    ] },
    { titulo: 'Plata', filas: [
        { key: 'gasto', label: 'Importe gastado', formato: 'money', ayuda: 'Gasto de Meta de los anuncios del embudo.' },
        { key: 'new_cash', label: 'New Cash', formato: 'money',
            ayuda: 'Lo cobrado en pagos de venta nueva del período (completo + split).' },
        { key: 'cash_total', label: 'Cash total', formato: 'money',
            ayuda: 'Todo lo cobrado del período de los clientes de la fuente: ventas, cuotas, señas y upsells.' },
        { key: 'roas_new_cash', label: 'ROAS New Cash', formato: 'veces', mejor: 'mas',
            ayuda: 'New Cash ÷ importe gastado.' },
        { key: 'roas_total', label: 'ROAS Total', formato: 'veces', mejor: 'mas',
            ayuda: 'Cash total ÷ importe gastado.' },
    ] },
    { titulo: 'Costos', filas: [
        { key: 'cpl', label: 'Costo por lead', formato: 'money', mejor: 'menos', ayuda: 'Importe gastado ÷ leads entrantes.' },
        { key: 'costo_agenda', label: 'Costo por agenda', formato: 'money', mejor: 'menos', ayuda: 'Importe gastado ÷ agendas.' },
        { key: 'costo_venta', label: 'Costo por venta', formato: 'money', mejor: 'menos', ayuda: 'Importe gastado ÷ ventas.' },
    ] },
];

/** La key de la fuente que rinde más en `fila` (la de mayor valor si `mejor` es 'mas', la de menor si
 *  'menos'), o null si no hay una tasa que comparar, falta un dato o empatan. */
export const ganadoraDe = (fila, fuentes) => {
    if (!fila.mejor) return null;
    const campo = fila.porPct ? fila.pct : fila.key;
    const con = fuentes.filter((f) => f[campo] !== null && f[campo] !== undefined);
    if (con.length < 2) return null;
    const orden = [...con].sort((a, b) => (fila.mejor === 'mas' ? b[campo] - a[campo] : a[campo] - b[campo]));
    return orden[0][campo] === orden[1][campo] ? null : orden[0].key;
};

const dividir = (num, den) => (den ? Number((num / den).toFixed(2)) : 0);

/** La serie por día de una fuente con todos los días del período: gasto (de `tablero.embudos`), agendas
 *  (`fuente.agendas_dias`) y costo por agenda (0 el día sin agendas: no hay con qué dividir). */
export const serieDeFuente = (embudos, fuente, desde, hasta) => {
    const dias = diasDelRango(desde, hasta, { gasto: 0, agendas: 0, costo_agenda: 0 });
    const indice = Object.fromEntries(dias.map((x, i) => [x.dia, i]));
    const gastos = (embudos || []).find((e) => e.embudo === fuente?.key)?.dias || {};
    Object.entries(gastos).forEach(([dia, g]) => { if (dias[indice[dia]]) dias[indice[dia]].gasto = g; });
    Object.entries(fuente?.agendas_dias || {}).forEach(([dia, n]) => { if (dias[indice[dia]]) dias[indice[dia]].agendas = n; });
    return dias.map((x) => ({ ...x, costo_agenda: dividir(x.gasto, x.agendas) }));
};
