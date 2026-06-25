import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../services/api';
import { Loader2, Send, Phone, DollarSign, ArrowLeft, BarChart3, Users, TrendingUp, Target, Activity, Zap, Brain, Headphones, BarChart, ArrowLeftCircle } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import DailyReflectionSection from '../../components/reports/DailyReflectionSection';

// Componente reutilizable para inputs numéricos
const MetricInput = ({ label, field, value, onChange, color = "indigo", readOnly = false, type = "number", step, placeholder }) => {
    const isFilled = value > 0 || value !== '';
    return (
        <div className="space-y-1.5">
            {label && <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-400">{label}</label>}
            <input
                type={type}
                step={step}
                required={false}
                readOnly={readOnly}
                placeholder={placeholder}
                className={`w-full px-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-${color}-500 transition-all font-bold text-sm text-center
                    ${isFilled && !readOnly ? 'bg-slate-800 border-slate-600 text-white border' : 'bg-slate-800/50 border border-slate-700/50 text-white'}
                `}
                value={value}
                onChange={e => onChange(field, e.target.value)}
            />
        </div>
    );
};

// Seccion colapsable
const CollapsibleSection = ({ id, currentOpen, setOpen, title, icon: Icon, isComplete, children, colorClass, borderColorClass }) => {
    const isOpen = currentOpen === id;

    return (
        <div className={`bg-slate-900 border border-slate-800 shadow-xl rounded-3xl overflow-hidden transition-all duration-500 border-t-4 ${borderColorClass} relative`}>
            {isComplete && (
                <div className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full m-4 animate-pulse" title="Sección Completada" />
            )}
            <div
                className="p-5 md:p-6 cursor-pointer flex items-center justify-between select-none"
                onClick={() => setOpen(isOpen ? null : id)}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-800/50 rounded-xl">
                        <Icon className={colorClass} size={22} />
                    </div>
                    <h2 className="text-lg font-black italic tracking-tighter uppercase text-white flex items-center gap-2">
                        {title}
                        {isComplete && <span className="text-emerald-500 text-xs font-bold lowercase normal-case tracking-normal">(completado)</span>}
                    </h2>
                </div>
                <div>
                    <div className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                </div>
            </div>
            <div
                className={`transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
            >
                <div className="p-5 md:p-6 pt-0 border-t border-slate-800/50">
                    {children}
                </div>
            </div>
        </div>
    );
};

const PublicCloserReportPage = () => {
    const auth = useAuth();
    const user = auth?.user || { role: 'admin' };
    const navigate = useNavigate();
    const location = useLocation();
    const editReport = location.state?.editReport;
    const [closers, setClosers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const initialFormData = {
        closer_id: '',
        date: new Date().toISOString().split('T')[0],

        // Generales
        slots: '',
        offers_made: '',

        // Llamadas
        decision_makers: '',
        rescheduled_calls: '',

        // Primera llamada
        first_call_scheduled: '',
        first_call_attended: '',
        first_call_no_show: '',
        first_call_rescheduled: '',
        first_call_canceled: '',

        // Segunda llamada
        second_call_scheduled: '',
        second_call_attended: '',
        second_call_no_show: '',
        second_call_rescheduled: '',
        second_call_canceled: '',

        // Ventas PIF
        pif_count: '',
        pif_cash_collected: '',
        pif_in_call_count: '',
        pif_in_call_cash: '',

        // Ventas Split Pay
        split_count: '',
        split_cash_collected: '',
        split_in_call_count: '',
        split_in_call_cash: '',

        // Ventas Señas
        deposit_count: '',
        deposit_cash_collected: '',
        deposit_in_call_count: '',
        deposit_in_call_cash: '',

        // Ventas Cuotas
        installment_count: '',
        installment_cash_collected: '',
        installment_in_call_count: '',
        installment_in_call_cash: '',

        // Seguimientos
        follow_ups_sent: '',
        follow_ups_replied: '',
        follow_ups_hot_sent: '',
        follow_ups_hot_replied: '',
        follow_ups_cold_sent: '',
        follow_ups_cold_replied: '',

        // Reflexión
        reflections: {},
    };

    const [formData, setFormData] = useState(initialFormData);
    const [openSection, setOpenSection] = useState('agendas');
    const [loadingPrefill, setLoadingPrefill] = useState(false);
    const [prefilledMessage, setPrefilledMessage] = useState('');

    useEffect(() => {
        fetchClosers();
    }, []);

    useEffect(() => {
        if (editReport) return;
        
        const prefillData = async () => {
            if (!formData.closer_id || !formData.date) return;
            
            setLoadingPrefill(true);
            setPrefilledMessage('');
            try {
                const res = await api.get(`/public/closer-report/prefill?closer_id=${formData.closer_id}&date=${formData.date}`);
                
                // Mapear los datos al formulario
                setFormData(prev => {
                    const updated = { ...prev };
                    
                    const fieldsToPrefill = [
                        'decision_makers', 'rescheduled_calls',
                        'first_call_scheduled', 'first_call_attended', 'first_call_no_show', 'first_call_rescheduled', 'first_call_canceled',
                        'second_call_scheduled', 'second_call_attended', 'second_call_no_show', 'second_call_rescheduled', 'second_call_canceled',
                        
                        'pif_count', 'pif_cash_collected', 'pif_in_call_count', 'pif_in_call_cash',
                        'split_count', 'split_cash_collected', 'split_in_call_count', 'split_in_call_cash',
                        'deposit_count', 'deposit_cash_collected', 'deposit_in_call_count', 'deposit_in_call_cash',
                        'installment_count', 'installment_cash_collected', 'installment_in_call_count', 'installment_in_call_cash'
                    ];
                    
                    fieldsToPrefill.forEach(f => {
                        updated[f] = res.data[f] !== undefined ? res.data[f] : '';
                    });
                    
                    return updated;
                });
                setPrefilledMessage('Métricas de agendas y ventas del día autocompletadas correctamente.');
            } catch (err) {
                console.error("Error al prefill de reporte de closer:", err);
            } finally {
                setLoadingPrefill(false);
            }
        };
        
        prefillData();
    }, [formData.closer_id, formData.date, editReport]);

    const fetchClosers = async () => {
        setLoading(true);
        try {
            const res = await api.get('/public/active-closers');
            setClosers(res.data);
            
            // Si el usuario es closer y no estamos editando, auto-seleccionarlo
            if (user.role === 'closer' && user.id && !editReport) {
                setFormData(prev => ({ ...prev, closer_id: user.id.toString() }));
            }
        } catch (err) {
            console.error("Error fetching closers:", err);
            alert("Hubo un error cargando el formulario. Reintenta.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (editReport) {
            const newFormData = {};
            Object.keys(initialFormData).forEach(key => {
                newFormData[key] = (editReport[key] !== undefined && editReport[key] !== null) ? editReport[key] : '';
            });
            if (newFormData.closer_id) {
                newFormData.closer_id = newFormData.closer_id.toString();
            }
            newFormData.reflections = editReport.reflections || {};
            setFormData(newFormData);
        }
    }, [editReport]);

    const handleFieldChange = (field, value) => {
        // Campos monetarios aceptan decimales
        const moneyFields = ['pif_cash_collected', 'pif_in_call_cash', 'split_cash_collected', 'split_in_call_cash', 'deposit_cash_collected', 'deposit_in_call_cash', 'installment_cash_collected', 'installment_in_call_cash'];
        
        if (moneyFields.includes(field)) {
            setFormData(prev => ({ ...prev, [field]: value === '' ? '' : value }));
        } else {
            setFormData(prev => ({ ...prev, [field]: value === '' ? '' : (parseInt(value) || 0) }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.closer_id) {
            alert("Por favor, selecciona quién eres.");
            return;
        }

        // Validar que se haya enviado al menos un seguimiento
        const totalFuSent = (parseInt(formData.follow_ups_hot_sent) || 0) + (parseInt(formData.follow_ups_cold_sent) || 0);
        if (totalFuSent === 0) {
            alert('Debes hacer al menos un seguimiento. Completa la sección de Seguimientos antes de enviar.');
            setOpenSection('seguimientos');
            return;
        }

        setSubmitting(true);
        try {
            // Computar los totales de seguimiento antes de enviar
            const finalData = {
                ...formData,
                follow_ups_sent: (parseInt(formData.follow_ups_hot_sent) || 0) + (parseInt(formData.follow_ups_cold_sent) || 0),
                follow_ups_replied: (parseInt(formData.follow_ups_hot_replied) || 0) + (parseInt(formData.follow_ups_cold_replied) || 0)
            };

            if (editReport) {
                await api.put(`/public/closer-reports/${editReport.id}`, finalData);
                alert('¡Reporte actualizado correctamente!');
                navigate(-1);
            } else {
                await api.post('/public/closer-report', finalData);
                alert('¡Reporte enviado correctamente! Buen trabajo.');

                // Reset pero mantener closer y fecha
                setFormData(prev => ({
                    ...initialFormData,
                    closer_id: prev.closer_id,
                    date: prev.date,
                }));
                setOpenSection('agendas');
            }
        } catch (err) {
            alert(err.response?.data?.message || err.response?.data?.error || 'Error al enviar el reporte.');
        } finally {
            setSubmitting(false);
        }
    };

    // Calcular progreso de llenado
    const calculateProgress = () => {
        const allFields = Object.keys(initialFormData).filter(k => k !== 'closer_id' && k !== 'date');
        let filled = 0;
        allFields.forEach(field => {
            if (formData[field] !== '' && formData[field] !== null && formData[field] !== undefined) {
                filled++;
            }
        });
        const total = allFields.length + 2;
        if (formData.closer_id) filled++;
        if (formData.date) filled++;
        return Math.min(Math.round((filled / total) * 100), 100);
    };

    // Helper para verificar si una sección está completa
    const isSectionComplete = (fields) => {
        return fields.every(f => {
            const val = formData[f];
            return val !== '' && val !== null && val !== undefined;
        });
    };

    const generalFields = ['slots'];
    const llamadasFields = ['offers_made', 'decision_makers', 'rescheduled_calls'];
    const agendaFields = [
        'first_call_scheduled', 'first_call_attended', 'first_call_no_show', 'first_call_rescheduled', 'first_call_canceled',
        'second_call_scheduled', 'second_call_attended', 'second_call_no_show', 'second_call_rescheduled', 'second_call_canceled'
    ];
    const followUpsFields = ['follow_ups_hot_sent', 'follow_ups_hot_replied', 'follow_ups_cold_sent', 'follow_ups_cold_replied'];
    const salesFields = ['pif_count', 'pif_cash_collected', 'pif_in_call_count', 'pif_in_call_cash', 'split_count', 'split_cash_collected', 'split_in_call_count', 'split_in_call_cash', 'deposit_count', 'deposit_cash_collected', 'deposit_in_call_count', 'deposit_in_call_cash', 'installment_count', 'installment_cash_collected', 'installment_in_call_count', 'installment_in_call_cash'];
    const reflectionFields = ['reflections'];

    const llamadasComplete = isSectionComplete(llamadasFields);
    const agendaComplete = isSectionComplete([...generalFields, ...agendaFields]);
    const followUpsComplete = isSectionComplete(followUpsFields);
    const salesComplete = isSectionComplete(salesFields);
    const reflectionComplete = Object.keys(formData.reflections).length >= 2;

    // Auto-colapsar logica (solo una vez por sección)
    const autoAdvancedRef = useRef({ agendas: false, llamadas: false, seguimientos: false, ventas: false });

    useEffect(() => {
        if (openSection === 'agendas' && agendaComplete && !autoAdvancedRef.current.agendas) {
            autoAdvancedRef.current.agendas = true;
            setOpenSection('llamadas');
        } else if (openSection === 'llamadas' && llamadasComplete && !autoAdvancedRef.current.llamadas) {
            autoAdvancedRef.current.llamadas = true;
            setOpenSection('seguimientos');
        } else if (openSection === 'seguimientos' && followUpsComplete && !autoAdvancedRef.current.seguimientos) {
            autoAdvancedRef.current.seguimientos = true;
            setOpenSection('ventas');
        } else if (openSection === 'ventas' && salesComplete && !autoAdvancedRef.current.ventas) {
            autoAdvancedRef.current.ventas = true;
            setOpenSection('reflexion');
        }
    }, [agendaComplete, llamadasComplete, followUpsComplete, salesComplete, openSection]);

    // Métricas computadas en tiempo real para el sidebar
    const liveMetrics = useMemo(() => {
        const totalScheduled = (parseInt(formData.first_call_scheduled) || 0) + (parseInt(formData.second_call_scheduled) || 0);
        const totalAttended = (parseInt(formData.first_call_attended) || 0) + (parseInt(formData.second_call_attended) || 0);
        const totalNoShow = (parseInt(formData.first_call_no_show) || 0) + (parseInt(formData.second_call_no_show) || 0);
        const totalSales = (parseInt(formData.pif_count) || 0) + (parseInt(formData.split_count) || 0) + (parseInt(formData.deposit_count) || 0) + (parseInt(formData.installment_count) || 0);
        const totalCash = (parseFloat(formData.pif_cash_collected) || 0) + (parseFloat(formData.split_cash_collected) || 0) + (parseFloat(formData.deposit_cash_collected) || 0) + (parseFloat(formData.installment_cash_collected) || 0);
        const totalInCallSales = (parseInt(formData.pif_in_call_count) || 0) + (parseInt(formData.split_in_call_count) || 0) + (parseInt(formData.deposit_in_call_count) || 0) + (parseInt(formData.installment_in_call_count) || 0);
        const totalInCallCash = (parseFloat(formData.pif_in_call_cash) || 0) + (parseFloat(formData.split_in_call_cash) || 0) + (parseFloat(formData.deposit_in_call_cash) || 0) + (parseFloat(formData.installment_in_call_cash) || 0);
        const slots = parseInt(formData.slots) || 0;
        const offers = parseInt(formData.offers_made) || 0;
        const fuHotSent = parseInt(formData.follow_ups_hot_sent) || 0;
        const fuHotReplied = parseInt(formData.follow_ups_hot_replied) || 0;
        const fuColdSent = parseInt(formData.follow_ups_cold_sent) || 0;
        const fuColdReplied = parseInt(formData.follow_ups_cold_replied) || 0;

        const pct = (a, b) => b > 0 ? ((a / b) * 100).toFixed(1) : '0.0';

        return {
            slots,
            offers,
            totalScheduled,
            totalAttended,
            totalNoShow,
            totalSales,
            totalCash,
            totalInCallSales,
            totalInCallCash,
            showRate: pct(totalAttended, totalScheduled),
            closeRate: pct(totalSales, totalAttended),
            offerToSale: pct(totalSales, offers),
            pitchRate: pct(offers, totalAttended),
            ticketPromedio: totalSales > 0 ? (totalCash / totalSales).toFixed(0) : '0',
            inCallPct: pct(totalInCallSales, totalSales),
            fuHotRate: pct(fuHotReplied, fuHotSent),
            fuColdRate: pct(fuColdReplied, fuColdSent),
            fuHotSent,
            fuHotReplied,
            fuColdSent,
            fuColdReplied,
        };
    }, [formData]);

    // Filas de la tabla de doble entrada de agendas
    const agendaRows = [
        { label: 'Agendas', firstField: 'first_call_scheduled', secondField: 'second_call_scheduled' },
        { label: 'Asistencias', firstField: 'first_call_attended', secondField: 'second_call_attended' },
        { label: 'No Shows', firstField: 'first_call_no_show', secondField: 'second_call_no_show' },
        { label: 'Reprogramaciones', firstField: 'first_call_rescheduled', secondField: 'second_call_rescheduled' },
        { label: 'Cancelaciones', firstField: 'first_call_canceled', secondField: 'second_call_canceled' },
    ];

    // Tabla de ventas con filas y columnas
    const salesRows = [
        { label: 'PIF', countField: 'pif_count', cashField: 'pif_cash_collected', inCallField: 'pif_in_call_count', inCallCashField: 'pif_in_call_cash' },
        { label: 'Split Pay', countField: 'split_count', cashField: 'split_cash_collected', inCallField: 'split_in_call_count', inCallCashField: 'split_in_call_cash' },
        { label: 'Señas', countField: 'deposit_count', cashField: 'deposit_cash_collected', inCallField: 'deposit_in_call_count', inCallCashField: 'deposit_in_call_cash' },
        { label: 'Cuotas', countField: 'installment_count', cashField: 'installment_cash_collected', inCallField: 'installment_in_call_count', inCallCashField: 'installment_in_call_cash' },
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-4 py-12 relative overflow-hidden">
            {/* Background */}
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-violet-900/20 to-transparent pointer-events-none" />

            <div className="w-full max-w-[98%] mx-auto z-10 space-y-8">
                {/* Header */}
                <div className="text-center space-y-4 mb-2 relative">
                    <p className="text-violet-400 font-bold tracking-widest text-xs uppercase">NeurOPS High Performance</p>
                    <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        {editReport ? 'Editar Reporte Diario' : 'Reporte Diario Closer'}
                    </h1>
                    
                    <div className="flex justify-center gap-4 mt-6">
                        {editReport && (
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="flex items-center gap-2 bg-slate-900 border border-rose-950 text-rose-400 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:text-white hover:border-rose-500 hover:bg-rose-950/20 transition-all group shadow-xl cursor-pointer"
                            >
                                <ArrowLeftCircle size={16} className="group-hover:text-rose-500" />
                                Cancelar Edición
                            </button>
                        )}
                        {user.role === 'closer' && !editReport && (
                            <button
                                type="button"
                                onClick={() => navigate('/closer/stats')}
                                className="flex items-center gap-2 bg-slate-900 border border-slate-800 text-slate-400 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:text-white hover:border-violet-500 transition-all group shadow-xl cursor-pointer"
                            >
                                <BarChart3 size={16} className="group-hover:text-violet-500" />
                                Ver Mis Estadísticas
                            </button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <Loader2 className="animate-spin text-violet-500" size={48} />
                        <p className="text-slate-500 font-medium animate-pulse">Cargando módulos de reporte...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* ═══ COLUMNA 1: FORMULARIO ═══ */}
                        <div className="lg:col-span-2">
                            <form onSubmit={handleSubmit} className="space-y-8">

                                {/* Barra de progreso */}
                                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3 sticky top-4 z-50">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Progreso del Reporte</span>
                                        <span className="text-sm font-black text-violet-400">{calculateProgress()}%</span>
                                    </div>
                                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                        <div className="bg-gradient-to-r from-violet-500 to-fuchsia-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${calculateProgress()}%` }}></div>
                                    </div>
                                </div>

                                {/* Banner de Pre-llenado */}
                                {loadingPrefill && (
                                    <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl flex items-center gap-3 text-indigo-450 animate-pulse text-left">
                                        <Loader2 size={16} className="animate-spin text-indigo-400 shrink-0" />
                                        <p className="font-bold text-xs uppercase tracking-wider leading-none">Cargando métricas y ventas automáticas del día...</p>
                                    </div>
                                )}
                                {prefilledMessage && !loadingPrefill && (
                                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center gap-3 text-emerald-450 text-left animate-in fade-in slide-in-from-top-2 duration-300">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-400 shrink-0">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                        </svg>
                                        <p className="font-bold text-[10px] uppercase tracking-wider leading-none">{prefilledMessage}</p>
                                    </div>
                                )}

                                {/* Identificación */}
                                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">¿Quién eres?</label>
                                        <select
                                            required
                                            className="w-full px-5 py-3.5 bg-slate-800 border border-slate-700/80 rounded-2xl text-white outline-none focus:border-violet-500 transition-all font-bold cursor-pointer"
                                            value={formData.closer_id}
                                            onChange={e => setFormData({ ...formData, closer_id: e.target.value })}
                                        >
                                            <option value="" disabled>Selecciona tu nombre</option>
                                            {closers.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha del Informe</label>
                                        <input
                                            type="date"
                                            required
                                            className="w-full px-5 py-3.5 bg-slate-800 border border-slate-700/80 rounded-2xl text-white outline-none focus:border-violet-500 transition-all font-bold"
                                            value={formData.date}
                                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Sección Agendas */}
                                <CollapsibleSection
                                    id="agendas"
                                    currentOpen={openSection}
                                    setOpen={setOpenSection}
                                    title="Métricas de Agendas"
                                    icon={Phone}
                                    isComplete={agendaComplete}
                                    colorClass="text-emerald-500"
                                    borderColorClass="border-t-emerald-600"
                                >
                                    {/* Campos generales */}
                                    <div className="grid grid-cols-1 gap-4 mb-6 mt-2">
                                        <MetricInput
                                            label="Slots Disponibles"
                                            field="slots"
                                            color="emerald"
                                            value={formData.slots}
                                            onChange={handleFieldChange}
                                        />
                                    </div>

                                    {/* Tabla de doble entrada */}
                                    <div className="bg-slate-800/30 rounded-2xl overflow-hidden">
                                        {/* Header de la tabla */}
                                        <div className="grid grid-cols-3 gap-0">
                                            <div className="p-3 bg-slate-700/50">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400"></p>
                                            </div>
                                            <div className="p-3 text-center bg-emerald-900/30">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">1ra Llamada</p>
                                            </div>
                                            <div className="p-3 text-center bg-sky-900/30">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-sky-400">2da Llamada</p>
                                            </div>
                                        </div>

                                        {/* Filas de datos */}
                                        {agendaRows.map((row, i) => (
                                            <div key={row.label} className={`grid grid-cols-3 gap-0 ${i % 2 === 0 ? '' : 'bg-slate-800/20'}`}>
                                                <div className="p-3 flex items-center border-r border-slate-700/30">
                                                    <p className="text-xs font-bold text-slate-300">{row.label}</p>
                                                </div>
                                                <div className="p-2 border-r border-slate-700/30">
                                                    <MetricInput
                                                        field={row.firstField}
                                                        color="emerald"
                                                        value={formData[row.firstField]}
                                                        onChange={handleFieldChange}
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <div className="p-2">
                                                    <MetricInput
                                                        field={row.secondField}
                                                        color="sky"
                                                        value={formData[row.secondField]}
                                                        onChange={handleFieldChange}
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Totales en vivo */}
                                    <div className="mt-4 bg-slate-800/30 rounded-2xl p-4">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Agendas</p>
                                                <p className="text-2xl font-black text-emerald-500">
                                                    {(parseInt(formData.first_call_scheduled) || 0) + (parseInt(formData.second_call_scheduled) || 0)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Asistencias</p>
                                                <p className="text-2xl font-black text-sky-500">
                                                    {(parseInt(formData.first_call_attended) || 0) + (parseInt(formData.second_call_attended) || 0)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total No Shows</p>
                                                <p className="text-2xl font-black text-rose-500">
                                                    {(parseInt(formData.first_call_no_show) || 0) + (parseInt(formData.second_call_no_show) || 0)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Cancelaciones</p>
                                                <p className="text-2xl font-black text-amber-500">
                                                    {(parseInt(formData.first_call_canceled) || 0) + (parseInt(formData.second_call_canceled) || 0)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </CollapsibleSection>

                                {/* Llamadas */}
                                <CollapsibleSection
                                    id="llamadas"
                                    currentOpen={openSection}
                                    setOpen={setOpenSection}
                                    title="Llamadas"
                                    icon={Headphones}
                                    isComplete={llamadasComplete}
                                    colorClass="text-fuchsia-500"
                                    borderColorClass="border-t-fuchsia-600"
                                >
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 mb-4">
                                        <MetricInput
                                            label="Asistencias"
                                            field=""
                                            color="fuchsia"
                                            value={(parseInt(formData.first_call_attended) || 0) + (parseInt(formData.second_call_attended) || 0)}
                                            onChange={() => {}}
                                            isLightMode={llamadasComplete}
                                            readOnly={true}
                                        />
                                        <MetricInput
                                            label="Presentaciones"
                                            field="offers_made"
                                            color="fuchsia"
                                            value={formData.offers_made}
                                            onChange={handleFieldChange}
                                            isLightMode={llamadasComplete}
                                        />
                                        <MetricInput
                                            label="Decisores"
                                            field="decision_makers"
                                            color="fuchsia"
                                            value={formData.decision_makers}
                                            onChange={handleFieldChange}
                                            isLightMode={llamadasComplete}
                                        />
                                        <MetricInput
                                            label="Reagendados"
                                            field="rescheduled_calls"
                                            color="fuchsia"
                                            value={formData.rescheduled_calls}
                                            onChange={handleFieldChange}
                                            isLightMode={llamadasComplete}
                                        />
                                    </div>
                                </CollapsibleSection>

                                {/* Seguimientos */}
                                <CollapsibleSection
                                    id="seguimientos"
                                    currentOpen={openSection}
                                    setOpen={setOpenSection}
                                    title="Seguimientos"
                                    icon={Users}
                                    isComplete={followUpsComplete}
                                    colorClass="text-blue-500"
                                    borderColorClass="border-t-blue-600"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                                        {/* Flujo Caliente */}
                                        <div className="p-5 rounded-2xl border bg-rose-950/20 border-rose-900/50">
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">Flujo Caliente</span>
                                            </div>
                                            <div className="space-y-4">
                                                <MetricInput
                                                    label="Enviados (Hot)"
                                                    field="follow_ups_hot_sent"
                                                    color="rose"
                                                    value={formData.follow_ups_hot_sent}
                                                    onChange={handleFieldChange}
                                                    placeholder="0"
                                                />
                                                <MetricInput
                                                    label="Respondidos (Hot)"
                                                    field="follow_ups_hot_replied"
                                                    color="rose"
                                                    value={formData.follow_ups_hot_replied}
                                                    onChange={handleFieldChange}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>

                                        {/* Flujo Frío */}
                                        <div className="p-5 rounded-2xl border bg-blue-950/20 border-blue-900/50">
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Flujo Frío</span>
                                            </div>
                                            <div className="space-y-4">
                                                <MetricInput
                                                    label="Enviados (Cold)"
                                                    field="follow_ups_cold_sent"
                                                    color="blue"
                                                    value={formData.follow_ups_cold_sent}
                                                    onChange={handleFieldChange}
                                                    placeholder="0"
                                                />
                                                <MetricInput
                                                    label="Respondidos (Cold)"
                                                    field="follow_ups_cold_replied"
                                                    color="blue"
                                                    value={formData.follow_ups_cold_replied}
                                                    onChange={handleFieldChange}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 bg-slate-800/30 rounded-2xl p-4">
                                        <div className="grid grid-cols-2 gap-4 text-center">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Enviados</p>
                                                <p className="text-2xl font-black text-slate-400">
                                                    {(parseInt(formData.follow_ups_hot_sent) || 0) + (parseInt(formData.follow_ups_cold_sent) || 0)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Respondidos</p>
                                                <p className="text-2xl font-black text-blue-500">
                                                    {(parseInt(formData.follow_ups_hot_replied) || 0) + (parseInt(formData.follow_ups_cold_replied) || 0)}
                                                </p>
                                            </div>
                                        </div>
                                        {/* Advertencia si no hay seguimientos */}
                                        {((parseInt(formData.follow_ups_hot_sent) || 0) + (parseInt(formData.follow_ups_cold_sent) || 0)) === 0 && (
                                            <div className="mt-3 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
                                                <span className="text-amber-400 text-lg">⚠️</span>
                                                <p className="text-xs font-bold text-amber-400">Debes hacer al menos un seguimiento para enviar el reporte.</p>
                                            </div>
                                        )}
                                    </div>
                                </CollapsibleSection>

                                {/* Ventas */}
                                <CollapsibleSection
                                    id="ventas"
                                    currentOpen={openSection}
                                    setOpen={setOpenSection}
                                    title="Ventas"
                                    icon={DollarSign}
                                    isComplete={salesComplete}
                                    colorClass="text-amber-500"
                                    borderColorClass="border-t-amber-600"
                                >
                                    <div className="space-y-4 mt-2">
                                        {salesRows.map(row => (
                                            <div key={row.label} className="bg-slate-800/30 rounded-2xl p-4">
                                                <p className="text-xs font-black uppercase tracking-wider mb-3 text-white">{row.label}</p>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    <MetricInput
                                                        label="Cantidad"
                                                        field={row.countField}
                                                        color="amber"
                                                        value={formData[row.countField]}
                                                        onChange={handleFieldChange}
                                                    />
                                                    <MetricInput
                                                        label="Cash Collected"
                                                        field={row.cashField}
                                                        color="amber"
                                                        value={formData[row.cashField]}
                                                        onChange={handleFieldChange}
                                                        type="number"
                                                        step="0.01"
                                                    />
                                                    <MetricInput
                                                        label="En Llamada"
                                                        field={row.inCallField}
                                                        color="amber"
                                                        value={formData[row.inCallField]}
                                                        onChange={handleFieldChange}
                                                    />
                                                    <MetricInput
                                                        label="Cash En Llamada"
                                                        field={row.inCallCashField}
                                                        color="amber"
                                                        value={formData[row.inCallCashField]}
                                                        onChange={handleFieldChange}
                                                        type="number"
                                                        step="0.01"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Totales en vivo */}
                                    <div className="mt-5 bg-slate-800/30 rounded-2xl p-4">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Ventas</p>
                                                <p className="text-2xl font-black text-amber-500">
                                                    {(parseInt(formData.pif_count) || 0) + (parseInt(formData.split_count) || 0) + (parseInt(formData.deposit_count) || 0) + (parseInt(formData.installment_count) || 0)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Cash</p>
                                                <p className="text-2xl font-black text-emerald-500">
                                                    ${((parseFloat(formData.pif_cash_collected) || 0) + (parseFloat(formData.split_cash_collected) || 0) + (parseFloat(formData.deposit_cash_collected) || 0) + (parseFloat(formData.installment_cash_collected) || 0)).toLocaleString()}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">En Llamada</p>
                                                <p className="text-2xl font-black text-sky-500">
                                                    {(parseInt(formData.pif_in_call_count) || 0) + (parseInt(formData.split_in_call_count) || 0) + (parseInt(formData.deposit_in_call_count) || 0) + (parseInt(formData.installment_in_call_count) || 0)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Cash En Llamada</p>
                                                <p className="text-2xl font-black text-violet-500">
                                                    ${((parseFloat(formData.pif_in_call_cash) || 0) + (parseFloat(formData.split_in_call_cash) || 0) + (parseFloat(formData.deposit_in_call_cash) || 0) + (parseFloat(formData.installment_in_call_cash) || 0)).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </CollapsibleSection>

                                {/* Reflexión */}
                                <CollapsibleSection
                                    id="reflexion"
                                    currentOpen={openSection}
                                    setOpen={setOpenSection}
                                    title="Reflexión Diaria"
                                    icon={Brain}
                                    isComplete={reflectionComplete}
                                    colorClass="text-indigo-500"
                                    borderColorClass="border-t-indigo-600"
                                >
                                    <DailyReflectionSection
                                        role="closer"
                                        values={formData.reflections}
                                        onChange={(key, val) => setFormData(prev => ({
                                            ...prev,
                                            reflections: { ...prev.reflections, [key]: val }
                                        }))}
                                    />
                                </CollapsibleSection>


                                {/* Botón de envío */}
                                <div className="pt-4">
                                    <button
                                        type="submit"
                                        disabled={submitting || !formData.closer_id}
                                        className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-5 rounded-3xl font-black uppercase text-base tracking-[0.2em] transition-all shadow-2xl shadow-violet-600/30 flex items-center justify-center gap-3 active:scale-[0.98]"
                                    >
                                        {submitting ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                                        {submitting ? 'Procesando Envío...' : editReport ? 'GUARDAR CAMBIOS' : 'ENVIAR REPORTE AL SISTEMA'}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* ═══ COLUMNA 2: SIDEBAR DE STATS EN VIVO ═══ */}
                        <div className="lg:col-span-1">
                            <div className="sticky top-4 space-y-4">

                                {/* Mini Dashboard Header */}
                                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-500">
                                            <Activity size={16} />
                                        </div>
                                        <h3 className="text-sm font-black text-white italic tracking-tight uppercase">Live Preview</h3>
                                    </div>

                                    {/* Mini stat cards */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/50 text-center">
                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Slots</p>
                                            <p className="text-xl font-black text-violet-400 tabular-nums">{liveMetrics.slots}</p>
                                        </div>
                                        <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/50 text-center">
                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Agendas</p>
                                            <p className="text-xl font-black text-emerald-400 tabular-nums">{liveMetrics.totalScheduled}</p>
                                        </div>
                                        <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/50 text-center">
                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Ventas</p>
                                            <p className="text-xl font-black text-amber-400 tabular-nums">{liveMetrics.totalSales}</p>
                                        </div>
                                        <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/50 text-center">
                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Cash</p>
                                            <p className="text-lg font-black text-emerald-400 tabular-nums">${Number(liveMetrics.totalCash).toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Conversiones en vivo */}
                                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                                            <TrendingUp size={16} />
                                        </div>
                                        <h3 className="text-sm font-black text-white italic tracking-tight uppercase">Conversiones</h3>
                                    </div>

                                    {[
                                        { label: 'Show Rate', value: liveMetrics.showRate, color: 'emerald' },
                                        { label: 'Pitch Rate', value: liveMetrics.pitchRate, color: 'fuchsia' },
                                        { label: 'Close Rate', value: liveMetrics.closeRate, color: 'amber' },
                                        { label: 'Offer → Sale', value: liveMetrics.offerToSale, color: 'violet' },
                                    ].map(item => (
                                        <div key={item.label} className="space-y-1.5">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{item.label}</span>
                                                <span className={`text-xs font-black text-${item.color}-400 tabular-nums`}>{item.value}%</span>
                                            </div>
                                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full bg-${item.color}-500 transition-all duration-700`} style={{ width: `${Math.min(parseFloat(item.value), 100)}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Ticket y En Llamada */}
                                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                                            <DollarSign size={16} />
                                        </div>
                                        <h3 className="text-sm font-black text-white italic tracking-tight uppercase">Ventas</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Ticket Prom.</span>
                                            <span className="text-base font-black text-white tabular-nums">${Number(liveMetrics.ticketPromedio).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">En Llamada</span>
                                            <span className="text-base font-black text-sky-400 tabular-nums">{liveMetrics.totalInCallSales} ({liveMetrics.inCallPct}%)</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
                                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Cash Total</span>
                                            <span className="text-base font-black text-emerald-400 tabular-nums">${Number(liveMetrics.totalCash).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Re-engagement */}
                                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500">
                                            <Users size={16} />
                                        </div>
                                        <h3 className="text-sm font-black text-white italic tracking-tight uppercase">Re-engagement</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-rose-500/5 rounded-xl p-3 border border-rose-500/10 text-center">
                                            <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1">Hot</p>
                                            <p className="text-lg font-black text-white tabular-nums">{liveMetrics.fuHotReplied}/{liveMetrics.fuHotSent}</p>
                                            <p className="text-[9px] font-bold text-rose-400">{liveMetrics.fuHotRate}%</p>
                                        </div>
                                        <div className="bg-sky-500/5 rounded-xl p-3 border border-sky-500/10 text-center">
                                            <p className="text-[8px] font-black text-sky-400 uppercase tracking-widest mb-1">Cold</p>
                                            <p className="text-lg font-black text-white tabular-nums">{liveMetrics.fuColdReplied}/{liveMetrics.fuColdSent}</p>
                                            <p className="text-[9px] font-bold text-sky-400">{liveMetrics.fuColdRate}%</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Mini Embudo Visual */}
                                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-2 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-500">
                                            <Zap size={16} />
                                        </div>
                                        <h3 className="text-sm font-black text-white italic tracking-tight uppercase">Embudo</h3>
                                    </div>
                                    <div className="space-y-2">
                                        {[
                                            { label: 'Slots', value: liveMetrics.slots, color: 'violet', maxWidth: 100 },
                                            { label: 'Agendas', value: liveMetrics.totalScheduled, color: 'emerald', maxWidth: liveMetrics.slots > 0 ? (liveMetrics.totalScheduled / liveMetrics.slots) * 100 : 0 },
                                            { label: 'Asistencias', value: liveMetrics.totalAttended, color: 'sky', maxWidth: liveMetrics.slots > 0 ? (liveMetrics.totalAttended / liveMetrics.slots) * 100 : 0 },
                                            { label: 'Presentac.', value: liveMetrics.offers, color: 'fuchsia', maxWidth: liveMetrics.slots > 0 ? (liveMetrics.offers / liveMetrics.slots) * 100 : 0 },
                                            { label: 'Ventas', value: liveMetrics.totalSales, color: 'amber', maxWidth: liveMetrics.slots > 0 ? (liveMetrics.totalSales / liveMetrics.slots) * 100 : 0 },
                                        ].map(step => (
                                            <div key={step.label} className="flex items-center gap-3">
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest w-16 text-right shrink-0">{step.label}</span>
                                                <div className="flex-1 h-5 bg-slate-800 rounded-full overflow-hidden relative">
                                                    <div
                                                        className={`h-full rounded-full bg-${step.color}-500 transition-all duration-700 flex items-center justify-end pr-2`}
                                                        style={{ width: `${Math.max(step.maxWidth, step.value > 0 ? 12 : 0)}%` }}
                                                    >
                                                        {step.value > 0 && <span className="text-[9px] font-black text-white">{step.value}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </div>

                    </div>
                )}

                <div className="text-center pt-8">
                    <Link to="/login" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 font-medium text-sm transition-colors group">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Volver al Inicio de Sesión
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default PublicCloserReportPage;
