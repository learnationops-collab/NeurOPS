import { useState, useEffect } from 'react';
import { Loader2, X, Save, Check, DollarSign } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');

const CUOTA_ESTADO_CLS = {
    vencido: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    pendiente: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    pagado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
};

const CuotaRow = ({ cuota, client, vendedorEmail, onSaved }) => {
    const [fecha, setFecha] = useState(cuota.fecha_vencimiento || '');
    const [saving, setSaving] = useState(false);
    const [marking, setMarking] = useState(false);
    const dirty = fecha !== (cuota.fecha_vencimiento || '');

    const patch = async (payload, setFlag) => {
        setFlag(true);
        try {
            const res = await api.patch(`/closer/installments/cuota/${cuota.id}`, payload);
            onSaved(res.data);
        } catch (err) {
            console.error('Error al actualizar cuota:', err);
        } finally {
            setFlag(false);
        }
    };

    // Marcar una cuota como pagada tiene que reportarse igual que cualquier otra venta —
    // mismo POST /sheets/push?tabla=Ventas_DB que usa "Declarar Venta" (crea el FinancialSale
    // local y dispara el webhook de n8n hacia Discord), en el mismo orden: primero se reporta
    // la venta, y solo si eso funciona se marca la cuota como pagada.
    const markAsPaid = async () => {
        setMarking(true);
        try {
            const payload = {
                email_vendedor: vendedorEmail || '',
                nombre_cliente: client?.full_name || '',
                telefono: client?.phone || '',
                mail_cliente: client?.email || '',
                tipo_pago: `${client?.programa_code || 'RR'} - Cuota`,
                monto: cuota.monto,
                segundo_pago: `Cuota ${cuota.numero_cuota}`,
                metodo_pago: 'Stripe',
                examen: '',
                instagram: client?.instagram ? client.instagram.replace(/@/g, '').trim() : '',
                estado: 'Completada',
                setter: '',
                documento_identidad: '',
                marca_temporal: new Date().toLocaleString('es-ES'),
                enviar_webhook: true,
                enviar_mensaje: true,
                sold_in_call: false
            };
            const res = await api.post('/sheets/push?tabla=Ventas_DB', payload);
            if (res.data?.status !== 'success') {
                console.error('No se pudo reportar el pago de la cuota:', res.data);
                setMarking(false);
                return;
            }
        } catch (err) {
            console.error('Error al reportar el pago de la cuota:', err);
            setMarking(false);
            return;
        }
        await patch({ estado: 'pagado' }, setMarking);
    };

    return (
        <div className="flex items-center justify-between gap-3 text-[10px] bg-slate-950/40 border border-slate-800 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${CUOTA_ESTADO_CLS[cuota.estado] || CUOTA_ESTADO_CLS.pendiente}`}>
                    {cuota.estado}
                </span>
                <span className="text-slate-300">Cuota {cuota.numero_cuota}</span>
                <span className="text-emerald-400 font-bold">{money(cuota.monto)}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <input
                    type="date"
                    value={fecha || ''}
                    disabled={cuota.estado === 'pagado'}
                    onChange={(e) => setFecha(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-200 disabled:opacity-50"
                />
                {dirty && (
                    <button
                        onClick={() => patch({ fecha_vencimiento: fecha }, setSaving)}
                        disabled={saving}
                        title="Guardar nueva fecha"
                        className="p-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 cursor-pointer"
                    >
                        {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                    </button>
                )}
                {cuota.estado !== 'pagado' && (
                    <button
                        onClick={markAsPaid}
                        disabled={marking}
                        title="Marcar cuota como pagada (reporta a Discord vía n8n, igual que una venta)"
                        className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 cursor-pointer"
                    >
                        {marking ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    </button>
                )}
            </div>
        </div>
    );
};

// Cuando un cliente debe dinero pero nunca tuvo un InstallmentPlan armado (el Parcial se
// declaró sin pasar por el armador de cronograma del modal de venta — el caso más común en
// ventas históricas), acá se puede crear uno directamente sobre el saldo pendiente real.
const defaultCuotaDate = (i) => {
    const d = new Date();
    d.setMonth(d.getMonth() + i + 1);
    return d.toISOString().slice(0, 10);
};

const CreatePlanForm = ({ deuda, appointmentId, programaCode, onCreated }) => {
    const [numCuotas, setNumCuotas] = useState(3);
    const [fechas, setFechas] = useState({});
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    const crear = async () => {
        setCreating(true);
        setError('');
        try {
            const fechasList = Array.from({ length: numCuotas }, (_, i) => fechas[i] || null);
            const res = await api.post('/closer/installments', {
                appointment_id: appointmentId,
                total: deuda,
                cobrado_hoy: 0,
                num_cuotas: numCuotas,
                fechas: fechasList,
                programa_code: programaCode
            });
            onCreated(res.data.cuotas);
        } catch (err) {
            setError(err.response?.data?.error || 'Error al crear el plan de cuotas');
        } finally {
            setCreating(false);
        }
    };

    const cadaUna = deuda / (numCuotas || 1);

    return (
        <div className="bg-slate-950/40 border border-amber-500/20 rounded-lg p-3 space-y-2">
            <p className="text-[10px] text-amber-300 font-bold">
                Debe {money(deuda)} y no tiene plan de cuotas armado — se puede repartir ese saldo en cuotas ahora, eligiendo cuándo cobrar cada una.
            </p>
            <div className="flex items-center gap-2">
                <label className="text-[9px] text-slate-500 font-bold uppercase">Cuotas</label>
                <input
                    type="number"
                    min="1"
                    max="12"
                    value={numCuotas}
                    onChange={(e) => setNumCuotas(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-14 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-200"
                />
                <span className="text-[9px] text-slate-500">de {money(cadaUna)} cada una</span>
            </div>
            <div className="space-y-1">
                {Array.from({ length: numCuotas }, (_, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                        <span className="text-slate-400 w-16">Cuota {i + 1}</span>
                        <input
                            type="date"
                            value={fechas[i] || defaultCuotaDate(i)}
                            onChange={(e) => setFechas(prev => ({ ...prev, [i]: e.target.value }))}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-200"
                        />
                    </div>
                ))}
            </div>
            <button
                onClick={crear}
                disabled={creating || !appointmentId}
                title={!appointmentId ? 'Este cliente no tiene ninguna agenda registrada' : 'Crear plan de cuotas'}
                className="px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-black uppercase disabled:opacity-50 cursor-pointer"
            >
                {creating ? <Loader2 size={11} className="animate-spin" /> : 'Crear plan'}
            </button>
            {error && <p className="text-[9px] text-rose-400 font-bold">{error}</p>}
        </div>
    );
};

const CONTACT_OUTCOME_LABELS = {
    no_resp: 'No respondió',
    contesto: 'Contestó',
    agendo: 'Agendó',
    cerro: 'Cerró la venta',
    pago: 'Pagó'
};

// Programar un seguimiento próximo directamente desde el resumen del cliente, sin tener que
// pasar por el árbol de decisión completo de una llamada — para cuando el closer ya sabe
// cuándo quiere volver a contactar a este cliente y no hay ninguna cita puntual que procesar.
const AddFollowUpForm = ({ appointmentId, onCreated }) => {
    const [fecha, setFecha] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 3);
        return d.toISOString().slice(0, 10);
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const programar = async () => {
        if (!appointmentId) return;
        setSaving(true);
        setError('');
        try {
            const res = await api.post(`/closer/deck/${appointmentId}`, {
                fecha_seguimiento: fecha,
                seguimiento_tipo: 'tomada',
                seguimiento_sub: 'Seguimiento manual desde historial',
                seguimiento_intento: 1,
                seguimiento_realizado: false
            });
            onCreated(fecha);
        } catch (err) {
            setError(err.response?.data?.message || 'Error al programar el seguimiento');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-slate-950/40 border border-violet-500/20 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
                <label className="text-[9px] text-slate-500 font-bold uppercase">Próximo contacto</label>
                <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-200"
                />
                <button
                    onClick={programar}
                    disabled={saving || !appointmentId}
                    title={!appointmentId ? 'Este cliente no tiene ninguna agenda registrada' : 'Programar seguimiento'}
                    className="px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-black uppercase disabled:opacity-50 cursor-pointer"
                >
                    {saving ? <Loader2 size={11} className="animate-spin" /> : 'Programar seguimiento'}
                </button>
            </div>
            {error && <p className="text-[9px] text-rose-400 font-bold">{error}</p>}
        </div>
    );
};

// Resumen de un cliente (agendas, ventas, inscripciones/pagos) en una sola vista — reutilizado
// desde la cola de limpieza y desde la búsqueda global del mazo del closer, para que cualquier
// closer pueda consultar (y confirmar) el historial completo de cualquier cliente sin tener que
// abrir cada agenda por separado.
const ClientHistoryModal = ({ clientId, onClose, onOpenAppointment, onRegisterSale }) => {
    const { user } = useAuth();
    const [history, setHistory] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        api.get(`/closer/clients/${clientId}/full-history`)
            .then(res => setHistory(res.data))
            .catch(err => console.error('Error al cargar historial del cliente:', err))
            .finally(() => setLoading(false));
    }, [clientId]);

    const mostRecentAppointmentId = history?.appointments?.[0]?.id || null;
    const seguimientosPorHacer = (history?.appointments || []).filter(a => a.fecha_seguimiento && !a.seguimiento_realizado);
    const seguimientosHechos = (history?.appointments || []).filter(a => a.seguimiento_realizado || a.last_contact_at);

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-[2rem] p-6 space-y-5">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-black text-white uppercase italic tracking-tight truncate">
                        {history?.client?.full_name || 'Historial del cliente'}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                        {onRegisterSale && history?.client && (
                            <button
                                onClick={() => onRegisterSale(history.client, mostRecentAppointmentId)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                            >
                                <DollarSign size={12} /> Registrar venta / pago
                            </button>
                        )}
                        <button onClick={onClose} className="text-slate-500 hover:text-white cursor-pointer"><X size={20} /></button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-violet-400" size={28} /></div>
                ) : !history ? (
                    <p className="text-slate-500 text-xs font-bold uppercase">No se pudo cargar el historial.</p>
                ) : (
                    <div className="space-y-5 text-left">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide space-x-3">
                            <span>{history.client.email || 'sin email'}</span>
                            <span>@{history.client.instagram || 'sin ig'}</span>
                            <span>{history.client.phone || 'sin teléfono'}</span>
                        </div>

                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Agendas ({history.appointments.length})</h4>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                {history.appointments.length === 0 && <p className="text-[10px] text-slate-600">Sin agendas registradas.</p>}
                                {history.appointments.map(a => (
                                    <div
                                        key={a.id}
                                        onClick={() => onOpenAppointment && onOpenAppointment(a.id)}
                                        className={`flex justify-between text-[10px] bg-slate-950/40 border border-slate-800 rounded-lg px-3 py-2 ${onOpenAppointment ? 'cursor-pointer hover:border-violet-500/40 hover:bg-slate-900/60 transition-all' : ''}`}
                                    >
                                        <span className="text-slate-300">{a.start_time ? new Date(a.start_time).toLocaleDateString('es-ES') : '—'} · {a.origin || 'Sin origen'}</span>
                                        <span className="text-slate-500 font-bold uppercase">{a.closer_result || a.result || 'Pendiente'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Seguimientos</h4>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Por hacer ({seguimientosPorHacer.length})</p>
                                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                                        {seguimientosPorHacer.length === 0 && <p className="text-[10px] text-slate-600">Sin seguimientos pendientes.</p>}
                                        {seguimientosPorHacer.map(a => (
                                            <div
                                                key={a.id}
                                                onClick={() => onOpenAppointment && onOpenAppointment(a.id)}
                                                className={`flex justify-between text-[10px] bg-slate-950/40 border border-amber-500/20 rounded-lg px-3 py-2 ${onOpenAppointment ? 'cursor-pointer hover:border-amber-500/40 hover:bg-slate-900/60 transition-all' : ''}`}
                                            >
                                                <span className="text-slate-300">Próximo contacto: {a.fecha_seguimiento}</span>
                                                <span className="text-amber-400 font-bold uppercase">{a.seguimiento_sub || a.seguimiento_tipo || 'Pendiente'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Hechos ({seguimientosHechos.length})</p>
                                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                                        {seguimientosHechos.length === 0 && <p className="text-[10px] text-slate-600">Sin seguimientos realizados todavía.</p>}
                                        {seguimientosHechos.map(a => (
                                            <div key={a.id} className="flex justify-between text-[10px] bg-slate-950/40 border border-emerald-500/20 rounded-lg px-3 py-2">
                                                <span className="text-slate-300">{a.last_contact_at ? new Date(a.last_contact_at).toLocaleDateString('es-ES') : '—'}</span>
                                                <span className="text-emerald-400 font-bold uppercase">{CONTACT_OUTCOME_LABELS[a.last_contact_outcome] || (a.seguimiento_realizado ? 'Cerrado' : 'Contactado')}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <AddFollowUpForm
                                    appointmentId={mostRecentAppointmentId}
                                    onCreated={(fecha) => setHistory(prev => ({
                                        ...prev,
                                        appointments: prev.appointments.map(a => a.id === mostRecentAppointmentId
                                            ? { ...a, fecha_seguimiento: fecha, seguimiento_realizado: false }
                                            : a)
                                    }))}
                                />
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Cuotas por cobrar ({history.installments.length})</h4>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {history.installments.length === 0 && (
                                    (history.client.deuda || 0) > 0.01 ? (
                                        <CreatePlanForm
                                            deuda={history.client.deuda}
                                            appointmentId={mostRecentAppointmentId}
                                            programaCode={history.client.programa_code}
                                            onCreated={(cuotas) => setHistory(prev => ({ ...prev, installments: cuotas }))}
                                        />
                                    ) : (
                                        <p className="text-[10px] text-slate-600">Sin plan de cuotas registrado.</p>
                                    )
                                )}
                                {history.installments.map(c => (
                                    <CuotaRow
                                        key={c.id}
                                        cuota={c}
                                        client={history.client}
                                        vendedorEmail={user?.email}
                                        onSaved={(updated) => setHistory(prev => ({
                                            ...prev,
                                            installments: prev.installments.map(i => i.id === updated.id ? updated : i)
                                        }))}
                                    />
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Ventas declaradas ({history.financial_sales.length})</h4>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                {history.financial_sales.length === 0 && <p className="text-[10px] text-slate-600">Sin ventas registradas.</p>}
                                {history.financial_sales.map(s => (
                                    <div key={s.id} className="flex justify-between text-[10px] bg-slate-950/40 border border-slate-800 rounded-lg px-3 py-2">
                                        <span className="text-slate-300">{s.date ? new Date(s.date).toLocaleDateString('es-ES') : '—'} · {s.tipo_pago}</span>
                                        <span className="text-emerald-400 font-bold">{money(s.monto)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Inscripciones y pagos ({history.enrollments.length})</h4>
                            {history.enrollments.length === 0 && <p className="text-[10px] text-slate-600">Sin inscripciones registradas.</p>}
                            {history.enrollments.map(e => (
                                <div key={e.id} className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 mb-2">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-300 mb-1.5">
                                        <span>{e.program || 'Programa desconocido'}</span>
                                        <span>{money(e.total_paid)} de {money(e.program_price)}</span>
                                    </div>
                                    <div className="space-y-1">
                                        {e.payments.map(p => (
                                            <div key={p.id} className="flex justify-between text-[9px] text-slate-500">
                                                <span>{p.payment_type} · {p.status}</span>
                                                <span>{money(p.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientHistoryModal;
