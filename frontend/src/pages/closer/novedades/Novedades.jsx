import React, { useEffect, useState } from 'react';
import { ArrowRight, X, Sparkles, PanelRight, CalendarDays, UserSquare2, CheckCircle2, CalendarClock, Clock } from 'lucide-react';
import { VERSION, FECHA, PORTADA, PASOS } from './contenido';
import Recorrido from './Recorrido';
import Recuerda from './Recuerda';
import { useCuenta } from './Mocks';
import { useTelefono } from '../confirmar/useTelefono';
// La huella del recorrido (ADR-W222): cambia sola con cualquier cambio de contenido, escenas o recorrido, así
// el changelog nuevo le vuelve a aparecer a todos (también a quien ya lo terminó) sin tocar VERSION a mano.
import fuenteContenido from './contenido.js?raw';
import fuenteMocks from './Mocks.jsx?raw';
import './novedades.css';

// Las novedades del Workspace de closers y triage (ADR-W218). La primera vez que alguien entra
// después de una tanda nueva (VERSION) ve la portada a pantalla completa; «Mostrame» arranca el
// recorrido por los lugares reales de Work. Queda visto recién al terminar el último paso (si se
// recarga a la mitad, vuelve a empezar). «Después» (ADR-W225) lo deja hasta el día siguiente, durante
// 3 días desde que apareció; pasado ese plazo es obligatorio: sin cruz, «Después» ni Esc. Ya visto,
// se puede volver a abrir (y cerrar) desde Herramientas › Novedades o con `?novedades=1`.

const EVENTO = 'ln:novedades';
export const huella = (t) => { let h = 5381; for (let k = 0; k < t.length; k += 1) h = ((h << 5) + h + t.charCodeAt(k)) | 0; return (h >>> 0).toString(36); };
// Desde que el recorrido es compartido con el Inbox (ADR-W255), su código ya no entra en la huella: así un cambio
// para el Inbox no les vuelve a abrir el changelog a los closers. Quien terminó la tanda de antes (cuando la huella
// lo incluía) la tiene vista, mientras el contenido siga siendo el mismo.
const VISTA = `${VERSION}-${huella(fuenteContenido + fuenteMocks)}`;
const VISTA_ANTERIOR = VISTA === '2026-11-25-2-1vquffi' ? '2026-11-25-2-2vuu09' : null;
const PLAZO_DIAS = 3;
const DIA = 86400000;

// Aplazos de esta tanda: `desde` es la primera vez que apareció y `hasta`, hasta cuándo se aplazó.
const leerAplazo = (t, user) => {
    let a = null;
    try { a = JSON.parse(localStorage.getItem(`${t.clave(user)}_aplazo`)); } catch { a = null; }
    if (a?.vista === t.vista) return a;
    a = { vista: t.vista, desde: Date.now(), hasta: 0 };
    localStorage.setItem(`${t.clave(user)}_aplazo`, JSON.stringify(a));
    return a;
};
const diasQueQuedan = (a) => Math.max(0, Math.ceil((a.desde + PLAZO_DIAS * DIA - Date.now()) / DIA));
const aplazar = (t, user) => {
    const a = leerAplazo(t, user);
    const manana = new Date(); manana.setHours(24, 0, 0, 0);
    a.hasta = Math.min(manana.getTime(), a.desde + PLAZO_DIAS * DIA);
    localStorage.setItem(`${t.clave(user)}_aplazo`, JSON.stringify(a));
};

// El paso donde quedó (ADR-W263): «Ver después» a mitad del recorrido y el recordatorio retoma desde ahí.
const leerPaso = (t, user) => {
    try {
        const p = JSON.parse(localStorage.getItem(`${t.clave(user)}_paso`));
        return p?.vista === t.vista ? p.i : 0;
    } catch { return 0; }
};
const guardarPaso = (t, user, i) => localStorage.setItem(`${t.clave(user)}_paso`, JSON.stringify({ vista: t.vista, i }));
// Avisa a las otras tandas de la pantalla que una se terminó (la que esperaba puede mostrar su recordatorio).
const CAMBIO = 'ln:novedades-cambio';

// Sin nombre (o desde un onClick, que pasa el evento del clic): las del Workspace.
export const abrirNovedades = (evento) => window.dispatchEvent(new Event(typeof evento === 'string' ? evento : EVENTO));

const ICONOS = { riel: PanelRight, calendario: CalendarDays, tarjeta: UserSquare2, confirmacion: CheckCircle2, reprogramar: CalendarClock, horario: Clock };

// La tanda de los closers y triage (ADR-W218). Otra pantalla pasa la suya (`tanda`, la del Inbox en
// `pages/inbox/tour/`): su vista (versión y huella), la clave donde se guarda, su evento para reabrirla, la
// portada (títulos, íconos, cuenta) y los pasos, con su `Escena` si no son las de `Mocks.jsx`.
const CLOSER = {
    vista: VISTA, anterior: VISTA_ANTERIOR, clave: (user) => `ln_novedades_${user?.id ?? 'anon'}`, evento: EVENTO,
    fecha: FECHA, portada: PORTADA, pasos: PASOS, iconos: ICONOS,
    titulo: ['Hay novedades', 'en Work.'], cuenta: 'cambios para tu día', etiqueta: 'Novedades de Work',
};

// Si la persona ya terminó esa tanda (la del Workspace sin `tanda`).
export const tandaVista = (t, user) => {
    const guardada = localStorage.getItem(t.clave(user));
    return guardada === t.vista || Boolean(t.anterior && guardada === t.anterior);
};
export const novedadesVistas = (user) => tandaVista(CLOSER, user);

