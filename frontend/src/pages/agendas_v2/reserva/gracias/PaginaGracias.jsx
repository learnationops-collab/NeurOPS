// Página de gracias después de agendar, en dos pantallas públicas (sin sesión):
//   /agendas-v2/agenda/gracias/:id       → «Mirá este video para completar tu reserva». «Ver mi plan»
//                                          aparece unos segundos después de que el lead le da play.
//   /agendas-v2/agenda/gracias/:id/plan  → el protocolo de aprobación y los casos de éxito de la Academia.
// La página es un recurso de Thalamus (Forms › Gracias); cada evento elige la suya. Thalamus muestra
// esta misma ruta como vista previa.

import './gracias.css';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cargarGracias, embedDe, reproductor, rutaPlan } from './contenido';
import Isotipo from '../Isotipo';

const LOGO_SVG = <Isotipo />;

const Check = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const Play = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" /></svg>;

// Lo cargado queda en memoria: pasar de «Gracias» a «Plan» no vuelve a pedirlo.
const cache = new Map();
function useGracias(id) {
    const [r, setR] = useState(() => (cache.has(id) ? { id, g: cache.get(id), error: '' } : { id: null, g: null, error: '' }));
    useEffect(() => {
        if (cache.has(id)) return undefined;
        let vivo = true;
        cargarGracias(id).then(
            (g) => { cache.set(id, g); if (vivo) setR({ id, g, error: '' }); },
            (e) => { if (vivo) setR({ id, g: null, error: e.code }); },
        );
        return () => { vivo = false; };
    }, [id]);
    useEffect(() => { document.title = 'Learnation'; }, []);
    return r.id === id ? r : { g: null, error: '' };
}

function Marco({ tono, aviso, children }) {
    return (
        <div className={'ln-gracias ln-gracias--' + tono}>
            {aviso && (
                <div className="gr-barra" role={tono === 'aviso' ? 'alert' : 'status'}>
                    <span className="gr-barra-brillo" aria-hidden="true" />
                    <div className="gr-barra-in">
                        <span className="gr-pulso" aria-hidden="true"><i /><i /></span>
                        {aviso}
                    </div>
                </div>
            )}
            <main className="gr-main">
                <div className="gr-fondo" aria-hidden="true"><i /><i /><i /><i /><i /></div>
                {children}
            </main>
        </div>
    );
}

function Marca() { return <div className="gr-marca">{LOGO_SVG}<span>LEARNATION</span></div>; }

function Cabeza({ eyebrow, titulo, h = 'h1' }) {
    const H = h;
    return (
        <div className="gr-cabeza">
            <p className="gr-eyebrow"><span aria-hidden="true" />{eyebrow}<span aria-hidden="true" /></p>
            <H className="gr-h1">{titulo}</H>
        </div>
    );
}

// Cargando, no existe o sin red: el mismo fondo, sin la barra.
function Estado({ error }) {
    return (
        <Marco tono="marca">
            <div className="gr-col" aria-busy={!error}>
                <Marca />
                {error && (
                    <Cabeza eyebrow="Learnation" titulo={error === 'no_disponible'
                        ? 'Esta página no está disponible'
                        : 'No pudimos cargar la página. Revisá tu conexión y volvé a intentar.'} />
                )}
            </div>
        </Marco>
    );
}

// El video: un archivo subido (<video>) o un link embebido (iframe). onPlay avisa cuando arranca.
function Video({ v, titulo, vivo = false, onPlay }) {
    const iframeRef = useRef(null);
    const r = reproductor(v);
    usePlay(r && r.tipo === 'iframe' ? iframeRef : null, onPlay);
    if (!r) return null;
    return (
        <div className="gr-video">
            <div className={'gr-aura' + (vivo ? ' gr-aura--viva' : '')} aria-hidden="true" />
            <div className="gr-pantalla">
                {r.tipo === 'archivo'
                    ? <video src={r.src} title={titulo} controls playsInline preload="metadata" onPlay={onPlay ? () => onPlay(true) : undefined} />
                    : <iframe ref={iframeRef} src={r.src} title={titulo} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />}
            </div>
        </div>
    );
}

// Pasos 1 y 2 hechos, el 3 (este video) pendiente, y lo que tarda.
function Pasos() {
    return (
        <span className="gr-pasos" aria-label="Paso 3 de 3, 5 minutos">
            <span className="gr-hecho"><Check /></span><span className="gr-linea" />
            <span className="gr-hecho"><Check /></span><span className="gr-linea gr-linea--viva"><i /></span>
            <span className="gr-pendiente"><i /><b>3</b></span>
            <span className="gr-sep" />
            <span className="gr-min"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>5 MIN</span>
        </span>
    );
}

