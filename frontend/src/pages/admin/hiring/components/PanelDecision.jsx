import React, { useEffect, useState } from 'react';
import { Aura } from '../../../../components/standard';
import { MODALIDAD } from '../lib/escalas';
import { VEREDICTO } from './comun';
import { decoBloque, titular } from './SeccionesFicha';

// El panel fijo de la derecha de la ficha: el score con su desglose por sección,
// los datos del perfil y los botones de decisión.

// El número sube de 0 al score al abrir la postulación.
const useCuenta = (fin) => {
    const [n, setN] = useState(0);
    useEffect(() => {
        if (typeof fin !== 'number') return undefined;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(fin); return undefined; }
        const t0 = performance.now();
        let raf;
        const tick = (t) => {
            const p = Math.min(1, (t - t0) / 1400);
            setN(Math.round(fin * (1 - (1 - p) ** 3)));
            if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [fin]);
    return n;
};

/** Los puntos de las preguntas agrupados por sección, en el orden del formulario. */
export const porSeccion = (puntaje = []) => {
    const grupos = [];
    puntaje.forEach((r) => {
        let g = grupos.find((x) => x.bloque === r.bloque);
        if (!g) { g = { bloque: r.bloque, puntos: 0, maximo: 0, num: 0, den: 0 }; grupos.push(g); }
        g.puntos += r.puntos;
        g.maximo += r.maximo;
        g.num += r.peso * (r.puntos / r.maximo);
        g.den += r.peso;
    });
    return grupos.map((g) => ({ ...g, ratio: g.den ? g.num / g.den : 0 }));
};

const ESTILO_BOTON = (a, k) => {
    if (a.id === 'baja') return 'tl-fi-btn--peligro';
    if (k === 0) return 'tl-fi-btn--cta';
    if (k === 1) return 'tl-fi-btn--claro';
    return '';
};

const PanelDecision = ({ d, botones, titulos, onDecidir, nota }) => {
    const score = useCuenta(d.score);
    const [baja, setBaja] = useState(false);
    const [motivo, setMotivo] = useState('');
    useEffect(() => { setBaja(false); setMotivo(''); }, [d.id]);
    const veredicto = VEREDICTO[d.veredicto] || VEREDICTO.sin_analizar;
    const grupos = porSeccion(d.puntaje);
    const lugar = [d.provincia, d.pais].filter(Boolean).join(', ');
    const perfil = [
        lugar && ['País', lugar],
        d.edad && ['Edad', `${d.edad} años`],
        d.modalidad && ['Modalidad', MODALIDAD[d.modalidad]?.label],
        typeof d.completitud === 'number' && d.completitud < 100 && ['Formulario', `${d.completitud} %`],
    ].filter(Boolean);

    return (
        <aside className="tl-fi-dec" aria-label="Decisión">
            <div className="tl-fi-score">
                <Aura size="card" colors={['var(--success)', 'var(--info)', 'var(--brand-secondary)']} />
                <div className="tl-fi-score-cab">
                    <strong className="tl-fi-score-num">{d.score == null ? '—' : score}</strong>
                    <span className="tl-fi-score-etq">Score<small>de 100</small></span>
                    <span className="tl-fi-estado" style={{ color: veredicto.fg, background: veredicto.bg, borderColor: veredicto.bd }}>
                        {veredicto.label}
                    </span>
                </div>
                {grupos.map((g, i) => (
                    <div key={g.bloque} className="tl-fi-fila" style={{ '--c': decoBloque(g.bloque, titulos.indexOf(g.bloque)).color, '--i': i }}>
                        <div><span title={titular(g.bloque)}>{titular(g.bloque)}</span><b>{+g.puntos.toFixed(1)}<small> de {g.maximo}</small></b></div>
                        <span className="tl-fi-barra"><i style={{ width: `${Math.round(g.ratio * 100)}%` }} /></span>
                    </div>
                ))}
            </div>

            {perfil.length > 0 && (
                <div className="tl-fi-perfil">
                    <span className="tl-fi-etq">Perfil</span>
                    {perfil.map(([k, v]) => <div key={k} className="tl-fi-dato"><span>{k}</span><b>{v}</b></div>)}
                </div>
            )}

            <div className="tl-fi-botones">
                {nota && <span className="tl-fi-nota">{nota}</span>}
                {baja ? (
                    <div className="tl-fi-baja">
                        <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de la baja…" aria-label="Motivo de la baja" />
                        <button type="button" className="tl-fi-btn tl-fi-btn--peligro" disabled={motivo.trim().length < 4}
                            onClick={() => onDecidir('baja', motivo.trim())}>Confirmar baja</button>
                        <button type="button" className="tl-fi-btn" onClick={() => setBaja(false)}>Cancelar</button>
                    </div>
                ) : botones.map((a, k) => {
                    const activo = d.estado === a.id;
                    return (
                        <button key={a.id} type="button" className={`tl-fi-btn ${ESTILO_BOTON(a, k)}${activo ? ' is-activo' : ''}`}
                            aria-pressed={activo} title={activo ? 'Tocar otra vez lo deshace' : a.label}
                            onClick={() => (a.id === 'baja' && !activo ? setBaja(true) : onDecidir(a.id))}>
                            <a.icon size={16} aria-hidden="true" /> {a.label}
                        </button>
                    );
                })}
            </div>
        </aside>
    );
};

export default PanelDecision;
