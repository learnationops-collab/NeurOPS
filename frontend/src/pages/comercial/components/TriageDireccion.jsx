// «Triage» de Dirección Comercial, con el diseño de Claude Design (Triage Dashboard, 30/10/2026): tarjetas, estados,
// embudo con su cuello de botella, low ticket, abandonos, por persona, día por día y el reporte lead por lead.
// Los datos son los de `GET /api/triage/metricas`. Cada cifra abre la lista que la compone y cada llamada, su ficha.
// Se elige en el interruptor del dock (Closers · Setters · Triage), no es una sección más.

import { useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { EmptyState, FieldError, Skeleton, SkeletonKpi, SkeletonPanel } from '../../../components/standard';
import { localDateFromNow, localToday } from '../../../utils/datetime';
import { diasDe } from '../../triage/components/TriageMetricas';
import { FILTROS } from '../../triage/components/triageFiltros';
import { Abandonos, Embudo, Estados, LowTicket, Tarjetas } from './triage/TriagePaneles';
import { DiaPorDia, PorPersona } from './triage/TriagePersonasDias';
import TriageReporte from './triage/TriageReporte';

const PERIODOS = [['0', 'Hoy'], ['6', '7 días'], ['29', '30 días']];
const FILA = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,460px),1fr))', gap: 16 };

const Pildoras = ({ opciones, valor, onChange, etiqueta }) => (
    <div role="group" aria-label={etiqueta} style={{ display: 'flex', flexShrink: 0, gap: 2, padding: 4, borderRadius: 999, border: '1px solid var(--border-main)', background: 'var(--bg-element)' }}>
        {opciones.map(([v, texto]) => (
            <button key={v} type="button" aria-pressed={valor === v} onClick={() => onChange(v)}
                style={{ whiteSpace: 'nowrap', padding: '7px 14px', border: 0, borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    background: valor === v ? '#fff' : 'transparent', color: valor === v ? 'var(--ink)' : 'var(--text-muted)' }}>{texto}</button>
        ))}
    </div>
);

const Cargando = () => (
    <Skeleton label="Cargando las métricas del triage">
        <div style={FILA}>{[0, 1, 2, 3].map((i) => <SkeletonKpi key={i} step={i} />)}</div>
        <SkeletonPanel rows={5} />
    </Skeleton>
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
    const leads = useMemo(() => (datos?.leads || []).filter((l) => !elegida || l.triage === elegida.nombre), [datos, elegida]);
    const verLista = (clave) => {
        setVer(clave);
        document.getElementById('triage-reporte')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const abrir = (l) => onAbrirFila?.({ tipo: 'agenda', id: l.id, client_id: l.client_id });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 120 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <Pildoras etiqueta="Período" opciones={PERIODOS} valor={dias} onChange={(v) => { setDias(v); setVer(null); }} />
                {personas.length > 1 && (
                    <Pildoras etiqueta="Persona" valor={persona} onChange={(v) => { setPersona(v); setVer(null); }}
                        opciones={[['todas', 'Todas'], ...personas.map((p) => [String(p.id), p.nombre])]} />
                )}
            </div>
            {error && <FieldError>{error}</FieldError>}
            {!m ? (!error && <Cargando />) : !m.agendas ? (
                <EmptyState title="Sin llamadas en este período">
                    Las métricas salen de lo que cada triage marca en el lead: confirmación, asistencia y resultado.
                </EmptyState>
            ) : (
                <>
                    <Tarjetas m={m} onVer={verLista} />
                    <div style={FILA}><Estados m={m} onVer={verLista} /><Embudo m={m} onVer={verLista} /></div>
                    <div style={FILA}><LowTicket m={m} onVer={verLista} /><Abandonos a={datos.abandonos} /></div>
                    <div style={FILA}>
                        {!elegida && <PorPersona personas={personas} onElegir={setPersona} />}
                        <DiaPorDia dias={diasDe(datos.por_dia, elegida?.id)} />
                    </div>
                    <TriageReporte leads={leads} ver={ver} onVer={setVer} onAbrir={abrir}
                        titulo={ver && FILTROS[ver] && ver !== 'agendas' ? FILTROS[ver].titulo : 'Reporte'} />
                </>
            )}
        </div>
    );
}
