import React, { useLayoutEffect, useRef, useState } from 'react';
import {
    AlignLeft, Briefcase, CalendarCheck, Check, ChevronDown, CircleDot, Copy, DollarSign, FileText, Hash, Inbox,
    Layers, Languages, Lightbulb, Link2, ListChecks, Mail, MapPin, MessageCircle, Phone, Puzzle, Search,
    ShieldCheck, Type, User, Wallet, Wrench, XCircle,
} from 'lucide-react';
import { BANDERA, href, soloDigitos } from '../lib/escalas';

// La ficha de una postulación, armada con las secciones que manda el backend
// (`secciones`: un bloque de su formulario por sección, cada pregunta con su
// tipo y si la respuesta la corta). No conoce las preguntas: si el formulario
// cambia, la ficha cambia sola.

// Ícono de cada sección según su nombre (el nombre lo edita quien arma el formulario).
const ICONOS_BLOQUE = [
    [/identific|datos|contacto/, User],
    [/requisit|filtro|excluy/, ShieldCheck],
    [/experien|trayect|antecedent/, Briefcase],
    [/idioma|lengua/, Languages],
    [/herramient|software|tecnolog/, Wrench],
    [/remunera|salari|sueldo|dinero|pago/, Wallet],
    [/organiz|jornada|horario|disponib/, CalendarCheck],
    [/criterio|aporte|actitud/, Lightbulb],
    [/resolv|caso|problema/, Puzzle],
    [/video|cv|curr/, FileText],
];

