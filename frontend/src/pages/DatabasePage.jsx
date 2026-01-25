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
    Trash2
} from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

const DatabasePage = () => {
    const [activeTab, setActiveTab] = useState('programs');
    const [data, setData] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    const tabs = [
        { id: 'programs', label: 'Programas', icon: Package, endpoint: '/admin/db/programs' },
        { id: 'payment-methods', label: 'Metodos de Pago', icon: CreditCard, endpoint: '/admin/db/payment-methods' },
        { id: 'leads_raw', label: 'Leads / Clientes', icon: Users, endpoint: '/admin/db/leads_raw' },
        { id: 'sales_raw', label: 'Ventas (Pagos)', icon: TrendingUp, endpoint: '/admin/db/sales_raw' },
        { id: 'agendas', label: 'Agenda General', icon: Calendar, endpoint: '/admin/db/agendas' },
        { id: 'questions', label: 'Reporte Diario (Q)', icon: HelpCircle, endpoint: '/admin/db/questions' },
    ];

    useEffect(() => {
        fetchData(1);
    }, [activeTab]);

    const fetchData = async (page = 1) => {
        try {
            setLoading(true);
            const tab = tabs.find(t => t.id === activeTab);
            const res = await api.get(tab.endpoint, { params: { page, search } });

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

    const startEditing = (item) => {
        setEditingId(item.id);
        setEditForm({ ...item });
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditForm({});
    };

    const handleSave = async () => {
        try {
            const tab = tabs.find(t => t.id === activeTab);
            await api.post(tab.endpoint, editForm);
            setEditingId(null);
            fetchData(pagination.page);
        } catch (err) {
            alert("Error al guardar cambios");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Seguro que deseas eliminar este registro?")) return;
        try {
            const tab = tabs.find(t => t.id === activeTab);
            await api.delete(`${tab.endpoint}?id=${id}`);
            fetchData(pagination.page);
        } catch (err) {
            alert("No se pudo eliminar el registro");
        }
    };

    const renderHeader = () => {
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

    const renderCell = (item, field, type = 'text') => {
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

    const renderRow = (item) => {
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
        return null;
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
        </div>
    );
};

export default DatabasePage;
