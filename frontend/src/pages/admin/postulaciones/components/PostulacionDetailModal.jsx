import React, { useEffect, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Check, Clock, ExternalLink } from 'lucide-react';
import api from '../../../../services/api';

const CAMPOS_CORTOS = [
    ['Edad', 'edad'], ['Lugar de residencia', 'pais'], ['WhatsApp', 'whatsapp'], ['Instagram', 'instagram'],
    ['Conocimiento como closer', 'conocimiento'], ['Cierre', 'cierre'], ['Inglés', 'ingles'],
    ['Reporta números', 'reporte'], ['Fuente', 'fuente'], ['Bolsa de trabajo', 'bolsa'],
];

const CAMPOS_ABIERTOS = [
    ['¿A qué te dedicás?', 'dedicacion'], ['Formación como closer', 'formacion'],
    ['Habilidades y experiencias relevantes', 'habilidades'], ['Ante un obstáculo', 'obstaculo'],
    ['Objetivos a largo plazo', 'objetivos'],
];

const VOTO_LABEL = { preseleccionada: 'Preseleccionada', en_reserva: 'En reserva', decidir: 'Decidir', descartado: 'Descartado', sin_calificar: 'Sin calificar' };
const VOTO_COLOR = { preseleccionada: '#34d399', en_reserva: '#fbbf24', decidir: '#fbbf24', descartado: 'rgba(255,255,255,.5)', sin_calificar: '#60a5fa' };
const OTRO_VOTO_LABEL = { pre: 'Preseleccionar', res: 'Reservar', des: 'Descartar' };

const PostulacionDetailModal = ({ applicationId, currentUserId, ids, onClose, onVoted, onNavigate }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

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
    }, [applicationId, cargar]);

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

    const miVoto = data?.votos ? data.votos[currentUserId] : null;
    const otroVoto = data?.votos_detalle?.find(v => v.reviewer_id !== currentUserId);

    return (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#04061480] p-8 backdrop-blur-sm" onClick={onClose}>
            <div
                className="flex h-[88vh] w-full max-w-[1240px] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#111634] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex flex-none items-center justify-between gap-6 border-b border-white/10 bg-white/5 px-8 py-6">
                    <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-widest text-pink-400">
                            Formulario completo · todas las respuestas
                        </p>
                        <p className="truncate text-2xl font-bold tracking-tight text-white">{data?.nombre || '...'}</p>
                        <p className="text-[13px] text-white/55">{data?.email || 'Sin correo todavía'}</p>
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

                                <div className="flex flex-col gap-2.5">
                                    <span className="text-[11px] font-black uppercase tracking-widest text-white/40">Material enviado</span>
                                    {['video', 'llamada'].map(key => data[key] && (
                                        <a key={key} href={data[key]} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3.5 rounded-2xl border border-white/12 bg-white/5 px-4.5 py-3.5 text-white no-underline hover:border-pink-400/60">
                                            <span className="text-[13px] text-white/60 capitalize">{key} <ExternalLink size={12} className="inline" /></span>
                                            <span className="truncate text-[13px] font-bold">{data[key]}</span>
                                        </a>
                                    ))}
                                </div>

                                <div className="flex flex-col gap-2 border-t border-white/10 pt-5">
                                    <span className="text-[11px] font-black uppercase tracking-widest text-white/40">Veredicto</span>
                                    <span className="text-[15px] font-bold" style={{ color: VOTO_COLOR[data.veredicto] }}>
                                        {VOTO_LABEL[data.veredicto]}
                                    </span>
                                    {otroVoto && (
                                        <span className="text-[12px] text-white/50">
                                            {otroVoto.reviewer_name || 'El otro revisor'} votó: {OTRO_VOTO_LABEL[otroVoto.vote] || otroVoto.vote}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-5">
                                <span className="text-[11px] font-black uppercase tracking-widest text-white/40">Respuestas abiertas</span>
                                {CAMPOS_ABIERTOS.filter(([, key]) => data[key]).map(([label, key]) => (
                                    <div key={key} className="rounded-2xl border border-white/12 bg-white/5 p-5">
                                        <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-pink-300">{label}</p>
                                        <p className="text-[14px] leading-relaxed text-white/85">{data[key]}</p>
                                    </div>
                                ))}
                                {data.porque?.length > 0 && (
                                    <div className="rounded-2xl border border-white/12 bg-white/5 p-5">
                                        <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-pink-300">Por qué le interesa Learnation</p>
                                        <ul className="list-disc pl-4 text-[14px] leading-relaxed text-white/85">
                                            {data.porque.map(p => <li key={p}>{p}</li>)}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-none items-center justify-end gap-3 border-t border-white/10 bg-white/5 px-8 py-5">
                    <div className="grid w-full max-w-[560px] grid-cols-3 gap-3">
                        <button
                            onClick={() => votar('pre')}
                            className={`flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-[13px] font-bold transition-all ${miVoto === 'pre' ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}
                        >
                            <Check size={16} /> Preseleccionar
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
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PostulacionDetailModal;
