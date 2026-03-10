import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Send, Phone, DollarSign, ArrowLeft, BarChart3, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

// Componente reutilizable para inputs numéricos
const MetricInput = ({ label, field, value, onChange, color = "indigo", readOnly = false, isLightMode = false, type = "number", step, placeholder }) => {
    const isFilled = value > 0 || value !== '';
    return (
        <div className="space-y-1.5">
            {label && <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>{label}</label>}
            <input
                type={type}
                step={step}
                required={false}
                readOnly={readOnly}
                placeholder={placeholder}
                className={`w-full px-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-${color}-500 transition-all font-bold text-sm text-center
                    ${isLightMode
                        ? (isFilled && !readOnly ? 'bg-white border-slate-200 text-slate-900 border shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-900 border shadow-inner')
                        : (isFilled && !readOnly ? 'bg-slate-800 border-slate-600 text-white border' : 'bg-slate-800/50 border border-slate-700/50 text-white')
                    }`}
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
        <div className={`${isComplete ? 'bg-slate-200 border-slate-300 shadow-md' : 'bg-slate-900 border-slate-800 shadow-xl'} border rounded-3xl overflow-hidden transition-all duration-500 border-t-4 ${borderColorClass}`}>
            <div
                className="p-5 md:p-6 cursor-pointer flex items-center justify-between select-none"
                onClick={() => setOpen(isOpen ? null : id)}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 ${isComplete ? 'bg-slate-100 text-slate-700' : 'bg-slate-800/50'} rounded-xl`}>
                        <Icon className={colorClass} size={22} />
                    </div>
                    <h2 className={`text-lg font-black italic tracking-tighter uppercase ${isComplete ? 'text-slate-800' : 'text-white'}`}>{title}</h2>
                </div>
                <div>
                    <div className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isComplete ? "text-slate-500" : "text-slate-400"}><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                </div>
            </div>
            <div
                className={`transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
            >
                <div className={`p-5 md:p-6 pt-0 ${isComplete ? 'border-t border-slate-300/50' : 'border-t border-slate-800/50'}`}>
                    {children}
                </div>
            </div>
        </div>
    );
};

