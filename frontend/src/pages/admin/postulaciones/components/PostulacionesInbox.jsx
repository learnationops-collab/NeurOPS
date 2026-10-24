import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import api from '../../../../services/api';
import { useAuth } from '../../../../contexts/AuthContext';
import PostulacionDetailModal from './PostulacionDetailModal';
import PostulacionVoteToast from './PostulacionVoteToast';
import ListaConfigurable from '../../../../components/listas/ListaConfigurable';
import {
    COLUMNAS_INCOMPLETAS, COLUMNAS_POSTULACIONES, FACETAS_INCOMPLETAS, FACETAS_POSTULACIONES,
} from './columnasPostulaciones';
import '../../../comercial/comercial.css';

// Sub-filtros contextuales por grupo (pedido del usuario a partir de un mockup de
// referencia, 10/sep/2026): la pestaña inferior "Pendientes" solo ofrece "Sin analizar" y
// "Decidir"; "Analizados" agrupa todo lo que ya tiene un veredicto. El `id` de cada uno es
// directamente el valor de `filtro` que ya entiende `GET /job-applications` — "sin analizar"
// reusa el filtro `mis_pendientes` que ya existía (candidatos que este admin no votó todavía),
// solo cambia la etiqueta visible.
const SUBTABS_POR_GRUPO = {
    pend: [
        { id: 'mis_pendientes', label: 'Sin analizar' },
        { id: 'decidir', label: 'Decidir' },
    ],
    anal: [
        { id: 'preseleccionadas', label: 'Seleccionados' },
        { id: 'en_reserva', label: 'En reserva' },
        { id: 'testeo', label: 'Testeo' },
        { id: 'bajas', label: 'Baja' },
        { id: 'descartadas', label: 'Descartados' },
        { id: 'incompletas', label: 'Incompletos' },
    ],
};

