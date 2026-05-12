import { useState, useEffect } from 'react';
import api from '../../../services/api';
import {
    Calendar as CalendarIcon,
    Activity,
    Search,
    Table,
    Users,
    Instagram,
    Filter,
    ArrowUpRight,
    Copy
} from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import usePersistentFilters from '../../../hooks/usePersistentFilters';

const FinancialAgendasPage = () => {
    const [agendas, setAgendas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState(null);
    
    const { filters, updateFilter: setFilters } = usePersistentFilters('filters_financial_agendas', {
        searchTerm: '',
        startDate: '',
        endDate: ''
    });

    const { searchTerm, startDate, endDate } = filters;
    const setSearchTerm = (val) => setFilters({ searchTerm: val });
    const setStartDate = (val) => setFilters({ startDate: val });
    const setEndDate = (val) => setFilters({ endDate: val });


    useEffect(() => {
        fetchAgendas();
    }, []);

    const fetchAgendas = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get('/public/financial-agendas');
            setAgendas(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            console.error('Error fetching financial agendas:', err);
            setError('No se pudo conectar con el servidor de agendas.');
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        try {
            setLoading(true);
            setSyncing(true);
            setError(null);
            await api.get('/sheets/sync', { params: { tabla: 'Llamadas_DB' } });
        } catch (err) {
            console.warn('Sync failed:', err);
        } finally {
            setSyncing(false);
            await fetchAgendas();
        }
    };

    const filteredAgendas = agendas.filter(agenda => {
        const matchesSearch = (agenda.lead || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (agenda.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (agenda.closer || '').toLowerCase().includes(searchTerm.toLowerCase());

        let matchesDate = true;
        if (startDate || endDate) {
            const aDate = new Date(agenda.date);
            if (startDate) {
                const sDate = new Date(startDate);
                sDate.setHours(0, 0, 0, 0);
                if (aDate < sDate) matchesDate = false;
            }
            if (endDate) {
                const eDate = new Date(endDate);
                eDate.setHours(23, 59, 59, 999);
                if (aDate > eDate) matchesDate = false;
            }
        }
        return matchesSearch && matchesDate;
    });

    const agendasByCloser = filteredAgendas.reduce((acc, curr) => {
        const c = curr.closer || 'Sin Asignar';
        acc[c] = (acc[c] || 0) + 1;
        return acc;
    }, {});
    
    const sortedClosers = Object.entries(agendasByCloser).sort((a, b) => b[1] - a[1]);

    return (
        <div className="p-8 pt-24 max-w-[98%] mx-auto space-y-10 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-white italic tracking-tighter text-balance">Tablero de Agendas</h1>
                    <p className="text-muted font-medium uppercase text-xs tracking-[0.2em]">Registro de Citas Externas (Sheets)</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 bg-surface p-2 rounded-2xl border border-base">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent border-none text-xs text-white focus:outline-none focus:ring-0"
                        />
                        <span className="text-muted text-xs">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent border-none text-xs text-white focus:outline-none focus:ring-0"
                        />
                    </div>
                     <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar setter o cliente..."
                            className="bg-surface border border-base rounded-2xl pl-12 pr-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all w-64 text-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleSync} variant="surface" size="md" icon={Activity} className="rounded-2xl border-base hover:border-primary/50" disabled={loading}>
                        {loading && syncing ? 'Sincronizando...' : 'Actualizar Agendas'}
                    </Button>
                </div>
            </header>

            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card variant="surface" className="flex flex-col justify-center rounded-[2rem] p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Users size={80} />
                    </div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Total Agendados</p>
                    <h3 className="text-4xl font-black text-white italic tracking-tighter">{agendas.length}</h3>
                </Card>

                <Card variant="surface" className="flex flex-col justify-center rounded-[2rem] p-6 relative overflow-hidden group border-primary/20 bg-primary/5">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <CalendarIcon size={80} />
                    </div>
                    <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest mb-2">Próximas Citas</p>
                    <h3 className="text-4xl font-black text-white italic tracking-tighter">
                        {agendas.filter(a => new Date(a.date) >= new Date()).length}
                    </h3>
                </Card>
            </div>

            {/* Summary by Closer Section */}
            <Card variant="surface" className="p-8 space-y-6 rounded-[2.5rem] border-base relative overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[10px] font-black text-base uppercase tracking-widest flex items-center gap-2">
                        <Users className="text-primary" size={16} />
                        Agendas por Closer (Comparativa Calendly)
                    </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {sortedClosers.map(([closerName, count]) => (
                        <div key={closerName} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2 hover:bg-white/10 transition-colors">
                            <span className="text-[9px] text-muted font-black uppercase tracking-widest">{closerName}</span>
                            <span className="text-3xl font-black italic tracking-tighter text-white">{count}</span>
                        </div>
                    ))}
                    {sortedClosers.length === 0 && !loading && (
                        <div className="col-span-full py-8 text-center text-muted text-xs font-bold tracking-widest uppercase">
                            No hay agendas en el rango seleccionado
                        </div>
                    )}
                </div>
            </Card>

            {/* List Section */}
            <Card variant="surface" className="p-8 space-y-6 rounded-[2.5rem] border-base relative">
                <div className="flex justify-between items-center">
                    <h3 className="text-[10px] font-black text-base uppercase tracking-widest flex items-center gap-2">
                        <Table className="text-primary" size={16} />
                        Historial de Agendas
                    </h3>
                </div>

                {loading && !syncing ? (
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
                                    <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Cliente</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Closer</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Setter</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest text-center">Instagram</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest text-right">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-base/50">
                                {filteredAgendas.map((agenda) => (
                                    <tr key={agenda.id} className="group hover:bg-white/5 transition-colors">
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-2">
                                                <CalendarIcon size={14} className="text-muted" />
                                                <span className="text-sm font-bold text-base">
                                                    {agenda.fecha_meet}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className="text-sm font-bold text-white">{agenda.nombre}</span>
                                        </td>
                                        <td className="py-4 px-4">
                                            <Badge variant="amber" className="rounded-lg px-2 py-0.5 text-[10px] uppercase font-black tracking-wider border-amber-500/30">
                                                {agenda.closer}
                                            </Badge>
                                        </td>
                                        <td className="py-4 px-4">
                                            <Badge variant="indigo" className="rounded-lg px-2 py-0.5 text-[10px] uppercase font-black tracking-wider">
                                                {agenda.lead}
                                            </Badge>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            {agenda.instagram && agenda.instagram !== 'N/A' ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <a 
                                                        href={`https://instagram.com/${agenda.instagram.replace('@', '')}`} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                                                    >
                                                        <Instagram size={10} />
                                                        {agenda.instagram.startsWith('@') ? agenda.instagram : `@${agenda.instagram}`}
                                                    </a>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigator.clipboard.writeText(agenda.instagram.startsWith('@') ? agenda.instagram : `@${agenda.instagram}`);
                                                        }}
                                                        className="text-muted hover:text-primary transition-colors p-1"
                                                        title="Copiar usuario"
                                                    >
                                                        <Copy size={12} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted">No IG</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <Badge variant="success" className="rounded-lg">
                                                Sincronizado
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                                {filteredAgendas.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="py-20 text-center text-muted uppercase text-xs font-bold tracking-widest">
                                            No se encontraron agendas
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

export default FinancialAgendasPage;
