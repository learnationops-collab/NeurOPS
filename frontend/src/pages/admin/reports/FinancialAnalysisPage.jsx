import { useState, useEffect } from 'react';
import api from '../../../services/api';
import FinancialSaleDetailsModal from './FinancialSaleDetailsModal';
import {
    TrendingUp,
    DollarSign,
    Activity,
    Calendar as CalendarIcon,
    Search,
    Table,
    ArrowUpRight,
    Filter,
    X,
    AlertTriangle
} from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';

const FinancialAnalysisPage = () => {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [resolvingSale, setResolvingSale] = useState(null);
    const [resolveFormData, setResolveFormData] = useState({
        product: '',
        payment_type: '',
        setter_name: '',
        amount: ''
    });
    const [resolving, setResolving] = useState(false);
    
    // New state for details modal
    const [viewingSale, setViewingSale] = useState(null);

    useEffect(() => {
        fetchSales();
    }, []);

    const fetchSales = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get('/public/financial-sales');
            setSales(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            console.error('Error fetching financial sales:', err);
            setError('No se pudo conectar con el servidor de ventas. Por favor, intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        try {
            setLoading(true);
            setSyncing(true);
            setError(null);
            
            // 1. Sync new data from sheets
            await api.post('/public/financial-sales/sync');
            
        } catch (err) {
            console.warn('Sync failed, falling back to existing DB data:', err);
        } finally {
            setSyncing(false);
        }

        // 2. Fetch all sales from DB
        await fetchSales();
    };

    const filteredSales = sales.filter(sale => 
        sale.setter_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const openResolveModal = (sale) => {
        setResolvingSale(sale);
        setResolveFormData({
            product: sale.producto === 'N/A' || sale.producto === 'Desconocido' ? '' : sale.producto,
            payment_type: sale.payment_type === 'N/A' || sale.payment_type === 'Desconocido' ? '' : sale.payment_type,
            setter_name: sale.setter_name === 'Desconocido' ? '' : sale.setter_name,
            amount: sale.amount || ''
        });
    };

    const handleResolveSubmit = async (e) => {
        e.preventDefault();
        try {
            setResolving(true);
            const payload = { ...resolveFormData };
            if (!payload.amount) {
                delete payload.amount;
            }
            
            const response = await api.put(`/public/financial-sales/${resolvingSale.id}`, payload);
            
            setSales(sales.map(s => s.id === resolvingSale.id ? response.data.sale : s));
            setResolvingSale(null);
        } catch (err) {
            console.error('Error resolving sale:', err);
            alert('Error al resolver la venta. Intenta nuevamente.');
        } finally {
            setResolving(false);
        }
    };

    const totalAmount = sales.reduce((sum, sale) => sum + sale.amount, 0);
    const averageSale = sales.length > 0 ? totalAmount / sales.length : 0;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-white italic tracking-tighter text-balance">Análisis Financiero</h1>
                    <p className="text-muted font-medium uppercase text-xs tracking-[0.2em]">Registro de Ventas Externas (Excel)</p>
                </div>

                <div className="flex items-center gap-4">
                     <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar por setter..."
                            className="bg-surface border border-base rounded-2xl pl-12 pr-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleSync} variant="surface" size="md" icon={Activity} className="rounded-2xl border-base hover:border-primary/50" disabled={loading}>
                        {loading && syncing ? 'Sincronizando...' : 'Actualizar e Importar'}
                    </Button>
                </div>
            </header>

            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card variant="surface" className="flex flex-col justify-center rounded-[2rem] p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-500">
                        <DollarSign size={80} />
                    </div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Total Recaudado</p>
                    <h3 className="text-4xl font-black text-success italic tracking-tighter">${totalAmount.toLocaleString()}</h3>
                    <p className="text-[9px] font-bold text-muted uppercase mt-1">Basado en {sales.length} ventas</p>
                </Card>

                <Card variant="surface" className="flex flex-col justify-center rounded-[2rem] p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-500">
                        <TrendingUp size={80} />
                    </div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Ticket Promedio</p>
                    <h3 className="text-4xl font-black text-indigo-400 italic tracking-tighter">${averageSale.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
                </Card>

                <Card variant="surface" className="flex flex-col justify-center rounded-[2rem] p-6 relative overflow-hidden group border-primary/20 bg-primary/5">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-500">
                        <Activity size={80} />
                    </div>
                    <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest mb-2">Total de Ventas</p>
                    <h3 className="text-4xl font-black text-white italic tracking-tighter">{sales.length}</h3>
                </Card>
            </div>

            {/* List Section */}
            <Card variant="surface" className="p-8 space-y-6 rounded-[2.5rem] border-base relative">
                <div className="flex justify-between items-center">
                    <h3 className="text-[10px] font-black text-base uppercase tracking-widest flex items-center gap-2">
                        <Table className="text-primary" size={16} />
                        Historial de Ventas
                    </h3>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted">
                            {syncing ? 'Sincronizando con Google Sheets...' : 'Cargando registros...'}
                        </p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                        <div className="p-4 rounded-full bg-rose-500/10 text-rose-500 mb-2">
                            <Activity size={32} />
                        </div>
                        <p className="text-sm font-bold text-white uppercase tracking-widest">{error}</p>
                        <Button onClick={fetchSales} variant="surface" size="sm" className="mt-2 rounded-xl">
                            Reintentar Conexión
                        </Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-base">
                                    <th className="py-4 px-4"><span className="sr-only">Estado</span></th>
                                    <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Fecha</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Cliente</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Closer</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Setter</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Instagram</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Producto</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Monto</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-base/50">
                                {filteredSales.map((sale) => (
                                    <tr key={sale.id} className={`group hover:bg-white/5 transition-colors ${sale.status === 'error' ? 'bg-rose-500/10' : ''}`}>
                                        <td className="py-4 px-4 pl-6">
                                            {sale.status === 'error' && (
                                                <div title={sale.error_notes}>
                                                    <AlertTriangle size={16} className="text-rose-500" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-2">
                                                <CalendarIcon size={14} className="text-muted" />
                                                <span className="text-sm font-bold text-base">
                                                    {new Date(sale.date).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className="text-sm font-bold text-white">{sale.cliente}</span>
                                        </td>
                                        <td className="py-4 px-4">
                                            <Badge variant="amber" className="rounded-lg px-2 py-0.5 text-[10px] uppercase font-black tracking-wider border-amber-500/30">
                                                {sale.closer}
                                            </Badge>
                                        </td>
                                        <td className="py-4 px-4">
                                            <Badge variant="indigo" className="rounded-lg px-2 py-0.5 text-[10px] uppercase font-black tracking-wider">
                                                {sale.setter_name}
                                            </Badge>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            {sale.instagram && sale.instagram !== 'N/A' ? (
                                                <a 
                                                    href={`https://instagram.com/${sale.instagram.replace('@', '')}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-xs font-bold text-primary hover:underline flex items-center justify-center gap-1"
                                                >
                                                    <Activity size={10} />
                                                    {sale.instagram.startsWith('@') ? sale.instagram : `@${sale.instagram}`}
                                                </a>
                                            ) : (
                                                <span className="text-xs text-muted">No IG</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className="text-[10px] font-black text-muted uppercase tracking-widest bg-white/5 py-1 px-2 rounded-lg">{sale.producto}</span>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className="text-sm font-black text-success tracking-tighter">
                                                ${sale.amount.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            {sale.status === 'error' ? (
                                                <Button variant="surface" size="xs" onClick={() => openResolveModal(sale)} className="bg-rose-500/20 border border-rose-500/30 text-rose-500 hover:bg-rose-500/40">
                                                    Resolver Error
                                                </Button>
                                            ) : (
                                                <Button variant="ghost" size="xs" onClick={() => setViewingSale(sale)} className="text-muted hover:text-white">
                                                    Detalles
                                                </Button>
                                            )}
                                        </td>

                                    </tr>
                                ))}
                                 {filteredSales.length === 0 && !error && (
                                    <tr>
                                        <td colSpan="8" className="py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <Search size={24} className="text-muted opacity-20" />
                                                <p className="text-sm font-bold text-muted uppercase tracking-widest">No se encontraron ventas</p>
                                                {searchTerm && (
                                                    <Button variant="ghost" size="xs" onClick={() => setSearchTerm('')} className="text-primary hover:bg-primary/5">
                                                        Limpiar búsqueda
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Modal de Resolución de Errores */}
            {resolvingSale && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <Card variant="surface" className="w-full max-w-lg p-6 rounded-3xl border-base shadow-2xl relative overflow-hidden">
                        <button 
                            onClick={() => setResolvingSale(null)}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/5 transition-colors text-muted hover:text-white"
                        >
                            <X size={20} />
                        </button>
                        
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xl font-black text-white italic tracking-tighter">Resolver Venta</h3>
                                <p className="text-[11px] font-bold text-rose-400/80 uppercase mt-2">{resolvingSale.error_notes}</p>
                            </div>

                            <form onSubmit={handleResolveSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-2">Setter (Columna K)</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-base border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
                                        value={resolveFormData.setter_name}
                                        onChange={(e) => setResolveFormData({...resolveFormData, setter_name: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-2">Producto</label>
                                        <select 
                                            className="w-full bg-base border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors appearance-none"
                                            value={resolveFormData.product}
                                            onChange={(e) => setResolveFormData({...resolveFormData, product: e.target.value})}
                                            required
                                        >
                                            <option value="">Seleccionar Producto...</option>
                                            <option value="Residency Roadmap">Residency Roadmap (RR)</option>
                                            <option value="Ace Learners">Ace Learners (AL)</option>
                                            <option value="Specialist Iniciative">Specialist Iniciative (SI)</option>
                                            <option value="Seña">Seña</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-2">Tipo de Pago</label>
                                        <select 
                                            className="w-full bg-base border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors appearance-none"
                                            value={resolveFormData.payment_type}
                                            onChange={(e) => setResolveFormData({...resolveFormData, payment_type: e.target.value})}
                                            required
                                        >
                                            <option value="">Seleccionar Pago...</option>
                                            <option value="Completo">Completo</option>
                                            <option value="Cuota / Primer Pago">Cuota / Primer Pago</option>
                                            <option value="Seña">Seña</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="pt-4 flex gap-3">
                                    <Button type="button" variant="ghost" className="flex-1 rounded-xl" onClick={() => setResolvingSale(null)}>
                                        Cancelar
                                    </Button>
                                    <Button type="submit" variant="primary" className="flex-1 rounded-xl bg-success text-white hover:bg-success/80 border-success/20" disabled={resolving}>
                                        {resolving ? 'Guardando...' : 'Confirmar Datos'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </Card>
                </div>
            )}

            {/* Modal de Detalles Completos */}
            <FinancialSaleDetailsModal 
                sale={viewingSale} 
                onClose={() => setViewingSale(null)} 
            />
        </div>
    );
};

export default FinancialAnalysisPage;