export const iconoBloque = (titulo) => {
    const t = String(titulo || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return (ICONOS_BLOQUE.find(([re]) => re.test(t)) || [null, Layers])[1];
};

const ICONO_TIPO = {
    radio: CircleDot, check: ListChecks, buscable: Search, texto: Type, email: Mail, parrafo: AlignLeft,
    numero: Hash, dinero: DollarSign, tel: Phone, link: Link2,
};

const LARGO = 90;

const Copiar = ({ texto, etiqueta, onCopiar }) => (
    <button
        type="button"
        onClick={() => onCopiar(texto, etiqueta)}
        title="Copiar"
        aria-label={`Copiar ${etiqueta}`}
        className="grid h-7 w-7 flex-none place-items-center rounded-lg text-white/35 transition-colors hover:bg-white/[.08] hover:text-white"
    >
        <Copy size={14} />
    </button>
);

// Texto largo: tres renglones y «Ver todo». Solo ofrece abrirlo si de verdad quedó cortado.
const TextoLargo = ({ texto, abierto, onToggle }) => {
    const ref = useRef(null);
    const [cortado, setCortado] = useState(false);
    useLayoutEffect(() => {
        const el = ref.current;
        if (el && !abierto) setCortado(el.scrollHeight > el.clientHeight + 1);
    }, [texto, abierto]);
    return (
        <>
            <span
                ref={ref}
                className="block whitespace-pre-wrap break-words text-[14px] leading-[1.55] text-white/80"
                style={abierto ? undefined : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
                {texto}
            </span>
            {(cortado || abierto) && (
                <button type="button" onClick={onToggle}
                    className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-bold text-[#8AA3FF] transition-colors hover:text-white">
                    {abierto ? 'Ver menos' : 'Ver todo'}
                    <ChevronDown size={14} className="transition-transform duration-200" style={{ transform: abierto ? 'rotate(180deg)' : 'none' }} />
                </button>
            )}
        </>
    );
};

const Valor = ({ p, abierto, onToggle, onCopiar }) => {
    if (p.valor == null) return <span className="text-[13.5px] text-white/30">Sin respuesta</span>;
    const texto = String(p.valor);
    const color = p.corta ? 'text-[#F28B7D]' : 'text-white/90';

    if (p.tipo === 'check') {
        return (
            <span className="flex flex-wrap gap-1.5">
                {texto.split(' | ').filter(Boolean).map((t) => (
                    <span key={t} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[.08] bg-white/[.05] px-2 py-1 text-[13px] font-semibold leading-tight text-white/85">
                        <Check size={12} className="flex-none text-[#2FBF8F]" />{t}
                    </span>
                ))}
            </span>
        );
    }
    if (p.tipo === 'dinero' || p.tipo === 'numero') {
        return (
            <span className="flex items-baseline gap-1.5">
                <span className={`text-[17px] font-black tabular-nums ${color}`}>{p.tipo === 'dinero' ? `$ ${texto}` : texto}</span>
                {p.unidad && <small className="text-[12px] font-semibold text-white/45">{p.unidad}</small>}
            </span>
        );
    }
    if (p.tipo === 'link') {
        const enlace = href(texto);
        return enlace
            ? <a href={enlace} target="_blank" rel="noreferrer" className="block truncate text-[14px] font-semibold text-[#8AA3FF] hover:underline">{texto}</a>
            : <span className="block truncate text-[14px] text-white/80">{texto}</span>;
    }
    if (p.tipo === 'email' || p.tipo === 'tel') {
        return (
            <span className="flex min-w-0 items-center gap-1">
                <span className="truncate text-[14px] font-semibold tabular-nums text-white/90">{texto}</span>
                <Copiar texto={texto} etiqueta={p.tipo === 'email' ? 'correo' : 'teléfono'} onCopiar={onCopiar} />
            </span>
        );
    }
    if (p.tipo === 'parrafo' || texto.length > LARGO) {
        return (
            <span className="flex items-start gap-1">
                <span className="min-w-0 flex-1"><TextoLargo texto={texto} abierto={abierto} onToggle={onToggle} /></span>
                <Copiar texto={texto} etiqueta="respuesta" onCopiar={onCopiar} />
            </span>
        );
    }
    return <span className={`block text-[14px] font-semibold leading-snug ${color}`}>{texto}</span>;
};

const Pregunta = ({ p, abierto, onToggle, onCopiar }) => {
    const Ico = ICONO_TIPO[p.tipo] || Type;
    return (
        <div className={`border-t border-white/[.07] py-2.5 ${p.corta ? '-mx-2 rounded-xl border-transparent bg-[#E85C4A]/[.07] px-2' : ''}`}>
            <div className="mb-1.5 flex items-center gap-2">
                <Ico size={13} className="flex-none text-white/35" aria-hidden="true" />
                <small className="min-w-0 flex-1 truncate text-[12px] font-bold leading-none text-white/50" title={p.t}>{p.t}</small>
                {p.corta && (
                    <small className="inline-flex flex-none items-center gap-1 rounded-full bg-[#E85C4A]/15 px-2 py-[3px] text-[10.5px] font-black uppercase leading-none tracking-[.08em] text-[#F28B7D]">
                        <XCircle size={11} /> Corta
                    </small>
                )}
            </div>
            <Valor p={p} abierto={abierto} onToggle={onToggle} onCopiar={onCopiar} />
        </div>
    );
};

export const Seccion = ({ s, abiertas, todasAbiertas, onToggle, onCopiar }) => {
    const Ico = iconoBloque(s.titulo);
    const respondidas = s.preguntas.filter((p) => p.valor != null).length;
    return (
        <section className="mb-3 break-inside-avoid rounded-2xl border border-white/[.09] bg-white/[.03] px-4 pb-1.5 pt-3.5">
            <header className="flex items-center gap-2.5 pb-2.5">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] bg-[#5B7CFF]/15 text-[#8AA3FF]">
                    <Ico size={15} />
                </span>
                <small className="min-w-0 flex-1 truncate text-[12px] font-extrabold uppercase leading-none tracking-[.12em] text-white/70">{s.titulo}</small>
                <small className="flex-none text-[12px] font-bold tabular-nums text-white/35">{respondidas}/{s.preguntas.length}</small>
            </header>
            {s.preguntas.map((p) => (
                <Pregunta key={p.id} p={p} abierto={todasAbiertas || abiertas.has(p.id)} onToggle={() => onToggle(p.id)} onCopiar={onCopiar} />
            ))}
        </section>
    );
};

const FilaContacto = ({ icono, children, accion }) => (
    <div className="flex min-h-[44px] items-center gap-2.5 border-t border-white/[.07] py-1.5 first:border-t-0">
        {icono}
        <span className="min-w-0 flex-1 text-[13.5px] font-semibold">{children}</span>
        {accion}
    </div>
);

const Tile = ({ children, className = 'bg-white/[.07] text-white/65' }) => (
    <span className={`grid h-8 w-8 flex-none place-items-center rounded-[10px] ${className}`}>{children}</span>
);

export const ContactoFicha = ({ d, onCopiar }) => {
    const digitos = soloDigitos(d.whatsapp);
    const cv = href(d.cv);
    const lugar = [d.provincia, d.pais].filter(Boolean).join(', ');
    return (
        <section className="rounded-2xl border border-white/[.09] bg-white/[.03] px-4 pb-2 pt-3.5">
            <header className="flex items-center gap-2.5 pb-2">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] bg-[#FF3FA4]/15 text-[#FF6AD5]"><User size={15} /></span>
                <small className="text-[12px] font-extrabold uppercase leading-none tracking-[.12em] text-white/70">Contacto</small>
            </header>
            <FilaContacto icono={<Tile><Inbox size={16} /></Tile>} accion={d.email && <Copiar texto={d.email} etiqueta="correo" onCopiar={onCopiar} />}>
                {d.email ? <span className="block truncate" title={d.email}>{d.email}</span> : <span className="text-white/30">Sin correo</span>}
            </FilaContacto>
            <FilaContacto
                icono={digitos ? (
                    <a href={`https://wa.me/${digitos}`} target="_blank" rel="noreferrer" aria-label="Abrir WhatsApp" title="Abrir WhatsApp"
                        className="grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-[#25D366]/20 text-[#25D366] transition-colors hover:bg-[#25D366]/35">
                        <MessageCircle size={16} />
                    </a>
                ) : <Tile className="bg-white/[.07] text-white/30"><MessageCircle size={16} /></Tile>}
                accion={digitos && <Copiar texto={d.whatsapp} etiqueta="WhatsApp" onCopiar={onCopiar} />}
            >
                {digitos ? <span className="block truncate tabular-nums">{d.whatsapp}</span> : <span className="text-white/30">Sin WhatsApp</span>}
            </FilaContacto>
            <FilaContacto icono={<Tile><MapPin size={16} /></Tile>}>
                {lugar ? (
                    <span className="flex min-w-0 items-center gap-2">
                        {BANDERA[d.pais] && <span className="h-3 w-[18px] flex-none rounded-[3px]" style={{ background: BANDERA[d.pais] }} />}
                        <span className="truncate">{lugar}</span>
                    </span>
                ) : <span className="text-white/30">Sin país</span>}
            </FilaContacto>
            {d.edad && (
                <FilaContacto icono={<Tile><CalendarCheck size={16} /></Tile>}>
                    <span className="tabular-nums">{d.edad} años</span>
                </FilaContacto>
            )}
            {cv && (
                <FilaContacto icono={<Tile><FileText size={16} /></Tile>}>
                    <a href={cv} target="_blank" rel="noreferrer" className="text-[#8AA3FF] hover:underline">Abrir CV</a>
                </FilaContacto>
            )}
        </section>
    );
};
