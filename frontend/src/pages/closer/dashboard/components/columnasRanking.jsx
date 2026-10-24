import React from 'react';
import { money } from '../performanceUtils';
import { tip, DESTINOS_RANKING } from '../metricSources';
import MetricaClicable from '../../../../components/dashboard/MetricaClicable';

/* Columnas del ranking del equipo para `ListaConfigurable`. Una celda lleva a la lista de ESA persona
   con ESA metrica. La persona se acota con el selector de miembro del dashboard comercial (`m` en la
   query string, que el backend usa para rearmar el alcance) y no con la faceta Closer: asi la tira de
   totales y los contadores de faceta tambien quedan acotados, y el numero de la celda cierra con lo que
   se ve abajo. */
const Celda = ({ fila, metrica, valor, irA, bruto }) => (
    <>
        <MetricaClicable
            irA={irA ? (tabla, filtro) => irA(tabla, filtro, { miembroId: fila.closer_id }) : null}
            destino={DESTINOS_RANKING[metrica]}
            detalle={`${fila.name} · ${valor}`}>
            {valor}
        </MetricaClicable>
        {bruto && <small className="block text-[10px] font-bold text-muted whitespace-nowrap">{bruto}</small>}
    </>
);

// El «i» de la columna: qué mide y cómo se calcula.
const ayudaDe = (id) => {
    const m = tip(id);
    return [m.title, m.formula && `Fórmula: ${m.formula}`].filter(Boolean).join('. ');
};

const claseCloseRate = (v) => {
    if (v > 100) return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    if (v >= 40) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
};

export const columnasRanking = (irA, selectedCloserId) => [
    { key: 'pos', header: '#', width: '44px', fija: true, valor: (r) => r.pos,
        render: (r) => (
            <div className={`w-6 h-6 rounded-md grid place-items-center text-[10px] font-black ${r.pos === 1 ? 'bg-gradient-to-br from-primary to-secondary text-white' : 'bg-surface-hover text-muted'}`}>
                {r.pos}
            </div>
        ) },
    { key: 'closer', header: 'Closer', width: 'minmax(130px,1.4fr)', fija: true, valor: (r) => r.name,
        render: (r) => (
            <span className="trunc">
                <b>{r.name}</b>
                {String(r.closer_id) === String(selectedCloserId) && <span className="text-[9px] text-muted ml-2">seleccionado</span>}
            </span>
        ) },
    { key: 'cash', header: 'Cash neto', alinear: 'der', width: '120px', ayuda: ayudaDe('cash_collected'),
        valor: (r) => r.cash_neto ?? r.cash_collected,
        render: (r) => (
            <span className="font-black">
                <Celda fila={r} irA={irA} metrica="cash_collected" valor={money(r.cash_neto ?? r.cash_collected)}
                    bruto={`bruto ${money(r.cash_collected)}`} />
            </span>
        ) },
    { key: 'ventas', header: 'Ventas', alinear: 'der', width: '80px', ayuda: ayudaDe('ventas'),
        valor: (r) => r.ventas, render: (r) => <Celda fila={r} irA={irA} metrica="ventas" valor={r.ventas} /> },
    { key: 'show_rate', header: 'Show rate', alinear: 'der', width: '100px', ayuda: ayudaDe('q_show_rate'),
        valor: (r) => r.show_rate,
        render: (r) => <Celda fila={r} irA={irA} metrica="show_rate" valor={`${r.show_rate}%`} /> },
    { key: 'close_pres', header: 'Close s/ pres.', alinear: 'der', width: '120px', ayuda: ayudaDe('q_close_presentacion'),
        valor: (r) => r.close_rate_presentacion,
        render: (r) => (
            <MetricaClicable subrayar={false}
                irA={irA ? (tabla, filtro) => irA(tabla, filtro, { miembroId: r.closer_id }) : null}
                destino={DESTINOS_RANKING.close_rate_presentacion}
                detalle={r.close_rate_presentacion > 100
                    ? `${r.name} · ${r.ventas} ventas sobre ${r.presentaciones} presentaciones reportadas`
                    : `${r.name} · ${r.ventas} ventas sobre ${r.presentaciones} presentaciones`}
                className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${claseCloseRate(r.close_rate_presentacion)}`}>
                {r.close_rate_presentacion}%{r.close_rate_presentacion > 100 ? ' ⚠️' : ''}
            </MetricaClicable>
        ) },
    { key: 'ticket', header: 'Ticket', alinear: 'der', width: '100px', ayuda: ayudaDe('ticket_promedio'),
        valor: (r) => r.ticket_promedio,
        render: (r) => <Celda fila={r} irA={irA} metrica="ticket_promedio" valor={money(r.ticket_promedio)} /> },
    { key: 'reportes', header: 'Reportes enviados', alinear: 'der', width: '140px', ayuda: ayudaDe('rank_reportes'),
        valor: (r) => r.reports_status, render: (r) => `${r.reports_status}%` },
    { key: 'sin_enviar', header: 'Sin enviar', alinear: 'der', width: '90px', valor: (r) => r.reportes_faltantes,
        render: (r) => (
            <span className={`font-black ${r.reportes_faltantes > 0 ? 'text-amber-400' : 'text-muted'}`}>{r.reportes_faltantes}</span>
        ) },
];
