import { Check } from 'lucide-react';
import AgendasDelTaller from '../agendas/AgendasDelTaller';
import {
    cac, dinero, ESTADOS_GRABACION, estadoGrabacion, ganancia, mesDe, numero, porcentaje, roasRango, veces,
} from './formato';
import { calcularTotales, MUESTRA_MINIMA, tieneTrafico, tonoDe } from './totalesTalleres';

/**
 * Las columnas de la tabla de Talleres (diseño de Kerwin, 24/10/2026): la principal junta la fecha, el punto
 * de ganancia, la casilla de comparar y el nombre, y se puede ensanchar; el resto son cifras que se leen
 * contra el total del período (verde si es 20 % mejor, rojo si 20 % peor). Las «vistas» arman en un toque
 * las combinaciones más pedidas.
 */

/** Una cifra: el valor, con el tono contra el total y, debajo, una nota chica. `solo`: tono en el texto, sin fondo. */
const Cifra = ({ texto, tono, solo = false, nota = null }) => (
    <span className="wt-cifra">
        <span className={`wt-tono${tono ? ` wt-tono--${tono}` : ''}${solo ? ' wt-tono--solo' : ''}`}>{texto}</span>
        {nota && <small>{nota}</small>}
    </span>
);

const FALTA = <span className="wt-sin">—</span>;
const der = { alinear: 'der', width: 'minmax(96px,1fr)' };

/** Todas las cifras comparan contra `total` solo si `comparar` está prendido. */
export const columnasDe = ({ formatDate, elegidos, onComparar, comparar }) => {
    const cifra = (key, header, valor, formato, extra = {}) => ({
        key, header, ...der, valor, ...extra,
        total: (filas) => calcularTotales(filas)[key],
        render: (e, total) => {
            const v = valor(e);
            if (v == null) return FALTA;
            const tono = comparar ? tonoDe(key, v, total?.valor, e) : null;
            return <Cifra texto={formato(v, e)} tono={tono} solo={key === 'ganancia' || key === 'roas'}
                nota={extra.nota ? extra.nota(e) : null} />;
        },
    });
    const traf = (f) => (e) => (tieneTrafico(e) ? f(e) : null);
    const dolares = (v) => `$${Number(v).toFixed(2)}`;
    return [
        {
            key: 'taller', header: 'Taller', fija: true, pegada: true, redimensionable: true, width: '280px',
            valor: (e) => e.date,
            render: (e) => {
                const on = elegidos.includes(e.id);
                const gana = ganancia(e) > 0;
                return (
                    <span className="wt-celda-nom">
                        <button type="button" className={`wt-casilla${on ? ' wt-casilla--on' : ''}`} aria-pressed={on}
                            aria-label={`Comparar ${e.name}`} title="Sumar a la comparación (hasta 4)"
                            onClick={(ev) => { ev.stopPropagation(); onComparar(e.id); }}
                            onKeyDown={(ev) => ev.stopPropagation()}>
                            {on && <Check aria-hidden="true" />}
                        </button>
                        <span className="wt-taller-dos">
                            <span className="wt-taller-fecha num">
                                <i className={`wt-punto wt-punto--${gana ? 'si' : 'no'}`} title={gana ? 'Dio ganancia' : 'Dio pérdida'} />
                                {formatDate(e.date)}
                            </span>
                            <span className="celda wt-taller-nombre" title={e.name}>{e.name}</span>
                        </span>
                    </span>
                );
            },
            total: () => null,
        },
        cifra('inversion', 'Inversión', (e) => e.inversion, dinero, { grupo: 'Tráfico' }),
        cifra('clics', 'Clics', traf((e) => e.clics), numero, { oculta: true }),
        cifra('ctr', 'CTR', traf((e) => e.ctr), porcentaje, { oculta: true }),
        cifra('cpc', 'CPC', traf((e) => e.cpc), dolares, { oculta: true }),
        cifra('cpm', 'CPM', traf((e) => e.cpm), dolares, { oculta: true }),
        cifra('leads', 'Leads', (e) => e.leads, numero, { grupo: 'Captación' }),
        cifra('cpl', 'CPL', (e) => (e.leads > 0 ? e.cpl : null), dolares,
            { ayuda: 'Costo por lead: la inversión dividida los anotados.' }),
        cifra('whatsapp', 'WhatsApp', (e) => e.whatsapp_leads, numero, { oculta: true }),
        cifra('show_up', 'Show up', (e) => e.show_up_rate, porcentaje,
            { nota: null, ayuda: 'Se conectaron a la clase en vivo, sobre los anotados.' }),
        cifra('aplicaciones', 'Aplicaron', (e) => e.aplicaciones_form, numero, { grupo: 'Conversión', oculta: true }),
        {
            ...cifra('agendas', 'Agendas', (e) => e.agendas_exitosas, numero),
            render: (e) => <AgendasDelTaller evento={e} formatDate={formatDate} />,
        },
        cifra('costo_agenda', 'Costo agenda', (e) => (e.agendas_exitosas > 0 ? e.costo_por_agenda : null), dinero, { oculta: true }),
        cifra('asistieron', 'Asistieron', (e) => e.show_up_sales_call, numero,
            { ayuda: 'Personas que se presentaron a la llamada de venta.' }),
        cifra('ventas', 'Ventas', (e) => e.sales, numero),
        cifra('close_rate', 'Close rate', (e) => (e.show_up_sales_call > 0 ? e.pct_close_rate : null), porcentaje, {
            ayuda: 'Ventas ÷ asistieron a la llamada. Sin señas. Con menos de 5 asistencias es muestra chica: sin color.',
            nota: (e) => (e.show_up_sales_call > 0 && e.show_up_sales_call < MUESTRA_MINIMA ? `n=${e.show_up_sales_call}` : null),
        }),
        cifra('cash', 'Cash', (e) => e.cash_collected, dinero, {
            grupo: 'Plata', oculta: true, ayuda: 'Todo lo cobrado a las personas del taller, señas incluidas.',
        }),
        cifra('ganancia', 'Ganancia', ganancia, dinero, { oculta: true, ayuda: 'Cash menos inversión.' }),
        cifra('ticket', 'Ticket', (e) => e.ticket_promedio, dinero, {
            oculta: true, ayuda: 'Ventas nuevas ÷ cantidad. Sin cuotas ni señas.',
        }),
        cifra('cac', 'CAC', cac, dinero, { oculta: true, ayuda: 'Lo que costó cada venta: la inversión dividida las ventas.' }),
        cifra('roas', 'ROAS Total', (e) => e.roas, veces, { ayuda: 'Todo lo cobrado (con cuotas y señas) ÷ inversión. Desde 1x el taller se pagó.' }),
        {
            key: 'grabacion', header: 'Grabación', width: 'minmax(96px,1fr)', oculta: true,
            valor: (e) => ESTADOS_GRABACION[estadoGrabacion(e).tipo].texto,
            render: (e) => {
                const info = ESTADOS_GRABACION[estadoGrabacion(e).tipo];
                return <span className="chip" style={{ '--c': `var(--${info.tono})` }}><span className="trunc">{info.texto}</span></span>;
            },
        },
    ];
};

