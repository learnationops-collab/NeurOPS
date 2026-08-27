import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/* "Antes de procrastinar": calculadora rápida para convencer al closer de tirar unos
 * seguimientos antes de dejar el día — a pedido del usuario (27/ago/2026), calcado del HTML
 * de referencia. Es una simulación editable, no un reporte de datos reales: no hay una tasa
 * "de verdad" de respuesta/cierre de seguimientos disponible en este componente sin pegarle a
 * otro endpoint, así que arranca con supuestos razonables (ajustables con los sliders) sobre el
 * único número real que sí tiene — cuántos seguimientos hay pendientes hoy (`pendientes`).
 */

const money = (n) => `$${Math.round(n).toLocaleString('es-AR')}`;

const Slider = ({ label, value, onChange, min, max, step = 1, format }) => (
    <div>
        <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
            <span className="text-[13px] font-black text-white">{format ? format(value) : value}</span>
        </div>
        <input
            type="range" min={min} max={max} step={step} value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-pink-500 h-1.5 rounded-full cursor-pointer"
        />
    </div>
);

const Stat = ({ value, label, color }) => (
    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl px-4 py-3">
        <div className="text-xl font-black tracking-tighter" style={{ color }}>{value}</div>
        <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-0.5">{label}</div>
    </div>
);

const ProcrastinarModal = ({ pendientes = 0, onClose, onGo }) => {
    const [mensajes, setMensajes] = useState(Math.max(1, pendientes || 5));
    const [minutos, setMinutos] = useState(2);
    const [pctContesta, setPctContesta] = useState(15);
    const [pctCierra, setPctCierra] = useState(20);
    const [ticket, setTicket] = useState(500);

    const calc = useMemo(() => {
        const contestan = mensajes * (pctContesta / 100);
        const ventas = contestan * (pctCierra / 100);
        const potencial = ventas * ticket;
        const horas = (mensajes * minutos) / 60;
        const porHora = horas > 0 ? potencial / horas : 0;
        const porMensaje = mensajes > 0 ? potencial / mensajes : 0;
        return { contestan, ventas, potencial, horas, porHora, porMensaje };
    }, [mensajes, minutos, pctContesta, pctCierra, ticket]);

    // 3 porciones del total pendiente real (no del slider, que el closer puede haber movido):
    // un cuarto, la mitad y todo — capadas para no repetirse cuando el total es chico.
    const picks = useMemo(() => {
        const base = Math.max(1, pendientes || mensajes);
        const raw = [Math.round(base * 0.25), Math.round(base * 0.5), base];
        const seen = new Set();
        return raw.filter(n => n > 0 && !seen.has(n) && seen.add(n)).map(n => ({
            count: n,
            monto: (n / mensajes) * calc.potencial || (n * calc.porMensaje)
        }));
    }, [pendientes, mensajes, calc.potencial, calc.porMensaje]);

    return createPortal(
        <div
            className="fixed inset-0 z-[99997] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Antes de procrastinar"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto custom-scrollbar p-6"
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-pink-400">Antes de procrastinar · Seguimientos</p>
                        <h3 className="text-lg font-black text-white mt-1">Un mensaje de un minuto vale esto</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 transition-colors cursor-pointer shrink-0" aria-label="Cerrar">
                        <X size={16} />
                    </button>
                </div>

                <div className="mt-4">
                    <div className="text-5xl font-black tracking-tighter text-pink-400">{money(calc.potencial)}</div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">
                        Potencial <span className="normal-case font-bold text-slate-600">· {money(calc.porHora)} por hora de trabajo</span>
                    </p>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-4">
                    <Stat value={mensajes} label="Mensajes" color="#fff" />
                    <Stat value={calc.contestan.toFixed(1)} label="Contestan" color="#60A5FA" />
                    <Stat value={calc.ventas.toFixed(1)} label="Ventas" color="#F3D08A" />
                    <Stat value={money(calc.potencial)} label="En caja" color="#FF3FA4" />
                </div>

                <div className="space-y-4 mt-5">
                    <Slider label="Seguimientos hoy" value={mensajes} onChange={setMensajes} min={1} max={Math.max(pendientes, mensajes, 20)} />
                    <Slider label="Minutos cada una" value={minutos} onChange={setMinutos} min={1} max={10} format={(v) => `${v} min`} />
                    <Slider label="% que contesta" value={pctContesta} onChange={setPctContesta} min={0} max={100} format={(v) => `${v}%`} />
                    <Slider label="% que cierra" value={pctCierra} onChange={setPctCierra} min={0} max={100} format={(v) => `${v}%`} />
                    <Slider label="Ticket promedio" value={ticket} onChange={setTicket} min={100} max={3000} step={50} format={money} />
                </div>

                <div className="mt-5 rounded-2xl border border-pink-500/30 bg-pink-500/10 px-4 py-3 text-[12px] text-pink-200 leading-snug">
                    Cada seguimiento vale {money(calc.porMensaje)} en promedio. {Math.round(mensajes * minutos)} minutos de trabajo valen {money(calc.potencial)}.
                </div>

                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-5 mb-2">Elegí cuánto querés hacer hoy</p>
                <div className={`grid gap-2 ${picks.length === 3 ? 'grid-cols-3' : picks.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {picks.map(p => (
                        <button
                            key={p.count}
                            type="button"
                            onClick={() => onGo(p.count)}
                            className="rounded-2xl border border-slate-800 bg-slate-950/60 hover:border-pink-500/50 hover:bg-pink-500/[0.08] transition-all px-3 py-3 text-left cursor-pointer"
                        >
                            <div className="text-lg font-black text-pink-400">{money(p.monto)}</div>
                            <div className="text-[10px] font-bold text-slate-500 mt-0.5">{p.count} seguimiento{p.count === 1 ? '' : 's'}</div>
                        </button>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="mt-4 w-full py-2.5 rounded-xl border border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 hover:border-slate-700 transition-all cursor-pointer"
                >
                    Dejarlo para mañana
                </button>
            </div>
        </div>,
        document.body
    );
};

export default ProcrastinarModal;
