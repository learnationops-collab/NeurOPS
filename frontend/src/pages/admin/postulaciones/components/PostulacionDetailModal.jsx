import React, { useEffect, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Check, Clock, UserX, Scale, FlaskConical, ChevronDown, Video, Phone } from 'lucide-react';
import api from '../../../../services/api';

const CAMPOS_CORTOS = [
    ['Edad', 'edad'], ['Lugar de residencia', 'pais'], ['WhatsApp', 'whatsapp'], ['Instagram', 'instagram'],
    ['Conocimiento como closer', 'conocimiento'], ['Cierre', 'cierre'], ['Inglés', 'ingles'],
    ['Reporta números', 'reporte'], ['Fuente', 'fuente'], ['Bolsa de trabajo', 'bolsa'],
];

const CAMPOS_ABIERTOS = [
    ['¿A qué te dedicás?', 'dedicacion'], ['Formación como closer', 'formacion'],
    ['Qué más puede aportar al equipo', 'aportes'], ['Habilidades y experiencias relevantes', 'habilidades'],
    ['Ante un obstáculo', 'obstaculo'], ['Objetivos a largo plazo', 'objetivos'],
    ['¿Por qué es la mejor opción?', 'porque_mejor_opcion'],
];

// 'aportes' y 'porque' eran checkboxes (listas) y pasaron a ser preguntas de
// texto libre — las postulaciones viejas todavía guardan la lista original,
// así que hay que soportar los dos formatos al mostrarlas.
const textoRespuesta = (valor) => (Array.isArray(valor) ? valor.join(' · ') : valor);

const VOTO_LABEL = { preseleccionada: 'Seleccionada', en_reserva: 'En reserva', decidir: 'Decidir', testeo: 'En testeo', descartado: 'Descartado', sin_calificar: 'Sin calificar', baja: 'De baja' };
const VOTO_COLOR = { preseleccionada: '#34d399', en_reserva: '#fbbf24', decidir: '#fbbf24', testeo: '#38bdf8', descartado: 'rgba(255,255,255,.5)', sin_calificar: '#60a5fa', baja: '#e879f9' };
const OTRO_VOTO_LABEL = { pre: 'Preseleccionar', res: 'Reservar', des: 'Descartar' };