const Portada = ({ tanda: t, obligatorio, quedan, onEmpezar, onDespues }) => {
    const PORTADA = t.portada;
    const ICONOS = t.iconos;
    const n = useCuenta(PORTADA.length, 900, 700);
    useEffect(() => {
        const tecla = (e) => { if (e.key === 'Escape') { e.stopPropagation(); if (!obligatorio) onDespues(); } };
        window.addEventListener('keydown', tecla, true);
        return () => window.removeEventListener('keydown', tecla, true);
    }, [obligatorio, onDespues]);
    return (
        <div className="nv-portada" role="dialog" aria-modal="true" aria-label={t.etiqueta}>
            <span className="nv-humo" aria-hidden="true"><i /><i /><i /><i /></span>
            {!obligatorio && <button type="button" className="nv-portada__x" onClick={onDespues} aria-label="Cerrar"><X /></button>}
            <div className="nv-portada__centro">
                <span className="nv-chip"><i />Novedades · {t.fecha}</span>
                <h1 className="nv-h1">
                    <span style={{ '--d': '250ms' }}>{t.titulo[0]}</span>
                    <span style={{ '--d': '550ms' }} className="is-tono">{t.titulo[1]}</span>
                </h1>
                <div className="nv-portada__cuenta"><b>{n}</b><em>{t.cuenta}</em></div>
                <div className="nv-portada__iconos">
                    {PORTADA.map((p, k) => {
                        const Icono = ICONOS[p.id] || Sparkles;
                        return (
                            <span key={p.id} style={{ '--k': k }}>
                                <i><Icono aria-hidden="true" /></i>
                                <em>{p.label}</em>
                            </span>
                        );
                    })}
                </div>
                <div className="nv-portada__acciones">
                    <button type="button" className="nv-cta" onClick={onEmpezar} autoFocus>
                        <span className="nv-cta__aura" aria-hidden="true"><i /><i /><i /></span>
                        <span>Mostrame</span><ArrowRight aria-hidden="true" />
                    </button>
                    {!obligatorio && (
                        <button type="button" className="nv-despues" onClick={onDespues}>
                            {quedan ? <>Ver después<small>{quedan === 1 ? 'último día' : `quedan ${quedan} días`}</small></> : 'Cerrar'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// En el teléfono el riel va arriba, no a la derecha. Se ajusta acá y no en `contenido.js` para no cambiar
// la huella: si no, a todos los que ya lo vieron les volvería a aparecer por un texto del teléfono.
const paraTelefono = (pasos) => pasos.map(p => (p.id === 'riel' ? { ...p, titulo: 'Tu día, siempre arriba' } : p));

const Novedades = ({ user, ctx, tanda = CLOSER }) => {
    const t = tanda;
    const [fase, setFase] = useState(null);
    const [inicio, setInicio] = useState(0);
    const [, setRevision] = useState(0);
    const telefono = useTelefono();
    const vista = () => tandaVista(t, user);
    // Sin terminar, se puede aplazar mientras queden días del plazo (`quedan`); después, obligatorio.
    const [quedan, setQuedan] = useState(0);
    const [obligatorio, setObligatorio] = useState(true);
    // `retomar` (el recordatorio): si ya había avanzado, va directo al paso donde quedó, sin la portada.
    const abrir = (retomar) => {
        const dias = vista() ? 0 : diasQueQuedan(leerAplazo(t, user));
        const paso = retomar === true ? leerPaso(t, user) : 0;
        setQuedan(dias);
        setObligatorio(!vista() && dias === 0);
        setInicio(paso);
        setFase(paso ? 'recorrido' : 'portada');
    };
    const despues = () => { if (quedan) aplazar(t, user); setFase(null); };
    const completar = () => {
        localStorage.setItem(t.clave(user), t.vista);
        localStorage.removeItem(`${t.clave(user)}_paso`);
        setFase(null);
        window.dispatchEvent(new Event(CAMBIO));
    };

    useEffect(() => {
        if (!user) return;
        const params = new URLSearchParams(window.location.search);
        const forzada = params.get(t.param || 'novedades') === (t.valor || '1');
        if (forzada) { abrir(); return; }
        // Un link que pide otro recorrido: este no se abre solo encima.
        if (params.has('tour') || params.has('novedades')) return;
        // `espera(user)`: otra tanda va primero (no se abren dos juntas); esta sale en la próxima entrada.
        if (vista() || t.espera?.(user)) return;
        const a = leerAplazo(t, user);
        if (Date.now() >= a.hasta || diasQueQuedan(a) === 0) abrir();
    }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const desdeAfuera = () => abrir();
        const otra = () => setRevision((n) => n + 1);
        window.addEventListener(t.evento, desdeAfuera);
        window.addEventListener(CAMBIO, otra);
        return () => { window.removeEventListener(t.evento, desdeAfuera); window.removeEventListener(CAMBIO, otra); };
    }); // eslint-disable-line react-hooks/exhaustive-deps

    // Sin terminar y cerrado: el recordatorio queda a la vista hasta que lo termine (no si otra tanda va primero).
    if (!fase) {
        if (!user || vista() || t.espera?.(user)) return null;
        return <Recuerda tanda={t} paso={leerPaso(t, user)} onAbrir={() => abrir(true)} />;
    }
    if (fase === 'portada') {
        return (
            <Portada tanda={t} obligatorio={obligatorio} quedan={quedan} onEmpezar={() => setFase('recorrido')} onDespues={despues} />
        );
    }
    return (
        <Recorrido pasos={telefono && t === CLOSER ? paraTelefono(t.pasos) : t.pasos} ctx={ctx} obligatorio={obligatorio} onCerrar={despues}
            aplazable={quedan > 0} inicio={inicio} onPaso={(i) => { if (!vista()) guardarPaso(t, user, i); }}
            Escena={t.Escena} etiqueta={t.etiqueta} onCompletar={completar} />
    );
};

export default Novedades;
