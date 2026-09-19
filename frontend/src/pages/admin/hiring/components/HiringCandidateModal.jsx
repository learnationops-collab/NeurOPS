import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, XCircle, Clock,
    Target, Trash2, Trophy, Star, PlayCircle, FileText, Inbox, MessageCircle,
    AlertTriangle, Copy, DollarSign, Info, Sparkles, Filter, ListChecks, PenLine,
} from 'lucide-react';
import api from '../../../../services/api';
import {
    PREGUNTA_CORTA, CAMPOS_ESCRITOS, VAL_CORTO, AREA_CORTO,
    escalaDe, nivelDe, techoIA, nivelCorto, estrellas, BANDERA, soloDigitos, href, MODALIDAD,
} from '../lib/escalas';
import { Dots, VEREDICTO } from './HiringInbox';
import logoSheets from '../assets/apps/google-sheets.png';
import logoChatgpt from '../assets/apps/chatgpt.png';
import logoClaude from '../assets/apps/claude.png';
import logoMeta from '../assets/apps/meta.png';
import logoNotion from '../assets/apps/notion.png';
import logoWhatsapp from '../assets/apps/whatsapp.png';
import logoZapier from '../assets/apps/zapier.png';

// Los siete veredictos que puede poner un revisor. 'baja' pide motivo: es la
// única que describe algo que pasó DESPUÉS de seleccionar/hacer entrar a
// prueba a alguien, y conviene dejarlo escrito.
const ACCIONES = [
    { id: 'seleccionada', label: 'Seleccionar', icon: CheckCircle2, fg: '#2FBF8F', bg: '#071A24', bd: '#10413D' },
    { id: 'en_reserva', label: 'Reserva', icon: Clock, fg: '#8AA3FF', bg: 'rgba(91,124,255,.14)', bd: 'rgba(91,124,255,.5)' },
    { id: 'testeo', label: 'Testeo', icon: Target, fg: '#D9A441', bg: '#1A171C', bd: '#473924' },
    { id: 'winner', label: 'Winner', icon: Trophy, fg: '#2FBF8F', bg: '#071A24', bd: '#10413D' },
    { id: 'top_tier', label: 'Top tier', icon: Star, fg: '#8AA3FF', bg: 'rgba(91,124,255,.14)', bd: 'rgba(91,124,255,.5)' },
    { id: 'descartado', label: 'Descartar', icon: XCircle, fg: 'rgba(255,255,255,.82)', bg: 'rgba(255,255,255,.05)', bd: 'rgba(255,255,255,.38)' },
    { id: 'baja', label: 'Baja', icon: Trash2, fg: '#E85C4A', bg: '#1B0F1D', bd: '#4C2227' },
];

// Qué botones se ven según el veredicto actual — ya no son siempre los 5/7:
// cada estado tiene un siguiente paso lógico, no todos a la vez.
const ACCIONES_POR_VEREDICTO = {
    sin_analizar: ['seleccionada', 'en_reserva', 'descartado'],
    incompleta: ['seleccionada', 'en_reserva', 'descartado'],
    seleccionada: ['testeo', 'en_reserva', 'descartado'],
    en_reserva: ['seleccionada', 'descartado'],
    descartado: ['descartado'], // tocarlo de nuevo deshace el descarte
    testeo: ['winner', 'top_tier', 'baja'],
    winner: ['baja'],
    top_tier: ['baja'],
    baja: [], // terminal: ya se fue, no hay a dónde moverlo
};

// El icono que acompaña al veredicto en la cabecera.
const ICONO_VEREDICTO = {
    sin_analizar: Info,
    incompleta: AlertTriangle,
    seleccionada: CheckCircle2,
    en_reserva: Clock,
    testeo: Target,
    winner: Trophy,
    top_tier: Star,
    descartado: XCircle,
    baja: Trash2,
};

// Los 4 excluyentes + la verificación de comprensión: son lo primero que mira
// un revisor, así que abren el primer riel.
const REQUISITOS = [
    ['equipo', (v) => /^S[íi]/.test(v || '')],
    ['disponibilidad', (v) => /4 horas ahora/.test(v || '')],
    ['horario', (v) => /^S[íi]/.test(v || '')],
    ['empleo', (v) => /^No/.test(v || '')],
    ['confirma', (v) => /4 horas diarias y desde el tercer mes/.test(v || '')],
];

// Cada fila del riel de experiencia: escala 0-4 + etiqueta corta.
const EXPERIENCIA = ['experiencia', 'digital', 'remoto', 'dinero', 'pm', 'educacion'];

// Preguntas de opción con una escala medible: su tarjeta lleva estrellas.
const NIVELES = {
    ia_avanzado: techoIA,
    pendientes: (valor) => escalaDe('pendientes', valor),
};

// --- Piezas chicas ---

