// La pantalla del Portal, con el formato de la referencia de Learnation Holding: la hora arriba a la
// izquierda, la marca a la derecha, el isotipo con sus anillos, un saludo con el primer nombre que entra
// letra por letra y una tarjeta por opción, cada una con su color. La usan el Portal (PortalPage: roles,
// áreas, cuentas y Finances) y la elección de rol al simular (ElegirRolAlSimular). El fondo se elige en
// Configuración › Apariencia (FondoEntrada.jsx).
//
// Con el teclado: Tab entre tarjetas, o el número de cada una (1 a 9) para entrar directo.

import { useEffect, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Isotipo } from '../comercial/components/Shared';
import FondoEntrada, { useFondo } from './FondoEntrada';
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

/**
 * Cuántas columnas para `n` tarjetas, sin dejar una sola en la última fila: en ancho completo hasta 5
 * en una fila y después dos filas; hasta 900px, 2 + 2 con 4 y de a 3 desde 5 (3 + 2, 3 + 3), o de a 4
 * cuando de a 3 sobraría una (4 + 3 con 7).
 */
export function columnas(n) {
    const medio = n <= 3 ? n : n === 4 ? 2 : n % 3 === 1 ? 4 : 3;
    return { ancho: n <= 5 ? n : Math.ceil(n / 2), medio };
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

/**
 * El marco de la entrada: el fondo elegido en Apariencia, la hora, la marca y lo de adentro, centrado.
 * Si el equipo no da para el fondo, pasa a Simple solo por esta vez (no cambia lo elegido).
 */
export function MarcoEntrada({ children, clase = '', reloj = true, marca = 'Portal' }) {
    const [fondo] = useFondo();
    const [lento, setLento] = useState(false);
    return (
        <div className={'lg el ' + clase}>
            <FondoEntrada fondo={lento ? 'light' : fondo} onLento={() => setLento(true)} />
            <header className="fe-arriba">
                {reloj ? <Reloj /> : <span />}
                <span className="fe-marca" aria-hidden="true">Learnation{marca && <b>{marca}</b>}</span>
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

function Tarjeta({ o, i, eligiendo, marcada }) {
    const pronto = o.pronto || !o.onElegir;
    const defecto = !pronto && marcada === o.clave;
    return (
        <button type="button" className={'el-tarjeta' + (pronto ? ' el-tarjeta--pronto' : '')}
            style={{ '--acento': pronto ? '#8e9bd8' : o.acento || ACENTOS[i % ACENTOS.length], '--n': i }}
            disabled={pronto || !!eligiendo} onClick={() => o.onElegir(o)}>
            <span className="el-ico">{o.Icono && <o.Icono size={20} />}</span>
            <span className={'el-num' + (defecto ? ' el-num--defecto' : '')}>
                {pronto ? 'Pronto' : defecto ? 'Por defecto' : i < 9 ? String(i + 1).padStart(2, '0') : ''}
            </span>
            <span className="el-txt">
                <small>{o.sobre || 'Learnation'}</small>
                <b>{o.titulo}</b>
                {o.detalle && <em>{o.detalle}</em>}
            </span>
            {eligiendo === o.clave
                ? <Loader2 size={18} className="lg-gira el-cargando" />
                : !pronto && <span className="el-ir" aria-hidden="true"><ArrowRight size={14} /></span>}
        </button>
    );
}

/**
 * nombre: el de la cuenta (el saludo). titulo: en vez del saludo (p. ej. «Cortex»). pregunta: el texto
 * debajo.
 * Las tarjetas van en `opciones` (una sola grilla) o en `grupos` ([{ clave, titulo, detalle?, Icono,
 * opciones }], una grilla por grupo con su encabezado: en el Portal, cada rol con sus áreas).
 * Opción: { clave, titulo, sobre?, detalle?, Icono, acento?, onElegir?, pronto? }. `sobre` va arriba del
 * título; sin él, «Learnation». Sin onElegir (o con pronto) queda deshabilitada con «Pronto».
 * eligiendo: la clave que está cargando. marcada: la clave de la tarjeta por defecto (lleva «Por
 * defecto» en vez del número). contenido: algo propio en lugar de las tarjetas (Simular, en el Portal).
 * pie: lo que va debajo (el toggle, «Volver»).
 */
export default function Eleccion({
    nombre, titulo = null, pregunta, opciones = null, grupos = null, eligiendo = null, error = null, pie = null,
    marcada = null, contenido = null,
}) {
    const n = primerNombre(nombre);
    const secciones = grupos || (opciones ? [{ clave: 'opciones', opciones }] : []);
    const todas = secciones.flatMap((g) => g.opciones);

    // El número de cada tarjeta entra directo (fuera de un campo de texto).
    useEffect(() => {
        if (contenido) return undefined;
        const alTeclear = (e) => {
            if (eligiendo || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
            const o = /^[1-9]$/.test(e.key) ? todas[Number(e.key) - 1] : null;
            if (!o || o.pronto || !o.onElegir) return;
            e.preventDefault();
            o.onElegir(o);
        };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, [todas, eligiendo, contenido]);

    let i = 0;
    return (
        <MarcoEntrada>
            <main className="el-centro">
                <LogoEntrada idGrad="lnGradEleccion" />
                {titulo ? <h1 className="el-hola">{titulo}</h1> : <Saludo nombre={n} />}
                {pregunta && <p className="el-pregunta">{pregunta}</p>}
                {contenido || secciones.map((g) => {
                    const cols = columnas(g.opciones.length);
                    const grilla = (
                        <div className="el-tarjetas" role="group" aria-label={g.titulo || pregunta || 'Opciones'}
                            style={{ '--cols': cols.ancho, '--cols-medio': cols.medio }}>
                            {g.opciones.map((o) => {
                                const k = i++;
                                return <Tarjeta key={o.clave} o={o} i={k} eligiendo={eligiendo} marcada={marcada} />;
                            })}
                        </div>
                    );
                    if (!g.titulo) return <div key={g.clave} className="el-grupo el-grupo--solo">{grilla}</div>;
                    return (
                        <section key={g.clave} className="el-grupo" aria-label={g.titulo}>
                            <header className="el-grupo-cab">
                                {g.Icono && <span className="el-grupo-ico" aria-hidden="true"><g.Icono size={15} /></span>}
                                <span className="el-grupo-txt">
                                    <b>{g.titulo}</b>
                                    {g.detalle && <small>{g.detalle}</small>}
                                </span>
                            </header>
                            {grilla}
                        </section>
                    );
                })}
                {error && <p className="lg-error" role="alert">{error}</p>}
                {pie}
            </main>
        </MarcoEntrada>
    );
}
