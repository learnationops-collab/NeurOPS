// «Métricas» del espacio del triage: el embudo de sus llamadas, calculado de lo que marca en cada
// lead (GET /api/triage/metricas). Agendas → confirmadas → asistencias → calificados / descalificados
// → presentaciones del low ticket → cómo quedó. Abajo, el reporte lead por lead con sus notas: es el
// reporte diario que pidió Marlon (27/10), con «Hoy».

import { useEffect, useState } from 'react';
import api from '../../../services/api';
import { Bars, Chip, EmptyState, FieldError, Grid, Kpi, Panel, Segmented, SkeletonKpi, SkeletonPanel, Skeleton } from '../../../components/standard';
import { formatAgendaDateTime, localDateFromNow, localToday } from '../../../utils/datetime';

const PERIODOS = [
    { value: '0', label: 'Hoy' },
    { value: '6', label: '7 días' },
    { value: '29', label: '30 días' },
];

export const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

export const embudo = (m) => [
    { key: 'agendas', label: 'Agendas', value: m.agendas },
    { key: 'confirmadas', label: 'Confirmadas', value: m.confirmadas, detail: pct(m.confirmadas, m.agendas) },
    { key: 'asistencias', label: 'Asistieron', value: m.asistencias, detail: pct(m.asistencias, m.agendas) },
    { key: 'calificados', label: 'Calificados +500 USD', value: m.calificados, detail: pct(m.calificados, m.asistencias), color: 'var(--success)' },
    { key: 'descalificados', label: 'Descalificados', value: m.descalificados, detail: pct(m.descalificados, m.asistencias), color: 'var(--warning)' },
];

export const lowTicket = (m) => [
    { key: 'pitch', label: 'Presentaciones', value: m.pitch_low_ticket, detail: pct(m.pitch_low_ticket, m.descalificados) },
    { key: 'cerrado', label: 'Cierres', value: m.cerrado, detail: pct(m.cerrado, m.pitch_low_ticket), color: 'var(--success)' },
    { key: 'no_cerrado', label: 'No cierres', value: m.no_cerrado, detail: pct(m.no_cerrado, m.pitch_low_ticket), color: 'var(--error)' },
    { key: 'seguimiento', label: 'Seguimiento', value: m.seguimiento, detail: pct(m.seguimiento, m.pitch_low_ticket), color: 'var(--info)' },
    { key: 'descartado', label: 'Perdido', value: m.descartado, detail: pct(m.descartado, m.pitch_low_ticket), color: 'var(--idle)' },
];

/** Los abandonos del formulario del período que siguen sin agendar y qué se hizo con ellos. */
export const AbandonosPanel = ({ abandonos: a }) => (a && a.total > 0 ? (
    <Panel>
        <h3 className="t-sm">Abandonos del formulario</h3>
        <Bars variant="rows" label="Abandonos" items={[
            { key: 'total', label: 'Sin agendar', value: a.total },
            { key: 'contactados', label: 'Contactados', value: a.contactados, detail: pct(a.contactados, a.total), color: 'var(--success)' },
            { key: 'no_contesta', label: 'No contestan', value: a.no_contesta, detail: pct(a.no_contesta, a.total), color: 'var(--warning)' },
            { key: 'sin_tocar', label: 'Sin tocar', value: a.total - a.contactados - a.no_contesta, detail: pct(a.total - a.contactados - a.no_contesta, a.total), color: 'var(--idle)' },
        ]} />
    </Panel>
) : null);

const RESULTADO = {
    calificado: ['Califica', 'var(--success)'],
    descalificado: ['No califica', 'var(--warning)'],
};
const LOW_TICKET = {
    no_pitch: 'Sin presentación', cerrado: 'Cerró el low ticket', no_cerrado: 'No cerró',
    seguimiento: 'Seguimiento', descartado: 'Perdido',
};

const asistenciaDe = (l) => {
    const r = (l.asistencia || '').toLowerCase();
    if (r === 'show up') return null;
    if (r === 'no show') return ['No se presentó', 'var(--error)'];
    if (r.startsWith('cancel')) return ['Canceló', 'var(--idle)'];
    return ['Sin reportar', 'var(--idle)'];
};

/** El reporte lead por lead: cómo quedó cada llamada y las notas (para el closer o por qué no califica).
 *  Con `onAbrir` cada llamada es un botón que abre la ficha del lead. */