const BOTON_CABECERA = 'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-[11px] border text-[11.5px] font-bold transition-all';
const PILDORA = `${BOTON_CABECERA} min-w-[112px] px-3`;
const PILDORA_NEUTRA = `${PILDORA} border-white/[.32] bg-white/[.04] hover:bg-[#5B7CFF]/20`;
const PILDORA_AUSENTE = `${PILDORA} border-[#4C2227] bg-[#1B0F1D] text-[#E85C4A]`;
const BOTON_ICONO = 'flex h-8 w-8 flex-none items-center justify-center rounded-[11px] border border-white/[.32] bg-white/[.04] transition-all hover:bg-[#5B7CFF]/20 disabled:opacity-30';

// Las etiquetas en mayúsculas van en <small>: el reset tipográfico global
// (index.html) pisa el peso y el tracking de span/div/button/h*, pero no el de
// <small> — el mismo truco que ya usa el encabezado del panel.
const Etiqueta = ({ children, className = '' }) => (
    <small className={`block text-[8px] font-extrabold uppercase leading-none tracking-[.1em] text-white/40 ${className}`}>
        {children}
    </small>
);

const Riel = ({ titulo, icono: Icono, className = '', children }) => (
    <section className={`flex min-w-0 flex-col rounded-[14px] border border-white/[.09] bg-white/[.03] px-3 pb-1.5 pt-2.5 ${className}`}>
        <small className="flex items-center gap-1.5 pb-2 text-[8px] font-extrabold uppercase leading-none tracking-[.12em] text-white/50">
            <Icono size={11} className="flex-none text-[#5B7CFF]" />
            {titulo}
        </small>
        {children}
    </section>
);

// Una fila de los rieles angostos: etiqueta (y medidor) arriba, valor abajo.
const FilaRiel = ({ k, title, medidor, children }) => (
    <div className="border-t border-white/[.07] py-[7px]" title={title}>
        <div className="flex items-center justify-between gap-2">
            <Etiqueta>{k}</Etiqueta>
            {medidor}
        </div>
        <div className="mt-1 text-[11.5px] font-bold leading-snug">{children}</div>
    </div>
);

const Contacto = ({ tile, texto, vacio, onCopiar }) => (
    <div className="flex items-center gap-2 rounded-[10px] border border-white/[.08] bg-white/[.03] p-1.5">
        {tile}
        {texto ? (
            <button
                type="button"
                onClick={onCopiar}
                title="Copiar"
                className="group flex min-w-0 flex-1 items-center gap-1.5 text-left text-[10.5px] font-semibold tabular-nums hover:text-white"
            >
                <span className="truncate">{texto}</span>
                <Copy size={11} className="flex-none text-white/30 transition-colors group-hover:text-white/70" />
            </button>
        ) : <span className="text-[10.5px] text-white/35">{vacio}</span>}
    </div>
);

// Banderitas redondas de los idiomas (los emoji de bandera no se dibujan en
// Windows: salen como "BR"/"GB").
const BANDERA_IDIOMA = {
    pt: (
        <>
            <rect width="20" height="20" fill="#009C3B" />
            <path d="M10 3 18 10 10 17 2 10Z" fill="#FFDF00" />
            <circle cx="10" cy="10" r="3.5" fill="#002776" />
        </>
    ),
    en: (
        <>
            <rect width="20" height="20" fill="#012169" />
            <path d="M0 0 20 20M20 0 0 20" stroke="#fff" strokeWidth="3.4" />
            <path d="M0 0 20 20M20 0 0 20" stroke="#C8102E" strokeWidth="1.4" />
            <path d="M10 0v20M0 10h20" stroke="#fff" strokeWidth="5.6" />
            <path d="M10 0v20M0 10h20" stroke="#C8102E" strokeWidth="3.2" />
        </>
    ),
    es: (
        <>
            <rect width="20" height="20" fill="#AA151B" />
            <rect y="5" width="20" height="10" fill="#F1BF00" />
        </>
    ),
};

const Bandera = ({ idioma }) => (
    <span className="block h-5 w-5 flex-none overflow-hidden rounded-full ring-1 ring-white/20">
        <svg viewBox="0 0 20 20" className="h-full w-full" aria-hidden="true">{BANDERA_IDIOMA[idioma]}</svg>
    </span>
);

const Logo = ({ src, className = '' }) => (
    <img src={src} alt="" width="20" height="20" draggable={false} className={`h-5 w-5 flex-none rounded-[5px] ${className}`} />
);

const LogosIA = () => (
    <span className="flex flex-none">
        <Logo src={logoChatgpt} />
        <Logo src={logoClaude} className="-ml-1.5 ring-1 ring-[#0B0F26]" />
    </span>
);

