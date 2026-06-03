import { useState } from 'react';
import api from '../../../services/api';
import {
    TrendingUp,
    Search,
    Calendar,
    DollarSign,
    Target,
    Activity,
    CheckCircle2,
    HelpCircle,
    AlertCircle,
    ChevronRight,
    BarChart3,
    Instagram,
    Layers,
    Clock
} from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';

// ─────────────────────────────────────────────
// Sub-componente: tarjeta de KPI de resumen
// ─────────────────────────────────────────────
const KpiCard = ({ label, value, subtext, color = 'text-white', icon: Icon, accent }) => (
    <Card
        variant="surface"
        className={`flex flex-col justify-between rounded-[2rem] p-6 relative overflow-hidden group ${accent || ''}`}
    >
        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-500">
            <Icon size={70} />
        </div>
        <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">{label}</p>
        <h3 className={`text-4xl font-black italic tracking-tighter ${color}`}>{value}</h3>
        {subtext && <p className="text-[9px] font-bold text-muted uppercase mt-1">{subtext}</p>}
    </Card>
);

// ─────────────────────────────────────────────
// Sub-componente: badge de atribución
// ─────────────────────────────────────────────
const AtribucionBadge = ({ status }) => {
    if (status === 'encontrado') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 size={10} /> Atribuido
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white/5 text-muted border border-white/10">
            <HelpCircle size={10} /> Indeterminado
        </span>
    );
};

