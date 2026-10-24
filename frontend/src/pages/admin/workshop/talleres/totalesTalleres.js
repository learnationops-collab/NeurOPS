import { dinero, ganancia, numero, porcentaje, veces } from './formato';

/**
 * Los totales del período de la tabla de Talleres y cómo se compara cada taller contra ellos (diseño de
 * Kerwin, 24/10/2026). Sin React: se prueba solo.
 *
 * Una cifra de suma (inversión, leads, ventas, cash…) se suma; una tasa o un costo se pondera con sus
 * propias bases (CPL = inversión ÷ leads, ROAS = cash ÷ inversión…), no se promedia; el show up y el
 * ticket sí se promedian. Los talleres viejos no tienen datos de tráfico (clics, CTR, CPC, CPM): quedan
 * fuera de esos totales.
 */
const suma = (fs, k) => fs.reduce((s, e) => s + (Number(e[k]) || 0), 0);
const promedio = (vs) => (vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null);
const dividir = (a, b) => (b > 0 ? a / b : null);
const por = (v, k) => (v == null ? null : v * k);
const dolares = (v) => `$${Number(v).toFixed(2)}`;

export const tieneTrafico = (e) => e.clics > 0 && e.cpm > 0;

/** { key de columna: { valor, texto, tipo } }, sobre los talleres que se están viendo. */
export const calcularTotales = (fs) => {
    const inv = suma(fs, 'inversion');
    const trafico = fs.filter(tieneTrafico);
    const invT = suma(trafico, 'inversion');
    const clics = suma(trafico, 'clics');
    const impr = trafico.reduce((s, e) => s + (e.inversion / e.cpm) * 1000, 0);
    const t = (valor, formato, tipo) => ({
        valor, tipo, texto: valor == null || !Number.isFinite(valor) ? '—' : formato(valor),
    });
    const leads = suma(fs, 'leads');
    const agendas = suma(fs, 'agendas_exitosas');
    const asistieron = suma(fs, 'show_up_sales_call');
    const ventas = suma(fs, 'sales');
    const cash = suma(fs, 'cash_collected');
    return {
        inversion: t(inv, dinero, 'suma'),
        clics: t(clics, numero, `${trafico.length} con datos`),
        ctr: t(por(dividir(clics, impr), 100), porcentaje, 'ponderado'),
        cpc: t(dividir(invT, clics), dolares, 'ponderado'),
        cpm: t(por(dividir(invT, impr), 1000), dolares, 'ponderado'),
        leads: t(leads, numero, 'suma'),
        cpl: t(dividir(inv, leads), dolares, 'ponderado'),
        whatsapp: t(suma(fs, 'whatsapp_leads'), numero, 'suma'),
        show_up: t(promedio(fs.map((e) => e.show_up_rate).filter((v) => v != null)), porcentaje, 'promedio'),
        aplicaciones: t(suma(fs, 'aplicaciones_form'), numero, 'suma'),
        agendas: t(agendas, numero, 'suma'),
        costo_agenda: t(dividir(inv, agendas), dinero, 'ponderado'),
        asistieron: t(asistieron, numero, 'suma'),
        ventas: t(ventas, numero, 'suma'),
        close_rate: t(por(dividir(ventas, asistieron), 100), porcentaje, 'ponderado'),
        cash: t(cash, dinero, 'suma'),
        ganancia: t(fs.reduce((s, e) => s + ganancia(e), 0), dinero, 'suma'),
        ticket: t(promedio(fs.filter((e) => e.sales > 0 && e.ticket_promedio > 0).map((e) => e.ticket_promedio)), dinero, 'promedio'),
        cac: t(dividir(inv, ventas), dinero, 'ponderado'),
        roas: t(dividir(cash, inv), veces, 'ponderado'),
    };
};

/** Más es mejor (1) o menos es mejor (-1) contra el total del período. */
const DIRECCION = { ctr: 1, cpc: -1, cpm: -1, cpl: -1, show_up: 1, costo_agenda: -1, close_rate: 1, cac: -1 };
/** Con menos asistencias que estas, el close rate es muestra chica: sin color. */
export const MUESTRA_MINIMA = 5;
/** Cuánto mejor o peor que el total tiene que ser un taller para que se marque (20 %). */
const UMBRAL = 1.2;

/**
 * 'success' | 'error' | null. `v` es la cifra del taller y `total` la del período (de `calcularTotales`).
 * La ganancia y el ROAS no se comparan con el total sino con un piso: ganancia positiva y ROAS desde 1x.
 */
export const tonoDe = (key, v, total, e) => {
    if (v == null || !Number.isFinite(Number(v))) return null;
    if (key === 'ganancia') return v > 0 ? 'success' : 'error';
    if (key === 'roas') return v >= 1 ? 'success' : 'error';
    const dir = DIRECCION[key];
    if (!dir || !total) return null;
    if (key === 'close_rate' && (e.show_up_sales_call || 0) < MUESTRA_MINIMA) return null;
    const razon = dir === 1 ? v / total : total / v;
    if (!Number.isFinite(razon)) return null;
    if (razon >= UMBRAL) return 'success';
    if (razon <= 1 / UMBRAL) return 'error';
    return null;
};
