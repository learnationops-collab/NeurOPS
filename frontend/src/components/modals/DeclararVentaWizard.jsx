import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import {
    X, ArrowLeft, ArrowRight, CheckCircle2, Loader2, Check, Plus, Trash2, Pencil, CreditCard
} from 'lucide-react';

// --- Helpers de fecha (mismo criterio que InstallmentService._add_months: clampea al último
// día del mes si el día elegido no existe en ese mes) ---
const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const toISO = (d) => {
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};
const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const prettyDate = (s) => { if (!s) return ''; const d = parseISO(s); return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`; };
const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const monthlyDates = (n, day) => {
    const base = new Date();
    const out = [];
    for (let k = 0; k < n; k++) {
        const t = addMonths(base, k + 1);
        const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
        out.push(toISO(new Date(t.getFullYear(), t.getMonth(), Math.min(day, last))));
    }
    return out;
};
// Montos por cuota: el closer puede tocar el monto de cualquier cuota salvo la última, que
// siempre absorbe lo que falte para que la suma cierre exacto contra el saldo — mismo criterio
// que ya aplica el backend (InstallmentService.create_plan) para las fechas custom.
const round2 = (n) => Math.round(n * 100) / 100;
const cuotaAmounts = (n, balanceVal, montosMap) => {
    const each = n > 0 ? round2(balanceVal / n) : 0;
    const arr = [];
    for (let k = 0; k < n - 1; k++) {
        const custom = montosMap?.[k + 1];
        const parsed = custom !== undefined && custom !== '' ? parseFloat(custom) : NaN;
        arr.push(isNaN(parsed) ? each : round2(parsed));
    }
    const sumFirst = arr.reduce((a, b) => a + b, 0);
    arr.push(round2(balanceVal - sumFirst));
    return arr;
};

const PROGRAMS = [
    { v: 'RR', label: 'Residency Roadmap', hint: 'RR' },
    { v: 'AL', label: 'Ace Learner', hint: 'AL' },
    { v: 'SI', label: 'Specialist Initiative', hint: 'SI' }
];
const METHODS = ['Stripe', 'PayPal', 'Transferencia Bancaria', 'Binance / USDT', 'Hotmart', 'Otro'];
// tipo_pago_simple guardado en saleForm usa estas grafías puntuales (no todo minúscula) —
// las claves de `allowed_types` que devuelve el backend sí son minúsculas.
const PAYMENT_TYPES = [
    { v: 'completo', key: 'completo', label: 'Completo (PIF)', hint: 'paga todo hoy' },
    { v: 'parcial', key: 'parcial', label: 'Parcial (primer pago)', hint: 'arranca un plan de cuotas' },
    { v: 'Seña', key: 'seña', label: 'Seña', hint: 'promesa de pago, sin cronograma todavía' },
    { v: 'Cuota', key: 'cuota', label: 'Cuota', hint: 'cobra una cuota del plan ya armado' },
    { v: 'Renovacion', key: 'renovacion', label: 'Renovación', hint: 'ya fue alumno, compra de nuevo' },
    { v: 'Upsell', key: 'upsell', label: 'Upsell', hint: 'suma otro programa/mejora' }
];

// Mismo helper `option()` que usa el modal de Ficha Interactiva (clases .opt/.opt.sel) —
// para que las tarjetas de opción se vean y se comporten igual en ambos modales.
const Option = ({ onClick, type = 'info', label, sub, selected = false, disabled = false, title }) => (
    <button
        type="button"
        onClick={onClick}
        data-t={type}
        disabled={disabled}
        title={title}
        className={`opt ${selected ? 'sel' : ''}`}
        style={disabled ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
    >
        {selected && <Check size={13} className="absolute top-3 right-3 text-white" />}
        {label}
        {sub && <small>{sub}</small>}
    </button>
);

const inputCls = "w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-medium";

function FieldTag({ prefilled }) {
    return prefilled ? (
        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#7DEAC0' }}>✓ Traído de la agenda</span>
    ) : (
        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#FFB3DE' }}>● Este lo cargás vos</span>
    );
}

function StepShell({ n, title, hint, children, counter, segments }) {
    return (
        <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-center gap-1">
                {segments.map((s, k) => (
                    <div
                        key={k}
                        className="flex-1 h-[3px] rounded-full"
                        style={{ background: s === 'done' ? '#2FBF8F' : s === 'now' ? 'linear-gradient(90deg,#1323C6,#FF3FA4)' : 'rgba(255,255,255,.10)' }}
                    />
                ))}
            </div>
            <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#8C99E0' }}>{counter}</span>
            </div>
            <div className="q">
                <h4><span className="num">{n}</span>{title}</h4>
                {hint && <p>{hint}</p>}
                <div className="pt-1">{children}</div>
            </div>
        </div>
    );
}

// --- Tabla de cronograma, editable en cualquier momento (agregar / borrar / editar cuota),
// incluso cuotas ya marcadas pagadas — para corregir un plan viejo mal cargado. ---
function PlanEditor({ apptId, programaCode, cuotas, loading, selectable, selectedCuotaId, onSelect, onChanged }) {
    const [savingId, setSavingId] = useState(null);
    const [adding, setAdding] = useState(false);
    const [newCuota, setNewCuota] = useState({ monto: '', fecha_vencimiento: toISO(new Date()) });

    const patchCuota = async (id, patch) => {
        setSavingId(id);
        try {
            await api.patch(`/closer/installments/cuota/${id}`, patch);
            onChanged();
        } catch (e) {
            console.error('Error al ajustar la cuota:', e);
        } finally {
            setSavingId(null);
        }
    };

    const deleteCuota = async (id) => {
        if (!confirm('¿Borrar esta cuota del plan? No se puede deshacer.')) return;
        setSavingId(id);
        try {
            await api.delete(`/closer/installments/cuota/${id}`);
            onChanged();
        } catch (e) {
            console.error('Error al borrar la cuota:', e);
        } finally {
            setSavingId(null);
        }
    };

    const addCuota = async () => {
        if (!newCuota.monto || !newCuota.fecha_vencimiento) return;
        setAdding(true);
        try {
            await api.post('/closer/installments/cuota', {
                appointment_id: apptId,
                monto: parseFloat(newCuota.monto),
                fecha_vencimiento: newCuota.fecha_vencimiento,
                programa_code: programaCode
            });
            setNewCuota({ monto: '', fecha_vencimiento: toISO(new Date()) });
            onChanged();
        } catch (e) {
            console.error('Error al agregar la cuota:', e);
        } finally {
            setAdding(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center py-4"><Loader2 className="animate-spin" style={{ color: '#6D8BFF' }} size={18} /></div>;
    }

    return (
        <div className="space-y-2">
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(0,0,0,.28)', border: '1px solid rgba(255,255,255,.12)' }}>
                <table className="w-full text-xs">
                    <thead style={{ background: 'rgba(0,0,0,.22)' }}>
                        <tr>
                            {selectable && <th className="w-8" />}
                            <th className="text-left px-3 py-2 text-[9px] font-black uppercase" style={{ color: '#8C99E0' }}>Cuota</th>
                            <th className="text-left px-3 py-2 text-[9px] font-black uppercase" style={{ color: '#8C99E0' }}>Monto</th>
                            <th className="text-left px-3 py-2 text-[9px] font-black uppercase" style={{ color: '#8C99E0' }}>Vence</th>
                            <th className="text-left px-3 py-2 text-[9px] font-black uppercase" style={{ color: '#8C99E0' }}>Estado</th>
                            <th className="w-8" />
                        </tr>
                    </thead>
                    <tbody>
                        {cuotas.map((c) => {
                            const isPagado = c.estado === 'pagado';
                            const isVencida = c.estado === 'vencido';
                            const isSelected = selectedCuotaId === c.id;
                            const busy = savingId === c.id;
                            return (
                                <tr
                                    key={c.id}
                                    className={selectable && !isPagado ? 'cursor-pointer' : ''}
                                    style={{ borderTop: '1px solid rgba(255,255,255,.08)', background: isSelected ? 'rgba(19,35,198,.20)' : 'transparent' }}
                                    onClick={() => { if (selectable && !isPagado) onSelect(c); }}
                                >
                                    {selectable && (
                                        <td className="px-3 py-2">
                                            {!isPagado && <input type="radio" checked={isSelected} onChange={() => {}} className="cursor-pointer" />}
                                        </td>
                                    )}
                                    <td className="px-3 py-2 font-bold text-white">#{c.numero_cuota}</td>
                                    <td className="px-3 py-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            defaultValue={c.monto}
                                            disabled={busy}
                                            onClick={(e) => e.stopPropagation()}
                                            onBlur={(e) => {
                                                const v = parseFloat(e.target.value);
                                                if (!isNaN(v) && v !== c.monto) patchCuota(c.id, { monto: v });
                                            }}
                                            className="w-20 bg-slate-950/70 border border-slate-800 rounded-lg px-1.5 py-1 text-[11px] font-bold text-slate-200 outline-none focus:ring-1 focus:ring-violet-500"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input
                                            type="date"
                                            defaultValue={c.fecha_vencimiento}
                                            disabled={busy}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => e.target.value && patchCuota(c.id, { fecha_vencimiento: e.target.value })}
                                            className="bg-slate-950/70 border border-slate-800 rounded-lg px-1.5 py-1 text-[10px] font-bold text-slate-200 outline-none focus:ring-1 focus:ring-violet-500"
                                        />
                                    </td>
                                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                        <select
                                            value={c.estado}
                                            disabled={busy}
                                            onChange={(e) => patchCuota(c.id, { estado: e.target.value })}
                                            className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-transparent cursor-pointer"
                                            style={{
                                                border: `1px solid ${isPagado ? 'rgba(47,191,143,.4)' : isVencida ? 'rgba(232,92,74,.4)' : 'rgba(217,164,65,.4)'}`,
                                                color: isPagado ? '#7DEAC0' : isVencida ? '#F5A99C' : '#F3D08A'
                                            }}
                                        >
                                            <option value="pendiente" className="text-black">Pendiente</option>
                                            <option value="pagado" className="text-black">Pagada</option>
                                        </select>
                                    </td>
                                    <td className="px-2 py-2 text-right">
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={(e) => { e.stopPropagation(); deleteCuota(c.id); }}
                                            className="p-1 transition-all"
                                            style={{ color: '#8C99E0' }}
                                            title="Borrar cuota"
                                        >
                                            {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {cuotas.length === 0 && (
                            <tr><td colSpan={selectable ? 5 : 4} className="px-3 py-4 text-center text-[10px] font-bold uppercase" style={{ color: '#8C99E0' }}>Sin cuotas cargadas</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="flex items-center gap-2 pt-1">
                <input
                    type="number"
                    step="0.01"
                    placeholder="Monto"
                    value={newCuota.monto}
                    onChange={(e) => setNewCuota((p) => ({ ...p, monto: e.target.value }))}
                    className="w-24 bg-slate-950/70 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-200 outline-none focus:ring-1 focus:ring-violet-500"
                />
                <input
                    type="date"
                    value={newCuota.fecha_vencimiento}
                    onChange={(e) => setNewCuota((p) => ({ ...p, fecha_vencimiento: e.target.value }))}
                    className="bg-slate-950/70 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-200 outline-none focus:ring-1 focus:ring-violet-500"
                />
                <button
                    type="button"
                    onClick={addCuota}
                    disabled={adding || !newCuota.monto}
                    className="h-8 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[9px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1 disabled:opacity-40 border border-slate-700"
                >
                    {adding ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                    Agregar cuota
                </button>
            </div>
            <p className="text-[9px] font-medium" style={{ color: '#8C99E0' }}>
                Podés editar monto/fecha/estado de cualquier cuota (incluso ya pagadas) o agregar/borrar una —
                para corregir un plan viejo mal cargado, en cualquier momento.
            </p>
        </div>
    );
}

const DeclararVentaWizard = ({
    saleForm,
    setSaleForm,
    saleClientState,
    loadingSaleState,
    saleExistingCuotas,
    loadingSaleCuotas,
    selectedCuotaId,
    setSelectedCuotaId,
    refreshExistingCuotas,
    settleBalanceWithSale,
    setSettleBalanceWithSale,
    submittingSale,
    teamMembers,
    apptId,
    onClose,
    onRegisterSale
}) => {
    const [i, setI] = useState(0);
    const [dir, setDir] = useState(1);
    const [fromReview, setFromReview] = useState(false);
    const [installmentMode, setInstallmentMode] = useState('monthly');
    const [payDay, setPayDay] = useState(10);
    const [referralContacts, setReferralContacts] = useState([]);
    const [savingReferrals, setSavingReferrals] = useState(false);

    const set = (k, v) => setSaleForm((prev) => ({ ...prev, [k]: v }));

    const balance = useMemo(() => {
        const total = parseFloat(saleForm.precio_total) || 0;
        const paidBefore = saleClientState?.total_paid || 0;
        const today = parseFloat(saleForm.monto) || 0;
        if (saleForm.tipo_pago_simple === 'completo') return 0;
        return Math.max(0, total - paidBefore - today);
    }, [saleForm.precio_total, saleForm.monto, saleForm.tipo_pago_simple, saleClientState]);

    const isCuotaPayment = (saleForm.tipo_pago_simple || '').toLowerCase() === 'cuota';
    const hasExistingPlan = saleExistingCuotas.length > 0;
    const alreadyHasSales = (saleClientState?.sales_count || 0) > 0;

    const path = useMemo(() => {
        const p = ['name', 'instagram', 'email', 'phone', 'document', 'closer', 'program'];
        if (alreadyHasSales) p.push('clientSummary');
        p.push('paymentType');
        if (saleForm.tipo_pago_simple !== 'completo') p.push('amounts');
        p.push('method');
        const needsSchedule = saleForm.tipo_pago_simple !== 'completo' && balance > 0.009;
        if (needsSchedule) {
            if (isCuotaPayment && hasExistingPlan) {
                p.push('pickCuota');
            } else {
                p.push('installmentCount', 'installmentMode', installmentMode === 'monthly' ? 'installmentDay' : 'installmentDates');
            }
        }
        p.push('exam', 'saleMeta', 'estado', 'notas', 'referralAsked');
        if (saleForm.referralAsked === 'got') {
            p.push('referralCount', 'referralWhen');
            if (saleForm.referralWhen === 'now') p.push('referralContacts');
        }
        p.push('review');
        return p;
    }, [alreadyHasSales, saleForm.tipo_pago_simple, saleForm.referralAsked, saleForm.referralWhen, balance, isCuotaPayment, hasExistingPlan, installmentMode]);

    const step = path[Math.min(i, path.length - 1)];

    useEffect(() => {
        if (i >= path.length) setI(path.length - 1);
    }, [path, i]);

    useEffect(() => {
        if (saleForm.referralCount && referralContacts.length !== saleForm.referralCount) {
            setReferralContacts((prev) => Array.from({ length: saleForm.referralCount }, (_, k) => prev[k] || { name: '', phone: '' }));
        }
    }, [saleForm.referralCount]); // eslint-disable-line react-hooks/exhaustive-deps

    const goNext = () => {
        if (step === 'review') return;
        if (fromReview) { setFromReview(false); setDir(1); setI(path.indexOf('review')); return; }
        setDir(1);
        setI((p) => Math.min(p + 1, path.length - 1));
    };
    const goBack = () => {
        if (fromReview) { setFromReview(false); setDir(-1); setI(path.indexOf('review')); return; }
        setDir(-1);
        setI((p) => Math.max(0, p - 1));
    };
    const jumpTo = (stepId) => {
        const idx = path.indexOf(stepId);
        if (idx >= 0) { setFromReview(true); setDir(1); setI(idx); }
    };

    const canAdvance = () => {
        if (step === 'name') return !!saleForm.nombre_cliente?.trim();
        if (step === 'instagram') return !!saleForm.instagram?.trim();
        if (step === 'email') return !!saleForm.mail_cliente?.trim();
        if (step === 'closer') return !!saleForm.email_vendedor?.trim();
        if (step === 'amounts') return !!saleForm.precio_total && parseFloat(saleForm.monto) > 0;
        if (step === 'method' && saleForm.tipo_pago_simple === 'completo') return parseFloat(saleForm.monto) > 0;
        if (step === 'pickCuota') return !!selectedCuotaId;
        if (step === 'saleMeta') return !!saleForm.date;
        return true;
    };

    // Enter avanza al siguiente paso (como tocar "Siguiente"), en vez de no hacer nada —
    // en un wizard de una pregunta por pantalla el closer espera poder ir con el teclado.
    // No se usa en <textarea> (ahí Enter mete un salto de línea) ni en review (para no
    // registrar la venta sin querer con un Enter de más).
    const enterNext = (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (step !== 'review' && canAdvance()) goNext();
    };

    const submitReferrals = async () => {
        const withData = referralContacts.filter((c) => c.name.trim());
        if (withData.length === 0) return;
        setSavingReferrals(true);
        try {
            for (const c of withData) {
                await api.post('/closer/deck/referrals/manual', {
                    from_lead_id: apptId,
                    lead_name: c.name.trim(),
                    phone: c.phone.trim(),
                    notes: `Referido por ${saleForm.nombre_cliente}`
                });
            }
        } catch (e) {
            console.error('Error al cargar referidos:', e);
        } finally {
            setSavingReferrals(false);
        }
    };

    const handleFinalSubmit = async () => {
        if (saleForm.referralAsked === 'got' && saleForm.referralWhen === 'now') {
            await submitReferrals();
        }
        await onRegisterSale();
    };

    const rule = saleClientState?.allowed_types?.[(saleForm.tipo_pago_simple || '').toLowerCase()];
    const segments = path.map((_, k) => (k < i ? 'done' : k === i ? 'now' : 'todo'));
    const counter = `PASO ${i + 1} DE ${path.length}`;

    return (
        <div className="ov mid">
            <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 18, scale: 0.97 }}
                transition={{ duration: 0.2 }}
                className="md sm"
            >
                <div className="mdh">
                    <div style={{ flex: 1 }}>
                        <h3>DECLARAR VENTA</h3>
                        <p>{saleForm.nombre_cliente || 'Nuevo cliente'}</p>
                    </div>
                    <button className="x" onClick={onClose}>×</button>
                </div>

                <div className="mdb space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {step === 'name' && (
                        <StepShell n={1} title="¿Quién compró?" hint="Vino de la agenda. Confirmá que esté bien escrito." counter={counter} segments={segments}>
                            <input autoFocus type="text" value={saleForm.nombre_cliente || ''} onChange={(e) => set('nombre_cliente', e.target.value)} onKeyDown={enterNext} placeholder="Nombre y apellido" className={inputCls} />
                            <div className="mt-2"><FieldTag prefilled={!!saleForm.nombre_cliente} /></div>
                        </StepShell>
                    )}
                    {step === 'instagram' && (
                        <StepShell n={1} title="¿Su Instagram?" hint="Sin arroba. Se usa para el seguimiento por DM." counter={counter} segments={segments}>
                            <input autoFocus type="text" value={saleForm.instagram || ''} onChange={(e) => set('instagram', e.target.value.replace(/@/g, ''))} onKeyDown={enterNext} placeholder="usuario" className={inputCls} />
                            <div className="mt-2"><FieldTag prefilled={!!saleForm.instagram} /></div>
                        </StepShell>
                    )}
                    {step === 'email' && (
                        <StepShell n={1} title="¿Su email?" hint="Acá le llega el acceso al programa." counter={counter} segments={segments}>
                            <input autoFocus type="email" value={saleForm.mail_cliente || ''} onChange={(e) => set('mail_cliente', e.target.value)} onKeyDown={enterNext} placeholder="nombre@mail.com" className={inputCls} />
                            <div className="mt-2"><FieldTag prefilled={!!saleForm.mail_cliente} /></div>
                        </StepShell>
                    )}
                    {step === 'phone' && (
                        <StepShell n={1} title="¿Teléfono?" hint="Con código de país, para WhatsApp." counter={counter} segments={segments}>
                            <input autoFocus type="text" value={saleForm.telefono || ''} onChange={(e) => set('telefono', e.target.value)} onKeyDown={enterNext} placeholder="+54 9 11 ..." className={inputCls} />
                            <div className="mt-2"><FieldTag prefilled={!!saleForm.telefono} /></div>
                        </StepShell>
                    )}
                    {step === 'document' && (
                        <StepShell n={1} title="¿Documento de identidad?" hint="DNI, NIE o pasaporte. Es el único dato que tenés que tipear." counter={counter} segments={segments}>
                            <input autoFocus type="text" value={saleForm.documento_identidad || ''} onChange={(e) => set('documento_identidad', e.target.value)} onKeyDown={enterNext} placeholder="Ingresá el documento" className={inputCls} />
                            <div className="mt-2"><FieldTag prefilled={false} /></div>
                        </StepShell>
                    )}
                    {step === 'closer' && (
                        <StepShell n={1} title="¿A quién se le atribuye?" hint="La comisión va a este correo." counter={counter} segments={segments}>
                            <div className="grid grid-cols-1 gap-2.5">
                                {(teamMembers || []).filter((m) => m.role === 'closer').map((m) => (
                                    <Option key={m.id} type="info" selected={saleForm.email_vendedor === m.email} label={m.username} sub={m.email} onClick={() => set('email_vendedor', m.email)} />
                                ))}
                            </div>
                        </StepShell>
                    )}
                    {step === 'program' && (
                        <StepShell n={2} title="¿Qué programa compró?" counter={counter} segments={segments}>
                            <div className="grid grid-cols-1 gap-2.5">
                                {PROGRAMS.map((p) => (
                                    <Option key={p.v} type="info" selected={saleForm.programa === p.v} label={p.label} sub={p.hint} onClick={() => { set('programa', p.v); setTimeout(goNext, 120); }} />
                                ))}
                            </div>
                        </StepShell>
                    )}
                    {step === 'clientSummary' && (
                        <StepShell n={2} title="Así viene este cliente" hint="Ya tiene pagos registrados en este programa — el resto del flujo se ajusta solo." counter={counter} segments={segments}>
                            {loadingSaleState ? (
                                <div className="flex justify-center py-6"><Loader2 className="animate-spin" style={{ color: '#6D8BFF' }} size={20} /></div>
                            ) : saleClientState ? (
                                <div className="fq info">
                                    <div className="flex justify-between text-xs mb-1"><span style={{ color: '#8C99E0' }} className="font-bold uppercase">Pagó</span><b className="text-white">{money(saleClientState.total_paid)} / {money(saleClientState.program_price)}</b></div>
                                    <div className="flex justify-between text-xs mb-1"><span style={{ color: '#8C99E0' }} className="font-bold uppercase">Saldo</span><b style={{ color: '#FFB3DE' }}>{money(saleClientState.balance_remaining)}</b></div>
                                    <div className="flex justify-between text-xs"><span style={{ color: '#8C99E0' }} className="font-bold uppercase">Ventas registradas</span><b className="text-white">{saleClientState.sales_count}</b></div>
                                </div>
                            ) : null}
                        </StepShell>
                    )}
                    {step === 'paymentType' && (
                        <StepShell n={2} title="¿Cómo paga?" counter={counter} segments={segments}>
                            {loadingSaleState ? (
                                <div className="flex justify-center py-6"><Loader2 className="animate-spin" style={{ color: '#6D8BFF' }} size={20} /></div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2.5">
                                    {PAYMENT_TYPES.map((opt) => {
                                        const r = saleClientState?.allowed_types?.[opt.key];
                                        const disabled = r ? !r.ok : false;
                                        return (
                                            <Option
                                                key={opt.v}
                                                type="info"
                                                disabled={disabled}
                                                title={disabled ? r.reason : undefined}
                                                selected={saleForm.tipo_pago_simple === opt.v}
                                                label={opt.label}
                                                sub={opt.hint}
                                                onClick={() => { if (!disabled) { set('tipo_pago_simple', opt.v); setTimeout(goNext, 120); } }}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                            {rule && !rule.ok && <p className="text-[10px] font-bold mt-2" style={{ color: '#F5A99C' }}>{rule.reason}</p>}
                            {['Renovacion', 'Upsell'].includes(saleForm.tipo_pago_simple) && saleClientState?.can_settle_balance_with_installment && (
                                <label className="flex items-center gap-2 mt-3 p-3 rounded-xl text-[10px] font-bold uppercase cursor-pointer" style={{ background: 'rgba(217,164,65,.10)', border: '1px solid rgba(217,164,65,.30)', color: '#F3D08A' }}>
                                    <input type="checkbox" checked={settleBalanceWithSale} onChange={(e) => setSettleBalanceWithSale(e.target.checked)} className="rounded" />
                                    Liquidar el saldo pendiente ({money(saleClientState.balance_remaining)}) junto con esta venta
                                </label>
                            )}
                        </StepShell>
                    )}
                    {step === 'amounts' && (
                        <StepShell n={2} title="Precio total y cuánto cobrás hoy" hint="El saldo se calcula solo." counter={counter} segments={segments}>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest ml-1" style={{ color: '#8C99E0' }}>Precio total</label>
                                    <input type="number" step="0.01" value={saleForm.precio_total || ''} onChange={(e) => set('precio_total', e.target.value)} onKeyDown={enterNext} className={inputCls} placeholder="0.00" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest ml-1" style={{ color: '#8C99E0' }}>Cobrado hoy</label>
                                    <input type="number" step="0.01" value={saleForm.monto || ''} onChange={(e) => set('monto', e.target.value)} onKeyDown={enterNext} className={inputCls} placeholder="0.00" />
                                </div>
                            </div>
                            <div className="mt-3 fq info">
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] font-black uppercase" style={{ color: '#8C99E0' }}>Saldo a financiar</span>
                                    <span className="text-lg font-black" style={{ color: '#FFB3DE' }}>{money(balance)}</span>
                                </div>
                            </div>
                        </StepShell>
                    )}
                    {step === 'method' && (
                        <StepShell n={2} title="¿Por dónde entró la plata?" counter={counter} segments={segments}>
                            <div className="grid grid-cols-2 gap-2.5">
                                {METHODS.map((m) => (
                                    <Option key={m} type="info" selected={saleForm.metodo_pago === m} label={m} onClick={() => set('metodo_pago', m)} />
                                ))}
                            </div>
                            {saleForm.tipo_pago_simple === 'completo' && (
                                <div className="mt-3 space-y-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest ml-1" style={{ color: '#8C99E0' }}>Monto cobrado</label>
                                    <input type="number" step="0.01" value={saleForm.monto || ''} onChange={(e) => set('monto', e.target.value)} onKeyDown={enterNext} className={inputCls} placeholder="0.00" />
                                </div>
                            )}
                            <input
                                type="text"
                                value={saleForm.segundo_pago || ''}
                                onChange={(e) => set('segundo_pago', e.target.value)}
                                onKeyDown={enterNext}
                                placeholder="Comentario del cobro (opcional)"
                                className={`${inputCls} mt-3`}
                            />
                        </StepShell>
                    )}
                    {step === 'pickCuota' && (
                        <StepShell n={3} title="¿Cuál cuota se está pagando?" hint="Elegí cualquier pendiente — podés adelantar una futura o pagar una vencida." counter={counter} segments={segments}>
                            <PlanEditor
                                apptId={apptId}
                                programaCode={saleForm.programa}
                                cuotas={saleExistingCuotas}
                                loading={loadingSaleCuotas}
                                selectable
                                selectedCuotaId={selectedCuotaId}
                                onSelect={(c) => { setSelectedCuotaId(c.id); set('monto', String(c.monto)); }}
                                onChanged={refreshExistingCuotas}
                            />
                        </StepShell>
                    )}
                    {step === 'installmentCount' && (
                        <StepShell n={3} title={`Te deben ${money(balance)}. ¿En cuántas cuotas?`} hint="Después definís cuándo se cobran." counter={counter} segments={segments}>
                            <div className="flex items-center justify-between">
                                <button type="button" onClick={() => set('num_cuotas', Math.max(1, (saleForm.num_cuotas || 1) - 1))} className="w-11 h-11 rounded-full border border-slate-700 text-slate-300 font-black text-lg">−</button>
                                <span className="text-3xl font-black text-white">{saleForm.num_cuotas}</span>
                                <button type="button" onClick={() => set('num_cuotas', Math.min(12, (saleForm.num_cuotas || 1) + 1))} className="w-11 h-11 rounded-full bg-violet-600 text-white font-black text-lg">+</button>
                                <div className="text-right">
                                    <div className="text-[9px] font-black uppercase" style={{ color: '#8C99E0' }}>Cada cuota</div>
                                    <div className="font-black" style={{ color: '#7DEAC0' }}>{money(balance / Math.max(1, saleForm.num_cuotas || 1))}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-2 mt-4">
                                {[2, 3, 4, 6].map((k) => (
                                    <button key={k} type="button" onClick={() => set('num_cuotas', k)} className={`h-9 rounded-lg text-[11px] font-black ${saleForm.num_cuotas === k ? 'bg-violet-600 text-white' : 'bg-slate-900/60 text-slate-300 border border-slate-750'}`}>{k}</button>
                                ))}
                            </div>
                        </StepShell>
                    )}
                    {step === 'installmentMode' && (
                        <StepShell n={3} title="¿El pago es mensual?" hint="Si es mensual solo elegís el día y el resto se calcula solo." counter={counter} segments={segments}>
                            <div className="grid grid-cols-1 gap-2.5">
                                <Option type="info" selected={installmentMode === 'monthly'} label="Sí, todos los meses el mismo día" sub="elegís un día y listo" onClick={() => { setInstallmentMode('monthly'); setTimeout(goNext, 120); }} />
                                <Option type="info" selected={installmentMode === 'custom'} label="No, fechas distintas" sub="cargás cada fecha a mano" onClick={() => { setInstallmentMode('custom'); setTimeout(goNext, 120); }} />
                            </div>
                        </StepShell>
                    )}
                    {step === 'installmentDay' && (
                        <StepShell n={3} title="¿Qué día de cada mes paga?" hint="Si el mes no tiene ese día, se cobra el último. Podés ajustar el monto de cada cuota abajo." counter={counter} segments={segments}>
                            <div className="grid grid-cols-7 gap-1.5">
                                {Array.from({ length: 31 }, (_, k) => k + 1).map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        onClick={() => setPayDay(n)}
                                        className={`h-9 rounded-lg text-[11px] font-black tabular-nums ${payDay === n ? 'bg-violet-600 text-white' : 'bg-slate-900/60 text-slate-300 border border-slate-750'}`}
                                    >{n}</button>
                                ))}
                            </div>
                            <div className="mt-3 space-y-2">
                                {(() => {
                                    const n = saleForm.num_cuotas || 1;
                                    const dates = monthlyDates(n, payDay);
                                    const amounts = cuotaAmounts(n, balance, saleForm.cuotaMontos);
                                    return dates.map((d, k) => {
                                        const isLast = k === n - 1;
                                        return (
                                            <div key={k} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(0,0,0,.22)', border: '1px solid rgba(255,255,255,.10)' }}>
                                                <span className="text-xs font-black text-white w-16">Cuota {k + 1}</span>
                                                {isLast ? (
                                                    <span className="text-xs font-bold w-24" style={{ color: '#8C99E0' }} title="Se ajusta sola para que la suma cierre">{money(amounts[k])}</span>
                                                ) : (
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={saleForm.cuotaMontos?.[k + 1] ?? amounts[k]}
                                                        onChange={(e) => set('cuotaMontos', { ...saleForm.cuotaMontos, [k + 1]: e.target.value })}
                                                        className="w-24 bg-slate-950/70 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-200 outline-none focus:ring-1 focus:ring-violet-500"
                                                    />
                                                )}
                                                <span className="text-xs font-bold text-slate-300 flex-1">{prettyDate(d)}</span>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </StepShell>
                    )}
                    {step === 'installmentDates' && (
                        <StepShell n={3} title="¿Cuándo cobrás cada cuota?" hint="Estas fechas son las que te van a aparecer en seguimientos. Podés ajustar el monto de cada cuota también." counter={counter} segments={segments}>
                            <div className="space-y-2">
                                {(() => {
                                    const n = saleForm.num_cuotas || 1;
                                    const amounts = cuotaAmounts(n, balance, saleForm.cuotaMontos);
                                    return Array.from({ length: n }, (_, k) => k + 1).map((num) => {
                                        const isLast = num === n;
                                        const current = saleForm.cuotaFechas?.[num] || toISO(addMonths(new Date(), num));
                                        return (
                                            <div key={num} className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(0,0,0,.22)', border: '1px solid rgba(255,255,255,.10)' }}>
                                                <span className="text-xs font-black text-white w-16">Cuota {num}</span>
                                                {isLast ? (
                                                    <span className="text-xs font-bold w-20" style={{ color: '#8C99E0' }} title="Se ajusta sola para que la suma cierre">{money(amounts[num - 1])}</span>
                                                ) : (
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={saleForm.cuotaMontos?.[num] ?? amounts[num - 1]}
                                                        onChange={(e) => set('cuotaMontos', { ...saleForm.cuotaMontos, [num]: e.target.value })}
                                                        className="w-20 bg-slate-950/70 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-200 outline-none focus:ring-1 focus:ring-violet-500"
                                                    />
                                                )}
                                                <input
                                                    type="date"
                                                    value={current}
                                                    onChange={(e) => set('cuotaFechas', { ...saleForm.cuotaFechas, [num]: e.target.value })}
                                                    className="flex-1 bg-slate-950/70 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-200 outline-none focus:ring-1 focus:ring-violet-500"
                                                />
                                                <button type="button" onClick={() => set('cuotaFechas', { ...saleForm.cuotaFechas, [num]: toISO(addDays(parseISO(current), -7)) })} className="px-1" style={{ color: '#8C99E0' }}>-7d</button>
                                                <button type="button" onClick={() => set('cuotaFechas', { ...saleForm.cuotaFechas, [num]: toISO(addDays(parseISO(current), 7)) })} className="px-1" style={{ color: '#8C99E0' }}>+7d</button>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                            <p className="text-[9px] font-medium mt-2" style={{ color: '#8C99E0' }}>La última cuota se ajusta sola para que la suma cierre exacto contra el saldo.</p>
                        </StepShell>
                    )}
                    {step === 'exam' && (
                        <StepShell n={4} title="¿Qué examen rinde?" hint="Define el grupo y el contenido que recibe." counter={counter} segments={segments}>
                            <input autoFocus type="text" value={saleForm.examen_lead || ''} onChange={(e) => set('examen_lead', e.target.value)} onKeyDown={enterNext} placeholder="ej. USMLE Step 1" className={inputCls} />
                            <div className="mt-2"><FieldTag prefilled={!!saleForm.examen_lead} /></div>
                        </StepShell>
                    )}
                    {step === 'saleMeta' && (
                        <StepShell n={4} title="¿Cuándo se cerró?" hint="Y si la firma fue dentro de la llamada." counter={counter} segments={segments}>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest ml-1" style={{ color: '#8C99E0' }}>Fecha de la venta</label>
                                    <input type="date" value={saleForm.date || ''} onChange={(e) => set('date', e.target.value)} onKeyDown={enterNext} className={inputCls} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest ml-1" style={{ color: '#8C99E0' }}>¿Cerró en llamada?</label>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <Option type="ok" selected={!!saleForm.sold_in_call} label="Sí, Meet" onClick={() => set('sold_in_call', true)} />
                                        <Option type="no" selected={!saleForm.sold_in_call} label="No, fuera" onClick={() => set('sold_in_call', false)} />
                                    </div>
                                </div>
                            </div>
                        </StepShell>
                    )}
                    {step === 'estado' && (
                        <StepShell n={4} title="¿Estado de la venta?" counter={counter} segments={segments}>
                            <div className="grid grid-cols-1 gap-2.5">
                                <Option type="ok" selected={saleForm.estado === 'Completada'} label="Completada" sub="todo en orden" onClick={() => { set('estado', 'Completada'); setTimeout(goNext, 120); }} />
                                <Option type="no" selected={saleForm.estado === 'Pendiente'} label="Pendiente" sub="falta algo para cerrarla" onClick={() => { set('estado', 'Pendiente'); setTimeout(goNext, 120); }} />
                                <Option type="bad" selected={saleForm.estado === 'Cancelada'} label="Cancelada" sub="no va a concretarse" onClick={() => { set('estado', 'Cancelada'); setTimeout(goNext, 120); }} />
                            </div>
                        </StepShell>
                    )}
                    {step === 'notas' && (
                        <StepShell n={4} title="Notas u observaciones" hint="Opcional — objeciones, detalles del cierre, lo que sirva después." counter={counter} segments={segments}>
                            <textarea
                                rows={3}
                                value={saleForm.notas || ''}
                                onChange={(e) => set('notas', e.target.value)}
                                placeholder="Detalles sobre el cierre, objeciones vencidas, etc..."
                                className={`${inputCls} resize-none custom-scrollbar`}
                            />
                        </StepShell>
                    )}
                    {step === 'referralAsked' && (
                        <StepShell n={4} title="¿Le pediste un referido?" hint="El mejor momento para pedirlo ya pasó. Contá qué salió." counter={counter} segments={segments}>
                            <div className="grid grid-cols-1 gap-2.5">
                                <Option type="ok" selected={saleForm.referralAsked === 'got'} label="Sí le pedí y me dio" sub="cargamos los contactos" onClick={() => { set('referralAsked', 'got'); setTimeout(goNext, 120); }} />
                                <Option type="no" selected={saleForm.referralAsked === 'asked'} label="Sí le pedí, no me dio" sub="queda registrado igual" onClick={() => { set('referralAsked', 'asked'); setTimeout(goNext, 120); }} />
                                <Option type="info" selected={saleForm.referralAsked === 'no'} label="No le pedí" sub="sin drama, la próxima" onClick={() => { set('referralAsked', 'no'); setTimeout(goNext, 120); }} />
                            </div>
                        </StepShell>
                    )}
                    {step === 'referralCount' && (
                        <StepShell n={4} title="¿Cuántos referidos te dio?" hint="Cada uno vale una llamada nueva." counter={counter} segments={segments}>
                            <div className="flex items-center justify-between">
                                <button type="button" onClick={() => set('referralCount', Math.max(1, (saleForm.referralCount || 1) - 1))} className="w-11 h-11 rounded-full border border-slate-700 text-slate-300 font-black text-lg">−</button>
                                <span className="text-3xl font-black text-white">{saleForm.referralCount || 1}</span>
                                <button type="button" onClick={() => set('referralCount', Math.min(5, (saleForm.referralCount || 1) + 1))} className="w-11 h-11 rounded-full bg-violet-600 text-white font-black text-lg">+</button>
                            </div>
                        </StepShell>
                    )}
                    {step === 'referralWhen' && (
                        <StepShell n={4} title="¿Los cargás ahora o después?" hint="Si es después quedan como tarea en tu bandeja." counter={counter} segments={segments}>
                            <div className="grid grid-cols-2 gap-2.5">
                                <Option type="ok" selected={saleForm.referralWhen === 'now'} label="Cargar ahora" sub="nombre y número de cada uno" onClick={() => { set('referralWhen', 'now'); setTimeout(goNext, 120); }} />
                                <Option type="info" selected={saleForm.referralWhen === 'later'} label="Después" sub="va a pendientes" onClick={() => { set('referralWhen', 'later'); setTimeout(goNext, 120); }} />
                            </div>
                        </StepShell>
                    )}
                    {step === 'referralContacts' && (
                        <StepShell n={4} title="Nombre y número de cada referido" hint="Con esto ya quedan agendados. Sin esto no existen." counter={counter} segments={segments}>
                            <div className="space-y-2">
                                {referralContacts.map((c, k) => (
                                    <div key={k} className="flex items-center gap-2">
                                        <span className="num" style={{ width: 22, height: 22 }}>{k + 1}</span>
                                        <input
                                            type="text"
                                            value={c.name}
                                            onChange={(e) => setReferralContacts((prev) => prev.map((r, j) => (j === k ? { ...r, name: e.target.value } : r)))}
                                            onKeyDown={enterNext}
                                            placeholder="Nombre del referido"
                                            className={inputCls}
                                        />
                                        <input
                                            type="text"
                                            value={c.phone}
                                            onChange={(e) => setReferralContacts((prev) => prev.map((r, j) => (j === k ? { ...r, phone: e.target.value } : r)))}
                                            onKeyDown={enterNext}
                                            placeholder="+54 9 ..."
                                            className={`${inputCls} w-32`}
                                        />
                                    </div>
                                ))}
                            </div>
                            <p className="text-[9px] font-medium mt-2" style={{ color: '#8C99E0' }}>Cada referido cargado entra a la bandeja del closer que corresponda como llamada nueva.</p>
                        </StepShell>
                    )}
                    {step === 'review' && (
                        <StepShell n={4} title="Revisá y registrá" hint="Si algo está mal, tocá 'editar' y corregilo ahí mismo." counter={counter} segments={segments}>
                            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,.12)' }}>
                                {[
                                    { label: 'Cliente', value: `${saleForm.nombre_cliente} · ${saleForm.examen_lead || 'sin examen'}`, step: 'name' },
                                    { label: 'Programa', value: `${PROGRAMS.find((p) => p.v === saleForm.programa)?.label} · ${PAYMENT_TYPES.find((t) => t.v === saleForm.tipo_pago_simple)?.label}`, step: 'program' },
                                    { label: 'Cobrado hoy', value: `${money(saleForm.monto)} por ${saleForm.metodo_pago}`, step: 'method' },
                                    { label: 'Saldo', value: balance > 0.009 ? money(balance) : 'sin saldo', step: 'amounts' },
                                    { label: 'Referidos', value: saleForm.referralAsked === 'got' ? `${saleForm.referralCount} referidos` : saleForm.referralAsked === 'asked' ? 'pedido, sin dar' : 'no se pidió', step: 'referralAsked' },
                                    { label: 'Fecha', value: `${saleForm.date}${saleForm.sold_in_call ? ' · en llamada' : ' · fuera de llamada'}`, step: 'saleMeta' }
                                ].map((r) => (
                                    <button
                                        key={r.label}
                                        type="button"
                                        onClick={() => jumpTo(r.step)}
                                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-all"
                                        style={{ borderTop: '1px solid rgba(255,255,255,.08)', background: 'transparent' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <div>
                                            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#8C99E0' }}>{r.label}</div>
                                            <div className="text-xs font-bold text-white">{r.value}</div>
                                        </div>
                                        <span className="text-[9px] font-black uppercase flex items-center gap-1 shrink-0" style={{ color: '#93C5FD' }}><Pencil size={10} /> Editar</span>
                                    </button>
                                ))}
                            </div>

                            {(hasExistingPlan || balance > 0.009) && (
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest" style={{ color: '#8C99E0' }}><CreditCard size={11} /> Cronograma de cuotas</div>
                                    <PlanEditor
                                        apptId={apptId}
                                        programaCode={saleForm.programa}
                                        cuotas={saleExistingCuotas}
                                        loading={loadingSaleCuotas}
                                        selectable={false}
                                        onChanged={refreshExistingCuotas}
                                    />
                                </div>
                            )}
                        </StepShell>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3 px-6 py-4" style={{ borderTop: '1px solid rgba(255,255,255,.12)' }}>
                    <button type="button" onClick={goBack} className="h-9 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-slate-750">
                        <ArrowLeft size={12} /> {fromReview ? 'Volver al resumen' : 'Anterior'}
                    </button>
                    {step === 'review' ? (
                        <button
                            type="button"
                            onClick={handleFinalSubmit}
                            disabled={submittingSale || savingReferrals}
                            className="h-9 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {(submittingSale || savingReferrals) ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                            Registrar venta
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={goNext}
                            disabled={!canAdvance()}
                            className="h-9 px-5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                        >
                            {fromReview ? 'Guardar y volver' : 'Siguiente'} <ArrowRight size={12} />
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default DeclararVentaWizard;
