// Sección «Triage» de Dirección Comercial: lo mismo que ve cada triage en su espacio (GET /api/triage/metricas),
// de todas o de una persona. Cada tarjeta y cada barra abre la lista de leads que compone el número
// (criterios en triage/components/triageFiltros.js) y cada lead abre su ficha.

import { useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { Bars, Button, EmptyState, FieldError, Grid, Kpi, Panel, Segmented, Skeleton, SkeletonKpi, SkeletonPanel } from '../../../components/standard';
import { localDateFromNow, localToday } from '../../../utils/datetime';
import { AbandonosPanel, embudo, lowTicket, pct, Reporte } from '../../triage/components/TriageMetricas';
import { FILTROS, filtrar } from '../../triage/components/triageFiltros';

const PERIODOS = [
    { value: '0', label: 'Hoy' },
    { value: '6', label: '7 días' },
    { value: '29', label: '30 días' },
];

const Cargando = () => (
    <Skeleton label="Cargando las métricas del triage">
        <Grid variant="kpis">{[0, 1, 2, 3].map((i) => <SkeletonKpi key={i} step={i} />)}</Grid>
        <SkeletonPanel rows={5} />
    </Skeleton>
);

/** Una fila por persona: sirve para comparar y para quedarse con una. */
const PorPersona = ({ personas, onElegir }) => (
    <Panel>
        <h3 className="t-sm">Por persona</h3>
        <div style={{ display: 'grid' }}>
            {personas.map((p) => (
                <button key={p.id} type="button" onClick={() => onElegir(String(p.id))}
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s3)', alignItems: 'baseline', padding: 'var(--s3) 0',
                        borderTop: '1px solid var(--border-subtle)', textAlign: 'left', background: 'none', color: 'inherit', cursor: 'pointer' }}>
                    <b className="t-sm" style={{ minWidth: 96 }}>{p.nombre}</b>
                    <span className="t-cap">{`${p.agendas} agendas`}</span>
                    <span className="t-cap">{`${p.confirmadas} confirmadas`}</span>
                    <span className="t-cap">{`${p.asistencias} asistieron`}</span>
                    <span className="t-cap">{`${p.calificados} calificados · ${p.descalificados} descalificados`}</span>
                    <span className="t-cap">{`${p.cerrado} de ${p.pitch_low_ticket} low ticket`}</span>
                </button>
            ))}
        </div>
    </Panel>
);

export default function TriageDireccion({ onAbrirFila }) {
    const [dias, setDias] = useState('6');
    const [persona, setPersona] = useState('todas');
    const [ver, setVer] = useState(null);
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let vivo = true;
        api.get('/triage/metricas', { params: { desde: localDateFromNow(-Number(dias)), hasta: localToday() } })
            .then((res) => { if (vivo) { setDatos(res.data); setError(null); } })
            .catch((err) => { if (vivo) setError(err?.response?.data?.message || 'No se pudieron cargar las métricas.'); });
        return () => { vivo = false; };
    }, [dias]);

    const personas = datos?.por_persona || [];
    const elegida = personas.find((p) => String(p.id) === persona);
    const m = elegida || datos?.total;
    const leads = useMemo(() => {
        const propios = (datos?.leads || []).filter((l) => !elegida || l.triage === elegida.nombre);
        return filtrar(propios, ver);
    }, [datos, elegida, ver]);

    const elegir = (clave) => setVer((actual) => (actual === clave ? null : clave));
    const abrir = (l) => onAbrirFila?.({ tipo: 'agenda', id: l.id, client_id: l.client_id });
    const opcionesPersona = [{ value: 'todas', label: 'Todas' }, ...personas.map((p) => ({ value: String(p.id), label: p.nombre }))];

    return (
        <div style={{ display: 'grid', gap: 'var(--s4)', paddingBottom: 120 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s3)' }}>
                <Segmented value={dias} onChange={(v) => { setDias(v); setVer(null); }} options={PERIODOS} label="Período" />
                {personas.length > 1 && <Segmented value={persona} onChange={setPersona} options={opcionesPersona} label="Persona" />}
            </div>
            {error && <FieldError>{error}</FieldError>}
            {!m ? (!error && <Cargando />) : !m.agendas ? (
                <EmptyState title="Sin llamadas en este período">
                    Las métricas salen de lo que cada triage marca en el lead: confirmación, asistencia y resultado.
                </EmptyState>
            ) : (
                <>
                    <Grid variant="kpis">
                        <Kpi label="Agendas" value={m.agendas} onSelect={() => elegir('agendas')}>
                            <small>{`${m.sin_reporte} sin reportar`}</small>
                        </Kpi>
                        <Kpi label="Asistencia" value={pct(m.asistencias, m.asistencias + m.no_show)} onSelect={() => elegir('asistencias')}>
                            <small>{`${m.asistencias} asistieron · ${m.no_show} no show · ${m.canceladas} cancelaron`}</small>
                        </Kpi>
                        <Kpi label="Calificados" value={pct(m.calificados, m.asistencias)} onSelect={() => elegir('calificados')}>
                            <small>{`${m.calificados} pasados al closer · ${m.pasadas_asistieron} ya asistieron con él`}</small>
                        </Kpi>
                        <Kpi label="Cierres del low ticket" value={pct(m.cerrado, m.pitch_low_ticket)} onSelect={() => elegir('cerrado')}>
                            <small>{`${m.cerrado} de ${m.pitch_low_ticket} presentaciones`}</small>
                        </Kpi>
                    </Grid>
                    <Panel>
                        <h3 className="t-sm">Embudo</h3>
                        <Bars variant="rows" items={embudo(m)} label="Embudo del triage" onSelect={elegir} />
                    </Panel>
                    <Panel>
                        <h3 className="t-sm">Descalificados: low ticket de 100 USD</h3>
                        <Bars variant="rows" items={lowTicket(m)} label="Low ticket" onSelect={elegir} />
                    </Panel>
                    <AbandonosPanel abandonos={datos.abandonos} />
                    {!elegida && personas.length > 1 && <PorPersona personas={personas} onElegir={setPersona} />}
                    {ver && (
                        <div>
                            <Button onClick={() => setVer(null)}>{`Quitar filtro · ${FILTROS[ver].titulo}`}</Button>
                        </div>
                    )}
                    {leads.length > 0
                        ? <Reporte leads={leads} titulo={ver ? FILTROS[ver].titulo : 'Reporte'} onAbrir={abrir} />
                        : <EmptyState title="Ningún lead en esta lista" />}
                </>
            )}
        </div>
    );
}