const PostulacionesInbox = ({ grupo = 'pend' }) => {
    const { user } = useAuth();
    const subtabs = SUBTABS_POR_GRUPO[grupo] || SUBTABS_POR_GRUPO.pend;
    const [sub, setSub] = useState(subtabs[0].id);
    const [postulaciones, setPostulaciones] = useState([]);
    const [conteos, setConteos] = useState({});
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(null);
    const [toast, setToast] = useState(null);

    // Al cambiar de grupo (pestaña inferior Pendientes <-> Analizados) se vuelve al primer
    // sub-filtro de ese grupo — mantener el `sub` anterior mostraría un filtro que ni
    // siquiera aparece en la fila de arriba.
    useEffect(() => { setSub(subtabs[0].id); }, [grupo]); // eslint-disable-line react-hooks/exhaustive-deps

    const cargar = useCallback(async (f) => {
        setLoading(true);
        try {
            const res = await api.get(`/job-applications?filtro=${f}`);
            setPostulaciones(res.data.postulaciones);
            setConteos(res.data.conteos);
            setTotal(res.data.total);
        } catch (err) {
            console.error('Error al cargar postulaciones:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(sub); }, [sub, cargar]);

    const ids = useMemo(() => postulaciones.map(p => p.id), [postulaciones]);
    const pendientes = conteos.mis_pendientes ?? 0;

    const irSiguiente = async () => {
        let lista = postulaciones;
        if (sub !== 'mis_pendientes') {
            const res = await api.get('/job-applications?filtro=mis_pendientes');
            lista = res.data.postulaciones;
        }
        if (lista.length > 0) setSelectedId(lista[0].id);
    };

    const onVoted = (id, valor, veredicto) => {
        const postulacion = postulaciones.find(p => p.id === id);
        if (valor) {
            setToast({
                valor,
                nombre: postulacion?.nombre || '',
                mensajeFin: 'Actualizamos tu inbox de pendientes.',
            });
        }
        cargar(sub);
        // Autoavance: si quedan otros pendientes, saltar al siguiente (solo tiene sentido
        // en el grupo "Pendientes" — en "Analizados" cada fila ya tiene veredicto).
        if (valor && grupo === 'pend') {
            setTimeout(async () => {
                const res = await api.get('/job-applications?filtro=mis_pendientes');
                const restante = res.data.postulaciones.find(p => p.id !== id);
                setSelectedId(restante ? restante.id : null);
            }, 250);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="flex flex-col gap-2 rounded-3xl border border-white/12 bg-white/5 p-6">
                    <span className="text-[13px] text-white/55">Postulaciones</span>
                    <span className="text-3xl font-black tracking-tight text-white">{total}</span>
                </div>
                <div className="flex flex-col gap-2 rounded-3xl border border-white/12 bg-white/5 p-6">
                    <span className="text-[13px] text-white/55">Completadas</span>
                    <span className="text-3xl font-black tracking-tight text-white">{total}</span>
                </div>
                <div className="flex flex-col gap-2 rounded-3xl border border-white/12 bg-white/5 p-6">
                    <span className="text-[13px] text-white/55">Con video y llamada</span>
                    <span className="text-3xl font-black tracking-tight text-white">{conteos.con_material ?? 0}</span>
                </div>
                <div className="flex flex-col gap-2 rounded-3xl border border-pink-400/40 bg-gradient-to-br from-pink-500/20 to-blue-600/20 p-6">
                    <span className="text-[13px] text-white/70">A decidir entre los dos</span>
                    <span className="text-3xl font-black tracking-tight text-pink-300">{conteos.decidir ?? 0}</span>
                </div>
            </div>

            {/* Sub-filtros: solo los del grupo activo (Pendientes o Analizados) */}
            <div className="flex flex-wrap gap-2.5">
                {subtabs.map(s => (
                    <button
                        key={s.id}
                        onClick={() => setSub(s.id)}
                        className={`rounded-full border px-5 py-2.5 text-[13px] font-bold transition-all ${
                            sub === s.id
                                ? 'border-pink-500 bg-pink-500/15 text-white'
                                : 'border-white/15 bg-white/[.03] text-white/70 hover:border-white/30'
                        }`}
                    >
                        {s.label} {typeof conteos[s.id] === 'number' ? `(${conteos[s.id]})` : ''}
                    </button>
                ))}
            </div>

            {grupo === 'pend' && (
                /* Inbox card: revisar el siguiente sin analizar, uno por uno */
                <div className="flex flex-wrap items-center gap-7 rounded-3xl border border-pink-400/30 bg-gradient-to-r from-blue-600/20 to-pink-500/15 px-7 py-6">
                    <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
                        <span className="text-[11px] font-black uppercase tracking-widest text-white/55">
                            Tu inbox · {user?.username}
                        </span>
                        <span className="text-xl font-black tracking-tight text-white">
                            Te faltan {pendientes} de {total} candidatos
                        </span>
                    </div>
                    <button
                        onClick={irSiguiente}
                        disabled={pendientes === 0}
                        className={`flex flex-none items-center gap-2 rounded-full bg-white px-7 py-4 text-[13px] font-black text-[#0B0F26] transition-transform hover:-translate-y-0.5 disabled:opacity-40 ${pendientes > 0 ? 'animate-pulse' : ''}`}
                    >
                        Revisar el siguiente <ArrowRight size={16} />
                    </button>
                </div>
            )}

            {sub !== 'incompletas' && (
                <div className="dc-shell dc-shell--embebido">
                    <ListaConfigurable key="enviadas" columnas={COLUMNAS_POSTULACIONES} facetas={FACETAS_POSTULACIONES}
                        filas={loading ? [] : postulaciones} clave={(p) => p.id} onAbrirFila={(p) => setSelectedId(p.id)}
                        buscar={(p) => p.nombre} buscarPlaceholder="Buscar candidato…" claveGuardado="postulaciones_cols"
                        ordenInicial={{ key: 'score', dir: 'desc' }}
                        vacio={loading ? 'Cargando…' : 'No hay postulaciones en este filtro.'} />
                </div>
            )}

            {sub === 'incompletas' && (
                <>
                    <p className="max-w-3xl text-[14px] leading-relaxed text-white/55">
                        Guardaron la postulación pero no la enviaron. Tenés su WhatsApp y su correo para empujarlas: son las que ya invirtieron tiempo y se cayeron en el camino.
                    </p>
                    <div className="dc-shell dc-shell--embebido">
                        <ListaConfigurable key="incompletas" columnas={COLUMNAS_INCOMPLETAS} facetas={FACETAS_INCOMPLETAS}
                            filas={loading ? [] : postulaciones} clave={(p) => p.id} onAbrirFila={(p) => setSelectedId(p.id)}
                            buscar={(p) => `${p.nombre} ${p.email || ''}`} buscarPlaceholder="Buscar candidato…"
                            claveGuardado="postulaciones_incompletas_cols"
                            vacio={loading ? 'Cargando…' : 'No hay postulaciones incompletas.'} />
                    </div>
                </>
            )}

            {selectedId && (
                <PostulacionDetailModal
                    applicationId={selectedId}
                    currentUserId={user?.id}
                    ids={ids}
                    onClose={() => setSelectedId(null)}
                    onNavigate={setSelectedId}
                    onVoted={onVoted}
                />
            )}
            <PostulacionVoteToast toast={toast} onDone={() => setToast(null)} />
        </div>
    );
};

export default PostulacionesInbox;
