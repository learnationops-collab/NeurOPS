import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import {
    X, ArrowLeft, ArrowRight, CheckCircle2, Loader2, User, Instagram, Mail, Phone,
    PenTool, DollarSign, Calendar, CalendarDays, Plus, Trash2, Pencil, CreditCard
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

const cardStyle = (active) =>
    `w-full text-left p-4 rounded-2xl border transition-all cursor-pointer ${
        active
            ? 'bg-gradient-to-r from-violet-600/25 to-fuchsia-600/10 border-violet-500 shadow-lg shadow-violet-500/10'
            : 'bg-slate-800/50 border-slate-750 hover:border-slate-600'
    }`;

function StepShell({ eyebrow, title, hint, children, counter, segments }) {
    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-center gap-1.5">
                {segments.map((s, k) => (
                    <div
                        key={k}
                        className="flex-1 h-1 rounded-full"
                        style={{ background: s === 'done' ? '#8B5CF6' : s === 'now' ? 'linear-gradient(90deg,#7C3AED,#EC4899)' : 'rgba(255,255,255,.08)' }}
                    />
                ))}
            </div>
            <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-violet-400 uppercase tracking-widest">{eyebrow}</span>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{counter}</span>
            </div>
            <div className="space-y-1">
                <h4 className="text-xl font-black text-white tracking-tight">{title}</h4>
                {hint && <p className="text-[11px] text-slate-450 font-semibold">{hint}</p>}
            </div>
            <div className="pt-1">{children}</div>
        </div>
    );
}

function FieldTag({ prefilled }) {
    return prefilled ? (
        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">✓ Traído de la agenda</span>
    ) : (
        <span className="text-[9px] font-black text-fuchsia-400 uppercase tracking-widest">● Este lo cargás vos</span>
    );
}