// El play de un iframe (Loom, YouTube…) no se puede leer directo: un click en el iframe le saca el foco a
// la ventana, y eso es el play. Respaldos: chequear el foco seguido (si la ventana ya no lo tenía) y los
// mensajes de Loom. alPlay(true) cuando arranca; es el setter de un estado, así que no cambia entre renders.
function usePlay(iframeRef, alPlay) {
    useEffect(() => {
        if (!iframeRef || !alPlay) return undefined;
        let hecho = false;
        const play = () => { if (!hecho) { hecho = true; alPlay(true); } };
        const enIframe = () => iframeRef.current && document.activeElement === iframeRef.current;
        const onBlur = () => setTimeout(() => { if (enIframe()) play(); }, 0);
        const poll = setInterval(() => { if (enIframe()) { play(); clearInterval(poll); } }, 300);
        const onMsg = (e) => {
            let host = '';
            try { host = new URL(e.origin).hostname; } catch { return; }
            if (!/(^|\.)loom\.com$/.test(host)) return;
            const d = typeof e.data === 'string' ? e.data : JSON.stringify(e.data || '');
            if (/play/i.test(d)) play();
        };
        window.addEventListener('blur', onBlur);
        window.addEventListener('message', onMsg);
        return () => { clearInterval(poll); window.removeEventListener('blur', onBlur); window.removeEventListener('message', onMsg); };
    }, [iframeRef, alPlay]);
}

export function Gracias() {
    const { id } = useParams();
    const nav = useNavigate();
    const { g, error } = useGracias(id);
    const [vivo, setVivo] = useState(false);
    const [boton, setBoton] = useState(false);
    const hayVideo = !!(g && reproductor(g.video));
    // Sin video no hay a qué esperar: el botón va desde el principio. Mientras carga, nada.
    const espera = !g ? null : hayVideo ? (vivo ? g.segundos : null) : 0;
    useEffect(() => {
        if (espera == null) return undefined;
        const t = setTimeout(() => setBoton(true), espera * 1000);
        return () => clearTimeout(t);
    }, [espera]);
    if (!g) return <Estado error={error} />;
    const hayPlan = !!reproductor(g.plan) || g.casos.length > 0;
    return (
        <Marco tono="aviso" aviso={<><span className="gr-barra-txt">Reserva incompleta</span><Pasos /></>}>
            <div className="gr-col">
                <Marca />
                <Cabeza eyebrow="Antes de tu sesión" titulo={<>Mirá este video para<br />completar tu reserva</>} />
                <Video v={g.video} titulo="Video para completar tu reserva" vivo={vivo} onPlay={setVivo} />
                {hayPlan && (
                    <div className="gr-cta-lugar">
                        {boton && (
                            <button type="button" className="gr-cta" onClick={() => nav(rutaPlan(id))}>
                                <span className="gr-cta-giro" aria-hidden="true" />
                                <span className="gr-cta-fondo" aria-hidden="true" />
                                <span className="gr-cta-txt">Ver mi plan</span>
                                <span className="gr-cta-flecha" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg></span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </Marco>
    );
}

// Un caso de éxito de la Academia: foto, quién es, el resumen («De X a Y») y su testimonio. Si tiene
// video y se puede embeber, se abre ahí mismo; si no, en otra pestaña.
function Caso({ c }) {
    const [verVideo, setVerVideo] = useState(false);
    const embed = embedDe(c.video);
    return (
        <article className="gr-caso">
            <header className="gr-caso-quien">
                {c.foto ? <img src={c.foto} alt="" loading="lazy" /> : <span className="gr-caso-ini" aria-hidden="true">{c.nombre.slice(0, 1)}</span>}
                <div><h3>{c.nombre}</h3>{c.meta && <p>{c.meta}</p>}</div>
            </header>
            {c.resumen && <p className="gr-caso-resumen">{c.resumen}</p>}
            {c.cita && <blockquote className="gr-caso-cita">“{c.cita}”</blockquote>}
            {c.video && (verVideo && embed ? (
                <div className="gr-caso-video">
                    <iframe src={embed} title={'Historia de ' + c.nombre} loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
                </div>
            ) : embed ? (
                <button type="button" className="gr-caso-play" onClick={() => setVerVideo(true)}><span className="gr-play"><Play /></span>Ver su historia en video</button>
            ) : (
                <a className="gr-caso-play" href={c.video} target="_blank" rel="noopener noreferrer"><span className="gr-play"><Play /></span>Ver su historia en video</a>
            ))}
        </article>
    );
}

export function Plan() {
    const { id } = useParams();
    const { g, error } = useGracias(id);
    if (!g) return <Estado error={error} />;
    const aviso = (
        <>
            <span className="gr-barra-txt">Clase gratuita</span>
            <span className="gr-sep" />
            <span className="gr-liberado"><span className="gr-mini-play" aria-hidden="true"><i /><Play /></span>Acceso liberado · Miralo ahora</span>
        </>
    );
    const hayPlan = !!reproductor(g.plan);
    return (
        <Marco tono="marca" aviso={aviso}>
            <section className="gr-col">
                <Marca />
                {hayPlan && <Cabeza eyebrow="Tu plan paso a paso" titulo={<>Mirá el protocolo de aprobación<br />que implementaríamos con vos</>} />}
                <Video v={g.plan} titulo="Protocolo de aprobación" vivo />
            </section>
            {g.casos.length > 0 && (
                <section className="gr-casos">
                    <Cabeza h="h2" eyebrow="Casos de estudio" titulo={<>¿Qué podrías lograr en<br />los próximos 4 meses?</>} />
                    <div className="gr-grilla">
                        {g.casos.map((c, i) => <Caso key={i + c.nombre} c={c} />)}
                    </div>
                </section>
            )}
        </Marco>
    );
}
