import React from 'react';
import { MessageCircle, Phone, Video } from 'lucide-react';

/* Columnas de las dos listas de postulaciones (`ListaConfigurable`): las enviadas y las incompletas. */

const VEREDICTO_BADGE = {
    preseleccionada: { label: 'Seleccionado', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    en_reserva: { label: 'En reserva', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    decidir: { label: 'Decidir', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    testeo: { label: 'Testeo', cls: 'bg-sky-500/10 text-sky-300 border-sky-500/20' },
    descartado: { label: 'Descartado', cls: 'bg-slate-800 text-slate-400 border-slate-700' },
    baja: { label: 'De baja', cls: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20' },
    sin_calificar: { label: 'Sin calificar', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    incompleta: { label: 'Incompleta', cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
};

const badgeDe = (p) => (p.completo
    ? (VEREDICTO_BADGE[p.veredicto] || VEREDICTO_BADGE.sin_calificar)
    : VEREDICTO_BADGE.incompleta);

const soloDigitos = (texto) => (texto || '').replace(/\D/g, '');
const metaLinea = (p) => [p.pais, p.edad].filter(Boolean).join(' · ');
const cierreTexto = (p) => (p.cierre && p.cierre !== 'nada' ? `${p.cierre} %` : null);
const pctAvance = (p) => Math.round((p.respondidas / p.total_preguntas) * 100);

const chipClase = 'inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px]';
const alto = (e) => e.stopPropagation();

const Material = ({ url, icono: Icono, si, no }) => (url ? (
    <a href={url} target="_blank" rel="noreferrer" onClick={alto}
        className={`${chipClase} border-emerald-500/30 bg-emerald-500/10 font-bold text-emerald-400 hover:bg-emerald-500/20`}>
        <Icono size={13} /> {si}
    </a>
) : (
    <span className={`${chipClase} border-white/10 bg-white/5 font-semibold text-white/35`}>
        <Icono size={13} /> {no}
    </span>
));

export const COLUMNAS_POSTULACIONES = [
    { key: 'nombre', header: 'Candidato', width: 'minmax(160px,1.6fr)', fija: true, valor: (p) => p.nombre,
        render: (p) => <b className="trunc">{p.nombre}</b> },
    { key: 'formacion', header: 'Formación', width: 'minmax(100px,1fr)', valor: (p) => p.conocimiento },
    { key: 'ingles', header: 'Inglés', width: '90px', valor: (p) => p.ingles },
    { key: 'cierre', header: 'Cierre', width: '90px', valor: (p) => cierreTexto(p) },
    { key: 'progreso', header: 'Progreso', width: '90px', valor: (p) => p.respondidas,
        render: (p) => `${p.respondidas}/${p.total_preguntas}` },
    { key: 'score', header: 'Score', alinear: 'der', width: '80px', valor: (p) => p.score,
        render: (p) => <span className="text-lg font-black text-pink-400">{p.score ?? '—'}</span> },
    { key: 'estado', header: 'Estado', width: '130px', valor: (p) => badgeDe(p).label,
        render: (p) => {
            const b = badgeDe(p);
            return (
                <span className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest ${b.cls}`}>
                    {b.label}
                </span>
            );
        } },
];

export const FACETAS_POSTULACIONES = [
    { key: 'estado', label: 'Estado', de: (p) => badgeDe(p).label },
    { key: 'formacion', label: 'Formación', de: (p) => p.conocimiento || null },
    { key: 'ingles', label: 'Inglés', de: (p) => p.ingles || null },
];

export const COLUMNAS_INCOMPLETAS = [
    { key: 'nombre', header: 'Candidato', width: 'minmax(180px,1.4fr)', fija: true, valor: (p) => p.nombre,
        render: (p) => (
            <span className="flex flex-col gap-1">
                <b className="trunc">{p.nombre}</b>
                {metaLinea(p) && <span className="text-[12px] text-white/50">{metaLinea(p)}</span>}
            </span>
        ) },
    { key: 'contacto', header: 'Contacto', width: 'minmax(200px,1.6fr)', ordenable: false,
        render: (p) => {
            const digitos = soloDigitos(p.whatsapp);
            return (
                <span className="flex flex-col gap-2">
                    {digitos ? (
                        <a href={`https://wa.me/${digitos}`} target="_blank" rel="noreferrer" onClick={alto}
                            className={`${chipClase} border-emerald-500/30 bg-emerald-500/10 font-bold text-emerald-400 hover:bg-emerald-500/20`}>
                            <MessageCircle size={13} /> {p.whatsapp}
                        </a>
                    ) : <span className="text-[12px] italic text-white/35">Sin WhatsApp</span>}
                    {p.email ? (
                        <a href={`mailto:${p.email}`} onClick={alto}
                            className="w-fit text-[12px] font-semibold text-white/65 hover:text-pink-300 hover:underline">
                            {p.email}
                        </a>
                    ) : <span className="text-[12px] italic text-white/35">Sin correo</span>}
                </span>
            );
        } },
    { key: 'avance', header: 'Avance', width: '180px', valor: (p) => pctAvance(p),
        render: (p) => (
            <span className="flex w-40 flex-col gap-1.5">
                <span className="text-[12px] font-bold text-white/70">{p.respondidas}/{p.total_preguntas} · {pctAvance(p)}%</span>
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full rounded-full bg-gradient-to-r from-blue-500 to-pink-500"
                        style={{ width: `${pctAvance(p)}%` }} />
                </span>
            </span>
        ) },
    { key: 'materiales', header: 'Materiales', width: 'minmax(220px,1.4fr)', ordenable: false,
        render: (p) => (
            <span className="flex flex-wrap gap-2">
                <Material url={p.video} icono={Video} si="Ver video" no="Sin video" />
                <Material url={p.llamada} icono={Phone} si="Ver llamada" no="Sin llamada" />
            </span>
        ) },
];

export const FACETAS_INCOMPLETAS = [];