// Idiomas y herramientas, en el orden del mockup. `escala` es la escala propia
// del campo; sin ella rige la genérica de nivel (idiomas, Sheets, IA).
// `etiqueta` e `icono` pueden depender de la candidata (a una brasileña se le
// pregunta por español, no por portugués).
const HERRAMIENTAS = [
    {
        campo: 'idioma2',
        etiqueta: (d) => (d.pais === 'Brasil' ? 'Español' : 'Portugués'),
        icono: (d) => <Bandera idioma={d.pais === 'Brasil' ? 'es' : 'pt'} />,
    },
    { campo: 'ingles', etiqueta: 'Inglés', icono: <Bandera idioma="en" /> },
    { campo: 'sheets', etiqueta: 'Google Sheets', icono: <Logo src={logoSheets} /> },
    { campo: 'ia_nivel', etiqueta: 'ChatGPT · Claude', icono: <LogosIA /> },
    { campo: 'meta', etiqueta: 'Meta Ads', icono: <Logo src={logoMeta} />, escala: 'meta' },
    { campo: 'notion', etiqueta: 'Notion', icono: <Logo src={logoNotion} />, escala: 'notion' },
    { campo: 'wa_tools', etiqueta: 'WhatsApp', icono: <Logo src={logoWhatsapp} />, escala: 'wa_tools' },
    { campo: 'automatizaciones', etiqueta: 'Zapier (o análogas)', icono: <Logo src={logoZapier} />, escala: 'automatizaciones' },
];

// Todo lo que ya tiene lugar propio arriba (cabecera, rieles, herramientas):
// lo que queda del formulario son las "Respuestas".
const YA_MOSTRADAS = new Set([
    'pais', 'nombre', 'email', 'whatsapp', 'edad', 'remuneracion', 'video', 'video_verificado', 'cv',
    ...REQUISITOS.map(([campo]) => campo),
    ...EXPERIENCIA,
    'area',
    ...HERRAMIENTAS.map((h) => h.campo),
]);

const Celda = ({ etiqueta, icono, label, n, title }) => (
    <div className="flex min-w-0 items-center gap-2 border-t border-white/[.07] px-0.5 py-2" title={title}>
        {icono}
        <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1.5">
                <Etiqueta className="truncate">{etiqueta}</Etiqueta>
                <Dots n={n} redondos />
            </div>
            <span
                className="mt-1 block truncate text-[11px] font-bold leading-none"
                style={{ color: n > 0 ? '#fff' : 'rgba(255,255,255,.45)' }}
            >
                {label}
            </span>
        </div>
    </div>
);

const Estrellas = ({ n }) => (
    <span
        className="inline-flex flex-none items-center gap-1 rounded-full border border-[#FF3FA4]/45 bg-[#FF3FA4]/10 py-[2px] pl-1.5 pr-2"
        title={`${n} de 5`}
    >
        <span className="flex gap-px">
            {[1, 2, 3, 4, 5].map((i) => (
                <Star
                    key={i}
                    size={8}
                    strokeWidth={2}
                    fill={i <= n ? 'currentColor' : 'none'}
                    className={i <= n ? 'text-[#FF6AD5]' : 'text-white/25'}
                />
            ))}
        </span>
        <span className="text-[9.5px] font-bold leading-none tabular-nums text-[#FF6AD5]">{n}/5</span>
    </span>
);

// Se despliega y se pliega con la altura animada; `initial={false}` para que lo
// que ya está abierto al montar no se anime al aparecer.
const Plegable = ({ abierto, children }) => (
    <AnimatePresence initial={false}>
        {abierto && (
            <motion.div
                key="contenido"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="overflow-hidden"
            >
                {children}
            </motion.div>
        )}
    </AnimatePresence>
);

// Dice si el texto, tal como está colapsado (una línea), queda cortado: solo
// entonces tiene sentido ofrecer abrirlo. Cerrado no vuelve a medir, así que
// la flecha para volver a cerrarlo no desaparece.
const useCortado = (colapsado, texto) => {
    const ref = useRef(null);
    const [cortado, setCortado] = useState(false);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el || !colapsado) return undefined;
        const medir = () => setCortado(el.scrollWidth > el.clientWidth + 1);
        medir();
        const observador = new ResizeObserver(medir);
        observador.observe(el);
        return () => observador.disconnect();
    }, [colapsado, texto]);
    return [ref, cortado];
};

const CLASE_TARJETA = 'min-w-0 rounded-xl border border-white/[.1] bg-white/[.04] transition-colors hover:border-[#5B7CFF]/45 hover:bg-[#5B7CFF]/[.07]';

