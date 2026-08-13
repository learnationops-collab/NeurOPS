import React, { useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import FixIssueModal from './FixIssueModal';
import MissingDaysPicker from './MissingDaysPicker';

/* Datos que no se pueden creer, con su arreglo. Va arriba de todo a propósito: si el embudo está
   incompleto, leer los KPIs de abajo lleva a conclusiones falsas, así que esto tiene que verse
   antes. Cuando no hay nada roto la tarjeta se queda igual pero en verde — que el espacio esté
   siempre reservado hace que la ausencia de problemas también sea una señal. */

const SEVERITY = {
    danger: {
        card: 'border-rose-500/30 bg-rose-500/[0.07]',
        chip: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        label: 'No confiable'
    },
    warning: {
        card: 'border-amber-500/30 bg-amber-500/[0.07]',
        chip: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        label: 'Incompleto'
    }
};

const DataIssuesPanel = ({ issues, onNavigate }) => {
    const [openIssue, setOpenIssue] = useState(null);

    if (!issues.length) {
        return (
            <Card variant="surface" padding="p-5" className="border-emerald-500/25 bg-emerald-500/[0.05]">
                <div className="flex items-center gap-3">
                    <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                    <div>
                        <b className="text-[12.5px] block">Los datos del período cierran</b>
                        <p className="text-[11px] text-muted leading-snug">
                            No se detectaron reportes faltantes ni números imposibles. Todo lo de abajo se puede leer tal cual.
                        </p>
                    </div>
                </div>
            </Card>
        );
    }

    const danger = issues.filter(i => i.severity === 'danger').length;

    return (
        <>
            <Card variant="surface" padding="p-6" className={danger ? 'border-rose-500/30' : 'border-amber-500/30'}>
                <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-base">
                        Datos que hay que corregir
                    </h3>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-surface-hover text-muted">
                        {issues.length}
                    </span>
                </div>
                <p className="text-[11px] text-muted mb-5 leading-snug">
                    Esto no son problemas de performance: son números que <b className="text-base">no se pueden leer todavía</b> porque
                    falta cargar algo. Arreglalos primero — el resto del dashboard se recalcula solo.
                </p>

                <div className="space-y-2.5">
                    {issues.map(issue => {
                        const s = SEVERITY[issue.severity] || SEVERITY.warning;
                        return (
                            <div key={issue.id} className={`rounded-2xl border p-4 ${s.card}`}>
                                <div className="flex items-start gap-3">
                                    <span className="text-lg leading-none shrink-0 mt-0.5">{issue.icon}</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <b className="text-[13px] leading-tight">{issue.title}</b>
                                            <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border ${s.chip}`}>
                                                {s.label}
                                            </span>
                                        </div>
                                        <p className="text-[11.5px] text-muted mt-1.5 leading-snug">{issue.why}</p>
                                        <p className="text-[10.5px] text-muted mt-2">
                                            <span className="font-black uppercase tracking-widest text-[8.5px]">Ensucia:</span>{' '}
                                            {issue.affects}
                                        </p>
                                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                                            <button
                                                onClick={() => setOpenIssue(issue)}
                                                className="px-3 py-1.5 rounded-xl bg-surface border border-base text-[10px] font-black uppercase tracking-wider hover:border-primary/50 transition-colors cursor-pointer"
                                            >
                                                Cómo lo arreglo
                                            </button>
                                            {issue.view && onNavigate && (
                                                <button
                                                    onClick={() => onNavigate(issue.view)}
                                                    className="px-3 py-1.5 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1.5"
                                                >
                                                    {issue.actionLabel} <ArrowRight size={12} />
                                                </button>
                                            )}
                                        </div>
                                        <MissingDaysPicker
                                            days={issue.days}
                                            onPick={(date) => onNavigate && onNavigate(issue.view, { date })}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

            {openIssue && (
                <FixIssueModal issue={openIssue} onClose={() => setOpenIssue(null)} onNavigate={onNavigate} />
            )}
        </>
    );
};

export default DataIssuesPanel;
