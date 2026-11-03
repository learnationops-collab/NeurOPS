import React, { useLayoutEffect, useRef, useState } from 'react';
import {
    Briefcase, CalendarCheck, Check, ChevronDown, Copy, FileText, Filter, Languages, Layers, PenLine, Plus,
    Puzzle, Sparkles, User, Wallet, Wrench, XCircle,
} from 'lucide-react';
import { Aura } from '../../../../components/standard';
import { href } from '../lib/escalas';

// Las tarjetas de sección de la ficha, armadas con lo que manda el backend
// (`secciones`: un bloque de su formulario por sección, cada pregunta con su
// tipo y si la respuesta la corta; `puntaje`: los puntos de cada pregunta que
// suma al score). No conoce las preguntas: si el formulario cambia, la ficha
// cambia sola.

// Color, ícono y bajada de cada sección según su nombre (lo edita quien arma el formulario).
const DECO_BLOQUE = [
    [/excluy|requisit|filtro/, 'var(--success)', Filter, 'Requisitos mínimos para avanzar'],
    [/deseab/, 'var(--info)', Plus, 'Suman puntos al score'],
    [/inteligencia|\bia\b/, 'var(--brand-secondary)', Sparkles, 'Herramientas que ya usa'],
    [/cualitativ|criterio|aporte|actitud/, 'var(--warning)', PenLine, 'Respuestas abiertas'],
    [/identific|datos|contacto/, 'var(--idle)', User, null],
    [/experien|trayect|antecedent/, 'var(--info)', Briefcase, null],
    [/idioma|lengua/, 'var(--info)', Languages, null],
    [/herramient|software|tecnolog/, 'var(--brand-secondary)', Wrench, null],
    [/remunera|salari|sueldo|dinero|pago/, 'var(--success)', Wallet, null],
    [/organiz|jornada|horario|disponib/, 'var(--success)', CalendarCheck, null],
    [/resolv|caso|problema/, 'var(--warning)', Puzzle, null],
    [/archivo|video|cv|curr/, 'var(--idle)', FileText, null],
];
const COLORES_SUELTOS = ['var(--info)', 'var(--brand-secondary)', 'var(--success)', 'var(--warning)'];

