import { useState, useEffect } from 'react';
import api from '../services/api';
import {
    Database,
    Package,
    CreditCard,
    Radio,
    HelpCircle,
    Users,
    TrendingUp,
    Calendar,
    Search,
    Edit3,
    Check,
    X,
    ChevronLeft,
    ChevronRight,
    Filter,
    Trash2,
    Save
} from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import AdvancedImportTool from '../components/AdvancedImportTool';
import { FileUp } from 'lucide-react';
import DateRangeFilter from '../components/DateRangeFilter';
import MultiSelectFilter from '../components/MultiSelectFilter';
import usePersistentFilters from '../hooks/usePersistentFilters';

const DatabasePage = () => {
    const [activeTab, setActiveTab] = useState('leads_raw'); // Default to leads for visibility
    const [data, setData] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [showFilters, setShowFilters] = useState(false);

    // Persistent Filters for each tab? ideally separated or unified
    // For simplicity, we can use one hook object but keyed by tab?
    // Let's use simpler approach: one filter state object reset on tab change or managed by hook?
    // We'll use local state for simplicity here or a hook with a key that includes activeTab
    const { filters, updateFilter, setFilters } = usePersistentFilters(`admin_${activeTab}`, {
        dateRange: { type: 'all', start: '', end: '' },
        status: [],
        program: [],
        payment_method: [],
        payment_type: [],
        closer: [],
        origin: [],
        sort_by: 'newest'
    });

    const tabs = [
        { id: 'leads_raw', label: 'Leads / Clientes', icon: Users, endpoint: '/admin/db/leads_raw' },
        { id: 'sales_raw', label: 'Ventas (Pagos)', icon: TrendingUp, endpoint: '/admin/db/sales_raw' },
        { id: 'agendas', label: 'Agenda General', icon: Calendar, endpoint: '/admin/db/agendas' },
        { id: 'programs', label: 'Programas', icon: Package, endpoint: '/admin/db/programs' },
        { id: 'payment-methods', label: 'Metodos de Pago', icon: CreditCard, endpoint: '/admin/db/payment-methods' },
        { id: 'questions', label: 'Reporte Diario (Q)', icon: HelpCircle, endpoint: '/admin/db/questions' },
        { id: 'import', label: 'Importaciones', icon: FileUp, endpoint: null },
    ];

    useEffect(() => {
        // Reset specific filters when switching if needed, or let them persist per tab
        fetchData(1);
    }, [activeTab, filters]);

    const fetchData = async (page = 1) => {
        try {
            setLoading(true);
            const tab = tabs.find(t => t.id === activeTab);
            if (!tab?.endpoint) {
                if (tab.id !== 'import') setData([]);
                setLoading(false);
                return;
            }

            const params = {
                page,
                search,
                start_date: filters.dateRange?.start,
                end_date: filters.dateRange?.end,
                ...filters // spread others like sort_by
            };

            // Format list filters
            if (filters.status?.length) params.status = filters.status.join(',');
            if (filters.payment_method?.length) params.payment_method = filters.payment_method.join(',');
            if (filters.payment_type?.length) params.payment_type = filters.payment_type.join(',');
            if (filters.closer?.length) params.closer = filters.closer.join(',');
            if (filters.origin?.length) params.origin = filters.origin.join(',');
            // Program filter?

            const res = await api.get(tab.endpoint, { params });

            if (res.data.data) {
                setData(res.data.data);
                setPagination({ page, total: res.data.total, pages: res.data.pages });
            } else {
                setData(res.data);
                setPagination({ page: 1, total: res.data.length, pages: 1 });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // ... editing logic ...
    const startEditing = (item) => { setEditingId(item.id); setEditForm({ ...item }); };
    const cancelEditing = () => { setEditingId(null); setEditForm({}); };
    const handleSave = async () => { /* ... existing ... */
        try {
            const tab = tabs.find(t => t.id === activeTab);
            await api.post(tab.endpoint, editForm);
            setEditingId(null);
            fetchData(pagination.page);
        } catch (err) { alert("Error al guardar cambios"); }
    };
    const handleDelete = async (id) => { /* ... existing ... */
        if (!window.confirm("¿Seguro que deseas eliminar este registro?")) return;
        try {
            const tab = tabs.find(t => t.id === activeTab);
            await api.delete(`${tab.endpoint}?id=${id}`);
            fetchData(pagination.page);
        } catch (err) { alert("No se pudo eliminar el registro"); }
    };

    const renderHeader = () => { /* ... existing ... */
        const headers = {
            'programs': ['ID', 'Nombre', 'Precio', 'Estado'],
            'payment-methods': ['ID', 'Nombre', 'Fee %', 'Fee Fixed', 'Estado'],
            'leads_raw': ['ID', 'Nombre completo', 'Email', 'Teléfono / Instagram', 'Creación'],
            'sales_raw': ['ID', 'Fecha', 'Cliente / Programa', 'Monto', 'Tipo', 'Método'],
            'agendas': ['ID', 'Fecha/Hora', 'Lead / Closer', 'Estado', 'Origen'],
            'questions': ['ID', 'Texto', 'Tipo', 'Orden', 'Estado']
        };
        return (headers[activeTab] || []).map(h => (
            <th key={h} className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest">{h}</th>
        ));
    };

    const renderCell = (item, field, type = 'text') => { /* ... existing ... */
        if (editingId === item.id) {
            if (type === 'checkbox') return <input type="checkbox" checked={editForm[field]} onChange={(e) => setEditForm({ ...editForm, [field]: e.target.checked })} />;
            if (type === 'number') return <input type="number" step="0.01" className="bg-slate-800 border-none rounded px-2 py-1 text-white w-20" value={editForm[field]} onChange={(e) => setEditForm({ ...editForm, [field]: parseFloat(e.target.value) })} />;
            if (type === 'datetime') return <input type="datetime-local" className="bg-slate-800 border-none rounded px-2 py-1 text-white text-xs" value={editForm[field] ? (editForm[field].includes('Z') ? editForm[field].split('.')[0] : editForm[field].substring(0, 16)) : ''} onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })} />;
            return <input type="text" className="bg-slate-800 border-none rounded px-2 py-1 text-white w-full" value={editForm[field] || ''} onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })} />;
        }

        if (type === 'status') return <Badge variant={item[field] ? 'success' : 'neutral'}>{item[field] ? 'Activo' : 'Inactivo'}</Badge>;
        if (type === 'price') return <span className="text-secondary font-bold">${item[field]}</span>;
        return <span className="text-base/80">{item[field]}</span>;
    };

    const statusOptions = [
        { value: 'scheduled', label: 'Programada' },
        { value: 'completed', label: 'Completada' },
        { value: 'no_show', label: 'No Show' },
        { value: 'canceled', label: 'Cancelada' },
        { value: 'sold', label: 'Ventada' }
    ];

    const paymentMethods = [
        { value: 'Stripe', label: 'Stripe' },
        { value: 'PayPal', label: 'PayPal' },
        { value: 'Transferencia', label: 'Transferencia' }
    ];

    const paymentTypes = [
        { value: 'Full', label: 'Pago Completo' },
        { value: 'Installment', label: 'Cuota' },
        { value: 'Down Payment', label: 'Seña' }
    ];

    const originOptions = [
        { value: 'Manual Closer', label: 'Manual' },
        { value: 'Calendly', label: 'Calendly' },
        { value: 'Website', label: 'Web' }
    ];

    const renderFilters = () => {
        if (!showFilters) return null;

        return (
            <div className="bg-surface border border-base rounded-[1.5rem] p-6 mb-8 animate-in slide-in-from-top-4 fade-in duration-300 flex flex-wrap gap-4 items-center">
                <DateRangeFilter value={filters.dateRange} onChange={(val) => updateFilter('dateRange', val)} />

                {activeTab === 'leads_raw' && (
                    <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
                        {['newest', 'oldest', 'a-z', 'z-a'].map(opt => (
                            <button
                                key={opt}
                                onClick={() => updateFilter('sort_by', opt)}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filters.sort_by === opt ? 'bg-primary text-white' : 'text-muted hover:text-white'}`}
                            >
                                {opt === 'newest' ? 'Recientes' : opt === 'oldest' ? 'Antiguos' : opt.toUpperCase()}
                            </button>
                        ))}
                    </div>
                )}

                {activeTab === 'sales_raw' && (
                    <>
                        <MultiSelectFilter label="Tipo" options={paymentTypes} value={filters.payment_type} onChange={(val) => updateFilter('payment_type', val)} />
                        <MultiSelectFilter label="Método" options={paymentMethods} value={filters.payment_method} onChange={(val) => updateFilter('payment_method', val)} />
                    </>
                )}

                {activeTab === 'agendas' && (
                    <>
                        <MultiSelectFilter label="Estado" options={statusOptions} value={filters.status} onChange={(val) => updateFilter('status', val)} />
                        <MultiSelectFilter label="Origen" options={originOptions} value={filters.origin} onChange={(val) => updateFilter('origin', val)} />
                        {/* Closer filter could be dynamic input or dropdown if we fetched closers */}
                    </>
                )}

                <Button variant="ghost" className="text-rose-500 ml-auto" onClick={() => setFilters({ dateRange: { type: 'all' }, sort_by: 'newest' })}>Limpiar</Button>
            </div>
        );
    };

    const renderRow = (item) => { /* ... existing */
        if (activeTab === 'programs') return (
            <>
                <td className="px-8 py-5 text-primary font-black">#{item.id}</td>
                <td className="px-8 py-5">{renderCell(item, 'name')}</td>
                <td className="px-8 py-5">{renderCell(item, 'price', 'number')}</td>
                <td className="px-8 py-5">{renderCell(item, 'is_active', 'status')}</td>
            </>
        );
        if (activeTab === 'payment-methods') return (
            <>
                <td className="px-8 py-5 text-primary font-black">#{item.id}</td>
                <td className="px-8 py-5">{renderCell(item, 'name')}</td>
                <td className="px-8 py-5">{renderCell(item, 'fee_percent', 'number')}%</td>
                <td className="px-8 py-5">${renderCell(item, 'fee_fixed', 'number')}</td>
                <td className="px-8 py-5">{renderCell(item, 'is_active', 'status')}</td>
            </>
        );
        if (activeTab === 'leads_raw') return (
            <>
                <td className="px-8 py-5 text-primary font-black">#{item.id}</td>
                <td className="px-8 py-5">{renderCell(item, 'full_name')}</td>
                <td className="px-8 py-5">{renderCell(item, 'email')}</td>
                <td className="px-8 py-5">
                    <p className="text-xs text-base">{renderCell(item, 'phone')}</p>
                    <p className="text-[10px] text-primary">{renderCell(item, 'instagram')}</p>
                </td>
                <td className="px-8 py-5 text-[10px] text-muted uppercase">{new Date(item.created_at).toLocaleDateString()}</td>
            </>
        );
        if (activeTab === 'sales_raw') return (
            <>
                <td className="px-8 py-5 text-primary font-black">#{item.id}</td>
                <td className="px-8 py-5 text-[10px] text-muted uppercase">{new Date(item.date).toLocaleDateString()}</td>
                <td className="px-8 py-5">
                    <p className="text-base font-bold text-sm tracking-tight">{item.student}</p>
                    <p className="text-[10px] text-primary font-black uppercase">{item.program}</p>
                </td>
                <td className="px-8 py-5 text-secondary font-black">${renderCell(item, 'amount', 'number')}</td>
                <td className="px-8 py-5">{renderCell(item, 'payment_type')}</td>
                <td className="px-8 py-5 text-[10px] text-muted uppercase font-black">{item.method}</td>
            </>
        );
        if (activeTab === 'agendas') return (
            <>
                <td className="px-8 py-5 text-primary font-black">#{item.id}</td>
                <td className="px-8 py-5 text-xs text-base/80 font-bold">{editingId === item.id ? renderCell(item, 'start_time', 'datetime') : new Date(item.start_time).toLocaleString()}</td>
                <td className="px-8 py-5">
                    <p className="text-base font-bold text-sm">{item.lead}</p>
                    <p className="text-[10px] text-primary font-black uppercase">Closer: {item.closer}</p>
                </td>
                <td className="px-8 py-5">{renderCell(item, 'status')}</td>
                <td className="px-8 py-5">{renderCell(item, 'origin')}</td>
            </>
        );
        if (activeTab === 'questions') return (
            <>
                <td className="px-8 py-5 text-primary font-black">#{item.id}</td>
                <td className="px-8 py-5">{renderCell(item, 'text')}</td>
                <td className="px-8 py-5">{renderCell(item, 'type')}</td>
                <td className="px-8 py-5">{renderCell(item, 'order', 'number')}</td>
                <td className="px-8 py-5">{renderCell(item, 'is_active', 'status')}</td>
            </>
        );
        return null; // For questions or others
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
            <header className="flex justify-between items-end">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-base italic tracking-tighter">Bases de Datos Maestro</h1>
                    <p className="text-muted font-medium uppercase text-xs tracking-[0.2em]">Gestión integral de la infraestructura de datos</p>
                </div>
            </header>

            <div className="flex flex-wrap gap-2 p-1 bg-surface border border-base rounded-2xl overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); cancelEditing(); }}
                        className={`flex items-center gap-3 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted hover:text-base'}`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {(activeTab === 'leads_raw' || activeTab === 'sales_raw' || activeTab === 'agendas') && (
                <div className="flex gap-4">
                    <Button
                        variant="ghost"
                        icon={Filter}
                        className={`border-base ${showFilters ? 'bg-surface text-primary border-primary' : 'text-muted'}`}
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        Filtros Avanzados
                    </Button>
                </div>
            )}

            {renderFilters()}

            <div className="flex gap-4 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                    <input
                        className="w-full bg-surface border border-base rounded-2xl pl-11 pr-4 py-4 text-base text-sm outline-none focus:ring-1 focus:ring-primary/50 transition-all font-bold placeholder:opacity-50"
                        placeholder="Buscar registros..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onBlur={() => fetchData(1)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchData(1)}
                    />
                </div>
                {pagination.pages > 1 && (
                    <div className="flex bg-surface rounded-xl p-1 border border-base">
                        <button disabled={pagination.page === 1} onClick={() => fetchData(pagination.page - 1)} className="p-2 text-muted hover:text-base disabled:text-muted/20 transition-all"><ChevronLeft size={20} /></button>
                        <div className="px-4 flex items-center text-[10px] font-black text-base uppercase tracking-widest">{pagination.page} / {pagination.pages}</div>
                        <button disabled={pagination.page === pagination.pages} onClick={() => fetchData(pagination.page + 1)} className="p-2 text-muted hover:text-base disabled:text-muted/20 transition-all"><ChevronRight size={20} /></button>
                    </div>
                )}
            </div>
            {/* ... Rest of JSX ... */}

            {activeTab === 'import' ? (
                <AdvancedImportTool />
            ) : (
                <Card variant="surface" padding="p-0 overflow-hidden">
                    {loading ? (
                        <div className="p-32 text-center text-muted font-black uppercase tracking-[0.5em] animate-pulse">Sincronizando Nodo...</div>
                    ) : (
                        <div className="overflow-x-auto min-h-[400px]">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-base bg-surface-hover">
                                        {renderHeader()}
                                        <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-base">
                                    {data.map(item => (
                                        <tr key={item.id} className={`hover:bg-surface-hover/50 transition-all group ${editingId === item.id ? 'bg-primary/5' : ''}`}>
                                            {renderRow(item)}
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {editingId === item.id ? (
                                                        <>
                                                            <button onClick={handleSave} className="p-2 text-success hover:bg-success/10 rounded-lg"><Save size={16} /></button>
                                                            <button onClick={cancelEditing} className="p-2 text-accent hover:bg-accent/10 rounded-lg"><X size={16} /></button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => startEditing(item)} className="p-2 text-muted hover:text-primary hover:bg-primary/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Edit3 size={16} /></button>
                                                            {activeTab === 'agendas' && <button onClick={() => handleDelete(item.id)} className="p-2 text-muted hover:text-accent hover:bg-accent/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
};

export default DatabasePage;