export const Reporte = ({ leads, titulo = 'Reporte', onAbrir }) => (
    <Panel>
        <h3 className="t-sm">{`${titulo} · ${leads.length} ${leads.length === 1 ? 'llamada' : 'llamadas'}`}</h3>
        <div style={{ display: 'grid' }}>
            {leads.map((l) => {
                const asis = asistenciaDe(l);
                const res = RESULTADO[l.calificacion];
                return (
                    <div key={l.id} {...(onAbrir ? { role: 'button', tabIndex: 0, onClick: () => onAbrir(l),
                        onKeyDown: (e) => { if (e.key === 'Enter') onAbrir(l); } } : null)}
                        style={{ display: 'grid', gap: 'var(--s1)', padding: 'var(--s3) 0', borderTop: '1px solid var(--border-subtle)', cursor: onAbrir ? 'pointer' : undefined }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s2)', alignItems: 'center' }}>
                            <span className="t-sm" style={{ fontWeight: 700 }}>{l.cliente || `Agenda ${l.id}`}</span>
                            <span className="t-cap mut">{formatAgendaDateTime(l.hora)}{l.triage ? ` · ${l.triage}` : ''}</span>
                            {asis && <Chip color={asis[1]} subtle>{asis[0]}</Chip>}
                            {res && <Chip color={res[1]} subtle>{res[0]}</Chip>}
                            {l.calificacion === 'calificado' && <Chip subtle>Pasado al closer</Chip>}
                            {l.low_ticket && <Chip subtle>{LOW_TICKET[l.low_ticket]}{l.low_ticket === 'seguimiento' && l.fecha_seguimiento ? ` · ${l.fecha_seguimiento}` : ''}</Chip>}
                        </div>
                        {l.nota_para_closer && <small className="t-cap" style={{ whiteSpace: 'pre-wrap' }}>{`Para el closer: ${l.nota_para_closer}`}</small>}
                        {l.nota && <small className="t-cap mut" style={{ whiteSpace: 'pre-wrap' }}>{l.nota}</small>}
                    </div>
                );
            })}
        </div>
    </Panel>
);

const Cargando = () => (
    <Skeleton label="Cargando las métricas del triage">
        <Grid variant="kpis">
            {[0, 1, 2, 3].map((i) => <SkeletonKpi key={i} step={i} />)}
        </Grid>
        <SkeletonPanel rows={5} />
    </Skeleton>
);

export default function TriageMetricas() {
    const [dias, setDias] = useState('6');
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let vivo = true;
        api.get('/triage/metricas', { params: { desde: localDateFromNow(-Number(dias)), hasta: localToday() } })
            .then((res) => { if (vivo) { setDatos(res.data); setError(null); } })
            .catch((err) => { if (vivo) setError(err?.response?.data?.message || 'No se pudieron cargar las métricas.'); });
        return () => { vivo = false; };
    }, [dias]);

    const m = datos?.total;
    return (
        <div className="dc-shell dc-shell--embebido">
            <div style={{ display: 'grid', gap: 'var(--s4)', padding: 'var(--s4)', paddingBottom: 120 }}>
                <Segmented value={dias} onChange={setDias} options={PERIODOS} label="Período" />
                {error && <FieldError>{error}</FieldError>}
                {!m ? (!error && <Cargando />) : !m.agendas ? (
                    <EmptyState title="Sin llamadas en este período">
                        Las métricas salen de lo que marcás en cada lead: confirmación, asistencia y resultado.
                    </EmptyState>
                ) : (
                    <>
                        <Grid variant="kpis">
                            <Kpi label="Agendas" value={m.agendas}><small>{`${m.sin_reporte} sin reportar`}</small></Kpi>
                            <Kpi label="Asistencia" value={pct(m.asistencias, m.asistencias + m.no_show)}>
                                <small>{`${m.asistencias} asistieron · ${m.no_show} no show · ${m.canceladas} cancelaron`}</small>
                            </Kpi>
                            <Kpi label="Calificados" value={pct(m.calificados, m.asistencias)}>
                                <small>{`${m.calificados} pasados al closer · ${m.pasadas_asistieron} ya asistieron con él`}</small>
                            </Kpi>
                            <Kpi label="Cierres del low ticket" value={pct(m.cerrado, m.pitch_low_ticket)}>
                                <small>{`${m.cerrado} de ${m.pitch_low_ticket} presentaciones`}</small>
                            </Kpi>
                        </Grid>
                        <Panel>
                            <h3 className="t-sm">Embudo</h3>
                            <Bars variant="rows" items={embudo(m)} label="Embudo del triage" />
                        </Panel>
                        <Panel>
                            <h3 className="t-sm">Descalificados: low ticket de 100 USD</h3>
                            <Bars variant="rows" items={lowTicket(m)} label="Low ticket" />
                        </Panel>
                        <AbandonosPanel abandonos={datos.abandonos} />
                        {datos.leads?.length > 0 && <Reporte leads={datos.leads} />}
                    </>
                )}
            </div>
        </div>
    );
}
