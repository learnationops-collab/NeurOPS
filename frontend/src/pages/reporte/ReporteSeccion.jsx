// Sección «Reporte» (cierre del día) de closer, setter y triage: Hoy + Historial. No hay botón de
// enviar: todo se guarda al escribir y el día se cierra solo a las 10:00 del día siguiente.
// Plan y contrato: docs/plan_reporte_unico.md. Mockup: docs/mockups/cierre-del-dia/seccion.html.
import { useCallback, useRef, useState } from 'react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { Skeleton, SkeletonPanel } from '../../components/standard';
import useReporteDia from './useReporteDia';
import Cabecera from './Cabecera';
import Hoy from './Hoy';
import Historial from './Historial';
import DetalleNumero from './DetalleNumero';
import { DetalleCtx } from './Exp';
import { manoVacio } from './Pendientes';
import { okVictoria } from './Victoria';
import { okManana } from './Manana';
import './reporte.css';

// Estado y «falta …» del día con lo que hay en pantalla (sin esperar al eco del servidor).
function estadoLocal(dia, resueltas) {
    if (!dia) return { estado: null, faltan: [] };
    if (dia.no_laborable) return { estado: 'no_laborable', faltan: [] };
    const p = dia.pendientes || {};
    const n = (p.agendas || []).filter((a) => !resueltas[a.id]).length + (p.mano || []).filter(manoVacio).length;
    const faltan = [];
    if (n) faltan.push(`${n} pendiente${n > 1 ? 's' : ''}`);
    if (!okVictoria(dia.victoria)) faltan.push('la victoria');
    if (!okManana(dia.manana)) faltan.push('el «mañana»');
    const abierto = dia.cierra_en ? new Date(dia.cierra_en) > new Date() : dia.estado === 'en_curso';
    return { estado: abierto ? 'en_curso' : faltan.length ? 'incompleto' : 'completo', faltan };
}

const Esqueleto = () => (
    <Skeleton label="Cargando el reporte…" className="rp-col">
        {[0, 1, 2].map((i) => <SkeletonPanel key={i} className="rp-card ui-panel" rows={i === 2 ? 6 : 3} rowHeight={i === 2 ? 44 : 32} step={i} />)}
    </Skeleton>
);

export default function ReporteSeccion({ userId, onDia, tabInicial = 'hoy' }) {
    const { user } = useAuth();
    // Solo se manda user_id cuando se mira el reporte de otra persona (admin).
    const otro = userId && userId !== user?.id ? userId : undefined;
    const [tab, setTab] = useState(tabInicial);
    const raiz = useRef(null);
    const [detalle, setDetalle] = useState(null);
    const [corrigiendo, setCorrigiendo] = useState(null);
    const { dia, cargando, error, editar, cargarResultado, resueltas, verDia } = useReporteDia({ userId: otro, onDia });
    const { estado, faltan } = estadoLocal(dia, resueltas);

    // La tira usa el estado en vivo del día que se está viendo.
    const diaCab = dia && { ...dia, semana: (dia.semana || []).map((d) => (d.fecha === dia.fecha && estado ? { ...d, estado } : d)) };

    const irADia = useCallback((f) => {
        verDia(f);
        setTab('hoy');
        setCorrigiendo(null);
        raiz.current?.scrollIntoView({ block: 'start' });
    }, [verDia]);

    return (
        <DetalleCtx.Provider value={setDetalle}>
            <div ref={raiz} className="dc-shell dc-shell--embebido rp">
                <Cabecera dia={diaCab} estado={estado} faltan={faltan} tab={tab} onTab={setTab} onDia={irADia}
                    onNoLaborable={() => editar({ no_laborable: true }, true)} />
                {tab === 'hoy' && (
                    !dia ? (error ? <p className="rp-sub">{error}</p> : <Esqueleto />) : (
                        <div key={dia.fecha} className={clsx('rp-col', cargando && 'rp-cargando')}>
                            <Hoy dia={dia} resueltas={resueltas} editar={editar} cargarResultado={cargarResultado}
                                corrigiendo={corrigiendo} onCorregir={setCorrigiendo} />
                        </div>
                    )
                )}
                {tab === 'hist' && <Historial userId={otro} hoy={dia?.hoy} onEditar={irADia} />}
                {detalle && (
                    <DetalleNumero dato={detalle} userId={otro} hoy={dia?.hoy} onClose={() => setDetalle(null)}
                        onCorregir={(tit) => { setTab('hoy'); setCorrigiendo(tit); }} />
                )}
            </div>
        </DetalleCtx.Provider>
    );
}