const PublicCloserReportPage = () => {
    const [closers, setClosers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const initialFormData = {
        closer_id: '',
        date: new Date().toISOString().split('T')[0],

        // Generales
        slots: '',
        offers_made: '',

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

        // Seguimientos
        follow_ups_sent: '',
        follow_ups_replied: '',
        follow_ups_hot_sent: '',
        follow_ups_hot_replied: '',
        follow_ups_cold_sent: '',
        follow_ups_cold_replied: '',
    };

    const [formData, setFormData] = useState(initialFormData);
    const [openSection, setOpenSection] = useState('agendas');

    useEffect(() => {
        fetchClosers();
    }, []);

    const fetchClosers = async () => {
        setLoading(true);
        try {
            const res = await api.get('/public/active-closers');
            setClosers(res.data);
        } catch (err) {
            console.error("Error fetching closers:", err);
            alert("Hubo un error cargando el formulario. Reintenta.");
        } finally {
            setLoading(false);
        }
    };

    const handleFieldChange = (field, value) => {
        // Campos monetarios aceptan decimales
        const moneyFields = ['pif_cash_collected', 'pif_in_call_cash', 'split_cash_collected', 'split_in_call_cash', 'deposit_cash_collected', 'deposit_in_call_cash'];
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

        setSubmitting(true);
        try {
            // Computar los totales de seguimiento antes de enviar
            const finalData = {
                ...formData,
                follow_ups_sent: (parseInt(formData.follow_ups_hot_sent) || 0) + (parseInt(formData.follow_ups_cold_sent) || 0),
                follow_ups_replied: (parseInt(formData.follow_ups_hot_replied) || 0) + (parseInt(formData.follow_ups_cold_replied) || 0)
            };

            await api.post('/public/closer-report', finalData);
            alert('¡Reporte enviado correctamente! Buen trabajo.');

            // Reset pero mantener closer y fecha
            setFormData(prev => ({
                ...initialFormData,
                closer_id: prev.closer_id,
                date: prev.date,
            }));
            setOpenSection('agendas');
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

    const generalFields = ['slots', 'offers_made'];
    const agendaFields = [
        'first_call_scheduled', 'first_call_attended', 'first_call_no_show', 'first_call_rescheduled', 'first_call_canceled',
        'second_call_scheduled', 'second_call_attended', 'second_call_no_show', 'second_call_rescheduled', 'second_call_canceled'
    ];
    const followUpsFields = ['follow_ups_hot_sent', 'follow_ups_hot_replied', 'follow_ups_cold_sent', 'follow_ups_cold_replied'];
    const salesFields = ['pif_count', 'pif_cash_collected', 'pif_in_call_count', 'pif_in_call_cash', 'split_count', 'split_cash_collected', 'split_in_call_count', 'split_in_call_cash', 'deposit_count', 'deposit_cash_collected', 'deposit_in_call_count', 'deposit_in_call_cash'];

    const agendaComplete = isSectionComplete([...generalFields, ...agendaFields]);
    const followUpsComplete = isSectionComplete(followUpsFields);
    const salesComplete = isSectionComplete(salesFields);

    // Auto-colapsar logica
    useEffect(() => {
        if (openSection === 'agendas' && agendaComplete) {
            setOpenSection('seguimientos');
        } else if (openSection === 'seguimientos' && followUpsComplete) {
            setOpenSection('ventas');
        }
    }, [agendaComplete, followUpsComplete, openSection]);

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
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-4 py-12 relative overflow-hidden">
            {/* Background */}
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-violet-900/20 to-transparent pointer-events-none" />

            <div className="w-full max-w-4xl z-10 space-y-8">
                {/* Header */}
                <div className="text-center space-y-4 mb-2">
                    <p className="text-violet-400 font-bold tracking-widest text-xs uppercase">NeurOPS High Performance</p>
                    <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                        Reporte Diario Closer
                    </h1>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <Loader2 className="animate-spin text-violet-500" size={48} />
                        <p className="text-slate-500 font-medium animate-pulse">Cargando módulos de reporte...</p>
                    </div>
                ) : (
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
                            <div className="grid grid-cols-2 gap-4 mb-6 mt-2">
                                <MetricInput
                                    label="Slots Disponibles"
                                    field="slots"
                                    color="emerald"
                                    value={formData.slots}
                                    onChange={handleFieldChange}
                                    isLightMode={agendaComplete}
                                />
                                <MetricInput
                                    label="Ofertas Hechas"
                                    field="offers_made"
                                    color="emerald"
                                    value={formData.offers_made}
                                    onChange={handleFieldChange}
                                    isLightMode={agendaComplete}
                                />
                            </div>

                            {/* Tabla de doble entrada */}
                            <div className={`${agendaComplete ? 'bg-white/60' : 'bg-slate-800/30'} rounded-2xl overflow-hidden transition-colors duration-500`}>
                                {/* Header de la tabla */}
                                <div className="grid grid-cols-3 gap-0">
                                    <div className={`p-3 ${agendaComplete ? 'bg-slate-200' : 'bg-slate-700/50'}`}>
                                        <p className={`text-[10px] font-black uppercase tracking-wider ${agendaComplete ? 'text-slate-500' : 'text-slate-400'}`}></p>
                                    </div>
                                    <div className={`p-3 text-center ${agendaComplete ? 'bg-emerald-100' : 'bg-emerald-900/30'}`}>
                                        <p className={`text-[10px] font-black uppercase tracking-wider ${agendaComplete ? 'text-emerald-700' : 'text-emerald-400'}`}>1ra Llamada</p>
                                    </div>
                                    <div className={`p-3 text-center ${agendaComplete ? 'bg-sky-100' : 'bg-sky-900/30'}`}>
                                        <p className={`text-[10px] font-black uppercase tracking-wider ${agendaComplete ? 'text-sky-700' : 'text-sky-400'}`}>2da Llamada</p>
                                    </div>
                                </div>

                                {/* Filas de datos */}
                                {agendaRows.map((row, i) => (
                                    <div key={row.label} className={`grid grid-cols-3 gap-0 ${i % 2 === 0 ? '' : (agendaComplete ? 'bg-slate-100/50' : 'bg-slate-800/20')}`}>
                                        <div className={`p-3 flex items-center ${agendaComplete ? 'border-r border-slate-200' : 'border-r border-slate-700/30'}`}>
                                            <p className={`text-xs font-bold ${agendaComplete ? 'text-slate-700' : 'text-slate-300'}`}>{row.label}</p>
                                        </div>
                                        <div className={`p-2 ${agendaComplete ? 'border-r border-slate-200' : 'border-r border-slate-700/30'}`}>
                                            <MetricInput
                                                field={row.firstField}
                                                color="emerald"
                                                value={formData[row.firstField]}
                                                onChange={handleFieldChange}
                                                isLightMode={agendaComplete}
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="p-2">
                                            <MetricInput
                                                field={row.secondField}
                                                color="sky"
                                                value={formData[row.secondField]}
                                                onChange={handleFieldChange}
                                                isLightMode={agendaComplete}
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Totales en vivo */}
                            <div className={`mt-4 ${agendaComplete ? 'bg-white/60' : 'bg-slate-800/30'} rounded-2xl p-4 transition-colors duration-500`}>
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
                                <div className={`p-5 rounded-2xl border ${followUpsComplete ? 'bg-white/60 border-rose-200' : 'bg-rose-950/20 border-rose-900/50'}`}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${followUpsComplete ? 'text-rose-600' : 'text-rose-400'}`}>Flujo Caliente</span>
                                    </div>
                                    <div className="space-y-4">
                                        <MetricInput
                                            label="Enviados (Hot)"
                                            field="follow_ups_hot_sent"
                                            color="rose"
                                            value={formData.follow_ups_hot_sent}
                                            onChange={handleFieldChange}
                                            isLightMode={followUpsComplete}
                                            placeholder="0"
                                        />
                                        <MetricInput
                                            label="Respondidos (Hot)"
                                            field="follow_ups_hot_replied"
                                            color="rose"
                                            value={formData.follow_ups_hot_replied}
                                            onChange={handleFieldChange}
                                            isLightMode={followUpsComplete}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                {/* Flujo Frío */}
                                <div className={`p-5 rounded-2xl border ${followUpsComplete ? 'bg-white/60 border-blue-200' : 'bg-blue-950/20 border-blue-900/50'}`}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${followUpsComplete ? 'text-blue-600' : 'text-blue-400'}`}>Flujo Frío</span>
                                    </div>
                                    <div className="space-y-4">
                                        <MetricInput
                                            label="Enviados (Cold)"
                                            field="follow_ups_cold_sent"
                                            color="blue"
                                            value={formData.follow_ups_cold_sent}
                                            onChange={handleFieldChange}
                                            isLightMode={followUpsComplete}
                                            placeholder="0"
                                        />
                                        <MetricInput
                                            label="Respondidos (Cold)"
                                            field="follow_ups_cold_replied"
                                            color="blue"
                                            value={formData.follow_ups_cold_replied}
                                            onChange={handleFieldChange}
                                            isLightMode={followUpsComplete}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={`mt-4 ${followUpsComplete ? 'bg-white/60' : 'bg-slate-800/30'} rounded-2xl p-4 transition-colors duration-500`}>
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
                                    <div key={row.label} className={`${salesComplete ? 'bg-white/60' : 'bg-slate-800/30'} rounded-2xl p-4 transition-colors duration-500`}>
                                        <p className={`text-xs font-black uppercase tracking-wider mb-3 ${salesComplete ? 'text-slate-700' : 'text-white'}`}>{row.label}</p>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            <MetricInput
                                                label="Cantidad"
                                                field={row.countField}
                                                color="amber"
                                                value={formData[row.countField]}
                                                onChange={handleFieldChange}
                                                isLightMode={salesComplete}
                                            />
                                            <MetricInput
                                                label="Cash Collected"
                                                field={row.cashField}
                                                color="amber"
                                                value={formData[row.cashField]}
                                                onChange={handleFieldChange}
                                                isLightMode={salesComplete}
                                                type="number"
                                                step="0.01"
                                            />
                                            <MetricInput
                                                label="En Llamada"
                                                field={row.inCallField}
                                                color="amber"
                                                value={formData[row.inCallField]}
                                                onChange={handleFieldChange}
                                                isLightMode={salesComplete}
                                            />
                                            <MetricInput
                                                label="Cash En Llamada"
                                                field={row.inCallCashField}
                                                color="amber"
                                                value={formData[row.inCallCashField]}
                                                onChange={handleFieldChange}
                                                isLightMode={salesComplete}
                                                type="number"
                                                step="0.01"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Totales en vivo */}
                            <div className={`mt-5 ${salesComplete ? 'bg-white/60' : 'bg-slate-800/30'} rounded-2xl p-4 transition-colors duration-500`}>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Ventas</p>
                                        <p className="text-2xl font-black text-amber-500">
                                            {(parseInt(formData.pif_count) || 0) + (parseInt(formData.split_count) || 0) + (parseInt(formData.deposit_count) || 0)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Cash</p>
                                        <p className="text-2xl font-black text-emerald-500">
                                            ${((parseFloat(formData.pif_cash_collected) || 0) + (parseFloat(formData.split_cash_collected) || 0) + (parseFloat(formData.deposit_cash_collected) || 0)).toLocaleString()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">En Llamada</p>
                                        <p className="text-2xl font-black text-sky-500">
                                            {(parseInt(formData.pif_in_call_count) || 0) + (parseInt(formData.split_in_call_count) || 0) + (parseInt(formData.deposit_in_call_count) || 0)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Cash En Llamada</p>
                                        <p className="text-2xl font-black text-violet-500">
                                            ${((parseFloat(formData.pif_in_call_cash) || 0) + (parseFloat(formData.split_in_call_cash) || 0) + (parseFloat(formData.deposit_in_call_cash) || 0)).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CollapsibleSection>

                        {/* Botón de envío */}
                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={submitting || !formData.closer_id}
                                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-5 rounded-3xl font-black uppercase text-base tracking-[0.2em] transition-all shadow-2xl shadow-violet-600/30 flex items-center justify-center gap-3 active:scale-[0.98]"
                            >
                                {submitting ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                                {submitting ? 'Procesando Envío...' : 'ENVIAR REPORTE AL SISTEMA'}
                            </button>
                        </div>
                    </form>
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