/** Las vistas de columnas: cada una deja a la vista justo estas. «Todo» rotula los grupos. */
const TODAS = ['inversion', 'clics', 'ctr', 'cpc', 'cpm', 'leads', 'cpl', 'whatsapp', 'show_up', 'aplicaciones', 'agendas',
    'costo_agenda', 'asistieron', 'ventas', 'close_rate', 'cash', 'ganancia', 'ticket', 'cac', 'roas'];
export const VISTAS_TALLERES = [
    { key: 'embudo', label: 'Embudo', columnas: ['inversion', 'leads', 'cpl', 'show_up', 'agendas', 'asistieron', 'ventas', 'close_rate', 'roas'] },
    { key: 'trafico', label: 'Tráfico', columnas: ['inversion', 'clics', 'ctr', 'cpc', 'cpm', 'leads', 'cpl'] },
    { key: 'captacion', label: 'Captación', columnas: ['leads', 'cpl', 'whatsapp', 'show_up', 'aplicaciones', 'agendas'] },
    { key: 'conversion', label: 'Conversión', columnas: ['agendas', 'costo_agenda', 'asistieron', 'ventas', 'close_rate', 'cac'] },
    { key: 'plata', label: 'Plata', columnas: ['inversion', 'ventas', 'cash', 'ganancia', 'ticket', 'cac', 'roas'] },
    { key: 'todo', label: 'Todo', columnas: TODAS, grupos: true },
];

export const FACETAS_TALLERES = [
    { key: 'mes', label: 'Mes', de: (e) => mesDe(e.date) },
    { key: 'ventas', label: 'Ventas', de: (e) => (e.sales > 0 ? 'Con ventas' : 'Sin ventas') },
    { key: 'roas', label: 'ROAS', de: (e) => roasRango(e.roas) },
    { key: 'grabacion', label: 'Grabación', de: (e) => ESTADOS_GRABACION[estadoGrabacion(e).tipo].corto },
    { key: 'inversion', label: 'Inversión', de: (e) => (e.inversion_de_meta ? 'De Meta' : 'A mano') },
];

