import { useState, useEffect, useCallback } from 'react';
import { Loader2, ChevronDown, ChevronUp, Save, DollarSign, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { parseUtcIso } from '../../../utils/datetime';

const CLOSER_RESULT_OPTIONS = [
    'Pendiente', 'Show up', 'No Show', 'Cancelado', 'Reagendado', '2da call', 'Lead Perdido'
];
const PAYMENT_STATUS_OPTIONS = ['completed', 'pending', 'failed'];

const currentMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatDate = (iso) => {
    if (!iso) return 'Sin fecha';
    const d = parseUtcIso(iso) || new Date(iso);
    if (!d || isNaN(d.getTime())) return 'Sin fecha';
    return d.toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Fila de una agenda: muestra estado/fechas y permite editarlas inline (reutiliza los mismos
// endpoints que ya usa el flujo normal del closer — PATCH para la fecha, /process para el estado).
const AppointmentRow = ({ appt, onSaved }) => {
    const [editing, setEditing] = useState(false);
    const [status, setStatus] = useState(appt.closer_result || 'Pendiente');
    const [dateStr, setDateStr] = useState(appt.start_time ? appt.start_time.slice(0, 16) : '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            if (dateStr && dateStr !== (appt.start_time ? appt.start_time.slice(0, 16) : '')) {
                await api.patch(`/closer/appointments/${appt.id}`, { start_time: new Date(dateStr).toISOString() });
            }
            if (status !== appt.closer_result) {
                await api.post(`/closer/appointments/${appt.id}/process`, { status, role: 'closer' });
            }
            toast.success('Agenda actualizada');
            setEditing(false);
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo actualizar la agenda');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-3 py-2 px-3 bg-slate-950/40 rounded-xl border border-slate-800 text-xs">
            <CalendarDays size={14} className="text-slate-500 shrink-0" />
            {editing ? (
                <>
                    <input
                        type="datetime-local"
                        value={dateStr}
                        onChange={(e) => setDateStr(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
                    />
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
                    >
                        {CLOSER_RESULT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                    <button onClick={handleSave} disabled={saving} className="ml-auto px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold disabled:opacity-50 flex items-center gap-1">
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
                    </button>
                    <button onClick={() => setEditing(false)} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold">Cancelar</button>
                </>
            ) : (
                <>
                    <span className="text-slate-300">Reunión: {formatDate(appt.start_time)}</span>
                    <span className="text-slate-500">· Creada: {formatDate(appt.created_at)}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 font-bold">{appt.closer_result || 'Pendiente'}</span>
                    <button onClick={() => setEditing(true)} className="ml-auto text-primary hover:underline font-bold">Editar</button>
                </>
            )}
        </div>
    );
};

// Fila de un pago: monto/fecha/estado editables reutilizando PUT /closer/payments/<id>.
const PaymentRow = ({ payment, onSaved }) => {
    const [editing, setEditing] = useState(false);
    const [amount, setAmount] = useState(payment.amount ?? 0);
    const [status, setStatus] = useState(payment.status || 'completed');
    const [dateStr, setDateStr] = useState(payment.date ? payment.date.slice(0, 16) : '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put(`/closer/payments/${payment.id}`, {
                amount: Number(amount),
                status,
                date: dateStr ? new Date(dateStr).toISOString() : undefined
            });
            toast.success('Pago actualizado');
            setEditing(false);
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo actualizar el pago');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-3 py-2 px-3 bg-slate-950/40 rounded-xl border border-slate-800 text-xs">
            <DollarSign size={14} className="text-emerald-500 shrink-0" />
            {editing ? (
                <>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white w-24"
                    />
                    <input
                        type="datetime-local"
                        value={dateStr}
                        onChange={(e) => setDateStr(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
                    />
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
                    >
                        {PAYMENT_STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                    <button onClick={handleSave} disabled={saving} className="ml-auto px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold disabled:opacity-50 flex items-center gap-1">
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
                    </button>
                    <button onClick={() => setEditing(false)} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold">Cancelar</button>
                </>
            ) : (
                <>
                    <span className="text-slate-300 font-bold">${payment.amount?.toLocaleString() ?? 0}</span>
                    <span className="text-slate-500">· {formatDate(payment.date)}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 font-bold">{payment.status}</span>
                    {payment.payment_type && <span className="text-slate-500">({payment.payment_type})</span>}
                    <button onClick={() => setEditing(true)} className="ml-auto text-primary hover:underline font-bold">Editar</button>
                </>
            )}
        </div>
    );
};

const LeadCard = ({ lead, onSaved }) => {
    const [open, setOpen] = useState(false);

    return (
        <div className="bg-surface border border-base rounded-2xl overflow-hidden">
            <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-4 p-4 text-left">
                <div>
                    <p className="font-black text-base text-sm">{lead.full_name}</p>
                    <p className="text-xs text-muted">{lead.email || 'Sin correo'} · {lead.phone || 'Sin teléfono'}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                    <span>{lead.appointments.length} agenda(s)</span>
                    <span>{lead.payments.length} pago(s)</span>
                    {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </button>
            {open && (
                <div className="p-4 pt-0 space-y-4">
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted">Agendas</p>
                        {lead.appointments.length === 0 && <p className="text-xs text-muted">Sin agendas registradas.</p>}
                        {lead.appointments.map(a => <AppointmentRow key={a.id} appt={a} onSaved={onSaved} />)}
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted">Pagos</p>
                        {lead.payments.length === 0 && <p className="text-xs text-muted">Sin pagos registrados.</p>}
                        {lead.payments.map(p => <PaymentRow key={p.id} payment={p} onSaved={onSaved} />)}
                    </div>
                </div>
            )}
        </div>
    );
};

const CloserLeadsAudit = ({ embedded = false }) => {
    const [month, setMonth] = useState(currentMonth());
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [forbidden, setForbidden] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setForbidden(false);
        try {
            const res = await api.get('/closer/leads-audit', { params: { month } });
            setLeads(res.data?.leads || []);
        } catch (err) {
            if (err.response?.status === 403) {
                setForbidden(true);
            } else {
                toast.error('No se pudo cargar la auditoría de leads');
            }
        } finally {
            setLoading(false);
        }
    }, [month]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const minHeightClass = embedded ? 'min-h-[60vh]' : 'min-h-screen';

    if (forbidden) {
        return (
            <div className={`flex flex-col items-center justify-center ${minHeightClass} gap-3 text-center`}>
                <p className="text-muted">La auditoría de leads no está activa en este momento.</p>
                <p className="text-xs text-muted">Operaciones desactivó esta pestaña — hablá con tu líder si la necesitás de nuevo.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tighter text-base">🗂️ Auditoría de Leads</h1>
                    <p className="text-xs text-muted mt-1">Revisá y actualizá el estado de tus agendas y pagos del mes.</p>
                </div>
                <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm"
                />
            </header>

            {loading ? (
                <div className={`flex items-center justify-center ${minHeightClass}`}>
                    <Loader2 className="animate-spin text-primary" size={40} />
                </div>
            ) : leads.length === 0 ? (
                <p className="text-muted text-sm">No tenés leads con agendas en este mes.</p>
            ) : (
                <div className="space-y-3">
                    {leads.map(lead => <LeadCard key={lead.client_id} lead={lead} onSaved={fetchData} />)}
                </div>
            )}
        </div>
    );
};

export default CloserLeadsAudit;