// ─────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────
const SalesAttributionPage = () => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAtribucion, setFilterAtribucion] = useState('all'); // all | encontrado | indeterminado

    const handleGenerateReport = async () => {
        if (!startDate || !endDate) {
            setError('Por favor selecciona ambas fechas.');
            return;
        }
        if (startDate > endDate) {
            setError('La fecha de inicio no puede ser posterior a la fecha de fin.');
            return;
        }

        setLoading(true);
        setError(null);
        setReport(null);

        try {
            // Sincronizar tabla de ventas primero para asegurar datos frescos
            await api.post('/public/financial-sales/sync');

            const res = await api.get('/public/reports/sales-attribution', {
                params: { start_date: startDate, end_date: endDate }
            });
            setReport(res.data);
        } catch (err) {
            console.error('[ATTRIBUTION]', err);
            setError('No se pudo generar el reporte. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    // Filtrado de filas
    const filteredRows = (report?.rows || []).filter(row => {
        const matchesSearch =
            !searchTerm ||
            row.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (row.instagram || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (row.ad_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            row.setter.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesAtribucion =
            filterAtribucion === 'all' ||
            row.atribucion === filterAtribucion;

        return matchesSearch && matchesAtribucion;
    });

    const { summary, revenue_by_ad } = report || {};

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">

            {/* ── Header ── */}
            <header className="space-y-1">
                <h1 className="text-4xl font-black text-white italic tracking-tighter">Atribución de Ventas</h1>
                <p className="text-muted font-medium uppercase text-xs tracking-[0.2em]">
                    Vincula cada venta con el anuncio que originó el contacto
                </p>
            </header>

            {/* ── Generador de Reporte ── */}
            <Card variant="surface" className="p-8 rounded-[2rem] border-base space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <BarChart3 size={20} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-white uppercase tracking-widest">Generar Reporte</h2>
                        <p className="text-[10px] text-muted">Selecciona el período de ventas a analizar</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest">Fecha Inicio</label>
                        <div className="relative">
                            <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="w-full bg-base border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest">Fecha Fin</label>
                        <div className="relative">
                            <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="w-full bg-base border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
                            />
                        </div>
                    </div>

                    <Button
                        onClick={handleGenerateReport}
                        disabled={loading || !startDate || !endDate}
                        variant="primary"
                        size="md"
                        icon={loading ? Activity : TrendingUp}
                        className="w-full rounded-xl h-[46px]"
                    >
                        {loading ? 'Generando...' : 'Generar Reporte'}
                    </Button>
                </div>

                {error && (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                        <AlertCircle size={16} />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                )}
            </Card>

            {/* ── Loading State ── */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-black uppercase tracking-widest text-muted">
                        Sincronizando ventas y cruzando registros...
                    </p>
                </div>
            )}

            {/* ── Resultados ─── */}
            {report && !loading && (
                <>
                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <KpiCard
                            label="Total Ventas"
                            value={summary.total_ventas}
                            icon={DollarSign}
                            color="text-white"
                        />
                        <KpiCard
                            label="Atribuidas"
                            value={summary.atribuidas}
                            subtext={`${summary.porcentaje_atribucion}% del total`}
                            color="text-emerald-400"
                            icon={CheckCircle2}
                            accent="border-emerald-500/20 bg-emerald-500/5"
                        />
                        <KpiCard
                            label="Indeterminadas"
                            value={summary.indeterminadas}
                            subtext="Sin match de anuncio"
                            color="text-muted"
                            icon={HelpCircle}
                        />
                        <KpiCard
                            label="Sin Instagram"
                            value={summary.sin_instagram}
                            subtext="No se pueden cruzar"
                            color="text-amber-400"
                            icon={Instagram}
                            accent="border-amber-500/10"
                        />
                    </div>

                    {/* Ranking por anuncio */}
                    {revenue_by_ad.length > 0 && (
                        <Card variant="surface" className="p-8 rounded-[2rem] border-base space-y-5">
                            <div className="flex items-center gap-2 mb-2">
                                <Target className="text-primary" size={16} />
                                <h3 className="text-[10px] font-black text-base uppercase tracking-widest">
                                    Revenue por Anuncio
                                </h3>
                            </div>
                            <div className="space-y-3">
                                {revenue_by_ad.map((ad, idx) => {
                                    const maxMonto = Math.max(...revenue_by_ad.map(a => a.monto_total), 1);
                                    const pct = Math.round((ad.monto_total / maxMonto) * 100);
                                    return (
                                        <div key={ad.ad_id} className="space-y-1.5">
                                            <div className="flex justify-between items-center text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-muted w-5 text-center">#{idx + 1}</span>
                                                    <span className="font-bold text-white">{ad.ad_name}</span>
                                                    {ad.ad_keyword && (
                                                        <span className="text-[9px] font-black text-muted uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-md">
                                                            {ad.ad_keyword}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-black text-emerald-400">${ad.monto_total.toLocaleString()}</span>
                                                    <span className="text-[10px] text-muted ml-2">({ad.ventas} venta{ad.ventas !== 1 ? 's' : ''})</span>
                                                </div>
                                            </div>
                                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all duration-700"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    )}

                    {/* Tabla detallada */}
                    <Card variant="surface" className="p-8 rounded-[2.5rem] border-base space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Layers className="text-primary" size={16} />
                                <h3 className="text-[10px] font-black text-base uppercase tracking-widest">
                                    Detalle por Venta ({filteredRows.length})
                                </h3>
                            </div>

                            {/* Filtros */}
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="relative">
                                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                    <input
                                        type="text"
                                        placeholder="Buscar cliente, IG, anuncio..."
                                        className="bg-base border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-primary/50 transition-colors w-56"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="flex rounded-xl overflow-hidden border border-white/10">
                                    {[
                                        { key: 'all', label: 'Todas' },
                                        { key: 'encontrado', label: 'Atribuidas' },
                                        { key: 'indeterminado', label: 'Indeterm.' }
                                    ].map(f => (
                                        <button
                                            key={f.key}
                                            onClick={() => setFilterAtribucion(f.key)}
                                            className={`px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${
                                                filterAtribucion === f.key
                                                    ? 'bg-primary text-white'
                                                    : 'text-muted hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-base">
                                        <th className="py-3 px-3 text-[10px] font-black text-muted uppercase tracking-widest">Estado</th>
                                        <th className="py-3 px-3 text-[10px] font-black text-muted uppercase tracking-widest">Fecha Venta</th>
                                        <th className="py-3 px-3 text-[10px] font-black text-muted uppercase tracking-widest">Cliente</th>
                                        <th className="py-3 px-3 text-[10px] font-black text-muted uppercase tracking-widest">Instagram</th>
                                        <th className="py-3 px-3 text-[10px] font-black text-muted uppercase tracking-widest">Setter</th>
                                        <th className="py-3 px-3 text-[10px] font-black text-muted uppercase tracking-widest">Monto</th>
                                        <th className="py-3 px-3 text-[10px] font-black text-muted uppercase tracking-widest">Anuncio de Origen</th>
                                        <th className="py-3 px-3 text-[10px] font-black text-muted uppercase tracking-widest">1er Contacto</th>
                                        <th className="py-3 px-3 text-[10px] font-black text-muted uppercase tracking-widest text-right">Ciclo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-base/50">
                                    {filteredRows.map(row => (
                                        <tr
                                            key={row.sale_id}
                                            className={`group transition-colors hover:bg-white/5 ${
                                                row.atribucion === 'indeterminado' ? 'opacity-60 hover:opacity-100' : ''
                                            }`}
                                        >
                                            <td className="py-3 px-3">
                                                <AtribucionBadge status={row.atribucion} />
                                            </td>

                                            <td className="py-3 px-3 text-base whitespace-nowrap">
                                                {new Date(row.fecha_venta).toLocaleDateString()}
                                            </td>

                                            <td className="py-3 px-3 font-bold text-white max-w-[140px] truncate">
                                                {row.cliente}
                                            </td>

                                            <td className="py-3 px-3">
                                                {row.instagram && row.instagram !== 'N/A' ? (
                                                    <a
                                                        href={`https://instagram.com/${row.instagram.replace('@', '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                                    >
                                                        <Instagram size={10} />
                                                        {row.instagram.startsWith('@') ? row.instagram : `@${row.instagram}`}
                                                    </a>
                                                ) : (
                                                    <span className="text-[10px] text-muted/50">Sin IG</span>
                                                )}
                                            </td>

                                            <td className="py-3 px-3">
                                                <Badge variant="indigo" className="rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                                                    {row.setter}
                                                </Badge>
                                            </td>

                                            <td className="py-3 px-3 font-black text-emerald-400 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span>${(row.monto || 0).toLocaleString()} <span className="text-[8px] text-slate-500 font-normal uppercase tracking-wider">neto</span></span>
                                                    {row.monto_bruto && row.monto_bruto !== row.monto && (
                                                        <span className="text-[9px] text-slate-400 font-medium">
                                                            Bruto: ${(row.monto_bruto || 0).toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="py-3 px-3">
                                                {row.atribucion === 'encontrado' ? (
                                                    <div className="space-y-0.5">
                                                        <p className="text-xs font-bold text-white">{row.ad_name}</p>
                                                        {row.ad_keyword && (
                                                            <span className="text-[9px] text-muted bg-white/5 px-1.5 py-0.5 rounded">
                                                                {row.ad_keyword}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-muted italic">—</span>
                                                )}
                                            </td>

                                            <td className="py-3 px-3 text-xs text-muted whitespace-nowrap">
                                                {row.fecha_primer_contacto
                                                    ? new Date(row.fecha_primer_contacto).toLocaleDateString()
                                                    : '—'}
                                            </td>

                                            <td className="py-3 px-3 text-right">
                                                {row.dias_hasta_venta != null ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-muted">
                                                        <Clock size={10} />
                                                        {row.dias_hasta_venta}d
                                                    </span>
                                                ) : '—'}
                                            </td>
                                        </tr>
                                    ))}

                                    {filteredRows.length === 0 && (
                                        <tr>
                                            <td colSpan="9" className="py-20 text-center text-muted text-xs font-bold uppercase tracking-widest">
                                                No se encontraron registros con los filtros aplicados
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
};

export default SalesAttributionPage;
