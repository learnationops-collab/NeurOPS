import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import { 
    Calendar, 
    DollarSign, 
    Users, 
    Percent, 
    X, 
    ArrowUpRight, 
    Loader2, 
    ClipboardList,
    TrendingUp,
    UserCheck,
    Compass
} from 'lucide-react';
import Card from '../../../components/ui/Card';

const getFirstDayOfCurrentMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
};

const getTodayDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
};

const formatSaleDate = (dateStr) => {
    if (!dateStr) return 'Sin Fecha';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
        return dateStr;
    }
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

const AdminPayrollPage = () => {
    const [startDate, setStartDate] = useState(getFirstDayOfCurrentMonth());
    const [endDate, setEndDate] = useState(getTodayDate());
    const [selectedUserFilter, setSelectedUserFilter] = useState('all');
    const [payroll, setPayroll] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('elias');

    const startDateRef = useRef(null);
    const endDateRef = useRef(null);

    const handleUserFilterChange = (filterId) => {
        setSelectedUserFilter(filterId);
        if (filterId !== 'all') {
            setActiveTab(filterId);
        }
    };

    const applyDatePreset = (preset) => {
        const today = new Date();
        let start = '';
        let end = today.toISOString().split('T')[0];

        if (preset === 'today') {
            start = end;
        } else if (preset === 'this_month') {
            start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        } else if (preset === 'last_month') {
            const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            start = firstOfLastMonth.toISOString().split('T')[0];
            end = lastOfLastMonth.toISOString().split('T')[0];
        } else if (preset === 'last_30_days') {
            const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            start = thirtyDaysAgo.toISOString().split('T')[0];
        }

        setStartDate(start);
        setEndDate(end);
    };

    const getActiveDatePreset = () => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        
        const lastMonthFirst = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthLast = new Date(today.getFullYear(), today.getMonth(), 0);
        const lastMonthStartStr = lastMonthFirst.toISOString().split('T')[0];
        const lastMonthEndStr = lastMonthLast.toISOString().split('T')[0];
        
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        if (startDate === todayStr && endDate === todayStr) return 'today';
        if (startDate === thisMonthStart && endDate === todayStr) return 'this_month';
        if (startDate === lastMonthStartStr && endDate === lastMonthEndStr) return 'last_month';
        if (startDate === thirtyDaysAgo && endDate === todayStr) return 'last_30_days';
        return 'custom';
    };

    const isFiltered = () => {
        return startDate !== getFirstDayOfCurrentMonth() || endDate !== getTodayDate() || selectedUserFilter !== 'all';
    };

    const handleClearFilters = () => {
        setStartDate(getFirstDayOfCurrentMonth());
        setEndDate(getTodayDate());
        setSelectedUserFilter('all');
    };

    const fetchPayroll = async () => {
        setLoading(true);
        try {
            const res = await api.get('/public/financial-sales/payroll', {
                params: {
                    start_date: startDate,
                    end_date: endDate
                }
            });
            setPayroll(res.data);
        } catch (error) {
            toast.error('Error al cargar datos de nómina');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPayroll();
    }, [startDate, endDate]);

    return (
        <div className="w-full p-4 lg:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white italic tracking-tight uppercase flex items-center gap-2 print:text-slate-900">
                        <DollarSign className="text-indigo-400 print:text-indigo-600" size={24} />
                        Consolidado de Nómina (PayRoll)
                    </h1>
                    <p className="text-sm text-slate-400 font-bold uppercase tracking-wide print:text-slate-500">Cálculo exacto de comisiones asignadas para el equipo.</p>
                </div>
                {payroll && (
                    <button
                        onClick={() => window.print()}
                        className="print:hidden text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider px-4 py-2.5 rounded-xl border border-indigo-500/30 flex items-center gap-2 transition-all shadow-md hover:shadow-indigo-500/10 cursor-pointer"
                    >
                        <ArrowUpRight size={14} /> Exportar PDF
                    </button>
                )}
            </div>

            {/* Período de Impresión (Solo visible al imprimir/PDF) */}
            <div className="hidden print:block border-b border-slate-350 pb-4 mb-4">
                <p className="text-xs text-slate-500 font-black uppercase tracking-wider">Período de Nómina</p>
                <div className="flex justify-between items-center mt-1">
                    <span className="text-sm font-semibold text-slate-800">
                        Desde: <span className="font-bold text-slate-900">{formatSaleDate(startDate)}</span> | Hasta: <span className="font-bold text-slate-900">{formatSaleDate(endDate)}</span>
                    </span>
                    <span className="text-xs font-bold text-slate-450 uppercase">
                        Generado el: {new Date().toLocaleDateString('es-ES')}
                    </span>
                </div>
            </div>

            {/* Panel de Filtro Rango de Fechas */}
            <Card variant="surface" className="p-5 rounded-[2rem] border-slate-800 bg-slate-900/20 backdrop-blur-md space-y-4 print:hidden">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-violet-400">
                        <Calendar size={16} />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-300">Rango de Fecha</span>
                    </div>
                    {isFiltered() && (
                        <button
                            onClick={handleClearFilters}
                            className="text-xs text-rose-400 hover:text-rose-300 font-bold transition-all uppercase tracking-wider flex items-center gap-1.5 bg-rose-500/10 px-3.5 py-1.5 rounded-full border border-rose-500/20"
                        >
                            <X size={12} /> Restablecer
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                    {/* Inputs de fecha */}
                    <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-850 hover:border-slate-700 px-3.5 py-2.5 rounded-xl lg:col-span-6 transition-all focus-within:border-violet-500">
                        <Calendar 
                            className="w-4 h-4 text-slate-450 hover:text-white cursor-pointer shrink-0 transition-colors" 
                            onClick={() => {
                                try {
                                    startDateRef.current?.showPicker();
                                } catch (e) {
                                    startDateRef.current?.focus();
                                }
                            }}
                        />
                        <span 
                            className="text-[9px] text-slate-400 hover:text-white cursor-pointer font-black uppercase tracking-wider shrink-0 transition-colors"
                            onClick={() => {
                                try {
                                    startDateRef.current?.showPicker();
                                } catch (e) {
                                    startDateRef.current?.focus();
                                }
                            }}
                        >
                            Fecha:
                        </span>
                        <input
                            ref={startDateRef}
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent border-none text-xs text-slate-200 focus:outline-none focus:ring-0 cursor-pointer w-full text-center"
                        />
                        <span className="text-slate-650 text-xs shrink-0">-</span>
                        <input
                            ref={endDateRef}
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent border-none text-xs text-slate-200 focus:outline-none focus:ring-0 cursor-pointer w-full text-center"
                        />
                    </div>

                    {/* Presets rápidos */}
                    <div className="flex flex-wrap items-center gap-1.5 lg:col-span-6 justify-start lg:justify-end">
                        {[
                            { id: 'today', label: 'Hoy' },
                            { id: 'this_month', label: 'Este Mes' },
                            { id: 'last_month', label: 'Mes Anterior' },
                            { id: 'last_30_days', label: 'Últimos 30 días' }
                        ].map((preset) => {
                            const isActive = getActiveDatePreset() === preset.id;
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => applyDatePreset(preset.id)}
                                    className={`text-[9px] font-black uppercase tracking-wider px-3.5 py-2 rounded-lg border transition-all ${
                                        isActive
                                            ? 'bg-violet-500/15 border-violet-550/40 text-violet-300 shadow-sm'
                                            : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:text-slate-350 hover:border-slate-800'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-violet-400">
                        <Users size={16} />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-300">Usuario</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {[
                            { id: 'all', label: 'Todos' },
                            { id: 'elias', label: 'Elias' },
                            { id: 'jeancarlo', label: 'Jean Carlo' },
                            { id: 'marlon', label: 'Marlon' }
                        ].map((userOpt) => {
                            const isActive = selectedUserFilter === userOpt.id;
                            return (
                                <button
                                    key={userOpt.id}
                                    type="button"
                                    onClick={() => handleUserFilterChange(userOpt.id)}
                                    className={`text-[9px] font-black uppercase tracking-wider px-3.5 py-2 rounded-lg border transition-all ${
                                        isActive
                                            ? 'bg-violet-500/15 border-violet-550/40 text-violet-300 shadow-sm'
                                            : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:text-slate-350 hover:border-slate-800'
                                    }`}
                                >
                                    {userOpt.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </Card>

            {loading ? (
                <div className="flex flex-col items-center justify-center p-24 space-y-4">
                    <Loader2 className="animate-spin text-indigo-500 w-10 h-10" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">Calculando Nómina...</span>
                </div>
            ) : payroll ? (
                <>
                    {/* Tarjetas KPI de comisiones */}
                    <div className={`grid grid-cols-1 gap-6 ${
                        selectedUserFilter === 'all' 
                            ? 'lg:grid-cols-3' 
                            : 'max-w-md lg:grid-cols-1'
                    }`}>
                        {/* Elias */}
                        {(selectedUserFilter === 'all' || selectedUserFilter === 'elias') && (
                            <div 
                                onClick={() => setActiveTab('elias')}
                                className={`p-6 rounded-[2rem] border transition-all cursor-pointer relative overflow-hidden bg-slate-900/40 backdrop-blur-md group ${
                                    activeTab === 'elias'
                                        ? 'border-indigo-500/40 shadow-xl shadow-indigo-500/5 bg-indigo-950/10'
                                        : 'border-slate-800 hover:border-slate-700'
                                }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                            <Compass size={10} /> Setter (Atribución)
                                        </span>
                                        <h2 className="text-lg font-black text-white uppercase group-hover:text-indigo-400 transition-colors">Elias</h2>
                                    </div>
                                    <span className="text-xs font-black text-slate-500 group-hover:text-slate-300 uppercase tracking-widest">{payroll.elias.porcentaje_comision}% Comisión</span>
                                </div>

                                <div className="mt-6 space-y-2">
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Comisión Generada</span>
                                        <span className="text-2xl font-black text-emerald-400 italic">
                                            ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(payroll.elias.comision_total)}
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-950/60 h-px" />
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Ventas Atribuidas: <strong className="text-white">{payroll.elias.total_ventas}</strong></span>
                                        <span>Neto: <strong>${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(payroll.elias.total_recaudado_neto)}</strong></span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Jean Carlo */}
                        {(selectedUserFilter === 'all' || selectedUserFilter === 'jeancarlo') && (
                            <div 
                                onClick={() => setActiveTab('jeancarlo')}
                                className={`p-6 rounded-[2rem] border transition-all cursor-pointer relative overflow-hidden bg-slate-900/40 backdrop-blur-md group ${
                                    activeTab === 'jeancarlo'
                                        ? 'border-indigo-500/40 shadow-xl shadow-indigo-500/5 bg-indigo-950/10'
                                        : 'border-slate-800 hover:border-slate-700'
                                }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                            <UserCheck size={10} /> Closer (Cierres)
                                        </span>
                                        <h2 className="text-lg font-black text-white uppercase group-hover:text-violet-400 transition-colors">Jean Carlo</h2>
                                    </div>
                                    <span className="text-xs font-black text-slate-500 group-hover:text-slate-300 uppercase tracking-widest">{payroll.jeancarlo.porcentaje_comision}% Comisión</span>
                                </div>

                                <div className="mt-6 space-y-2">
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Comisión Generada</span>
                                        <span className="text-2xl font-black text-emerald-400 italic">
                                            ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(payroll.jeancarlo.comision_total)}
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-950/60 h-px" />
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Ventas Cerradas: <strong className="text-white">{payroll.jeancarlo.total_ventas}</strong></span>
                                        <span>Neto: <strong>${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(payroll.jeancarlo.total_recaudado_neto)}</strong></span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Marlon */}
                        {(selectedUserFilter === 'all' || selectedUserFilter === 'marlon') && (
                            <div 
                                onClick={() => setActiveTab('marlon')}
                                className={`p-6 rounded-[2rem] border transition-all cursor-pointer relative overflow-hidden bg-slate-900/40 backdrop-blur-md group ${
                                    activeTab === 'marlon'
                                        ? 'border-indigo-500/40 shadow-xl shadow-indigo-500/5 bg-indigo-950/10'
                                        : 'border-slate-800 hover:border-slate-700'
                                }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                            <UserCheck size={10} /> Líder (5% de Jean Carlo sin Renovaciones)
                                        </span>
                                        <h2 className="text-lg font-black text-white uppercase group-hover:text-rose-400 transition-colors">Marlon</h2>
                                    </div>
                                    <span className="text-xs font-black text-slate-500 group-hover:text-slate-300 uppercase tracking-widest">{payroll.marlon.porcentaje_comision}% Comisión</span>
                                </div>

                                <div className="mt-6 space-y-2">
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Comisión Generada</span>
                                        <span className="text-2xl font-black text-emerald-400 italic">
                                            ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(payroll.marlon.comision_total)}
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-950/60 h-px" />
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Ventas JC Calificadas: <strong className="text-white">{payroll.marlon.total_ventas}</strong></span>
                                        <span>Neto JC: <strong>${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(payroll.marlon.total_recaudado_neto)}</strong></span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Desglose de Auditoría */}
                    <Card variant="surface" className="p-6 rounded-[2rem] border-slate-800 bg-slate-900/10">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-md font-black text-white uppercase tracking-wider">Auditoría de Ventas</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">
                                    {activeTab === 'elias' && "Lista de transacciones del período atribuidas a Elías como Setter (8% de comisión)."}
                                    {activeTab === 'jeancarlo' && "Lista de transacciones del período cerradas por Jean Carlo como Closer (10% de comisión)."}
                                    {activeTab === 'marlon' && "Lista de transacciones del período cerradas por Jean Carlo (excluyendo renovaciones) para comisión de Marlon (5% de comisión)."}
                                </p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                <ClipboardList size={14} /> {payroll[activeTab].total_ventas} {payroll[activeTab].total_ventas === 1 ? 'Venta' : 'Ventas'}
                            </span>
                        </div>

                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                                        <th className="p-4 font-semibold">Fecha</th>
                                        <th className="p-4 font-semibold">Cliente</th>
                                        <th className="p-4 font-semibold">Instagram</th>
                                        <th className="p-4 font-semibold">Producto / Tipo</th>
                                        <th className="p-4 font-semibold">Método</th>
                                        <th className="p-4 font-semibold text-center">Closer / Setter</th>
                                        <th className="p-4 font-semibold text-right">Monto Bruto</th>
                                        <th className="p-4 font-semibold text-right">Monto Neto</th>
                                        <th className="p-4 font-semibold text-right text-indigo-400">Comisión</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm text-slate-350 divide-y divide-slate-800/40">
                                    {payroll[activeTab].sales.map((sale) => {
                                        const rate = payroll[activeTab].porcentaje_comision;
                                        const comisionVal = (sale.monto_neto * rate) / 100;
                                        
                                        return (
                                            <tr key={sale.id} className="hover:bg-slate-800/20 transition-colors">
                                                <td className="p-4 whitespace-nowrap">
                                                    {formatSaleDate(sale.date)}
                                                </td>
                                                <td className="p-4 font-bold text-white">
                                                    {sale.nombre_cliente}
                                                </td>
                                                <td className="p-4">
                                                    {sale.instagram && sale.instagram !== 'N/A' ? `@${sale.instagram}` : 'N/A'}
                                                </td>
                                                <td className="p-4 text-xs font-semibold">
                                                    {sale.tipo_pago}
                                                </td>
                                                <td className="p-4 text-xs">
                                                    {sale.metodo_pago}
                                                </td>
                                                <td className="p-4 text-center text-xs space-y-0.5">
                                                    <div>C: <span className="font-semibold text-white">{sale.closer}</span></div>
                                                    <div>S: <span className="font-semibold text-slate-400">{sale.setter}</span></div>
                                                </td>
                                                <td className="p-4 text-right font-medium">
                                                    ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(sale.monto_bruto)}
                                                </td>
                                                <td className="p-4 text-right font-bold text-slate-200">
                                                    ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(sale.monto_neto)}
                                                </td>
                                                <td className="p-4 text-right font-black text-emerald-400 italic">
                                                    ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(comisionVal)}
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {payroll[activeTab].sales.length === 0 && (
                                        <tr>
                                            <td colSpan="9" className="p-12 text-center text-slate-500 italic">
                                                No se encontraron ventas calificadas en este rango de fecha.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            ) : null}
        </div>
    );
};

export default AdminPayrollPage;
