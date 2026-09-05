import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { X, Users, Search, Plus, Check, AlertCircle } from 'lucide-react';
import { parseUtcIso } from '../../utils/datetime';

const AttributionModal = ({ sale, onClose, onSuccess }) => {
    const [saleIg, setSaleIg] = useState(sale.instagram || '');
    const [updatingIg, setUpdatingIg] = useState(false);
    
    const [searchVal, setSearchVal] = useState(sale.nombre_cliente || '');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [searched, setSearched] = useState(false);
    
    const [matchedAgenda, setMatchedAgenda] = useState(null);
    const [checkingMatch, setCheckingMatch] = useState(false);

    const [setters, setSetters] = useState([]);
    const [closers, setClosers] = useState([]);

    const [newAgenda, setNewAgenda] = useState({
        lead: sale.nombre_cliente || '',
        fuente: '',
        closer: sale.email_vendedor || '',
        mail: sale.mail_cliente || '',
        whatsapp: sale.telefono || '',
        fecha: sale.date ? sale.date.split('T')[0] : new Date().toISOString().split('T')[0]
    });
    const [creatingAgenda, setCreatingAgenda] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);

    // Buscar match de agenda automáticamente por Instagram
    const checkAutomaticMatch = async (ig) => {
        if (!ig || ig.toLowerCase() === 'n/a') {
            setMatchedAgenda(null);
            return;
        }
        setCheckingMatch(true);
        try {
            const res = await api.get('/public/financial-agendas', {
                params: { search: ig }
            });
            const cleanIg = ig.trim().replace('@', '').toLowerCase();
            const match = res.data.find(a => a.instagram && a.instagram.trim().replace('@', '').toLowerCase() === cleanIg);
            if (match) {
                setMatchedAgenda(match);
            } else {
                setMatchedAgenda(null);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setCheckingMatch(false);
        }
    };

    useEffect(() => {
        checkAutomaticMatch(saleIg);
        
        const fetchSettersAndClosers = async () => {
            try {
                const settersRes = await api.get('/public/active-setters');
                setSetters(settersRes.data);
                const closersRes = await api.get('/public/active-closers');
                setClosers(closersRes.data);
            } catch (e) {
                console.error(e);
            }
        };
        fetchSettersAndClosers();
    }, []);

    const handleSaveInstagram = async () => {
        setUpdatingIg(true);
        try {
            await api.put(`/public/financial-sales/${sale.id}`, {
                instagram: saleIg
            });
            toast.success("Instagram de la venta actualizado");
            await checkAutomaticMatch(saleIg);
            onSuccess(); // Refrescar tabla principal
        } catch (e) {
            toast.error("Error al actualizar Instagram");
        } finally {
            setUpdatingIg(false);
        }
    };

    const handleSearchAgendas = async () => {
        if (!searchVal.trim()) {
            toast.error("Ingresa un término de búsqueda");
            return;
        }
        setSearching(true);
        setSearched(true);
        try {
            const res = await api.get('/public/financial-agendas', {
                params: { search: searchVal }
            });
            setSearchResults(res.data);
        } catch (e) {
            toast.error("Error al buscar agendas");
        } finally {
            setSearching(false);
        }
    };

    const handleLinkAgenda = async (agenda) => {
        try {
            await api.put(`/public/financial-agendas/${agenda.id}`, {
                instagram: saleIg
            });
            toast.success("Venta atribuida correctamente vinculando la agenda");
            onSuccess();
            onClose();
        } catch (e) {
            toast.error("Error al vincular la agenda");
        }
    };

    const handleCreateAgenda = async (e) => {
        e.preventDefault();
        if (!newAgenda.fuente) {
            toast.error("Por favor selecciona una Fuente/Setter");
            return;
        }
        setCreatingAgenda(true);
        try {
            await api.post('/public/financial-agendas', {
                fuente: newAgenda.fuente,
                nombre: newAgenda.lead,
                closer: newAgenda.closer,
                instagram: saleIg,
                mail: newAgenda.mail,
                whatsapp: newAgenda.whatsapp,
                fecha: newAgenda.fecha
            });
            toast.success("Agenda creada y venta atribuida correctamente");
            onSuccess();
            onClose();
        } catch (err) {
            toast.error("Error al crear la agenda");
        } finally {
            setCreatingAgenda(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-[2rem] w-full max-w-2xl p-6 md:p-8 space-y-6 relative text-slate-200 shadow-2xl my-8">
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                    <X size={18} />
                </button>

                <div className="space-y-1">
                    <h3 className="text-xl font-black text-white italic tracking-tight uppercase flex items-center gap-2">
                        <Users className="text-indigo-400" size={20} />
                        Atribución de Agenda para Venta
                    </h3>
                    <p className="text-xs text-slate-400 font-semibold">
                        Cliente: <span className="text-white font-bold">{sale.nombre_cliente}</span> | Closer: <span className="text-white font-bold">{sale.email_vendedor?.split('@')[0]}</span>
                    </p>
                </div>

                <div className="space-y-6 divide-y divide-slate-800">
                    {/* PASO 1: Instagram */}
                    <div className="space-y-3 pt-4 first:pt-0 border-none">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-black">1</span>
                            Verificar Instagram de la Venta
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                            Las ventas se atribuyen a agendas comparando los handles de Instagram. Corrige el Instagram de la venta para buscar un enlace automático.
                        </p>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold">@</span>
                                <input
                                    type="text"
                                    value={saleIg}
                                    onChange={(e) => setSaleIg(e.target.value.replace('@', '').trim())}
                                    placeholder="instagram_handle"
                                    className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-7 pr-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                                />
                            </div>
                            <button
                                onClick={handleSaveInstagram}
                                disabled={updatingIg}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50"
                            >
                                {updatingIg ? 'Guardando...' : 'Actualizar'}
                            </button>
                        </div>

                        {/* Estado del Match Automático */}
                        {checkingMatch ? (
                            <p className="text-[10px] text-indigo-300 animate-pulse font-bold">Comprobando si existe agenda con este Instagram...</p>
                        ) : matchedAgenda ? (
                            <div className="bg-indigo-500/10 border border-indigo-500/25 p-3 rounded-2xl flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <div className="text-[11px] text-indigo-400 font-black uppercase tracking-wider flex items-center gap-1.5">
                                        <Check className="w-3.5 h-3.5 text-indigo-400" /> ¡Match automático encontrado!
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-semibold">
                                        Agenda con Setter/Fuente <span className="text-white font-bold">{matchedAgenda.nombre}</span> del {parseUtcIso(matchedAgenda.date)?.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}.
                                    </p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
                                >
                                    Cerrar y Completar
                                </button>
                            </div>
                        ) : saleIg && saleIg !== 'N/A' ? (
                            <div className="bg-rose-500/5 border border-rose-500/10 p-3 rounded-2xl">
                                <div className="text-[11px] text-rose-400 font-black uppercase tracking-wider flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> No se encontró agenda para @{saleIg}
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">
                                    El Instagram es correcto pero no existe agenda registrada con este handle. Procede al Paso 2.
                                </p>
                            </div>
                        ) : null}
                    </div>

                    {/* PASO 2: Buscar Agenda Existente */}
                    {!matchedAgenda && (
                        <div className="space-y-3 pt-5">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-black">2</span>
                                Buscar Agenda por Nombre, Email o Teléfono
                            </h4>
                            <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                                Si el prospecto agendó con otros datos (o con un Instagram erróneo), busca su agenda aquí para vincularla a este Instagram.
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={searchVal}
                                    onChange={(e) => setSearchVal(e.target.value)}
                                    placeholder="Nombre del cliente, correo o teléfono..."
                                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                                />
                                <button
                                    onClick={handleSearchAgendas}
                                    disabled={searching}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    <Search size={12} />
                                    {searching ? 'Buscando...' : 'Buscar'}
                                </button>
                            </div>

                            {/* Resultados de búsqueda */}
                            {searched && (
                                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                                    {searchResults.length > 0 ? (
                                        searchResults.map((agenda) => (
                                            <div key={agenda.id} className="bg-slate-950/40 border border-slate-850 p-2.5 rounded-xl flex items-center justify-between hover:border-slate-700 transition-all">
                                                <div className="text-[10px] space-y-0.5">
                                                    <p className="font-bold text-white uppercase tracking-tight">{agenda.lead}</p>
                                                    <p className="text-slate-500 uppercase font-bold">
                                                        Fuente/Setter: <span className="text-slate-400">{agenda.nombre}</span> | Closer: <span className="text-slate-400">{agenda.closer}</span>
                                                    </p>
                                                    <p className="text-slate-600 font-semibold">
                                                        Fecha: {parseUtcIso(agenda.date)?.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} | IG: @{agenda.instagram || 'N/A'}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleLinkAgenda(agenda)}
                                                    className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors"
                                                >
                                                    Vincular
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-[10px] text-slate-500 italic text-center py-2">No se encontraron agendas registradas con ese término.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* PASO 3: Crear Cita */}
                    {!matchedAgenda && (
                        <div className="space-y-3 pt-5">
                            <div className="flex justify-between items-center">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-black">3</span>
                                    ¿La agenda no existe en el sistema?
                                </h4>
                                <button
                                    onClick={() => setShowCreateForm(!showCreateForm)}
                                    className="text-[10px] font-black text-indigo-400 uppercase tracking-wider hover:underline"
                                >
                                    {showCreateForm ? 'Cancelar' : 'Crear Registro de Agenda'}
                                </button>
                            </div>

                            {showCreateForm && (
                                <form onSubmit={handleCreateAgenda} className="bg-slate-950/40 p-4 border border-slate-850 rounded-2xl space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cliente / Lead</label>
                                            <input
                                                type="text"
                                                required
                                                value={newAgenda.lead}
                                                onChange={(e) => setNewAgenda({ ...newAgenda, lead: e.target.value })}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Fuente / Setter</label>
                                            <select
                                                required
                                                value={newAgenda.fuente}
                                                onChange={(e) => setNewAgenda({ ...newAgenda, fuente: e.target.value })}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                                            >
                                                <option value="">Selecciona Setter...</option>
                                                {setters.map(s => (
                                                    <option key={s.id} value={s.name}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Closer</label>
                                            <select
                                                required
                                                value={newAgenda.closer}
                                                onChange={(e) => setNewAgenda({ ...newAgenda, closer: e.target.value })}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                                            >
                                                <option value="">Selecciona Closer...</option>
                                                {closers.map(c => (
                                                    <option key={c.id} value={c.name}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Fecha Agenda</label>
                                            <input
                                                type="date"
                                                required
                                                value={newAgenda.fecha}
                                                onChange={(e) => setNewAgenda({ ...newAgenda, fecha: e.target.value })}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Email Cliente</label>
                                            <input
                                                type="email"
                                                value={newAgenda.mail}
                                                onChange={(e) => setNewAgenda({ ...newAgenda, mail: e.target.value })}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                                                placeholder="opcional"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Teléfono / Whatsapp</label>
                                            <input
                                                type="text"
                                                value={newAgenda.whatsapp}
                                                onChange={(e) => setNewAgenda({ ...newAgenda, whatsapp: e.target.value })}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                                                placeholder="opcional"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={creatingAgenda}
                                        className="w-full mt-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                                    >
                                        <Plus size={14} />
                                        {creatingAgenda ? 'Creando y Vinculando...' : 'Crear Agenda y Vincular'}
                                    </button>
                                </form>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AttributionModal;