export const decoBloque = (titulo, i = 0) => {
    const t = String(titulo || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const hit = DECO_BLOQUE.find(([re]) => re.test(t));
    return hit
        ? { color: hit[1], Icono: hit[2], bajada: hit[3] }
        : { color: COLORES_SUELTOS[i % COLORES_SUELTOS.length], Icono: Layers, bajada: null };
};

const LARGO = 48;

const esAncho = (p) => p.tipo === 'check' || p.tipo === 'parrafo' || p.tipo === 'link'
    || (p.valor != null && String(p.valor).length > LARGO);

// Alto aproximado de una sección, para repartirlas en dos columnas parejas.
const altoDe = (s) => 70 + s.preguntas.reduce((n, p) => {
    const largo = p.valor == null ? 0 : String(p.valor).length;
    const fila = p.tipo === 'check' ? 40 + 30 * Math.ceil(largo / 70) : 52 + 20 * Math.min(3, Math.floor(largo / 60));
    return n + (esAncho(p) ? fila : fila / 2);
}, 0);

/** Reparte las secciones en dos columnas: cada una va a la más corta, en orden. */
export const repartir = (secciones) => {
    const cols = [[], []];
    const alto = [0, 0];
    secciones.forEach((s, i) => {
        const k = alto[0] <= alto[1] ? 0 : 1;
        cols[k].push({ s, i });
        alto[k] += altoDe(s);
    });
    return cols;
};

const Copiar = ({ texto, etiqueta, onCopiar }) => (
    <button type="button" className="tl-fi-ibtn" onClick={() => onCopiar(texto, etiqueta)} title="Copiar" aria-label={`Copiar ${etiqueta}`}>
        <Copy size={14} />
    </button>
);

// Texto largo: tres renglones y «Ver todo», solo si de verdad quedó cortado.
const TextoLargo = ({ texto, abierto, onToggle }) => {
    const ref = useRef(null);
    const [cortado, setCortado] = useState(false);
    useLayoutEffect(() => {
        const el = ref.current;
        if (el && !abierto) setCortado(el.scrollHeight > el.clientHeight + 1);
    }, [texto, abierto]);
    return (
        <>
            <p ref={ref} className={`tl-fi-valor tl-fi-valor--largo${abierto ? '' : ' is-cerrado'}`}>{texto}</p>
            {(cortado || abierto) && (
                <button type="button" className="tl-fi-vertodo" onClick={onToggle}>
                    {abierto ? 'Ver menos' : 'Ver todo'}
                    <ChevronDown size={14} style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                </button>
            )}
        </>
    );
};

const Valor = ({ p, abierto, onToggle }) => {
    if (p.valor == null) return <p className="tl-fi-valor is-vacio">Sin respuesta</p>;
    const texto = String(p.valor);
    if (p.tipo === 'check') {
        return (
            <div className="tl-fi-chips">
                {texto.split(' | ').filter(Boolean).map((t) => (
                    <span key={t} className="tl-fi-chip"><Check size={14} aria-hidden="true" />{t}</span>
                ))}
            </div>
        );
    }
    if (p.tipo === 'dinero' || p.tipo === 'numero') {
        return (
            <p className="tl-fi-valor tl-fi-num">
                {p.tipo === 'dinero' ? `$ ${texto}` : texto}{p.unidad && <small>{p.unidad}</small>}
            </p>
        );
    }
    if (p.tipo === 'link') {
        const enlace = href(texto);
        return enlace
            ? <a className="tl-fi-link" href={enlace} target="_blank" rel="noreferrer">{texto}</a>
            : <p className="tl-fi-valor">{texto}</p>;
    }
    if (p.tipo === 'parrafo' || texto.length > 90) return <TextoLargo texto={texto} abierto={abierto} onToggle={onToggle} />;
    return <p className="tl-fi-valor">{texto}</p>;
};

const Item = ({ p, pts, abierto, onToggle, onCopiar }) => {
    const copiable = p.valor != null && (p.tipo === 'parrafo' || p.tipo === 'email' || p.tipo === 'tel' || String(p.valor).length > 90);
    return (
        <div className={`tl-fi-item${esAncho(p) ? ' is-ancho' : ''}${p.corta ? ' is-corta' : ''}`}>
            <div className="tl-fi-item-etq">
                <span title={p.t}>{p.t}</span>
                {p.corta && <span className="tl-fi-corta"><XCircle size={11} aria-hidden="true" /> Corta</span>}
                {pts && <span className="tl-fi-pts" title={`Importancia ×${pts.peso}`}>{+pts.puntos.toFixed(1)}/{pts.maximo} pts</span>}
                {copiable && <Copiar texto={p.valor} etiqueta="respuesta" onCopiar={onCopiar} />}
            </div>
            <Valor p={p} abierto={abierto} onToggle={onToggle} />
        </div>
    );
};

export const Seccion = ({ s, i, puntos, abiertas, onToggle, onCopiar }) => {
    const { color, Icono, bajada } = decoBloque(s.titulo, i);
    const total = s.preguntas.length;
    const bien = s.preguntas.filter((p) => p.valor != null && !p.corta).length;
    const corta = s.preguntas.some((p) => p.corta);
    return (
        <section className="tl-fi-sec" style={{ '--c': color, '--i': i }}>
            <Aura soft size="card" colors={[color, 'var(--brand-primary)']} />
            <header className="tl-fi-sec-cab">
                <span className="tl-fi-tile"><Icono size={18} aria-hidden="true" /></span>
                <div className="tl-fi-sec-tit">
                    <h3>{s.titulo}</h3>
                    <p>{bajada || `${total} ${total === 1 ? 'pregunta' : 'preguntas'}`}</p>
                </div>
                <span className="tl-fi-cuenta" style={corta ? { '--c': 'var(--error)' } : undefined}
                    title={corta ? 'Una respuesta corta la postulación' : 'Respondidas sin cortar'}>
                    <b>{bien}</b><span>/{total}</span>
                </span>
            </header>
            <div className="tl-fi-items">
                {s.preguntas.map((p) => (
                    <Item key={p.id} p={p} pts={puntos[p.id]} abierto={abiertas.has(p.id)}
                        onToggle={() => onToggle(p.id)} onCopiar={onCopiar} />
                ))}
            </div>
        </section>
    );
};