const PostulacionDetailModal = ({ applicationId, currentUserId, ids, onClose, onVoted, onNavigate }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    // Tarjetas de respuestas abiertas: cuáles están expandidas (colapsadas por defecto, para
    // que el resumen de 8 preguntas entre en pantalla de un vistazo — "Abrir todas" las
    // expande todas de una, mismo mecanismo que el mockup de referencia).
    const [abiertas, setAbiertas] = useState(new Set());

    const cargar = useCallback(async (id) => {
        setLoading(true);
        try {
            const res = await api.get(`/job-applications/${id}`);
            setData(res.data);
        } catch (err) {
            console.error('Error al cargar la postulación:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (applicationId) cargar(applicationId);
        setAbiertas(new Set());
    }, [applicationId, cargar]);

    const toggleAbierta = (key) => setAbiertas(prev => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
    });

    if (!applicationId) return null;

    const idx = ids.indexOf(applicationId);
    const anterior = () => idx > 0 && onNavigate(ids[idx - 1]);
    const siguiente = () => idx < ids.length - 1 && onNavigate(ids[idx + 1]);

    const votar = async (valor) => {
        try {
            const res = await api.post(`/job-applications/${applicationId}/vote`, { valor });
            onVoted(applicationId, res.data.valor, res.data.veredicto);
            cargar(applicationId);
        } catch (err) {
            console.error('Error al votar:', err);
        }
    };

    // Decisión manual de un admin que pisa el veredicto por votos: destraba un
    // "decidir" preseleccionando igual, marca a alguien en su etapa de prueba
    // (testeo) o le da de baja. Tocar el mismo botón otra vez la deshace.
    const resolver = async (valor) => {
        try {
            const nuevoValor = data?.resolucion === valor ? null : valor;
            const res = await api.post(`/job-applications/${applicationId}/resolver`, { valor: nuevoValor });
            const valorToast = nuevoValor === 'baja' ? 'baja' : nuevoValor === 'testeo' ? 'testeo' : nuevoValor === 'preseleccionada' ? 'pre' : null;
            onVoted(applicationId, valorToast, res.data.veredicto);
            cargar(applicationId);
        } catch (err) {
            console.error('Error al resolver:', err);
        }
    };

    const miVoto = data?.votos ? data.votos[currentUserId] : null;
    const otroVoto = data?.votos_detalle?.find(v => v.reviewer_id !== currentUserId);

    // Página completa, no un modal chico centrado (pedido explícito del usuario a partir del
    // mockup de referencia: "que no sea solo un pedacito... que no haya ni siquiera necesidad
    // de hacer scroll"). Sin backdrop ni click-afuera-para-cerrar: ya no hay "afuera", el cierre
    // es solo por la X o Escape.
    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        // z-[300]: por encima del botón flotante de reportar bugs (z-[190]/[210], ver
        // BugReportWidget) — si no, sus botones de voto quedan tapados por ese botón.
        <div className="fixed inset-0 z-[300] flex flex-col overflow-hidden bg-[#111634]">
            <div className="flex h-full w-full flex-col overflow-hidden">
                {/* Header */}
                <div className="flex flex-none items-center justify-between gap-6 border-b border-white/10 bg-white/5 px-8 py-6">
                    <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-widest text-pink-400">
                            Postulación
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                            <p className="truncate text-2xl font-bold tracking-tight text-white">{data?.nombre || '...'}</p>
                            {data?.completo && (
                                <span
                                    className="flex-none rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-widest"
                                    style={{ color: VOTO_COLOR[data.veredicto], borderColor: `${VOTO_COLOR[data.veredicto]}55`, background: `${VOTO_COLOR[data.veredicto]}1a` }}
                                >
                                    {VOTO_LABEL[data.veredicto]}
                                </span>
                            )}
                        </div>
                        <p className="text-[13px] text-white/55">{data?.email || 'Sin correo todavía'}</p>
                        {data && (
                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                {['video', 'llamada'].map(key => (
                                    data[key] ? (
                                        <a
                                            key={key}
                                            href={data[key]}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-bold text-emerald-400 hover:bg-emerald-500/20"
                                        >
                                            {key === 'video' ? <Video size={13} /> : <Phone size={13} />} Ver {key}
                                        </a>
                                    ) : (
                                        <span
                                            key={key}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/35"
                                        >
                                            {key === 'video' ? <Video size={13} /> : <Phone size={13} />} Sin {key}
                                        </span>
                                    )
                                ))}
                            </div>
                        )}
                        {data && !data.completo && (
                            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[11px] font-bold text-orange-400">
                                Quedó a mitad de camino · respondió {data.respondidas} de {data.total_preguntas}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-none items-center gap-5">
                        <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[11px] font-bold uppercase tracking-widest text-white/45">Score</span>
                            <span className="text-2xl font-black leading-none text-pink-400">{data?.score ?? '–'}</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={anterior} disabled={idx <= 0} className="flex h-10 items-center gap-1 rounded-full border border-white/20 px-4 text-[13px] font-bold text-white disabled:opacity-30 hover:bg-white/10">
                                <ChevronLeft size={16} /> Anterior
                            </button>
                            <button onClick={siguiente} disabled={idx < 0 || idx >= ids.length - 1} className="flex h-10 items-center gap-1 rounded-full border border-white/20 px-4 text-[13px] font-bold text-white disabled:opacity-30 hover:bg-white/10">
                                Siguiente <ChevronRight size={16} />
                            </button>
                        </div>
                        <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="grid flex-1 grid-cols-1 gap-8 overflow-y-auto px-8 py-8 lg:grid-cols-[minmax(320px,.85fr)_minmax(420px,1.4fr)]">
                    {loading && <div className="col-span-2 text-center text-white/50">Cargando...</div>}
                    {!loading && data && (
                        <>
                            <div className="flex flex-col gap-6">
                                <span className="text-[11px] font-black uppercase tracking-widest text-white/40">Datos y respuestas cortas</span>
                                <div className="flex flex-col">
                                    {CAMPOS_CORTOS.filter(([, key]) => data[key]).map(([label, key]) => (
                                        <div key={key} className="flex flex-col gap-1 border-b border-white/10 py-3">
                                            <span className="text-[12px] text-white/50">{label}</span>
                                            <span className="text-[15px] font-bold leading-relaxed text-white">
                                                {Array.isArray(data[key]) ? data[key].join(' · ') : data[key]}
                                                {key === 'cierre' && data[key] !== 'nada' ? ' %' : ''}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {data.herramientas?.length > 0 && (
                                    <div className="flex flex-col gap-3">
                                        <span className="text-[11px] font-black uppercase tracking-widest text-white/40">Herramientas</span>
                                        <div className="flex flex-wrap gap-2">
                                            {data.herramientas.map(t => (
                                                <span key={t} className="rounded-full border border-white/25 bg-white/5 px-3.5 py-2 text-[12px] font-semibold text-white/85">{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(data.resolucion || otroVoto) && (
                                    <div className="flex flex-col gap-2 border-t border-white/10 pt-5">
                                        <span className="text-[11px] font-black uppercase tracking-widest text-white/40">Detalle del veredicto</span>
                                        {data.resolucion && (
                                            <span className="text-[12px] text-white/50">
                                                Resuelto a mano por {data.resuelto_por || 'un admin'}
                                            </span>
                                        )}
                                        {otroVoto && (
                                            <span className="text-[12px] text-white/50">
                                                {otroVoto.reviewer_name || 'El otro revisor'} votó: {OTRO_VOTO_LABEL[otroVoto.vote] || otroVoto.vote}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-4">
                                {(() => {
                                    const items = CAMPOS_ABIERTOS.filter(([, key]) => data[key])
                                        .map(([label, key]) => ({ key, label, texto: textoRespuesta(data[key]) }));
                                    const tienePorque = data.porque && (Array.isArray(data.porque) ? data.porque.length > 0 : true);
                                    if (tienePorque) {
                                        items.push({
                                            key: 'porque',
                                            label: 'Por qué le interesa Learnation',
                                            texto: Array.isArray(data.porque) ? data.porque.join(' · ') : data.porque,
                                        });
                                    }
                                    const todasAbiertas = items.length > 0 && items.every(it => abiertas.has(it.key));
                                    return (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-black uppercase tracking-widest text-white/40">Respuestas</span>
                                                <button
                                                    onClick={() => setAbiertas(todasAbiertas ? new Set() : new Set(items.map(it => it.key)))}
                                                    className="rounded-full border border-white/20 px-4 py-1.5 text-[12px] font-bold text-white hover:bg-white/10"
                                                >
                                                    {todasAbiertas ? 'Cerrar todas' : 'Abrir todas'}
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                {items.map(it => {
                                                    const abierta = abiertas.has(it.key);
                                                    return (
                                                        <div
                                                            key={it.key}
                                                            onClick={() => toggleAbierta(it.key)}
                                                            className={`cursor-pointer rounded-2xl border p-4 transition-all ${abierta ? 'border-pink-400/50 bg-pink-500/[.07]' : 'border-white/12 bg-white/5 hover:border-white/25'}`}
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <p className="text-[13px] font-bold text-white">{it.label}</p>
                                                                <ChevronDown size={15} className={`flex-none text-white/50 transition-transform ${abierta ? 'rotate-180' : ''}`} />
                                                            </div>
                                                            <p className={`mt-2 text-[13px] leading-relaxed text-white/70 ${abierta ? '' : 'line-clamp-2'}`}>
                                                                {it.texto}
                                                            </p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-none flex-col gap-3 border-t border-white/10 bg-white/5 px-8 py-5">
                    {data?.veredicto === 'decidir' && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3.5">
                            <span className="text-[13px] font-bold text-amber-300">
                                Los revisores no coinciden. Podés resolverlo y preseleccionar igual.
                            </span>
                            <button
                                onClick={() => resolver('preseleccionada')}
                                className="flex items-center gap-2 rounded-full border border-emerald-400 bg-emerald-500 px-4 py-2 text-[12px] font-bold text-white transition-all hover:bg-emerald-600"
                            >
                                <Scale size={14} /> Preseleccionar de todas formas
                            </button>
                        </div>
                    )}
                    <div className="flex items-center justify-end">
                        {/* 5 acciones siempre visibles, mismo peso — Seleccionar/Reserva/Descartar son el
                            voto de este revisor; Testeo/Baja son una resolución manual de un admin que no
                            necesita el acuerdo del otro revisor (closer que ya está probando, o que se fue). */}
                        <div className="grid w-full max-w-[860px] grid-cols-5 gap-3">
                            <button
                                onClick={() => votar('pre')}
                                className={`flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-[13px] font-bold transition-all ${miVoto === 'pre' ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}
                            >
                                <Check size={16} /> Seleccionar
                            </button>
                            <button
                                onClick={() => votar('res')}
                                className={`flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-[13px] font-bold transition-all ${miVoto === 'res' ? 'border-amber-400 bg-amber-500 text-[#1a1204]' : 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'}`}
                            >
                                <Clock size={16} /> Reserva
                            </button>
                            <button
                                onClick={() => votar('des')}
                                className={`flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-[13px] font-bold transition-all ${miVoto === 'des' ? 'border-rose-400 bg-rose-500 text-white' : 'border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'}`}
                            >
                                <X size={16} /> Descartar
                            </button>
                            <button
                                onClick={() => resolver('testeo')}
                                className={`flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-[13px] font-bold transition-all ${data?.resolucion === 'testeo' ? 'border-sky-400 bg-sky-500 text-white' : 'border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20'}`}
                            >
                                <FlaskConical size={16} /> Testeo
                            </button>
                            <button
                                onClick={() => resolver('baja')}
                                className={`flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-[13px] font-bold transition-all ${data?.resolucion === 'baja' ? 'border-fuchsia-400 bg-fuchsia-500 text-white' : 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500/20'}`}
                            >
                                <UserX size={16} /> Baja
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PostulacionDetailModal;