function TextField({ icon: Icon, value, onChange, placeholder, type = 'text', prefilled }) {
    return (
        <div className="space-y-2">
            <div className="relative">
                {Icon && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><Icon size={15} /></span>}
                <input
                    type={type}
                    value={value || ''}
                    onChange={onChange}
                    placeholder={placeholder}
                    autoFocus
                    className={`w-full bg-slate-800/80 border border-slate-700 rounded-2xl ${Icon ? 'pl-11' : 'pl-4'} pr-4 py-3.5 text-sm font-bold text-white placeholder-slate-600 outline-none focus:border-violet-500 transition-all`}
                />
            </div>
            <FieldTag prefilled={prefilled} />
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
        return <div className="flex justify-center py-4"><Loader2 className="animate-spin text-violet-400" size={18} /></div>;
    }

    return (
        <div className="space-y-2">
            <div className="rounded-2xl border border-slate-800 overflow-hidden">
                <table className="w-full text-xs">
                    <thead className="bg-slate-950/60">
                        <tr>
                            {selectable && <th className="w-8" />}
                            <th className="text-left px-3 py-2 text-[9px] font-black text-slate-500 uppercase">Cuota</th>
                            <th className="text-left px-3 py-2 text-[9px] font-black text-slate-500 uppercase">Monto</th>
                            <th className="text-left px-3 py-2 text-[9px] font-black text-slate-500 uppercase">Vence</th>
                            <th className="text-left px-3 py-2 text-[9px] font-black text-slate-500 uppercase">Estado</th>
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
                                    className={`border-t border-slate-850 ${selectable && !isPagado ? 'cursor-pointer hover:bg-slate-900/40' : ''} ${isSelected ? 'bg-violet-500/10' : ''}`}
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
                                            className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-1 text-[11px] font-bold text-slate-200 outline-none focus:border-violet-500"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input
                                            type="date"
                                            defaultValue={c.fecha_vencimiento}
                                            disabled={busy}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => e.target.value && patchCuota(c.id, { fecha_vencimiento: e.target.value })}
                                            className="bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-1 text-[10px] font-bold text-slate-200 outline-none focus:border-violet-500"
                                        />
                                    </td>
                                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                        <select
                                            value={c.estado}
                                            disabled={busy}
                                            onChange={(e) => patchCuota(c.id, { estado: e.target.value })}
                                            className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border bg-transparent cursor-pointer ${
                                                isPagado ? 'text-emerald-400 border-emerald-500/30' :
                                                isVencida ? 'text-rose-400 border-rose-500/30' :
                                                'text-amber-400 border-amber-500/30'
                                            }`}
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
                                            className="p-1 text-slate-500 hover:text-rose-400 transition-all"
                                            title="Borrar cuota"
                                        >
                                            {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {cuotas.length === 0 && (
                            <tr><td colSpan={selectable ? 5 : 4} className="px-3 py-4 text-center text-[10px] text-slate-500 font-bold uppercase">Sin cuotas cargadas</td></tr>
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
                    className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-200 outline-none focus:border-violet-500"
                />
                <input
                    type="date"
                    value={newCuota.fecha_vencimiento}
                    onChange={(e) => setNewCuota((p) => ({ ...p, fecha_vencimiento: e.target.value }))}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-200 outline-none focus:border-violet-500"
                />
                <button
                    type="button"
                    onClick={addCuota}
                    disabled={adding || !newCuota.monto}
                    className="h-8 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[9px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1 disabled:opacity-40"
                >
                    {adding ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                    Agregar cuota
                </button>
            </div>
            <p className="text-[9px] text-slate-550 font-medium">
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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[2rem] shadow-[0_0_100px_rgba(0,0,0,0.6)] relative overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 pt-6">
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Declarar Venta</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">{saleForm.nombre_cliente || 'Nuevo cliente'}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                        <X size={14} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5">
                    {step === 'name' && (
                        <StepShell eyebrow="Cliente" title="¿Quién compró?" hint="Vino de la agenda. Confirmá que esté bien escrito." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <TextField icon={User} value={saleForm.nombre_cliente} onChange={(e) => set('nombre_cliente', e.target.value)} placeholder="Nombre y apellido" prefilled={!!saleForm.nombre_cliente} />
                        </StepShell>
                    )}
                    {step === 'instagram' && (
                        <StepShell eyebrow="Cliente" title="¿Su Instagram?" hint="Sin arroba. Se usa para el seguimiento por DM." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <TextField icon={Instagram} value={saleForm.instagram} onChange={(e) => set('instagram', e.target.value.replace(/@/g, ''))} placeholder="usuario" prefilled={!!saleForm.instagram} />
                        </StepShell>
                    )}
                    {step === 'email' && (
                        <StepShell eyebrow="Cliente" title="¿Su email?" hint="Acá le llega el acceso al programa." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <TextField icon={Mail} type="email" value={saleForm.mail_cliente} onChange={(e) => set('mail_cliente', e.target.value)} placeholder="nombre@mail.com" prefilled={!!saleForm.mail_cliente} />
                        </StepShell>
                    )}
                    {step === 'phone' && (
                        <StepShell eyebrow="Cliente" title="¿Teléfono?" hint="Con código de país, para WhatsApp." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <TextField icon={Phone} value={saleForm.telefono} onChange={(e) => set('telefono', e.target.value)} placeholder="+54 9 11 ..." prefilled={!!saleForm.telefono} />
                        </StepShell>
                    )}
                    {step === 'document' && (
                        <StepShell eyebrow="Cliente" title="¿Documento de identidad?" hint="DNI, NIE o pasaporte. Es el único dato que tenés que tipear." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <TextField icon={PenTool} value={saleForm.documento_identidad} onChange={(e) => set('documento_identidad', e.target.value)} placeholder="Ingresá el documento" prefilled={false} />
                        </StepShell>
                    )}
                    {step === 'closer' && (
                        <StepShell eyebrow="Cliente" title="¿A quién se le atribuye?" hint="La comisión va a este correo." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <div className="space-y-2">
                                {(teamMembers || []).filter((m) => m.role === 'closer').map((m) => (
                                    <button key={m.id} type="button" className={cardStyle(saleForm.email_vendedor === m.email)} onClick={() => set('email_vendedor', m.email)}>
                                        <div className="font-black text-white text-sm">{m.username}</div>
                                        <div className="text-[10px] text-slate-450 font-semibold">{m.email}</div>
                                    </button>
                                ))}
                            </div>
                        </StepShell>
                    )}
                    {step === 'program' && (
                        <StepShell eyebrow="Transacción" title="¿Qué programa compró?" counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <div className="space-y-2">
                                {PROGRAMS.map((p) => (
                                    <button key={p.v} type="button" className={cardStyle(saleForm.programa === p.v)} onClick={() => { set('programa', p.v); setTimeout(goNext, 120); }}>
                                        <div className="font-black text-white text-sm">{p.label}</div>
                                        <div className="text-[10px] text-slate-450 font-semibold">{p.hint}</div>
                                    </button>
                                ))}
                            </div>
                        </StepShell>
                    )}
                    {step === 'clientSummary' && (
                        <StepShell eyebrow="Transacción" title="Así viene este cliente" hint="Ya tiene pagos registrados en este programa — el resto del flujo se ajusta solo." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            {loadingSaleState ? (
                                <div className="flex justify-center py-6"><Loader2 className="animate-spin text-violet-400" size={20} /></div>
                            ) : saleClientState ? (
                                <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-2xl space-y-1.5">
                                    <div className="flex justify-between text-xs"><span className="text-slate-400 font-bold uppercase">Pagó</span><b className="text-white">{money(saleClientState.total_paid)} / {money(saleClientState.program_price)}</b></div>
                                    <div className="flex justify-between text-xs"><span className="text-slate-400 font-bold uppercase">Saldo</span><b className="text-fuchsia-400">{money(saleClientState.balance_remaining)}</b></div>
                                    <div className="flex justify-between text-xs"><span className="text-slate-400 font-bold uppercase">Ventas registradas</span><b className="text-white">{saleClientState.sales_count}</b></div>
                                </div>
                            ) : null}
                        </StepShell>
                    )}
                    {step === 'paymentType' && (
                        <StepShell eyebrow="Transacción" title="¿Cómo paga?" counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            {loadingSaleState ? (
                                <div className="flex justify-center py-6"><Loader2 className="animate-spin text-violet-400" size={20} /></div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2.5">
                                    {PAYMENT_TYPES.map((opt) => {
                                        const r = saleClientState?.allowed_types?.[opt.key];
                                        const disabled = r ? !r.ok : false;
                                        return (
                                            <button
                                                key={opt.v}
                                                type="button"
                                                disabled={disabled}
                                                title={disabled ? r.reason : undefined}
                                                className={`${cardStyle(saleForm.tipo_pago_simple === opt.v)} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                onClick={() => { if (!disabled) { set('tipo_pago_simple', opt.v); setTimeout(goNext, 120); } }}
                                            >
                                                <div className="font-black text-white text-xs">{opt.label}</div>
                                                <div className="text-[9px] text-slate-450 font-semibold">{opt.hint}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {rule && !rule.ok && <p className="text-[10px] text-rose-400 font-bold mt-2">{rule.reason}</p>}
                            {['Renovacion', 'Upsell'].includes(saleForm.tipo_pago_simple) && saleClientState?.can_settle_balance_with_installment && (
                                <label className="flex items-center gap-2 mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] font-bold text-amber-300 uppercase cursor-pointer">
                                    <input type="checkbox" checked={settleBalanceWithSale} onChange={(e) => setSettleBalanceWithSale(e.target.checked)} className="rounded" />
                                    Liquidar el saldo pendiente ({money(saleClientState.balance_remaining)}) junto con esta venta
                                </label>
                            )}
                        </StepShell>
                    )}
                    {step === 'amounts' && (
                        <StepShell eyebrow="Transacción" title="Precio total y cuánto cobrás hoy" hint="El saldo se calcula solo." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Precio total</label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><DollarSign size={13} /></span>
                                        <input type="number" step="0.01" value={saleForm.precio_total} onChange={(e) => set('precio_total', e.target.value)} className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold text-white outline-none focus:border-violet-500" placeholder="0.00" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Cobrado hoy</label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><DollarSign size={13} /></span>
                                        <input type="number" step="0.01" value={saleForm.monto} onChange={(e) => set('monto', e.target.value)} className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold text-white outline-none focus:border-violet-500" placeholder="0.00" />
                                    </div>
                                </div>
                            </div>
                            <div className="mt-3 p-3 bg-slate-950/50 border border-slate-800 rounded-xl flex justify-between items-center">
                                <span className="text-[9px] font-black text-slate-500 uppercase">Saldo a financiar</span>
                                <span className="text-lg font-black text-fuchsia-400">{money(balance)}</span>
                            </div>
                        </StepShell>
                    )}
                    {step === 'method' && (
                        <StepShell eyebrow="Transacción" title="¿Por dónde entró la plata?" counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <div className="grid grid-cols-2 gap-2.5">
                                {METHODS.map((m) => (
                                    <button key={m} type="button" className={cardStyle(saleForm.metodo_pago === m)} onClick={() => set('metodo_pago', m)}>
                                        <div className="font-black text-white text-xs">{m}</div>
                                    </button>
                                ))}
                            </div>
                            {saleForm.tipo_pago_simple === 'completo' && (
                                <div className="mt-3 space-y-1">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Monto cobrado</label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><DollarSign size={13} /></span>
                                        <input type="number" step="0.01" value={saleForm.monto} onChange={(e) => set('monto', e.target.value)} className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold text-white outline-none focus:border-violet-500" placeholder="0.00" />
                                    </div>
                                </div>
                            )}
                            <input
                                type="text"
                                value={saleForm.segundo_pago || ''}
                                onChange={(e) => set('segundo_pago', e.target.value)}
                                placeholder="Comentario del cobro (opcional)"
                                className="w-full mt-3 bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-violet-500"
                            />
                        </StepShell>
                    )}
                    {step === 'pickCuota' && (
                        <StepShell eyebrow="Cuotas" title="¿Cuál cuota se está pagando?" hint="Elegí cualquier pendiente — podés adelantar una futura o pagar una vencida." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
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
                        <StepShell eyebrow="Cuotas" title={`Te deben ${money(balance)}. ¿En cuántas cuotas?`} hint="Después definís cuándo se cobran." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <div className="flex items-center justify-between">
                                <button type="button" onClick={() => set('num_cuotas', Math.max(1, (saleForm.num_cuotas || 1) - 1))} className="w-11 h-11 rounded-full border border-slate-700 text-slate-300 font-black text-lg">−</button>
                                <span className="text-3xl font-black text-white">{saleForm.num_cuotas}</span>
                                <button type="button" onClick={() => set('num_cuotas', Math.min(12, (saleForm.num_cuotas || 1) + 1))} className="w-11 h-11 rounded-full bg-violet-600 text-white font-black text-lg">+</button>
                                <div className="text-right">
                                    <div className="text-[9px] font-black text-slate-500 uppercase">Cada cuota</div>
                                    <div className="text-emerald-400 font-black">{money(balance / Math.max(1, saleForm.num_cuotas || 1))}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-2 mt-4">
                                {[2, 3, 4, 6].map((k) => (
                                    <button key={k} type="button" onClick={() => set('num_cuotas', k)} className={`h-9 rounded-full text-[11px] font-black ${saleForm.num_cuotas === k ? 'bg-violet-600 text-white' : 'bg-slate-800/60 text-slate-300 border border-slate-750'}`}>{k}</button>
                                ))}
                            </div>
                        </StepShell>
                    )}
                    {step === 'installmentMode' && (
                        <StepShell eyebrow="Cuotas" title="¿El pago es mensual?" hint="Si es mensual solo elegís el día y el resto se calcula solo." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <div className="space-y-2">
                                <button type="button" className={cardStyle(installmentMode === 'monthly')} onClick={() => { setInstallmentMode('monthly'); setTimeout(goNext, 120); }}>
                                    <div className="font-black text-white text-sm">Sí, todos los meses el mismo día</div>
                                    <div className="text-[10px] text-slate-450 font-semibold">elegís un día y listo</div>
                                </button>
                                <button type="button" className={cardStyle(installmentMode === 'custom')} onClick={() => { setInstallmentMode('custom'); setTimeout(goNext, 120); }}>
                                    <div className="font-black text-white text-sm">No, fechas distintas</div>
                                    <div className="text-[10px] text-slate-450 font-semibold">cargás cada fecha a mano</div>
                                </button>
                            </div>
                        </StepShell>
                    )}
                    {step === 'installmentDay' && (
                        <StepShell eyebrow="Cuotas" title="¿Qué día de cada mes paga?" hint="Si el mes no tiene ese día, se cobra el último." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <div className="grid grid-cols-7 gap-1.5">
                                {Array.from({ length: 31 }, (_, k) => k + 1).map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        onClick={() => {
                                            setPayDay(n);
                                            const dates = monthlyDates(saleForm.num_cuotas || 1, n);
                                            const map = {};
                                            dates.forEach((d, idx) => { map[idx + 1] = d; });
                                            set('cuotaFechas', map);
                                        }}
                                        className={`h-9 rounded-lg text-[11px] font-black tabular-nums ${payDay === n ? 'bg-violet-600 text-white' : 'bg-slate-800/60 text-slate-300 border border-slate-750'}`}
                                    >{n}</button>
                                ))}
                            </div>
                            <div className="mt-3 p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-[10px] text-slate-400 font-semibold">
                                {monthlyDates(saleForm.num_cuotas || 1, payDay).map((d, k) => `Cuota ${k + 1} · ${money(balance / (saleForm.num_cuotas || 1))} · ${prettyDate(d)}`).join('   ·   ')}
                            </div>
                        </StepShell>
                    )}
                    {step === 'installmentDates' && (
                        <StepShell eyebrow="Cuotas" title="¿Cuándo cobrás cada cuota?" hint="Estas fechas son las que te van a aparecer en seguimientos." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <div className="space-y-2">
                                {Array.from({ length: saleForm.num_cuotas || 1 }, (_, k) => k + 1).map((n) => {
                                    const each = balance / (saleForm.num_cuotas || 1);
                                    const current = saleForm.cuotaFechas?.[n] || toISO(addMonths(new Date(), n));
                                    return (
                                        <div key={n} className="flex items-center gap-3 p-3 bg-slate-800/40 border border-slate-750 rounded-xl">
                                            <span className="text-xs font-black text-white w-16">Cuota {n}</span>
                                            <span className="text-xs font-bold text-slate-300 w-20">{money(each)}</span>
                                            <input
                                                type="date"
                                                value={current}
                                                onChange={(e) => set('cuotaFechas', { ...saleForm.cuotaFechas, [n]: e.target.value })}
                                                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-200 outline-none focus:border-violet-500"
                                            />
                                            <button type="button" onClick={() => set('cuotaFechas', { ...saleForm.cuotaFechas, [n]: toISO(addDays(parseISO(current), -7)) })} className="text-slate-500 hover:text-white px-1">-7d</button>
                                            <button type="button" onClick={() => set('cuotaFechas', { ...saleForm.cuotaFechas, [n]: toISO(addDays(parseISO(current), 7)) })} className="text-slate-500 hover:text-white px-1">+7d</button>
                                        </div>
                                    );
                                })}
                            </div>
                        </StepShell>
                    )}
                    {step === 'exam' && (
                        <StepShell eyebrow="Cierre" title="¿Qué examen rinde?" hint="Define el grupo y el contenido que recibe." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <TextField icon={PenTool} value={saleForm.examen_lead} onChange={(e) => set('examen_lead', e.target.value)} placeholder="ej. USMLE Step 1" prefilled={!!saleForm.examen_lead} />
                        </StepShell>
                    )}
                    {step === 'saleMeta' && (
                        <StepShell eyebrow="Cierre" title="¿Cuándo se cerró?" hint="Y si la firma fue dentro de la llamada." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Fecha de la venta</label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><Calendar size={13} /></span>
                                        <input type="date" value={saleForm.date} onChange={(e) => set('date', e.target.value)} className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold text-white outline-none focus:border-violet-500" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">¿Cerró en llamada?</label>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <button type="button" onClick={() => set('sold_in_call', true)} className={`h-[38px] rounded-xl text-[10px] font-black uppercase ${saleForm.sold_in_call ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400' : 'bg-slate-800/50 border border-slate-750 text-slate-400'}`}>✓ Sí, Meet</button>
                                        <button type="button" onClick={() => set('sold_in_call', false)} className={`h-[38px] rounded-xl text-[10px] font-black uppercase ${!saleForm.sold_in_call ? 'bg-rose-500/20 border border-rose-500 text-rose-400' : 'bg-slate-800/50 border border-slate-750 text-slate-400'}`}>× No, fuera</button>
                                    </div>
                                </div>
                            </div>
                        </StepShell>
                    )}
                    {step === 'estado' && (
                        <StepShell eyebrow="Cierre" title="¿Estado de la venta?" counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <div className="space-y-2">
                                {[
                                    { v: 'Completada', hint: 'todo en orden' },
                                    { v: 'Pendiente', hint: 'falta algo para cerrarla' },
                                    { v: 'Cancelada', hint: 'no va a concretarse' }
                                ].map((o) => (
                                    <button key={o.v} type="button" className={cardStyle(saleForm.estado === o.v)} onClick={() => { set('estado', o.v); setTimeout(goNext, 120); }}>
                                        <div className="font-black text-white text-sm">{o.v}</div>
                                        <div className="text-[10px] text-slate-450 font-semibold">{o.hint}</div>
                                    </button>
                                ))}
                            </div>
                        </StepShell>
                    )}
                    {step === 'notas' && (
                        <StepShell eyebrow="Cierre" title="Notas u observaciones" hint="Opcional — objeciones, detalles del cierre, lo que sirva después." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <textarea
                                value={saleForm.notas || ''}
                                onChange={(e) => set('notas', e.target.value)}
                                placeholder="Detalles sobre el cierre, objeciones vencidas, etc..."
                                className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl px-4 py-3 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-violet-500 min-h-[90px] resize-none"
                            />
                        </StepShell>
                    )}
                    {step === 'referralAsked' && (
                        <StepShell eyebrow="Cierre" title="¿Le pediste un referido?" hint="El mejor momento para pedirlo ya pasó. Contá qué salió." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <div className="space-y-2">
                                {[
                                    { v: 'got', label: 'Sí le pedí y me dio', hint: 'cargamos los contactos' },
                                    { v: 'asked', label: 'Sí le pedí, no me dio', hint: 'queda registrado igual' },
                                    { v: 'no', label: 'No le pedí', hint: 'sin drama, la próxima' }
                                ].map((o) => (
                                    <button key={o.v} type="button" className={cardStyle(saleForm.referralAsked === o.v)} onClick={() => { set('referralAsked', o.v); setTimeout(goNext, 120); }}>
                                        <div className="font-black text-white text-sm">{o.label}</div>
                                        <div className="text-[10px] text-slate-450 font-semibold">{o.hint}</div>
                                    </button>
                                ))}
                            </div>
                        </StepShell>
                    )}
                    {step === 'referralCount' && (
                        <StepShell eyebrow="Cierre" title="¿Cuántos referidos te dio?" hint="Cada uno vale una llamada nueva." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <div className="flex items-center justify-between">
                                <button type="button" onClick={() => set('referralCount', Math.max(1, (saleForm.referralCount || 1) - 1))} className="w-11 h-11 rounded-full border border-slate-700 text-slate-300 font-black text-lg">−</button>
                                <span className="text-3xl font-black text-white">{saleForm.referralCount || 1}</span>
                                <button type="button" onClick={() => set('referralCount', Math.min(5, (saleForm.referralCount || 1) + 1))} className="w-11 h-11 rounded-full bg-violet-600 text-white font-black text-lg">+</button>
                            </div>
                        </StepShell>
                    )}
                    {step === 'referralWhen' && (
                        <StepShell eyebrow="Cierre" title="¿Los cargás ahora o después?" hint="Si es después quedan como tarea en tu bandeja." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <div className="grid grid-cols-2 gap-2.5">
                                <button type="button" className={cardStyle(saleForm.referralWhen === 'now')} onClick={() => { set('referralWhen', 'now'); setTimeout(goNext, 120); }}>
                                    <div className="font-black text-white text-sm">Cargar ahora</div>
                                    <div className="text-[10px] text-slate-450 font-semibold">nombre y número de cada uno</div>
                                </button>
                                <button type="button" className={cardStyle(saleForm.referralWhen === 'later')} onClick={() => { set('referralWhen', 'later'); setTimeout(goNext, 120); }}>
                                    <div className="font-black text-white text-sm">Después</div>
                                    <div className="text-[10px] text-slate-450 font-semibold">va a pendientes</div>
                                </button>
                            </div>
                        </StepShell>
                    )}
                    {step === 'referralContacts' && (
                        <StepShell eyebrow="Cierre" title="Nombre y número de cada referido" hint="Con esto ya quedan agendados. Sin esto no existen." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <div className="space-y-2">
                                {referralContacts.map((c, k) => (
                                    <div key={k} className="flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-fuchsia-500/20 text-fuchsia-300 text-[10px] font-black flex items-center justify-center shrink-0">{k + 1}</span>
                                        <input
                                            type="text"
                                            value={c.name}
                                            onChange={(e) => setReferralContacts((prev) => prev.map((r, j) => (j === k ? { ...r, name: e.target.value } : r)))}
                                            placeholder="Nombre del referido"
                                            className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-violet-500"
                                        />
                                        <input
                                            type="text"
                                            value={c.phone}
                                            onChange={(e) => setReferralContacts((prev) => prev.map((r, j) => (j === k ? { ...r, phone: e.target.value } : r)))}
                                            placeholder="+54 9 ..."
                                            className="w-32 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-violet-500"
                                        />
                                    </div>
                                ))}
                            </div>
                            <p className="text-[9px] text-slate-550 font-medium mt-2">Cada referido cargado entra a la bandeja del closer que corresponda como llamada nueva.</p>
                        </StepShell>
                    )}
                    {step === 'review' && (
                        <StepShell eyebrow="Cierre" title="Revisá y registrá" hint="Si algo está mal, tocá 'editar' y corregilo ahí mismo." counter={`Paso ${i + 1} de ${path.length}`} segments={segments}>
                            <div className="rounded-2xl border border-slate-800 divide-y divide-slate-850 overflow-hidden">
                                {[
                                    { label: 'Cliente', value: `${saleForm.nombre_cliente} · ${saleForm.examen_lead || 'sin examen'}`, step: 'name' },
                                    { label: 'Programa', value: `${PROGRAMS.find((p) => p.v === saleForm.programa)?.label} · ${PAYMENT_TYPES.find((t) => t.v === saleForm.tipo_pago_simple)?.label}`, step: 'program' },
                                    { label: 'Cobrado hoy', value: `${money(saleForm.monto)} por ${saleForm.metodo_pago}`, step: 'method' },
                                    { label: 'Saldo', value: balance > 0.009 ? money(balance) : 'sin saldo', step: 'amounts' },
                                    { label: 'Referidos', value: saleForm.referralAsked === 'got' ? `${saleForm.referralCount} referidos` : saleForm.referralAsked === 'asked' ? 'pedido, sin dar' : 'no se pidió', step: 'referralAsked' },
                                    { label: 'Fecha', value: `${saleForm.date}${saleForm.sold_in_call ? ' · en llamada' : ' · fuera de llamada'}`, step: 'saleMeta' }
                                ].map((r) => (
                                    <button key={r.label} type="button" onClick={() => jumpTo(r.step)} className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-850/60 transition-all text-left">
                                        <div>
                                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{r.label}</div>
                                            <div className="text-xs font-bold text-white">{r.value}</div>
                                        </div>
                                        <span className="text-[9px] font-black text-violet-400 uppercase flex items-center gap-1 shrink-0"><Pencil size={10} /> Editar</span>
                                    </button>
                                ))}
                            </div>

                            {(hasExistingPlan || balance > 0.009) && (
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest"><CreditCard size={11} /> Cronograma de cuotas</div>
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

                <div className="flex items-center justify-between gap-3 px-6 py-5 border-t border-slate-800">
                    <button type="button" onClick={goBack} className="h-10 px-4 bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1.5 border border-slate-750">
                        <ArrowLeft size={12} /> {fromReview ? 'Volver al resumen' : 'Anterior'}
                    </button>
                    {step === 'review' ? (
                        <button
                            type="button"
                            onClick={handleFinalSubmit}
                            disabled={submittingSale || savingReferrals}
                            className="h-10 px-6 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1.5 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                        >
                            {(submittingSale || savingReferrals) ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                            Registrar venta
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={goNext}
                            disabled={!canAdvance()}
                            className="h-10 px-6 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1.5 disabled:opacity-40"
                        >
                            {fromReview ? 'Guardar y volver' : 'Siguiente'} <ArrowRight size={12} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DeclararVentaWizard;
