import { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { RefreshCcw, Search, Edit2, Check, X } from 'lucide-react';
import Card from '../../components/ui/Card';
import usePersistentFilters from '../../hooks/usePersistentFilters';

const PublicFinancialSalesPage = () => {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    
    const { filters, updateFilter: setFilters } = usePersistentFilters('filters_financial_sales', {
        searchTerm: ''
    });

    const { searchTerm } = filters;
    const setSearchTerm = (val) => setFilters({ searchTerm: val });

    
    // Edit Modal State
    const [editingSale, setEditingSale] = useState(null);
    const [editData, setEditData] = useState({});

    useEffect(() => {
        fetchSales();
    }, []);

    const fetchSales = async () => {
        setLoading(true);
        try {
            const res = await api.get('/public/financial-sales');
            setSales(res.data);
        } catch (error) {
            toast.error('Error al cargar las ventas');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await api.post('/public/financial-sales/sync');
            toast.success(res.data.message || 'Sincronización exitosa');
            fetchSales();
        } catch (error) {
            toast.error('Error al sincronizar');
            console.error(error);
        } finally {
            setSyncing(false);
        }
    };

    const handleEditClick = (sale) => {
        setEditingSale(sale.id);
        setEditData({
            instagram: sale.instagram || '',
            nombre_cliente: sale.nombre_cliente || '',
            email_vendedor: sale.email_vendedor || '',
            amount: sale.monto || 0,
            product: sale.tipo_pago || '',
            payment_type: sale.metodo_pago || '',
            setter_name: sale.setter || ''
        });
    };

    const handleSave = async (id) => {
        try {
            const res = await api.put(`/public/financial-sales/${id}`, editData);
            toast.success('Venta actualizada correctamente');
            
            // Actualizar localmente sin refetch para mejor UX
            setSales(sales.map(s => s.id === id ? { ...s, ...res.data.sale } : s));
            setEditingSale(null);
        } catch (error) {
            toast.error('Error al actualizar venta');
            console.error(error);
        }
    };

    // Filter
    const filteredSales = sales.filter(s => {
        const term = searchTerm.toLowerCase();
        return (
            (s.nombre_cliente && s.nombre_cliente.toLowerCase().includes(term)) ||
            (s.instagram && s.instagram.toLowerCase().includes(term)) ||
            (s.email_vendedor && s.email_vendedor.toLowerCase().includes(term))
        );
    });

    return (
        <div className="w-full p-4 lg:p-8 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white">Registro de Ventas</h1>
                    <p className="text-sm text-slate-400">Verifica y corrige las ventas para correcta atribución.</p>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por cliente o IG..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                    </div>
                    
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white text-sm font-semibold transition-all shadow-lg"
                    >
                        <RefreshCcw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">{syncing ? 'Sincronizando...' : 'Sincronizar Sheets'}</span>
                    </button>
                </div>
            </div>

            <Card className="overflow-x-auto">
                {loading ? (
                    <div className="flex justify-center p-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                                <th className="p-4 font-semibold">Fecha</th>
                                <th className="p-4 font-semibold">Cliente</th>
                                <th className="p-4 font-semibold">Instagram</th>
                                <th className="p-4 font-semibold text-right">Monto</th>
                                <th className="p-4 font-semibold">Producto/Pago</th>
                                <th className="p-4 font-semibold">Roles</th>
                                <th className="p-4 font-semibold text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm text-slate-300 divide-y divide-slate-800/50">
                            {filteredSales.map((sale) => {
                                const isEditing = editingSale === sale.id;
                                
                                return (
                                    <tr key={sale.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="p-4 whitespace-nowrap">
                                            {new Date(sale.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        
                                        <td className="p-4">
                                            {isEditing ? (
                                                <input 
                                                    type="text" 
                                                    value={editData.nombre_cliente} 
                                                    onChange={e => setEditData({...editData, nombre_cliente: e.target.value})}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
                                                />
                                            ) : (
                                                <span className="font-medium text-white">{sale.nombre_cliente || 'N/A'}</span>
                                            )}
                                        </td>
                                        
                                        <td className="p-4">
                                            {isEditing ? (
                                                <input 
                                                    type="text" 
                                                    value={editData.instagram} 
                                                    onChange={e => setEditData({...editData, instagram: e.target.value})}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
                                                    placeholder="Sin @"
                                                />
                                            ) : (
                                                <span className={`${!sale.instagram || sale.instagram === 'N/A' ? 'text-red-400 font-semibold' : 'text-slate-300'}`}>
                                                    {sale.instagram ? `@${sale.instagram}` : 'Falta IG'}
                                                </span>
                                            )}
                                        </td>
                                        
                                        <td className="p-4 text-right">
                                            {isEditing ? (
                                                <input 
                                                    type="number" 
                                                    value={editData.amount} 
                                                    onChange={e => setEditData({...editData, amount: e.target.value})}
                                                    className="w-20 bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs text-right"
                                                />
                                            ) : (
                                                <span className="text-emerald-400 font-bold">${sale.monto}</span>
                                            )}
                                        </td>
                                        
                                        <td className="p-4 space-y-1">
                                            {isEditing ? (
                                                <>
                                                    <input 
                                                        type="text" 
                                                        value={editData.product} 
                                                        onChange={e => setEditData({...editData, product: e.target.value})}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs mb-1"
                                                        placeholder="Producto"
                                                    />
                                                    <input 
                                                        type="text" 
                                                        value={editData.payment_type} 
                                                        onChange={e => setEditData({...editData, payment_type: e.target.value})}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
                                                        placeholder="Tipo Pago"
                                                    />
                                                </>
                                            ) : (
                                                <>
                                                    <div className="font-medium text-slate-200">{sale.tipo_pago || 'N/A'}</div>
                                                    <div className="text-xs text-slate-500">{sale.metodo_pago || 'N/A'}</div>
                                                </>
                                            )}
                                        </td>
                                        
                                        <td className="p-4 space-y-1">
                                            {isEditing ? (
                                                <>
                                                    <input 
                                                        type="text" 
                                                        value={editData.email_vendedor} 
                                                        onChange={e => setEditData({...editData, email_vendedor: e.target.value})}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs mb-1"
                                                        placeholder="Closer (Email)"
                                                    />
                                                    <input 
                                                        type="text" 
                                                        value={editData.setter_name} 
                                                        onChange={e => setEditData({...editData, setter_name: e.target.value})}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
                                                        placeholder="Setter"
                                                    />
                                                </>
                                            ) : (
                                                <>
                                                    <div className="text-xs text-slate-300">C: {sale.email_vendedor?.split('@')[0] || 'N/A'}</div>
                                                    <div className="text-xs text-slate-400">S: {sale.setter || 'N/A'}</div>
                                                </>
                                            )}
                                        </td>
                                        
                                        <td className="p-4 text-center">
                                            {isEditing ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => handleSave(sale.id)} className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors">
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setEditingSale(null)} className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button onClick={() => handleEditClick(sale)} className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            
                            {filteredSales.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="p-8 text-center text-slate-500">
                                        No se encontraron ventas con esos criterios.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </Card>
        </div>
    );
};

export default PublicFinancialSalesPage;
