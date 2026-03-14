import { useState, useEffect } from 'react';
import api from '../../../services/api';
import {
    TrendingUp,
    DollarSign,
    Activity,
    Calendar as CalendarIcon,
    Search,
    Table,
    ArrowUpRight,
    Filter
} from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';

const FinancialAnalysisPage = () => {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchSales();
    }, []);

    const fetchSales = async () => {
        try {
            setLoading(true);
            const response = await api.get('/public/financial-sales');
            setSales(response.data);
        } catch (err) {
            console.error('Error fetching financial sales:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredSales = sales.filter(sale => 
        sale.setter_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                    <Button onClick={fetchSales} variant="surface" size="md" icon={Activity} className="rounded-2xl border-base hover:border-primary/50">
                        Actualizar
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
                        <p className="text-xs font-bold uppercase tracking-widest text-muted">Cargando registros...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-base">
                                    <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Fecha</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Setter</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Monto</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-base/50">
                                {filteredSales.map((sale) => (
                                    <tr key={sale.id} className="group hover:bg-white/5 transition-colors">
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-2">
                                                <CalendarIcon size={14} className="text-muted" />
                                                <span className="text-sm font-bold text-base">
                                                    {new Date(sale.date).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <Badge variant="indigo" className="rounded-lg px-2 py-0.5 text-[10px] uppercase font-black tracking-wider">
                                                {sale.setter_name}
                                            </Badge>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className="text-sm font-black text-success tracking-tighter">
                                                ${sale.amount.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <Button variant="ghost" size="xs" className="text-muted hover:text-white">
                                                Detalles
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredSales.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="py-20 text-center">
                                            <p className="text-sm font-bold text-muted uppercase tracking-widest">No se encontraron ventas</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default FinancialAnalysisPage;
