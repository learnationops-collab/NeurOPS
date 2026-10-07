// Pantalla de elección al entrar, con el formato de la referencia de Learnation Holding: la hora arriba
// a la izquierda, el selector de fondo a la derecha, el isotipo con sus anillos, un saludo con el primer
// nombre que entra letra por letra y una tarjeta por opción, cada una con su color. La usan el rol (en
// el login, si la persona tiene más de uno) y el área (/inicio, si el rol tiene más de una).

import { useEffect, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Isotipo } from '../comercial/components/Shared';
import FondoEntrada, { SelectorFondo, useFondo } from './FondoEntrada';
import './login.css';

export function saludo(fecha = new Date()) {
    const h = fecha.getHours();
    return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}

// "mario_bueller" → "Mario".
export function primerNombre(nombre) {
    const p = String(nombre || '').trim().split(/[\s._-]+/)[0] || '';
    return p ? p.charAt(0).toUpperCase() + p.slice(1) : '';
}

// El color de cada tarjeta, en orden (como las de la referencia).
const ACENTOS = ['#ff3fa4', '#22c3ee', '#9b6bff', '#ffb03a', '#2fd4a7', '#8e9bd8'];

function Reloj() {
    const [ahora, setAhora] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setAhora(new Date()), 15000);
        return () => clearInterval(t);
    }, []);
    const hora = ahora.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const fecha = ahora.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
    return (
        <div className="el-reloj" aria-hidden="true">
            <b>{hora}</b>
            <span>{fecha}</span>
        </div>
    );
}

/** El isotipo con anillos que giran lento: el logo de la entrada. */
export function LogoEntrada({ idGrad }) {
    return (
        <span className="fe-logo" aria-hidden="true">
            <svg className="fe-anillos" viewBox="0 0 132 132" fill="none">
                <circle className="fe-anillo-a" cx="66" cy="66" r="63" stroke="rgba(255,255,255,.28)" strokeWidth="1" strokeDasharray="2 7" strokeLinecap="round" />
                <g className="fe-anillo-b"><circle cx="66" cy="66" r="57" stroke="rgba(255,120,200,.35)" strokeWidth="1.2" strokeDasharray="70 40 20 60" /></g>
            </svg>
            <Isotipo idGrad={idGrad} />
        </span>
    );
}

/** El marco de la entrada: fondo elegido, la hora, el selector de fondo y lo de adentro, centrado. */
export function MarcoEntrada({ children, clase = '', reloj = true }) {
    const [fondo, setFondo] = useFondo();
    return (
        <div className={'lg el ' + clase}>
            <FondoEntrada fondo={fondo} onLento={() => setFondo('light')} />
            <header className="fe-arriba">
                {reloj ? <Reloj /> : <span />}
                <SelectorFondo fondo={fondo} onCambiar={setFondo} />
            </header>
            {children}
        </div>
    );
}

// El saludo entra letra por letra, sin agrandarse: el nombre en rosa.
function Saludo({ nombre }) {
    const s = saludo() + (nombre ? ', ' : '');
    let i = 0;
    const letra = (c, clase) => <span key={i} className={'fe-ch' + (clase ? ' ' + clase : '')} style={{ '--i': i++ }} aria-hidden="true">{c}</span>;
    return (
        <h1 className="el-hola" aria-label={s + nombre}>
            {[...s].map(c => letra(c))}
            {nombre && <span className="fe-nombre">{[...nombre].map(c => letra(c, 'fe-ch--nombre'))}</span>}
        </h1>
    );
}

/**
 * nombre: el de la cuenta. pregunta: el texto bajo el saludo.
 * opciones: [{ clave, titulo, detalle?, Icono, onElegir?, pronto? }]. Sin onElegir (o con pronto) queda
 * deshabilitada con «Pronto». eligiendo: la clave que está cargando. pie: lo que va debajo (el toggle).
 */
export default function Eleccion({ nombre, pregunta, opciones, eligiendo = null, error = null, pie = null }) {
    const n = primerNombre(nombre);
    return (
        <MarcoEntrada>
            <main className="el-centro">
                <LogoEntrada idGrad="lnGradEleccion" />
                <Saludo nombre={n} />
                {pregunta && <p className="el-pregunta">{pregunta}</p>}
                <div className="el-tarjetas" role="group" aria-label={pregunta || 'Opciones'}>
                    {opciones.map((o, i) => {
                        const pronto = o.pronto || !o.onElegir;
                        return (
                            <button key={o.clave} type="button" className={'el-tarjeta' + (pronto ? ' el-tarjeta--pronto' : '')}
                                style={{ '--acento': pronto ? '#8e9bd8' : ACENTOS[i % ACENTOS.length], '--n': i }}
                                disabled={pronto || !!eligiendo} onClick={() => o.onElegir(o)}>
                                <span className="el-ico">{o.Icono && <o.Icono size={20} />}</span>
                                <span className="el-num">{pronto ? 'Pronto' : String(i + 1).padStart(2, '0')}</span>
                                <span className="el-txt">
                                    <small>Learnation</small>
                                    <b>{o.titulo}</b>
                                    {o.detalle && <em>{o.detalle}</em>}
                                </span>
                                {eligiendo === o.clave
                                    ? <Loader2 size={18} className="lg-gira el-cargando" />
                                    : !pronto && <span className="el-ir" aria-hidden="true"><ArrowRight size={14} /></span>}
                            </button>
                        );
                    })}
                </div>
                {error && <p className="lg-error" role="alert">{error}</p>}
                {pie}
            </main>
        </MarcoEntrada>
    );
}
