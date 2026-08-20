import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Layers, Loader2, AlertTriangle, X } from 'lucide-react';
import api from '../../../services/api';

// Etiquetas legibles de los campos que el backend acepta en lote
// (deben coincidir con CAMPOS_MASIVOS de app/api/public/financial_agendas_bulk.py)
const CAMPOS = [
    { id: 'nombre', label: 'Fuente', help: 'De dónde vino la agenda: el embudo o el setter que la generó.' },
    { id: 'closer', label: 'Closer', help: 'Quién atiende la llamada de venta.' },
    { id: 'encargado_triage', label: 'Call Confirmer', help: 'Quién confirma la asistencia antes de la llamada.' },
    { id: 'estado', label: 'Estado pre call', help: 'Estado de confirmación. Cancelada y Reagendada no se pueden aplicar en lote porque cada una necesita su razón.' }
];

/**
 * Panel de edición masiva del Tablero de Agendas.
 *
 * Dos modos: aplicar sobre las agendas tildadas, o sobre TODO el recorte filtrado
 * (incluyendo lo que todavía no se cargó por scroll infinito). El segundo pide una
 * confirmación escrita porque puede tocar cientos de registros de una vez.
 */
const AgendasBulkEditModal = ({ selectedIds, totalFiltradas, filterParams, filtrosActivos, onClose, onDone }) => {
    const [options, setOptions] = useState(null);
    const [campo, setCampo] = useState('nombre');
    const [valor, setValor] = useState('');
    const [alcance, setAlcance] = useState('seleccion'); // 'seleccion' | 'filtro'
    const [confirmacion, setConfirmacion] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        api.get('/public/financial-agendas/bulk-options')
            .then(res => setOptions(res.data))
            .catch(() => setError('No se pudo cargar el catálogo de valores. Recargá la página.'));
    }, []);

    // Si no hay nada tildado, el único alcance posible es el recorte filtrado
    useEffect(() => {
        if (selectedIds.length === 0) setAlcance('filtro');
    }, [selectedIds.length]);

    const valoresPosibles = useMemo(() => {
        if (!options) return [];
        if (campo === 'nombre') return options.fuentes || [];
        if (campo === 'closer') return options.closers || [];
        if (campo === 'encargado_triage') return options.encargados_triage || [];
        if (campo === 'estado') return options.estados || [];
        return [];
    }, [options, campo]);

    const cantidad = alcance === 'seleccion' ? selectedIds.length : totalFiltradas;
    const necesitaConfirmacion = alcance === 'filtro';
    const confirmacionOk = !necesitaConfirmacion || confirmacion.trim().toUpperCase() === 'APLICAR';
    const puedeGuardar = !guardando && valor !== '' && cantidad > 0 && confirmacionOk;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!puedeGuardar) return;
        setGuardando(true);
        setError(null);
        try {
            const payload = { fields: { [campo]: valor } };
            if (alcance === 'seleccion') {
                payload.ids = selectedIds;
            } else {
                payload.apply_filters = true;
            }
            // En modo filtro los filtros viajan en la query string, igual que en el GET del tablero
            const res = await api.post('/public/financial-agendas/bulk-update', payload, {
                params: alcance === 'filtro' ? filterParams : undefined
            });
            onDone(res.data);
        } catch (err) {
            console.error('Error en la edición masiva de agendas:', err);
            setError(err.response?.data?.error || 'No se pudo aplicar la edición masiva.');
        } finally {
            setGuardando(false);
        }
    };

    const campoActual = CAMPOS.find(c => c.id === campo);

    return createPortal(
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-[2rem] max-w-xl w-full max-h-[85dvh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="p-6 pb-4 border-b border-slate-800/60 flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-black text-white italic uppercase flex items-center gap-2">
                            <Layers size={18} className="text-indigo-400" />
                            Modificación Masiva
                        </h3>
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">
                            Aplicar un mismo valor a varias agendas
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0 custom-scrollbar text-left">
                        {/* Alcance */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">¿A cuáles se aplica?</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    disabled={selectedIds.length === 0}
                                    onClick={() => setAlcance('seleccion')}
                                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                        alcance === 'seleccion'
                                            ? 'bg-indigo-600/20 border-indigo-500/40 text-white'
                                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                                    }`}
                                >
                                    <span className="block text-[9px] font-black uppercase tracking-widest">Seleccionadas</span>
                                    <span className="block text-2xl font-black italic tracking-tighter">{selectedIds.length}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAlcance('filtro')}
                                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                                        alcance === 'filtro'
                                            ? 'bg-amber-600/20 border-amber-500/40 text-white'
                                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                                    }`}
                                >
                                    <span className="block text-[9px] font-black uppercase tracking-widest">Todo el filtro</span>
                                    <span className="block text-2xl font-black italic tracking-tighter">{totalFiltradas}</span>
                                </button>
                            </div>
                            {alcance === 'filtro' && (
                                <div className="text-[10px] text-amber-300/80 font-semibold bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 space-y-1">
                                    <p className="flex items-center gap-1.5 font-black uppercase tracking-widest text-[9px]">
                                        <AlertTriangle size={12} /> Incluye agendas que todavía no se cargaron en pantalla
                                    </p>
                                    {filtrosActivos.length > 0 ? (
                                        <ul className="list-disc list-inside text-amber-200/70">
                                            {filtrosActivos.map((f, i) => <li key={i}>{f}</li>)}
                                        </ul>
                                    ) : (
                                        <p className="text-amber-200/70">Sin filtros activos: se aplicaría a todas las agendas del período.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Campo a modificar */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Campo a modificar</label>
                            <div className="flex flex-wrap gap-2">
                                {CAMPOS.map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => { setCampo(c.id); setValor(''); }}
                                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all cursor-pointer ${
                                            campo === c.id
                                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium ml-1">{campoActual?.help}</p>
                        </div>

                        {/* Valor nuevo */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                Nuevo valor de {campoActual?.label}
                            </label>
                            {!options ? (
                                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
                                    <Loader2 size={14} className="animate-spin" /> Cargando opciones...
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-wrap gap-2">
                                        {valoresPosibles.map(v => (
                                            <button
                                                key={v}
                                                type="button"
                                                onClick={() => setValor(v)}
                                                className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                                                    valor === v
                                                        ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                                                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                {v}
                                            </button>
                                        ))}
                                        {campo === 'encargado_triage' && (
                                            <button
                                                type="button"
                                                onClick={() => setValor('')}
                                                className="px-3 py-2 rounded-xl text-[10px] font-bold border bg-slate-950 border-dashed border-slate-700 text-slate-500 hover:text-white cursor-pointer"
                                            >
                                                Sin asignar
                                            </button>
                                        )}
                                    </div>
                                    {campo === 'nombre' && (
                                        <input
                                            type="text"
                                            placeholder="…o escribí una fuente distinta"
                                            value={valor}
                                            onChange={e => setValor(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 outline-none focus:border-indigo-500 text-sm font-semibold"
                                        />
                                    )}
                                </>
                            )}
                        </div>

                        {/* Confirmación escrita para el modo masivo */}
                        {necesitaConfirmacion && (
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-amber-400 uppercase tracking-widest ml-1">
                                    Escribí APLICAR para confirmar
                                </label>
                                <input
                                    type="text"
                                    value={confirmacion}
                                    onChange={e => setConfirmacion(e.target.value)}
                                    placeholder="APLICAR"
                                    className="w-full px-4 py-2.5 bg-slate-950 border border-amber-700/40 rounded-xl text-white placeholder-slate-600 outline-none focus:border-amber-500 text-sm font-black tracking-widest uppercase"
                                />
                            </div>
                        )}

                        {error && (
                            <p className="text-xs font-bold text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-xl p-3">{error}</p>
                        )}
                    </div>

                    <div className="p-5 border-t border-slate-800/60 bg-slate-900/50 shrink-0 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 bg-slate-800 border border-slate-700 text-xs font-black uppercase tracking-widest text-slate-400 rounded-xl hover:text-white transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!puedeGuardar}
                            className="flex-1 py-3 bg-indigo-600 text-xs font-black uppercase tracking-widest text-white rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                        >
                            {guardando && <Loader2 size={14} className="animate-spin" />}
                            Aplicar a {cantidad}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default AgendasBulkEditModal;
