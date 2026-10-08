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
import { motion, useReducedMotion } from 'framer-motion';
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
    
    // Evitar desfase de zona horaria UTC para cadenas simples de fecha YYYY-MM-DD
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('-');
        const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    
    // Fallback para fechas completas ISO u otros objetos fecha
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
        return dateStr;
    }
    
    // Si la fecha fue interpretada como UTC a medianoche, forzar zona local si no tiene horas significativas
    if (typeof dateStr === 'string' && dateStr.includes('T00:00:00')) {
        const justDate = dateStr.split('T')[0];
        const [year, month, day] = justDate.split('-');
        const localD = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return localD.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Quienes cobran comision en la nomina; el `id` es la clave con la que viaja cada una en
// /public/financial-sales/payroll. Las clases van completas para que Tailwind las vea.
// Fila de arriba los dos setters (mitad y mitad), abajo los closers y el director (tercios).
const TONOS = {
    indigo: { badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', hover: 'group-hover:text-indigo-400' },
    violet: { badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20', hover: 'group-hover:text-violet-400' },
    rose: { badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20', hover: 'group-hover:text-rose-400' },
};

const SETTER = { rol: 'Setter', icono: Compass, tono: 'indigo', ancho: 'lg:col-span-3', ventas: 'Ventas Atribuidas', neto: 'Neto' };
const CLOSER = { rol: 'Closer', icono: UserCheck, tono: 'violet', ancho: 'lg:col-span-2', ventas: 'Ventas Cerradas', neto: 'Neto' };

const PERSONAS = [
    { ...SETTER, id: 'elias', nombre: 'Elias', auditoria: 'atribuidas a Elías como Setter' },
    { ...SETTER, id: 'paula', nombre: 'Paula', auditoria: 'atribuidas a Paula como Setter' },
    { ...CLOSER, id: 'jeancarlo', nombre: 'Jean Carlo', auditoria: 'cerradas por Jean Carlo como Closer' },
    { ...CLOSER, id: 'facundo', nombre: 'Facundo', auditoria: 'cerradas por Facundo como Closer' },
    {
        id: 'marlon', nombre: 'Marlon', rol: 'Director de ventas', icono: UserCheck, tono: 'rose', ancho: 'lg:col-span-2',
        ventas: 'Ventas Closers Calificadas', neto: 'Neto Closers',
        auditoria: 'cerradas por Jean Carlo y Facundo (excluyendo renovaciones) para la comisión de Marlon',
    },
];

const AdminPayrollPage = () => {
    const reducirMovimiento = useReducedMotion();
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

    const handleToggleExclusion = async (saleId) => {
        try {
            await api.post(`/public/financial-sales/${saleId}/toggle-payroll-exclusion`, {});
            await fetchPayroll();
            toast.success('Estado de nómina actualizado');
        } catch (error) {
            toast.error('Error al actualizar exclusión de nómina');
            console.error(error);
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
                        Consolidado de Nómina
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
                <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-900">
                        Período: <span className="font-medium text-slate-700">{formatSaleDate(startDate)} al {formatSaleDate(endDate)}</span>
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
                            ...PERSONAS.map((p) => ({ id: p.id, label: p.nombre }))
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
                            ? 'lg:grid-cols-6'
                            : 'max-w-md lg:grid-cols-1'
                    }`}>
                        {PERSONAS.filter((p) => selectedUserFilter === 'all' || selectedUserFilter === p.id).map((p, i) => {
                            const datos = payroll[p.id];
                            const tono = TONOS[p.tono];
                            const Icono = p.icono;
                            return (
                                <motion.div
                                    key={p.id}
                                    initial={reducirMovimiento ? false : { opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.25, delay: i * 0.04, ease: 'easeOut' }}
                                    onClick={() => setActiveTab(p.id)}
                                    className={`p-6 rounded-[2rem] border transition-colors cursor-pointer relative overflow-hidden bg-slate-900/40 backdrop-blur-md group ${
                                        selectedUserFilter === 'all' ? p.ancho : ''
                                    } ${
                                        activeTab === p.id
                                            ? 'border-indigo-500/40 shadow-xl shadow-indigo-500/5 bg-indigo-950/10'
                                            : 'border-slate-800 hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${tono.badge}`}>
                                                <Icono size={10} /> {p.rol}
                                            </span>
                                            <h2 className={`text-lg font-black text-white uppercase transition-colors ${tono.hover}`}>{p.nombre}</h2>
                                        </div>
                                        <span className="text-xs font-black text-slate-500 group-hover:text-slate-300 uppercase tracking-widest">{datos.porcentaje_comision}% Comisión</span>
                                    </div>

                                    <div className="mt-6 space-y-2">
                                        <div className="flex items-baseline justify-between">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Comisión Generada</span>
                                            <span className="text-2xl font-black text-emerald-400 italic">
                                                ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(datos.comision_total)}
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-950/60 h-px" />
                                        <div className="flex justify-between text-xs text-slate-400">
                                            <span>{p.ventas}: <strong className="text-white">{datos.total_ventas}</strong></span>
                                            <span>{p.neto}: <strong>${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(datos.total_recaudado_neto)}</strong></span>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Desglose de Auditoría */}
                    <Card variant="surface" className="p-6 rounded-[2rem] border-slate-800 bg-slate-900/10">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-md font-black text-white uppercase tracking-wider">Auditoría de Ventas</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">
                                    {`Lista de transacciones del período ${PERSONAS.find((p) => p.id === activeTab)?.auditoria} (${payroll[activeTab].porcentaje_comision}% de comisión).`}
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
                                        <th className="p-4 font-semibold text-center print:hidden">Nómina</th>
                                        <th className="p-4 font-semibold">Fecha</th>
                                        <th className="p-4 font-semibold">Cliente</th>
                                        <th className="p-4 font-semibold">Programa</th>
                                        <th className="p-4 font-semibold">Método</th>
                                        {selectedUserFilter === 'all' && (
                                            <th className="p-4 font-semibold text-right">Monto Bruto</th>
                                        )}
                                        <th className="p-4 font-semibold text-right text-indigo-400">Comisión</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm text-slate-350 divide-y divide-slate-800/40">
                                    {payroll[activeTab].sales.map((sale) => {
                                        const rate = payroll[activeTab].porcentaje_comision;
                                        const comisionVal = (sale.monto_neto * rate) / 100;
                                        const isExcluded = sale.is_excluded_from_payroll;
                                        
                                        return (
                                            <tr 
                                                key={sale.id} 
                                                className={`hover:bg-slate-800/20 transition-colors ${
                                                    isExcluded ? 'opacity-35 line-through decoration-rose-500/50 text-slate-500' : ''
                                                }`}
                                            >
                                                <td className="p-4 text-center print:hidden">
                                                    <input 
                                                        type="checkbox"
                                                        checked={!isExcluded}
                                                        onChange={() => handleToggleExclusion(sale.id)}
                                                        className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500/40 focus:ring-offset-slate-950 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="p-4 whitespace-nowrap">
                                                    {formatSaleDate(sale.date)}
                                                </td>
                                                <td className={`p-4 font-bold ${isExcluded ? 'text-slate-500' : 'text-white'}`}>
                                                    {sale.nombre_cliente}
                                                </td>
                                                <td className="p-4 text-xs font-semibold">
                                                    {sale.tipo_pago}
                                                </td>
                                                <td className="p-4 text-xs">
                                                    {sale.metodo_pago}
                                                </td>
                                                {selectedUserFilter === 'all' && (
                                                    <td className="p-4 text-right font-medium">
                                                        ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(sale.monto_bruto)}
                                                    </td>
                                                )}
                                                <td className="p-4 text-right font-black text-emerald-400 italic">
                                                    ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(comisionVal)}
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {payroll[activeTab].sales.length === 0 && (
                                        <tr>
                                            <td colSpan={selectedUserFilter === 'all' ? 7 : 6} className="p-12 text-center text-slate-500 italic">
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
