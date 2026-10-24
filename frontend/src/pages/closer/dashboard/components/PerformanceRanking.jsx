import React, { useMemo } from 'react';
import Card from '../../../../components/ui/Card';
import ListaConfigurable from '../../../../components/listas/ListaConfigurable';
import { columnasRanking } from './columnasRanking';
import '../../../comercial/comercial.css';

const ALERT_STYLES = {
    danger: 'bg-rose-500/10 border-rose-500/30',
    warning: 'bg-amber-500/10 border-amber-500/30',
    info: 'bg-primary/10 border-primary/30',
    success: 'bg-emerald-500/10 border-emerald-500/30'
};

const PerformanceRanking = ({ ranking, selectedCloserId, alerts, irA }) => {
    // La posición es la del ranking que manda el backend: ordenar la tabla no la cambia.
    const filas = useMemo(() => ranking.map((r, i) => ({ ...r, pos: i + 1 })), [ranking]);
    const columnas = useMemo(() => columnasRanking(irA, selectedCloserId), [irA, selectedCloserId]);
    return (
        <div className="space-y-4">
            <Card variant="surface" padding="p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-base mb-5">Ranking del equipo</h3>
                <div className="dc-shell dc-shell--embebido">
                    <ListaConfigurable columnas={columnas} filas={filas} clave={(r) => r.closer_id}
                        buscar={(r) => r.name} buscarPlaceholder="Buscar closer…" claveGuardado="closer_ranking_cols"
                        ordenInicial={{ key: 'pos', dir: 'asc' }} vacio="Sin closers en el período." />
                </div>
            </Card>

            <Card variant="surface" padding="p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-base mb-4">Qué mirar esta semana</h3>
                <div className="space-y-2.5">
                    {alerts.length > 0 ? alerts.map((a, i) => (
                        <div key={i} className={`flex gap-3 rounded-xl p-3 border text-[12.5px] ${ALERT_STYLES[a.type] || ALERT_STYLES.info}`}>
                            <span className="text-lg leading-none">{a.icon}</span>
                            <div>
                                <b className="block text-[13px]">{a.title}</b>
                                <p className="text-muted">{a.text}</p>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-6 text-[11px] text-muted">Sin alertas relevantes en este período.</div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default PerformanceRanking;
