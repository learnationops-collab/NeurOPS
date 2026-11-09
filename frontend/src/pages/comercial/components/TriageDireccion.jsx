// «Triage» de Dirección Comercial, con el diseño de Claude Design (Triage Dashboard, 30/10/2026): tarjetas, estados,
// embudo con su cuello de botella, low ticket, abandonos, por persona, día por día y el reporte lead por lead.
// Los datos son los de `GET /api/triage/metricas`. Cada cifra abre la lista que la compone y cada llamada, su ficha.
// Se elige en el interruptor del dock (Closers · Setters · Triage), no es una sección más.

import { useMemo, useState } from 'react';
import api from '../../../services/api';
import { useDatosCacheados } from '../../../services/cacheDeVistas';
import { EmptyState, FieldError, Skeleton, SkeletonKpi, SkeletonPanel } from '../../../components/standard';
import { filtroDe } from '../../triage/components/triageFiltros';
import { Abandonos, Embudo, Estados, LowTicket, Tarjetas } from './triage/TriagePaneles';
import { DiaPorDia, PorPersona } from './triage/TriagePersonasDias';
import { coloresDe } from './triage/coloresCloser';
import { diasDe } from './triage/triageDatos';
import { rangoDePeriodo } from './triage/periodo';
import PorCloser, { closersDe } from './triage/TriagePorCloser';
import TriageReporte from './triage/TriageReporte';

const FILA = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,460px),1fr))', gap: 16 };

const Cargando = () => (
    <Skeleton label="Cargando las métricas del triage">
        <div style={FILA}>{[0, 1, 2, 3].map((i) => <SkeletonKpi key={i} step={i} />)}</div>
        <SkeletonPanel rows={5} />
    </Skeleton>
);

export default function TriageDireccion({ onAbrirFila, period, rango, triageId, segmento, onElegirPersona }) {
    const [ver, setVer] = useState(null);
    const fechas = rangoDePeriodo(period, rango);
    // Recordado por período y segmento (cacheDeVistas): volver a Triage no lo vuelve a pedir.
    const { datos, error: falla } = useDatosCacheados(`triage:metricas:${fechas.desde}:${fechas.hasta}:${segmento || ''}`, (signal) => api
        .get('/triage/metricas', { params: { ...fechas, segmento: segmento || undefined }, signal })
        .then((res) => res.data));
    const error = falla ? (falla?.response?.data?.message || 'No se pudieron cargar las métricas.') : null;

    const personas = datos?.por_persona || [];
    // La triage que mira lo suyo (`yo`, ver triage_alcance.py): el total ya es el de ella y «Por persona» es para compararse.
    const yo = datos?.yo ?? null;
    const elegida = yo == null ? personas.find((p) => String(p.id) === String(triageId)) : null;
    const m = elegida || datos?.total;
    const leads = useMemo(() => (datos?.leads || []).filter((l) => !elegida || l.triage === elegida.nombre), [datos, elegida]);
    const verLista = (clave) => {
        setVer(clave);
        document.getElementById('triage-reporte')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const closers = useMemo(() => closersDe(datos?.por_closer, elegida?.id), [datos, elegida]);
    const colores = useMemo(() => coloresDe(datos?.por_closer), [datos]);
    const filtro = ver && ver !== 'agendas' ? filtroDe(ver, closers.find((c) => ver.startsWith(`cl:${c.id}:`))?.nombre) : null;
    const abrir = (l) => onAbrirFila?.({ tipo: 'agenda', id: l.id, client_id: l.client_id });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 120 }}>
            {error && <FieldError>{error}</FieldError>}
            {!m ? (!error && <Cargando />) : !m.agendas ? (
                <EmptyState title="Sin llamadas con este filtro">
                    Las métricas salen de lo que se marca en cada lead: asistencia y resultado.
                </EmptyState>
            ) : (
                <>
                    <Tarjetas m={m} onVer={verLista} />
                    <div style={FILA}><Estados m={m} onVer={verLista} /><Embudo m={m} onVer={verLista} closers={closers} colores={colores} /></div>
                    <PorCloser closers={closers} colores={colores} onVer={verLista} />
                    <div style={FILA}><LowTicket m={m} onVer={verLista} /><Abandonos a={datos.abandonos} /></div>
                    <div style={FILA}>
                        {!elegida && <PorPersona personas={personas} yo={yo}
                            onElegir={onElegirPersona ? (id) => onElegirPersona(String(id)) : null} />}
                        <DiaPorDia dias={diasDe(datos.por_dia, elegida?.id)} />
                    </div>
                    <TriageReporte leads={leads} ver={ver} onVer={setVer} onAbrir={abrir}
                        titulo={filtro?.titulo || 'Reporte'} />
                </>
            )}
        </div>
    );
}
