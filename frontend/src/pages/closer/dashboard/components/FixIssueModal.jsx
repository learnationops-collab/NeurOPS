import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight } from 'lucide-react';
import MissingDaysPicker from './MissingDaysPicker';

/* Modal de "cómo lo arreglo": los pasos concretos para corregir un dato que no se puede creer,
   con el botón que lleva directo al lugar donde se arregla. Va por portal a <body> para no
   quedar atrapado en el scroll del dashboard, y se cierra con Escape o click en el fondo. */

const SEVERITY = {
    danger: { ring: 'border-rose-500/40', chip: 'bg-rose-500/15 text-rose-400 border-rose-500/30', label: 'Dato no confiable' },
    warning: { ring: 'border-amber-500/40', chip: 'bg-amber-500/15 text-amber-400 border-amber-500/30', label: 'Dato incompleto' }
};

const FixIssueModal = ({ issue, onClose, onNavigate }) => {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    if (!issue) return null;
    const s = SEVERITY[issue.severity] || SEVERITY.warning;

    return createPortal(
        <div
            className="fixed inset-0 z-[99998] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={issue.title}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className={`bg-surface border ${s.ring} rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200`}
            >
                <div className="flex items-start gap-3 p-6 pb-4 border-b border-base">
                    <span className="text-2xl leading-none shrink-0">{issue.icon}</span>
                    <div className="min-w-0 flex-1">
                        <span className={`text-[8.5px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border ${s.chip}`}>
                            {s.label}
                        </span>
                        <h3 className="text-base font-black text-base mt-2 leading-tight">{issue.title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="shrink-0 p-1.5 rounded-lg text-muted hover:bg-surface-hover transition-colors cursor-pointer"
                        aria-label="Cerrar"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted mb-1.5">Por qué pasa</p>
                        <p className="text-[12.5px] text-base leading-relaxed">{issue.why}</p>
                    </div>

                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted mb-1.5">Qué datos ensucia</p>
                        <p className="text-[12px] text-muted leading-relaxed">{issue.affects}</p>
                    </div>

                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted mb-2.5">Cómo se arregla</p>
                        <ol className="space-y-2.5">
                            {issue.steps.map((step, i) => (
                                <li key={i} className="flex gap-3 text-[12.5px] leading-relaxed">
                                    <span className="shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary grid place-items-center text-[10px] font-black mt-0.5">
                                        {i + 1}
                                    </span>
                                    <span className="text-base">{step}</span>
                                </li>
                            ))}
                        </ol>
                    </div>

                    {issue.days?.length > 0 && onNavigate && (
                        <div className="rounded-2xl border border-base bg-main/60 p-4">
                            <MissingDaysPicker
                                dense
                                days={issue.days}
                                onPick={(date) => { onNavigate(issue.view, { date }); onClose(); }}
                            />
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 p-6 pt-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider text-muted hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                        Cerrar
                    </button>
                    {issue.view && onNavigate && (
                        <button
                            onClick={() => { onNavigate(issue.view); onClose(); }}
                            className="px-4 py-2.5 rounded-xl bg-primary text-white text-[11px] font-black uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-2"
                        >
                            {issue.actionLabel} <ArrowRight size={13} />
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default FixIssueModal;
