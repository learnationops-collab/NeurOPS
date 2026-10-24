import React from 'react';
import { destinoFuente } from '../metricSources';
import MetricaClicable from '../../../../components/dashboard/MetricaClicable';

/* Columnas de «Performance por fuente» para `ListaConfigurable`. */
const claseShow = (v) => {
    if (v >= 55) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (v >= 40) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
};

export const columnasFuente = (irA) => [
    { key: 'fuente', header: 'Fuente', width: 'minmax(140px,1.6fr)', fija: true, valor: (f) => f.name,
        render: (f) => <b className="trunc">{f.name}</b> },
    { key: 'agendas', header: 'Agendas', alinear: 'der', valor: (f) => f.agendas,
        render: (f) => (
            <MetricaClicable irA={irA} destino={destinoFuente(f.name)} vacio={!f.agendas}
                detalle={`${f.agendas} agendas de ${f.name}`}>
                {f.agendas}
            </MetricaClicable>
        ) },
    { key: 'asistencias', header: 'Asistencias', alinear: 'der', valor: (f) => f.asistencias,
        render: (f) => (
            <MetricaClicable irA={irA} destino={destinoFuente(f.name, 'asistencias')} vacio={!f.asistencias}
                detalle={`${f.asistencias} asistencias de ${f.name}`}>
                {f.asistencias}
            </MetricaClicable>
        ) },
    { key: 'show_rate', header: 'Show rate', alinear: 'der', valor: (f) => f.show_rate,
        render: (f) => (
            <MetricaClicable irA={irA} subrayar={false} destino={destinoFuente(f.name, 'asistencias')}
                vacio={!f.asistencias} detalle={`Show rate de ${f.name} · ${f.show_rate}%`}
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${claseShow(f.show_rate)}`}>
                {f.show_rate}%
            </MetricaClicable>
        ) },
];
