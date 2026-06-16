import React, { useState, useEffect } from 'react';
import { 
    Plus, 
    Edit, 
    Trash2, 
    Bell, 
    Globe, 
    Check, 
    X, 
    Settings, 
    Info, 
    HelpCircle,
    ChevronRight,
    ToggleLeft,
    ToggleRight,
    Send
} from 'lucide-react';
import api from '../../../services/api';
import toast from 'react-hot-toast';

const AlertRulesConfig = ({ stats, refreshStats }) => {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showDrawer, setShowDrawer] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [showDiscordModal, setShowDiscordModal] = useState(false);
    const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
    const [testingDiscord, setTestingDiscord] = useState(false);
    const [testing, setTesting] = useState(false);

    // Form states
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [metric, setMetric] = useState('cpl');
    const [condition, setCondition] = useState('>');
    const [value, setValue] = useState('');
    const [period, setPeriod] = useState('7_days');
    const [scopeType, setScopeType] = useState('all');
    const [scopeValue, setScopeValue] = useState('');
    const [severity, setSeverity] = useState('critical');
    const [notifyPlatform, setNotifyPlatform] = useState(true);
    const [notifyDiscord, setNotifyDiscord] = useState(false);
    const [isActive, setIsActive] = useState(true);

    const loadRules = async () => {
        setLoading(true);
        try {
            const res = await api.get('/alerts/rules');
            setRules(res.data || []);
        } catch (err) {
            console.error("Error al cargar reglas:", err);
            toast.error("Error al cargar reglas de alerta");
        } finally {
            setLoading(false);
        }
    };

    const loadDiscordConfig = async () => {
        try {
            const res = await api.get('/alerts/discord-config');
            setDiscordWebhookUrl(res.data.webhook_url || '');
        } catch (err) {
            console.error("Error al cargar configuración de Discord:", err);
        }
    };

    useEffect(() => {
        loadRules();
        loadDiscordConfig();
    }, []);

    const resetForm = () => {
        setEditingRule(null);
        setName('');
        setDescription('');
        setMetric('cpl');
        setCondition('>');
        setValue('');
        setPeriod('7_days');
        setScopeType('all');
        setScopeValue('');
        setSeverity('critical');
        setNotifyPlatform(true);
        setNotifyDiscord(false);
        setIsActive(true);
    };

    const handleOpenCreate = () => {
        resetForm();
        setShowDrawer(true);
    };

    const handleOpenEdit = (rule) => {
        setEditingRule(rule);
        setName(rule.name);
        setDescription(rule.description || '');
        setMetric(rule.metric);
        setCondition(rule.condition);
        setValue(rule.value.toString());
        setPeriod(rule.period);
        setScopeType(rule.scope_type);
        setScopeValue(rule.scope_value || '');
        setSeverity(rule.severity);
        setNotifyPlatform(rule.notify_platform);
        setNotifyDiscord(rule.notify_discord);
        setIsActive(rule.is_active);
        setShowDrawer(true);
    };

    const handleSaveRule = async (e) => {
        e.preventDefault();
        if (!name || !value) {
            toast.error("El nombre y el valor límite son requeridos");
            return;
        }

        const payload = {
            name,
            description,
            metric,
            condition,
            value: parseFloat(value),
            period,
            scope_type: scopeType,
            scope_value: scopeType === 'all' ? '' : scopeValue,
            severity,
            notify_platform: notifyPlatform,
            notify_discord: notifyDiscord,
            is_active: isActive
        };

        try {
            if (editingRule) {
                await api.put(`/alerts/rules/${editingRule.id}`, payload);
                toast.success("Regla de alerta actualizada con éxito");
            } else {
                await api.post('/alerts/rules', payload);
                toast.success("Regla de alerta creada con éxito");
            }
            setShowDrawer(false);
            resetForm();
            loadRules();
            refreshStats();
        } catch (err) {
            console.error("Error al guardar regla:", err);
            toast.error(err.response?.data?.message || "Error al guardar regla");
        }
    };

    const handleDeleteRule = async (ruleId) => {
        if (!window.confirm("¿Estás seguro de que deseas eliminar esta regla de alerta?")) return;
        try {
            await api.delete(`/alerts/rules/${ruleId}`);
            toast.success("Regla eliminada");
            loadRules();
            refreshStats();
        } catch (err) {
            console.error("Error al eliminar regla:", err);
            toast.error("Error al eliminar regla");
        }
    };

    const handleToggleActive = async (rule) => {
        try {
            const updated = !rule.is_active;
            await api.put(`/alerts/rules/${rule.id}`, { is_active: updated });
            setRules(rules.map(r => r.id === rule.id ? { ...r, is_active: updated } : r));
            toast.success(`Regla ${updated ? 'activada' : 'desactivada'}`);
            refreshStats();
        } catch (err) {
            console.error("Error al cambiar estado de regla:", err);
            toast.error("Error al actualizar estado");
        }
    };

    const handleSaveDiscordConfig = async (e) => {
        e.preventDefault();
        try {
            await api.post('/alerts/discord-config', { webhook_url: discordWebhookUrl });
            toast.success("Webhook de Discord configurado con éxito");
            setShowDiscordModal(false);
        } catch (err) {
            console.error("Error al guardar webhook:", err);
            toast.error("Error al configurar Discord");
        }
    };

    const handleTestAlert = async () => {
        setTesting(true);
        try {
            const res = await api.post('/alerts/test');
            toast.success(res.data.message || 'Alerta de prueba enviada con éxito');
            refreshStats();
        } catch (err) {
            console.error("Error al enviar alerta de prueba:", err);
            toast.error(err.response?.data?.message || "Error al enviar alerta de prueba");
        } finally {
            setTesting(false);
        }
    };

    const labelMapping = {
        metrics: {
            cpl: 'CPL (Costo por lead)',
            cpql: 'CPQL (CPL cualificado)',
            leads: 'Leads totales',
            inversion: 'Inversión',
            agendas: 'Agendas creadas',
            ventas: 'Ventas creadas',
            cash_collect: 'Cash Collect'
        },
        severities: {
            critical: 'Crítica',
            warning: 'Advertencia',
            info: 'Informativa',
            opportunity: 'Oportunidad'
        },
        periods: {
            '7_days': 'Prom. últimos 7 días',
            '1_day': 'Límite diario / Ayer',
            'vs_previous_week': 'vs. semana anterior'
        }
    };

    return (
        <div className="flex-1 flex bg-[#0e1017] p-8 space-y-6 overflow-hidden relative">
            <div className="flex-1 flex flex-col min-h-0 space-y-6">
                {/* Header Area */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="text-left">
                        <p className="text-blue-400 font-bold tracking-widest text-[9px] uppercase leading-none mb-1">REGLAS OPERATIVAS</p>
                        <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">
                            Configuración de Alertas
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleTestAlert}
                            disabled={testing}
                            className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-indigo-650/30 hover:bg-indigo-600 transition-all text-xs font-black uppercase tracking-wider text-indigo-300 hover:text-white border border-indigo-500/20 disabled:opacity-50"
                        >
                            <Send size={14} className={testing ? 'animate-spin' : ''} />
                            {testing ? 'Probando...' : 'Probar Alerta'}
                        </button>

                        <button
                            onClick={() => setShowDiscordModal(true)}
                            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#1d1f27] border border-white/5 text-xs font-black uppercase tracking-wider hover:bg-[#282a35] hover:border-white/10 transition-all text-slate-300"
                        >
                            <Settings size={14} className="text-slate-400" />
                            Configurar Discord
                        </button>

                        <button
                            onClick={handleOpenCreate}
                            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 transition-all text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-blue-500/20"
                        >
                            <Plus size={14} />
                            Nueva regla de alerta
                        </button>
                    </div>
                </div>

                {/* Categories Tab and Summary (Combined) */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="bg-[#12141c]/50 border border-white/5 rounded-3xl p-4 text-left">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Reglas Críticas</p>
                        <h3 className="text-xl font-black text-rose-500 mt-0.5">{stats.rules.critical || 0}</h3>
                    </div>
                    <div className="bg-[#12141c]/50 border border-white/5 rounded-3xl p-4 text-left">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Advertencias</p>
                        <h3 className="text-xl font-black text-amber-500 mt-0.5">{stats.rules.warning || 0}</h3>
                    </div>
                    <div className="bg-[#12141c]/50 border border-white/5 rounded-3xl p-4 text-left">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Informativas</p>
                        <h3 className="text-xl font-black text-blue-400 mt-0.5">{stats.rules.info || 0}</h3>
                    </div>
                    <div className="bg-[#12141c]/50 border border-white/5 rounded-3xl p-4 text-left">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Oportunidades</p>
                        <h3 className="text-xl font-black text-emerald-400 mt-0.5">{stats.rules.opportunity || 0}</h3>
                    </div>
                    <div className="bg-[#12141c]/50 border border-white/5 rounded-3xl p-4 text-left">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Reglas</p>
                        <h3 className="text-xl font-black text-white mt-0.5">{stats.rules.total || 0}</h3>
                    </div>
                </div>

                {/* Rules Table container */}
                <div className="flex-1 bg-[#12141c]/40 border border-white/5 rounded-[2rem] p-5 overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 text-[9px] font-black tracking-widest text-slate-500 uppercase">
                                    <th className="pb-3.5 pl-2">Nombre de la regla</th>
                                    <th className="pb-3.5">Métrica</th>
                                    <th className="pb-3.5">Condición</th>
                                    <th className="pb-3.5">Ámbito</th>
                                    <th className="pb-3.5 text-center">Canal</th>
                                    <th className="pb-3.5 text-center">Estado</th>
                                    <th className="pb-3.5 pr-2 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="py-8 text-center text-slate-500 text-xs font-bold">
                                            Cargando reglas...
                                        </td>
                                    </tr>
                                ) : rules.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="py-8 text-center text-slate-500 text-xs font-bold">
                                            No se han configurado reglas de alerta.
                                        </td>
                                    </tr>
                                ) : (
                                    rules.map(rule => {
                                        const severityTextColors = {
                                            critical: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
                                            warning: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
                                            info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                                            opportunity: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                        };
                                        return (
                                            <tr key={rule.id} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="py-4 pl-2">
                                                    <div className="text-xs font-black text-white uppercase tracking-wider">{rule.name}</div>
                                                    <div className="text-[9px] text-slate-500 font-medium mt-0.5 italic">{rule.description || 'Sin descripción'}</div>
                                                </td>
                                                <td className="py-4 text-xs font-bold text-slate-300">
                                                    {labelMapping.metrics[rule.metric] || rule.metric}
                                                </td>
                                                <td className="py-4">
                                                    <span className={`text-[10px] font-black border px-2.5 py-1 rounded-full ${severityTextColors[rule.severity] || severityTextColors.info}`}>
                                                        {rule.condition === '>' ? 'Mayor que' : 'Menor que'} {['cpl', 'cpql', 'inversion', 'cash_collect'].includes(rule.metric) ? '$' : ''}{rule.value}
                                                        {rule.period === 'vs_previous_week' ? '%' : ''}
                                                    </span>
                                                    <div className="text-[8px] font-black text-slate-500 uppercase tracking-wider mt-1.5">{labelMapping.periods[rule.period]}</div>
                                                </td>
                                                <td className="py-4 text-xs text-slate-400 font-bold">
                                                    {rule.scope_type === 'all' ? 'Todo' : `${rule.scope_type}: ${rule.scope_value}`}
                                                </td>
                                                <td className="py-4">
                                                    <div className="flex items-center justify-center gap-2 text-slate-400">
                                                        {rule.notify_platform && <Bell size={14} className="text-blue-400" title="Notificación interna" />}
                                                        {rule.notify_discord && <Globe size={14} className="text-indigo-400" title="Discord Webhook" />}
                                                    </div>
                                                </td>
                                                <td className="py-4 text-center">
                                                    <button 
                                                        onClick={() => handleToggleActive(rule)}
                                                        className="focus:outline-none"
                                                    >
                                                        {rule.is_active ? (
                                                            <ToggleRight className="text-emerald-500 hover:text-emerald-400" size={28} />
                                                        ) : (
                                                            <ToggleLeft className="text-slate-600 hover:text-slate-500" size={28} />
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="py-4 pr-2 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button 
                                                            onClick={() => handleOpenEdit(rule)}
                                                            className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:text-blue-400 text-slate-400 transition-colors"
                                                            title="Editar regla"
                                                        >
                                                            <Edit size={12} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteRule(rule.id)}
                                                            className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:text-rose-500 text-slate-400 transition-colors"
                                                            title="Eliminar regla"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Sidebar Slider Drawer: Crear o Editar Regla */}
            {showDrawer && (
                <>
                    {/* Backdrop */}
                    <div 
                        onClick={() => setShowDrawer(false)}
                        className="fixed inset-0 bg-black/60 backdrop-blur-[4px] z-40 pointer-events-auto"
                    />

                    {/* Drawer Content */}
                    <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-[#101117] border-l border-white/5 z-50 p-6 flex flex-col shadow-2xl animate-in slide-in-from-right-4 duration-300 text-left overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-5">
                            <div>
                                <h2 className="text-md font-black text-white uppercase tracking-widest">
                                    {editingRule ? 'Editar regla de alerta' : 'Nueva regla de alerta'}
                                </h2>
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                                    Define los límites de medición
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDrawer(false)}
                                className="p-2 hover:bg-white/5 rounded-2xl transition-all text-slate-400 hover:text-white"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveRule} className="space-y-4 flex-1 flex flex-col">
                            {/* Nombre de la regla */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Nombre de la regla</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ej. CPL alto - Crítica"
                                    className="w-full bg-[#161824] border border-white/5 text-slate-200 px-4 py-3 rounded-2xl text-xs font-medium placeholder-slate-600 focus:border-blue-500 outline-none transition-colors"
                                />
                            </div>

                            {/* Descripción */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Descripción (opcional)</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Explica qué activa esta regla..."
                                    className="w-full bg-[#161824] border border-white/5 text-slate-200 px-4 py-3 rounded-2xl text-xs font-medium placeholder-slate-600 focus:border-blue-500 outline-none transition-colors h-16 resize-none"
                                />
                            </div>

                            {/* Métrica */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Métrica de negocio</label>
                                <select
                                    value={metric}
                                    onChange={(e) => setMetric(e.target.value)}
                                    className="w-full bg-[#161824] border border-white/5 text-slate-200 px-4 py-3 rounded-2xl text-xs font-medium focus:border-blue-500 outline-none transition-colors cursor-pointer"
                                >
                                    <option value="cpl">CPL (Costo por Lead)</option>
                                    <option value="cpql">CPQL (Costo por Lead Cualificado)</option>
                                    <option value="leads">Leads totales (Volumen)</option>
                                    <option value="inversion">Inversión (Spend)</option>
                                    <option value="agendas">Agendas creadas (Agendamiento)</option>
                                    <option value="ventas">Ventas concretadas (Closer)</option>
                                    <option value="cash_collect">Cash Collect ($ total)</option>
                                </select>
                            </div>

                            {/* Condición y Valor */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Condición</label>
                                    <select
                                        value={condition}
                                        onChange={(e) => setCondition(e.target.value)}
                                        className="w-full bg-[#161824] border border-white/5 text-slate-200 px-4 py-3 rounded-2xl text-xs font-medium focus:border-blue-500 outline-none transition-colors cursor-pointer"
                                    >
                                        <option value=">">Mayor que</option>
                                        <option value="<">Menor que</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Valor límite</label>
                                    <div className="relative">
                                        {['cpl', 'cpql', 'inversion', 'cash_collect'].includes(metric) && (
                                            <span className="absolute left-4 top-3 text-xs font-bold text-slate-500">$</span>
                                        )}
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={value}
                                            onChange={(e) => setValue(e.target.value)}
                                            placeholder="1.50"
                                            className={`w-full bg-[#161824] border border-white/5 text-slate-200 py-3 rounded-2xl text-xs font-medium focus:border-blue-500 outline-none transition-colors ${
                                                ['cpl', 'cpql', 'inversion', 'cash_collect'].includes(metric) ? 'pl-8 pr-12' : 'px-4'
                                            }`}
                                        />
                                        <span className="absolute right-4 top-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            {period === 'vs_previous_week' ? '%' : (['cpl', 'cpql', 'inversion', 'cash_collect'].includes(metric) ? 'USD' : 'Uds')}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Basado en el promedio de */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Período temporal</label>
                                <select
                                    value={period}
                                    onChange={(e) => setPeriod(e.target.value)}
                                    className="w-full bg-[#161824] border border-white/5 text-slate-200 px-4 py-3 rounded-2xl text-xs font-medium focus:border-blue-500 outline-none transition-colors cursor-pointer"
                                >
                                    <option value="7_days">Promedio de los últimos 7 días</option>
                                    <option value="1_day">Ayer / Registro diario</option>
                                    <option value="vs_previous_week">vs. semana anterior (% cambio)</option>
                                </select>
                            </div>

                            {/* Ámbito */}
                            <div className="space-y-3 p-4 bg-black/20 rounded-3xl border border-white/5">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Ámbito de aplicación (Scope)</label>
                                    <select
                                        value={scopeType}
                                        onChange={(e) => setScopeType(e.target.value)}
                                        className="w-full bg-[#161824] border border-white/5 text-slate-200 px-4 py-3 rounded-2xl text-xs font-medium focus:border-blue-500 outline-none transition-colors cursor-pointer"
                                    >
                                        <option value="all">Todas las campañas / keywords</option>
                                        <option value="keyword">Palabra clave específica</option>
                                        <option value="campaign">Campaña específica</option>
                                        <option value="ad">Anuncio específico</option>
                                    </select>
                                </div>

                                {scopeType !== 'all' && (
                                    <div className="space-y-1 animate-in fade-in duration-300">
                                        <label className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Identificador o Nombre exacto</label>
                                        <input
                                            type="text"
                                            value={scopeValue}
                                            onChange={(e) => setScopeValue(e.target.value)}
                                            placeholder="Ej. Clase 26"
                                            className="w-full bg-[#161824] border border-white/5 text-slate-200 px-4 py-3 rounded-2xl text-xs font-medium placeholder-slate-600 focus:border-blue-500 outline-none transition-colors"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Nivel de alerta */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Nivel de alerta (Severidad)</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { id: 'critical', label: 'Crítica', color: 'border-rose-500/20 text-rose-400 bg-rose-500/5', activeColor: 'bg-rose-600 text-white border-rose-500' },
                                        { id: 'warning', label: 'Advertencia', color: 'border-amber-500/20 text-amber-400 bg-amber-500/5', activeColor: 'bg-amber-600 text-white border-amber-500' },
                                        { id: 'info', label: 'Informativa', color: 'border-blue-500/20 text-blue-400 bg-blue-500/5', activeColor: 'bg-blue-600 text-white border-blue-500' },
                                        { id: 'opportunity', label: 'Oportunidad', color: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5', activeColor: 'bg-emerald-600 text-white border-emerald-500' }
                                    ].map(opt => {
                                        const isSel = severity === opt.id;
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => setSeverity(opt.id)}
                                                className={`py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-wider text-center transition-all ${
                                                    isSel ? opt.activeColor : `${opt.color} hover:bg-white/5`
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Canales de notificación */}
                            <div className="space-y-2.5 bg-black/20 p-4 rounded-3xl border border-white/5 text-slate-300">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Canales de notificación</p>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-3 cursor-pointer text-xs font-bold">
                                        <input
                                            type="checkbox"
                                            checked={notifyPlatform}
                                            onChange={(e) => setNotifyPlatform(e.target.checked)}
                                            className="w-4 h-4 rounded border-white/10 bg-white/5 text-blue-600 focus:ring-0 focus:ring-offset-0"
                                        />
                                        <span>Notificación en la plataforma (Web)</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer text-xs font-bold">
                                        <input
                                            type="checkbox"
                                            checked={notifyDiscord}
                                            onChange={(e) => setNotifyDiscord(e.target.checked)}
                                            className="w-4 h-4 rounded border-white/10 bg-white/5 text-blue-600 focus:ring-0 focus:ring-offset-0"
                                        />
                                        <span>Notificación a Discord</span>
                                    </label>
                                </div>
                            </div>

                            {/* Estado switch */}
                            <div className="flex items-center justify-between py-2 border-t border-b border-white/5">
                                <span className="text-xs font-bold text-slate-300">Regla Activa</span>
                                <button 
                                    type="button"
                                    onClick={() => setIsActive(!isActive)}
                                    className="focus:outline-none"
                                >
                                    {isActive ? (
                                        <ToggleRight className="text-emerald-500" size={36} />
                                    ) : (
                                        <ToggleLeft className="text-slate-600" size={36} />
                                    )}
                                </button>
                            </div>

                            {/* Submit buttons */}
                            <div className="grid grid-cols-2 gap-3 pt-4 mt-auto">
                                <button
                                    type="button"
                                    onClick={() => setShowDrawer(false)}
                                    className="px-5 py-3.5 rounded-2xl bg-[#1d1f27] hover:bg-[#282a35] border border-white/5 transition-colors font-black text-[10px] uppercase tracking-widest text-slate-300 text-center"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 transition-colors font-black text-[10px] uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 text-center"
                                >
                                    Guardar cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </>
            )}

            {/* Discord Webhook Configuration Modal */}
            {showDiscordModal && (
                <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                    <div 
                        onClick={() => setShowDiscordModal(false)}
                        className="fixed inset-0 bg-black/70 backdrop-blur-[4px]"
                    />
                    <div className="relative bg-[#101117] border border-white/5 rounded-[2rem] p-6 w-full max-w-[450px] shadow-2xl animate-in zoom-in-95 duration-200 text-left">
                        <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-4">
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Configurar Webhook Discord</h3>
                                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Alertas Críticas Canal #1342945225890336910</p>
                            </div>
                            <button 
                                onClick={() => setShowDiscordModal(false)}
                                className="p-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveDiscordConfig} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Discord Webhook URL</label>
                                <input
                                    type="url"
                                    value={discordWebhookUrl}
                                    onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                                    placeholder="https://discord.com/api/webhooks/..."
                                    className="w-full bg-[#161824] border border-white/5 text-slate-200 px-4 py-3 rounded-2xl text-xs font-medium placeholder-slate-600 focus:border-blue-500 outline-none transition-colors"
                                    required
                                />
                                <p className="text-[8px] font-medium text-slate-500 leading-normal mt-1.5 italic">
                                    Crea un webhook en la configuración del canal de Discord de destino e ingresa la URL aquí.
                                </p>
                            </div>

                            <div className="flex gap-3 justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowDiscordModal(false)}
                                    className="px-5 py-3 rounded-2xl bg-[#1d1f27] hover:bg-[#282a35] text-slate-300 text-[9px] font-black uppercase tracking-widest transition-colors border border-white/5"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black uppercase tracking-widest transition-colors shadow-lg shadow-blue-500/20"
                                >
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AlertRulesConfig;