const TarjetaRespuesta = ({ campo, valor, abierta, onToggle }) => {
    const texto = String(valor);
    const enlace = campo === 'diseno_link' ? href(texto) : null;
    const nivel = NIVELES[campo]?.(texto);
    const puntos = nivel?.ok ? estrellas(nivel.n, nivel.max) : null;
    const [textoRef, cortado] = useCortado(!abierta, texto);
    const expandible = !enlace && (abierta || cortado);

    const titulo = (
        <span className="flex items-center gap-2">
            <span className="truncate text-[11.5px] font-bold">{PREGUNTA_CORTA[campo] || campo}</span>
            {puntos && <Estrellas n={puntos} />}
        </span>
    );

    if (enlace) {
        return (
            <div className={`${CLASE_TARJETA} px-3 py-1.5`}>
                {titulo}
                <a href={enlace} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-[10.5px] leading-snug text-[#8AA3FF] hover:underline">
                    {texto}
                </a>
            </div>
        );
    }

    return (
        <div className={CLASE_TARJETA}>
            <button
                type="button"
                disabled={!expandible}
                onClick={onToggle}
                aria-expanded={expandible ? abierta : undefined}
                className="flex w-full items-start gap-2 px-3 py-1.5 text-left disabled:cursor-default"
            >
                <span className="min-w-0 flex-1">
                    {titulo}
                    <span
                        ref={textoRef}
                        className={`mt-0.5 block text-[10.5px] leading-snug text-white/65 ${abierta ? 'whitespace-pre-wrap break-words' : 'truncate'}`}
                    >
                        {texto}
                    </span>
                </span>
                {expandible && (
                    <ChevronDown
                        size={14}
                        className="mt-0.5 flex-none text-white/35 transition-transform duration-200"
                        style={{ transform: abierta ? 'rotate(180deg)' : 'none' }}
                    />
                )}
            </button>
        </div>
    );
};

const GrupoRespuestas = ({ icono: Icono, titulo, campos, d, columnas, cerrado, onToggleGrupo, abiertas, todasAbiertas, onToggle }) => {
    if (campos.length === 0) return null;
    return (
        <div>
            <button
                type="button"
                onClick={onToggleGrupo}
                aria-expanded={!cerrado}
                className="flex items-center gap-1.5 py-1 text-white/50 transition-colors hover:text-white/80"
            >
                <Icono size={11} className="text-[#5B7CFF]" />
                <small className="text-[8.5px] font-extrabold uppercase leading-none tracking-[.16em]">{titulo}</small>
                <small className="rounded-full bg-white/10 px-1.5 py-[2px] text-[8.5px] font-extrabold leading-none tabular-nums">{campos.length}</small>
                <ChevronDown size={11} className="transition-transform duration-200" style={{ transform: cerrado ? 'rotate(-90deg)' : 'none' }} />
            </button>
            <Plegable abierto={!cerrado}>
                <div className={`grid items-start gap-2 pb-1 pt-1 ${columnas}`}>
                    {campos.map((campo) => (
                        <TarjetaRespuesta
                            key={campo}
                            campo={campo}
                            valor={d[campo]}
                            abierta={todasAbiertas || abiertas.has(campo)}
                            onToggle={() => onToggle(campo)}
                        />
                    ))}
                </div>
            </Plegable>
        </div>
    );
};

const HiringCandidateModal = ({ applicationId, ids, onClose, onNavigate, onDecidido }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [fallo, setFallo] = useState(false);
    const [abiertas, setAbiertas] = useState(new Set());
    const [todasAbiertas, setTodasAbiertas] = useState(false);
    const [gruposCerrados, setGruposCerrados] = useState(new Set());
    const [bajaAbierta, setBajaAbierta] = useState(false);
    const [motivo, setMotivo] = useState('');
    const [copiado, setCopiado] = useState(null);
    const cuerpo = useRef(null);

    // Al navegar rápido (flechas, auto-avance) puede haber dos pedidos en vuelo:
    // si el de la postulación anterior llega tarde, no debe pisar a la actual —
    // los botones de decisión actúan sobre `applicationId`, no sobre lo que se ve.
    const idVigente = useRef(applicationId);
    useEffect(() => { idVigente.current = applicationId; }, [applicationId]);

    const cargar = useCallback(async (id) => {
        setLoading(true);
        setFallo(false);
        try {
            const res = await api.get(`/assistant-applications/${id}`);
            if (id === idVigente.current) setData(res.data);
        } catch (err) {
            console.error('Error al cargar la postulación:', err);
            if (id === idVigente.current) setFallo(true);
        } finally {
            if (id === idVigente.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (applicationId) cargar(applicationId);
        // Nada de la postulación anterior queda en pantalla mientras carga la
        // siguiente: la cabecera con el nombre de una y el pie de otra confunde.
        setData(null);
        setAbiertas(new Set());
        setTodasAbiertas(false);
        setBajaAbierta(false);
        setMotivo('');
        cuerpo.current?.scrollTo({ top: 0 });
    }, [applicationId, cargar]);

    const idx = ids.indexOf(applicationId);
    const anterior = () => idx > 0 && onNavigate(ids[idx - 1]);
    const siguiente = () => idx < ids.length - 1 && onNavigate(ids[idx + 1]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') anterior();
            if (e.key === 'ArrowRight') siguiente();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }); // sin deps: `idx` cambia en cada render de navegación

    if (!applicationId) return null;

    const decidir = async (valor, motivoTexto) => {
        // Tocar de nuevo el mismo botón activo lo deshace (vuelve a null) — eso
        // no es "avanzar a la próxima decisión", es corregir la actual, así que
        // no dispara el auto-avance.
        const esUndo = data?.estado === valor && !motivoTexto;
        try {
            await api.post(`/assistant-applications/${applicationId}/estado`, {
                valor: esUndo ? null : valor,
                motivo: motivoTexto || null,
            });
            setBajaAbierta(false);
            setMotivo('');
            onDecidido?.();
            // Auto-avance: decidido el veredicto, se salta sola a la siguiente
            // postulación de la lista para poder despachar en cadena, igual que
            // pidió Kerwin en la grabación. Si era la última, se queda mostrando
            // esta (ya actualizada).
            if (!esUndo && idx < ids.length - 1) {
                siguiente();
            } else {
                await cargar(applicationId);
            }
        } catch (err) {
            console.error('Error al guardar el veredicto:', err);
        }
    };

    const copiar = (texto, etiqueta) => {
        navigator.clipboard?.writeText(String(texto || '')).finally(() => {
            setCopiado(etiqueta);
            setTimeout(() => setCopiado(null), 1800);
        });
    };

    const toggle = (campo) => setAbiertas((prev) => {
        const next = new Set(prev);
        next.has(campo) ? next.delete(campo) : next.add(campo);
        setTodasAbiertas(false);
        return next;
    });

    const toggleGrupo = (grupo) => setGruposCerrados((prev) => {
        const next = new Set(prev);
        next.has(grupo) ? next.delete(grupo) : next.add(grupo);
        return next;
    });

    const d = data || {};
    const cargando = loading && !data;
    const digitos = soloDigitos(d.whatsapp);
    const videoHref = href(d.video);
    const cvHref = href(d.cv);
    const veredicto = VEREDICTO[d.veredicto] || VEREDICTO.sin_analizar;
    const IconoVeredicto = ICONO_VEREDICTO[d.veredicto] || Info;
    const ubicacion = [[d.pais, d.provincia].filter(Boolean).join(' - '), d.edad && `${d.edad} años`].filter(Boolean).join(' · ') || '—';

    // Lo que el formulario preguntó y no tiene lugar propio arriba, en el orden
    // en que lo contestó la candidata y partido en dos: opción y escritas. Solo
    // lo respondido — un campo vacío (o una pregunta condicional que no le
    // tocó) no es una tarjeta más que revisar.
    const opcion = [];
    const escritas = [];
    (d.bloques || []).forEach((bloque) => bloque.campos.forEach((campo) => {
        if (YA_MOSTRADAS.has(campo) || d[campo] == null || d[campo] === '') return;
        (CAMPOS_ESCRITOS.has(campo) ? escritas : opcion).push(campo);
    }));

    const botones = ACCIONES.filter((a) => (ACCIONES_POR_VEREDICTO[d.veredicto] || []).includes(a.id));
    const estadoTexto = [
        d.revisado_por && `Decidió ${d.revisado_por}`,
        d.estado_motivo,
        copiado && `${copiado} copiado`,
    ].filter(Boolean).join(' · ');

    return (
        <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[#020617]/80 p-0 backdrop-blur-sm [@media(min-width:640px)_and_(min-height:681px)]:p-3"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
        >
            {/* En pantallas altas el diálogo mide lo que su contenido (mínimo 700px,
                para que no cambie de tamaño entre una postulación y otra); en las
                bajas —un notebook— ocupa toda la pantalla, sin margen ni bordes
                redondeados, para que todo entre sin scrollear. */}
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={d.nombre ? `Postulación de ${d.nombre}` : 'Postulación'}
                className="flex max-h-full min-h-[min(100%,700px)] w-full max-w-[1280px] flex-col overflow-hidden border-white/[.12] bg-[#0B0F26] shadow-2xl [@media(min-width:640px)_and_(min-height:681px)]:rounded-[20px] [@media(min-width:640px)_and_(min-height:681px)]:border"
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: 10, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
                {/* Cabecera fija: identidad a la izquierda; acceso rápido al video, al
                    CV, el veredicto, lo que pide y el score a la derecha. */}
                <header className="flex flex-none flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 bg-[#020617]/95 px-4 py-2 sm:px-6">
                    <div className="flex min-w-0 flex-1 basis-[260px] items-center gap-3">
                        <span
                            className="grid h-9 w-9 flex-none place-items-center rounded-[11px] text-[16px] font-black"
                            style={{ background: 'linear-gradient(135deg,#1323C6,#5B7CFF)' }}
                        >
                            {(d.nombre || '?')[0]}
                        </span>
                        <div className="min-w-0">
                            <small className="block text-[8.5px] font-extrabold uppercase leading-none tracking-[.2em] text-[#FF3FA4]">Postulación</small>
                            <h2 className="truncate text-[18px] font-black leading-[1.15] tracking-tight">{d.nombre || '—'}</h2>
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] leading-none text-white/50">
                                <span className="h-2.5 w-3.5 flex-none rounded-[2px]" style={{ background: BANDERA[d.pais] || 'rgba(255,255,255,.2)' }} />
                                {ubicacion}
                                {d.modalidad && (
                                    <span
                                        className="rounded-full border px-2 py-[2px] text-[8.5px] font-black uppercase tracking-[.12em]"
                                        style={{ color: MODALIDAD[d.modalidad]?.fg, borderColor: MODALIDAD[d.modalidad]?.bd, background: MODALIDAD[d.modalidad]?.bg }}
                                    >
                                        {MODALIDAD[d.modalidad]?.label}
                                    </span>
                                )}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        {!cargando && !fallo && (
                            <>
                                {videoHref ? (
                                    <a href={videoHref} target="_blank" rel="noreferrer" className={PILDORA_NEUTRA}>
                                        <PlayCircle size={14} /> Presentación
                                        {!d.video_ok && <span className="text-[9px] font-bold text-[#FF6AD5]">· sin verificar</span>}
                                    </a>
                                ) : (
                                    <span className={PILDORA_AUSENTE}><PlayCircle size={14} /> Sin video</span>
                                )}
                                {cvHref ? (
                                    <a href={cvHref} target="_blank" rel="noreferrer" className={PILDORA_NEUTRA}>
                                        <FileText size={14} /> CV
                                    </a>
                                ) : (
                                    <span className={PILDORA_AUSENTE}><FileText size={14} /> Sin CV</span>
                                )}
                                <span className={`${PILDORA} border`} style={{ color: veredicto.fg, background: veredicto.bg, borderColor: veredicto.bd }}>
                                    <IconoVeredicto size={13} /> {veredicto.label}
                                </span>
                                <span className={`${PILDORA} gap-2 border-[#5B7CFF]/50 bg-[#1323C6]/[.14]`}>
                                    <span className="grid h-[18px] w-[18px] flex-none place-items-center rounded-full border border-[#8AA3FF]/60 text-[#8AA3FF]">
                                        <DollarSign size={10} strokeWidth={2.6} />
                                    </span>
                                    <span className="text-[15px] font-black tabular-nums" style={{ color: Number(d.remuneracion) > 400 ? '#FF6AD5' : '#fff' }}>
                                        {d.remuneracion || '—'}
                                    </span>
                                    <Etiqueta>USD / mes</Etiqueta>
                                </span>
                                <span className={`${PILDORA} gap-2 border-white/[.32] bg-white/[.04]`}>
                                    <Etiqueta>Score</Etiqueta>
                                    <span className="text-[16px] font-black tabular-nums" style={{ color: d.score >= 85 ? '#5B7CFF' : '#fff' }}>
                                        {d.score ?? '—'}
                                    </span>
                                </span>
                            </>
                        )}

                        <span className="ml-1 flex flex-none items-center gap-1.5">
                            <button type="button" onClick={anterior} disabled={idx <= 0} aria-label="Anterior" className={BOTON_ICONO}>
                                <ChevronLeft size={15} />
                            </button>
                            {idx >= 0 && (
                                <span className="min-w-[30px] text-center text-[10.5px] font-bold tabular-nums text-white/45">{idx + 1}/{ids.length}</span>
                            )}
                            <button type="button" onClick={siguiente} disabled={idx >= ids.length - 1} aria-label="Siguiente" className={BOTON_ICONO}>
                                <ChevronRight size={15} />
                            </button>
                            <button type="button" onClick={onClose} aria-label="Cerrar" className={`${BOTON_ICONO} ml-1`}>
                                <X size={15} />
                            </button>
                        </span>
                    </div>
                </header>

                {/* Cuerpo: lo único que puede scrollear, y solo si la pantalla es
                    más chica que la postulación. */}
                <div ref={cuerpo} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    {cargando && <div className="px-7 py-20 text-center text-[13px] text-white/40">Cargando la postulación…</div>}
                    {fallo && !data && <div className="px-7 py-20 text-center text-[13px] text-[#E85C4A]">No se pudo cargar la postulación.</div>}

                    {data && (
                        <motion.div
                            key={applicationId}
                            className="mx-auto flex w-full max-w-[1180px] flex-col gap-2.5 px-4 py-2.5 sm:px-6"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.16 }}
                        >
                            {(d.descartado || d.auto_ko) && (
                                <div className="flex items-start gap-2.5 rounded-xl border border-[#4C2227] bg-[#1B0F1D] px-3.5 py-2.5">
                                    <AlertTriangle size={15} className="mt-px flex-none text-[#E85C4A]" />
                                    <span className="text-[11.5px] leading-snug text-white/60">
                                        <span className="font-bold text-[#E85C4A]">El formulario cortó esta postulación · </span>
                                        {d.motivo_descarte || 'Una respuesta del bloque Requisitos es excluyente. No llegó a completar el resto.'}
                                    </span>
                                </div>
                            )}

                            <div className="grid items-stretch gap-2.5 sm:grid-cols-2 lg:grid-cols-[156px_156px_minmax(0,1fr)]">
                                <Riel titulo="Filtros y jornada" icono={CheckCircle2}>
                                    {REQUISITOS.map(([campo, ok]) => {
                                        const valor = d[campo];
                                        return (
                                            <FilaRiel key={campo} k={PREGUNTA_CORTA[campo]} title={valor || 'Sin respuesta'}>
                                                <span className="flex items-start gap-1.5">
                                                    {valor
                                                        ? (ok(valor)
                                                            ? <CheckCircle2 size={13} className="mt-px flex-none text-[#2FBF8F]" />
                                                            : <AlertTriangle size={13} className="mt-px flex-none text-[#D9A441]" />)
                                                        : <XCircle size={13} className="mt-px flex-none text-white/25" />}
                                                    <span className={valor ? '' : 'text-white/35'}>
                                                        {VAL_CORTO[valor] || valor || 'Sin respuesta'}
                                                    </span>
                                                </span>
                                            </FilaRiel>
                                        );
                                    })}
                                    <div className="flex flex-col gap-1.5 border-t border-white/[.07] pb-1 pt-2.5">
                                        <Contacto
                                            tile={<span className="grid h-6 w-6 flex-none place-items-center rounded-lg bg-white/[.07] text-white/65"><Inbox size={13} /></span>}
                                            texto={d.email}
                                            vacio="Sin correo"
                                            onCopiar={() => copiar(d.email, 'correo')}
                                        />
                                        <Contacto
                                            tile={digitos ? (
                                                <a
                                                    href={`https://wa.me/${digitos}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    aria-label="Abrir WhatsApp"
                                                    title="Abrir WhatsApp"
                                                    className="grid h-6 w-6 flex-none place-items-center rounded-lg bg-[#25D366]/20 text-[#25D366] transition-colors hover:bg-[#25D366]/35"
                                                >
                                                    <MessageCircle size={13} />
                                                </a>
                                            ) : (
                                                <span className="grid h-6 w-6 flex-none place-items-center rounded-lg bg-white/[.07] text-white/30"><MessageCircle size={13} /></span>
                                            )}
                                            texto={digitos ? d.whatsapp : null}
                                            vacio="Sin WhatsApp"
                                            onCopiar={() => copiar(d.whatsapp, 'whatsapp')}
                                        />
                                    </div>
                                </Riel>

                                <Riel titulo="Experiencia" icono={Sparkles}>
                                    {EXPERIENCIA.map((campo) => {
                                        const e = escalaDe(campo, d[campo]);
                                        return (
                                            <FilaRiel key={campo} k={PREGUNTA_CORTA[campo]} title={d[campo] || 'Sin respuesta'} medidor={<Dots n={e.n} redondos />}>
                                                <span className={e.ok ? '' : 'text-white/35'}>{e.label}</span>
                                            </FilaRiel>
                                        );
                                    })}
                                    <FilaRiel k={PREGUNTA_CORTA.area} title={d.area || ''}>
                                        <span className={d.area ? 'text-white/85' : 'text-white/35'}>{AREA_CORTO[d.area] || d.area || 'Sin respuesta'}</span>
                                    </FilaRiel>
                                </Riel>

                                <div className="flex min-w-0 flex-col gap-2.5 sm:col-span-2 lg:col-span-1">
                                    <Riel titulo="Idiomas y herramientas" icono={Filter}>
                                        <div className="grid grid-cols-2 gap-x-3 min-[1240px]:grid-cols-4">
                                            {HERRAMIENTAS.map((h) => {
                                                const valor = d[h.campo];
                                                const nivel = h.escala ? escalaDe(h.escala, valor) : { n: nivelDe(valor), label: nivelCorto(valor) };
                                                const resolver = (x) => (typeof x === 'function' ? x(d) : x);
                                                return (
                                                    <Celda
                                                        key={h.campo}
                                                        etiqueta={resolver(h.etiqueta)}
                                                        icono={resolver(h.icono)}
                                                        label={valor ? nivel.label : 'Sin respuesta'}
                                                        n={valor ? nivel.n : 0}
                                                        title={valor || 'Sin respuesta'}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </Riel>

                                    <section className="flex min-w-0 flex-col">
                                        <div className="flex flex-wrap items-center justify-between gap-2 pb-1 pt-0.5">
                                            <small className="text-[8.5px] font-extrabold uppercase leading-none tracking-[.16em] text-white/50">Respuestas</small>
                                            <button
                                                type="button"
                                                onClick={() => { setTodasAbiertas((v) => !v); setAbiertas(new Set()); }}
                                                className="inline-flex h-7 items-center gap-1.5 rounded-[10px] border border-white/[.32] bg-white/[.04] px-3 text-[10.5px] font-bold transition-all hover:bg-[#5B7CFF]/20"
                                            >
                                                {todasAbiertas ? 'Cerrar las respuestas largas' : 'Abrir todas las respuestas'}
                                                <ChevronDown size={12} className="transition-transform duration-200" style={{ transform: todasAbiertas ? 'rotate(180deg)' : 'none' }} />
                                            </button>
                                        </div>

                                        {opcion.length === 0 && escritas.length === 0 && (
                                            <span className="py-3 text-[11.5px] text-white/35">Todavía no hay más respuestas para revisar.</span>
                                        )}

                                        <GrupoRespuestas
                                            icono={ListChecks}
                                            titulo="Choice"
                                            campos={opcion}
                                            d={d}
                                            columnas="sm:grid-cols-2"
                                            cerrado={gruposCerrados.has('opcion')}
                                            onToggleGrupo={() => toggleGrupo('opcion')}
                                            abiertas={abiertas}
                                            todasAbiertas={todasAbiertas}
                                            onToggle={toggle}
                                        />
                                        {/* Con más de tres escritas van de a dos: una postulación
                                            completa (el formulario viejo tiene hasta ocho) sigue
                                            entrando en una pantalla de notebook. */}
                                        <GrupoRespuestas
                                            icono={PenLine}
                                            titulo="Escrito"
                                            campos={escritas}
                                            d={d}
                                            columnas={escritas.length > 3 ? 'sm:grid-cols-2' : ''}
                                            cerrado={gruposCerrados.has('escrito')}
                                            onToggleGrupo={() => toggleGrupo('escrito')}
                                            abiertas={abiertas}
                                            todasAbiertas={todasAbiertas}
                                            onToggle={toggle}
                                        />
                                    </section>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Barra de decisión, fija abajo: el veredicto se pone sin scrollear.
                    Deja libre el costado derecho, donde flota el botón global de
                    reportar un problema. */}
                {data && (
                    <footer className="flex-none border-t border-white/10 bg-[#020617]/95 px-4 py-2 pr-[156px] sm:px-6 sm:pr-[168px]">
                        {bajaAbierta ? (
                            <div className="flex flex-wrap items-center justify-end gap-2.5">
                                <span className="text-[12px] font-bold text-white/70">Motivo de la baja de {d.nombre}:</span>
                                <input
                                    type="text"
                                    autoFocus
                                    value={motivo}
                                    onChange={(e) => setMotivo(e.target.value)}
                                    placeholder="Por qué se fue…"
                                    className="h-9 min-w-[200px] flex-1 rounded-xl border border-white/[.38] bg-black/30 px-3 text-[12.5px] text-white outline-none focus:border-[#5B7CFF]"
                                />
                                <button
                                    type="button"
                                    disabled={motivo.trim().length < 4}
                                    onClick={() => decidir('baja', motivo.trim())}
                                    className="h-9 rounded-xl border border-[#4C2227] px-4 text-[12px] font-black transition-all disabled:opacity-50"
                                    style={motivo.trim().length >= 4
                                        ? { background: '#E85C4A', color: '#1B0808' }
                                        : { background: 'transparent', color: '#E85C4A' }}
                                >
                                    Confirmar baja
                                </button>
                                <button type="button" onClick={() => { setBajaAbierta(false); setMotivo(''); }} className="text-[12px] font-bold text-white/50 hover:text-white">
                                    Cancelar
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center justify-end gap-2">
                                {estadoTexto && (
                                    <span className="mr-auto min-w-0 truncate text-[11px] font-semibold text-white/40">{estadoTexto}</span>
                                )}
                                {botones.map((a) => {
                                    const activo = d.estado === a.id;
                                    return (
                                        <motion.button
                                            key={a.id}
                                            type="button"
                                            onClick={() => (a.id === 'baja' && !activo ? setBajaAbierta(true) : decidir(a.id))}
                                            whileHover={{ y: -2 }}
                                            whileTap={{ scale: 0.95 }}
                                            transition={{ duration: 0.12 }}
                                            className="flex h-8 items-center gap-2 rounded-xl border px-4 text-[12px] font-bold"
                                            style={{
                                                borderColor: a.bd,
                                                background: activo ? a.fg : a.bg,
                                                color: activo ? '#0B0F26' : a.fg,
                                            }}
                                            title={activo ? 'Tocar otra vez lo deshace' : a.label}
                                        >
                                            <a.icon size={14} /> {a.label}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        )}
                    </footer>
                )}
            </motion.div>
        </motion.div>
    );
};

export default HiringCandidateModal;
