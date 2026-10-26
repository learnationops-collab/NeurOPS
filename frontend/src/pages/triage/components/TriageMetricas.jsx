// «Métricas» del espacio del triage: el embudo de sus llamadas, calculado de lo que marca en cada
// lead (GET /api/triage/metricas). Agendas → confirmadas → asistencias → calificados / descalificados
// → pitch del low ticket → cómo quedó.

import { useEffect, useState } from 'react';
import api from '../../../services/api';
import { Bars, EmptyState, FieldError, Grid, Kpi, Panel, Segmented, SkeletonKpi, SkeletonPanel, Skeleton } from '../../../components/standard';
import { localDateFromNow, localToday } from '../../../utils/datetime';

const PERIODOS = [
    { value: '0', label: 'Hoy' },
    { value: '6', label: '7 días' },
    { value: '29', label: '30 días' },
];

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

const embudo = (m) => [
    { key: 'agendas', label: 'Agendas', value: m.agendas },
    { key: 'confirmadas', label: 'Confirmadas', value: m.confirmadas, detail: pct(m.confirmadas, m.agendas) },
    { key: 'asistencias', label: 'Asistieron', value: m.asistencias, detail: pct(m.asistencias, m.agendas) },
    { key: 'calificados', label: 'Calificados +500 USD', value: m.calificados, detail: pct(m.calificados, m.asistencias), color: 'var(--success)' },
    { key: 'descalificados', label: 'Descalificados', value: m.descalificados, detail: pct(m.descalificados, m.asistencias), color: 'var(--warning)' },
];

const lowTicket = (m) => [
    { key: 'pitch', label: 'Pitch del low ticket', value: m.pitch_low_ticket, detail: pct(m.pitch_low_ticket, m.descalificados) },
    { key: 'cerrado', label: 'Cerró', value: m.cerrado, detail: pct(m.cerrado, m.pitch_low_ticket), color: 'var(--success)' },
    { key: 'no_cerrado', label: 'No cerró', value: m.no_cerrado, detail: pct(m.no_cerrado, m.pitch_low_ticket), color: 'var(--error)' },
    { key: 'seguimiento', label: 'Seguimiento', value: m.seguimiento, detail: pct(m.seguimiento, m.pitch_low_ticket), color: 'var(--info)' },
    { key: 'descartado', label: 'Descartado', value: m.descartado, detail: pct(m.descartado, m.pitch_low_ticket), color: 'var(--idle)' },
];

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
                            <Kpi label="Low ticket cerrado" value={pct(m.cerrado, m.pitch_low_ticket)}>
                                <small>{`${m.cerrado} de ${m.pitch_low_ticket} pitcheados`}</small>
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
                    </>
                )}
            </div>
        </div>
    );
}
