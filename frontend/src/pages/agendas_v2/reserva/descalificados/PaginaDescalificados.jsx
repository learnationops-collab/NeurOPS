// Landing de los que no califican (/agendas-v2/agenda/descalificados, pública): el «no» claro y el
// sistema EARN gratis en tres pasos (video, guía PDF y clase en vivo). Handoff «Descualificados»:
// escritorio por encima de 768px, mobile por debajo (descalificados.css).

import './descalificados.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import Isotipo from '../Isotipo';
import { useLinkDeLaClase } from './claseEnVivo';

const VIDEO = 'https://www.loom.com/embed/4c04b56c7e11427c9cc3bcc9395b3773?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true';
const GUIA = 'https://drive.google.com/file/d/1tMUVCId4_LJXDXp54od_Teo1PZlAu_Ne/view?usp=sharing';
const CICLO_MS = 4000;

const ICONOS = {
    search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
    target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r=".8" /></>,
    'chevron-down': <path d="M6 9l6 6 6-6" />,
};
const Icono = ({ n }) => <svg viewBox="0 0 24 24" aria-hidden="true">{ICONOS[n]}</svg>;

const ETAPAS = [
    { letra: 'E', icono: 'search', nombre: 'Escaneo', desc: 'Qué mirar antes de leer un tema.' },
    { letra: 'A', icono: 'menu', nombre: 'Apuntes', desc: 'Apuntes que muestren lo que entendiste, en vez de copiar el material.' },
    { letra: 'R', icono: 'clock', nombre: 'Recuperación', desc: 'Cómo repasar sin releer.' },
    { letra: 'N', icono: 'target', nombre: 'Nicho de preguntas', desc: 'En qué orden leer una pregunta de examen para equivocarte menos.' },
];

// La etapa activa avanza cada 4 s; elegir una la activa y reinicia el reloj.
function useCiclo() {
    const [activo, setActivo] = useState(0);
    const [vuelta, setVuelta] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setActivo((a) => (a + 1) % ETAPAS.length), CICLO_MS);
        return () => clearInterval(t);
    }, [vuelta]);
    const elegir = useCallback((i) => { setActivo(i); setVuelta((v) => v + 1); }, []);
    return [activo, elegir];
}

// Las secciones fuera de la primera pantalla entran al aparecer, una sola vez.
function useRevelar(raiz) {
    useEffect(() => {
        const nodos = [...(raiz.current?.querySelectorAll('.dq-revelar') || [])];
        if (typeof IntersectionObserver === 'undefined') { nodos.forEach((n) => n.classList.add('dq-visto')); return undefined; }
        const io = new IntersectionObserver((entradas) => entradas.forEach((e) => {
            if (e.isIntersecting) { e.target.classList.add('dq-visto'); io.unobserve(e.target); }
        }), { threshold: 0.1 });
        nodos.forEach((n) => io.observe(n));
        return () => io.disconnect();
    }, [raiz]);
}

const Humo = ({ clase, n = 3 }) => <span className={'dq-humo ' + (clase || '')} aria-hidden="true">{Array.from({ length: n }, (_, i) => <i key={i} />)}</span>;

function Logo({ lema = true }) {
    return (
        <span className="dq-logo" role="img" aria-label="Learnation">
            <Isotipo />
            <span><b>LEARNATION</b>{lema && <small>CIENCIA DEL APRENDIZAJE</small>}</span>
        </span>
    );
}

function Hero({ activo, elegir }) {
    const verSistema = (e) => {
        e.preventDefault();
        const el = document.getElementById('video');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    return (
        <section className="dq-hero" aria-labelledby="dq-titulo">
            <div className="dq-ancho dq-top">
                <Logo />
                <span className="dq-eyebrow">Gracias por postularte</span>
            </div>
            <div className="dq-ancho dq-centro">
                <div className="dq-intro">
                    <span className="dq-eyebrow">Gracias por postularte</span>
                    <h1 className="dq-h1" id="dq-titulo">
                        <span>Por ahora no</span><span>es el momento</span><span>de trabajar</span><span>juntos</span>
                    </h1>
                    <p className="dq-lead">Según lo que nos contaste, hoy no somos la mejor opción para acompañarte de forma personalizada.</p>
                </div>
                {/* El resaltador se mueve con su propio transform: cambiar una variable en el panel le reinicia la entrada. */}
                <div className="dq-panel">
                    <span className="dq-resalte" aria-hidden="true" style={{ transform: `translateY(${activo * 100}%)` }} />
                    {ETAPAS.map((s, i) => (
                        <button key={s.letra} type="button" className={'dq-fila' + (i === activo ? ' dq-fila--on' : '')}
                            aria-pressed={i === activo} onClick={() => elegir(i)} onMouseEnter={() => i !== activo && elegir(i)}>
                            <span className="dq-letra" aria-hidden="true">{s.letra}</span>
                            <span className="dq-nombre">{s.nombre}</span>
                            <span className="dq-ico"><Icono n={s.icono} /></span>
                        </button>
                    ))}
                </div>
            </div>
            <div className="dq-franja">
                <div className="dq-ancho dq-franja-in">
                    <p>Pero no te vas con las manos vacías, te dejamos <span className="dq-barrido">nuestro sistema de retención</span> aquí abajo</p>
                    <a className="dq-ver" href="#video" onClick={verSistema}>
                        <span>Ver el sistema</span>
                        <span className="dq-ver-flecha"><Icono n="chevron-down" /></span>
                        <span className="dq-ver-anillo" aria-hidden="true" />
                    </a>
                </div>
            </div>
        </section>
    );
}

function Video() {
    return (
        <section id="video" className="dq-video-sec dq-revelar" aria-labelledby="dq-video-titulo">
            <div className="dq-video-cab">
                <div>
                    <span className="dq-etiqueta">PASO 1 · VIDEO · 18 MIN</span>
                    <h2 className="dq-h2" id="dq-video-titulo">Entendé el sistema completo</h2>
                </div>
                <p>Mario te explica las cuatro etapas. Vas a ver qué mirar antes de leer un tema, cómo tomar apuntes que muestren lo que entendiste en vez de copiar el material, cómo repasar sin releer, y en qué orden leer una pregunta de examen para equivocarte menos.</p>
            </div>
            <div className="dq-video">
                <span className="dq-halo" aria-hidden="true" />
                <div className="dq-pantalla">
                    <iframe src={VIDEO} title="EARN System — video" allow="fullscreen; autoplay" allowFullScreen loading="lazy" />
                </div>
            </div>
        </section>
    );
}

function Earn({ activo, elegir }) {
    return (
        <section className="dq-sec dq-earn dq-revelar" aria-labelledby="dq-earn-titulo">
            <div className="dq-earn-cab">
                <h2 className="dq-h2" id="dq-earn-titulo">EARN System: cuatro etapas para convertir material en conocimiento</h2>
                <p className="dq-lead">Escaneo, Apuntes, Recuperación y Nicho de preguntas. Es un proceso pensado para dos cosas a la vez: subir tu puntaje y entender cada tema lo suficiente como para responder preguntas que nunca viste.</p>
            </div>
            <div className="dq-etapas">
                {ETAPAS.map((s, i) => {
                    const on = i === activo;
                    return (
                        <button key={s.letra} type="button" className={'dq-etapa' + (on ? ' dq-etapa--on' : '')} aria-pressed={on}
                            onClick={() => elegir(i)} onMouseEnter={() => !on && elegir(i)}>
                            <Humo n={2} />
                            <span className="dq-letra" aria-hidden="true">{s.letra}</span>
                            <span className="dq-nombre">{s.nombre}</span>
                            <span className="dq-desc">{s.desc}</span>
                            <span className="dq-ico"><Icono n={s.icono} /></span>
                            {on && <span key={'p' + activo} className="dq-progreso" aria-hidden="true" />}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

function Guia() {
    return (
        <section className="dq-sec dq-guia dq-revelar" aria-labelledby="dq-guia-titulo">
            <div className="dq-portada-lugar" aria-hidden="true">
                <span className="dq-portada-halo" />
                <div className="dq-portada">
                    <div className="dq-hoja" /><div className="dq-hoja" />
                    <div className="dq-tapa">
                        <Humo n={2} />
                        <Logo lema={false} />
                        <div className="dq-tapa-letras">{ETAPAS.map((s) => <span key={s.letra}>{s.letra}</span>)}</div>
                        <strong>EARN System</strong>
                        <small>Guía de aplicación</small>
                    </div>
                </div>
            </div>
            <div className="dq-guia-txt">
                <span className="dq-etiqueta">PASO 2 · GUÍA PDF · 24 PÁGINAS</span>
                <h2 className="dq-h2" id="dq-guia-titulo">Aplicalo con la guía</h2>
                <p className="dq-lead">El sistema por escrito, con un ejercicio para cada etapa, ejemplos de antes y después, y la evidencia científica en la que se apoya. Cierra con 7 pasos concretos para tu próximo bloque de estudio.</p>
                <a className="dq-btn-sec" href={GUIA} target="_blank" rel="noopener noreferrer">Abrir la guía</a>
                <div className="dq-consejo">
                    <span>Un consejo</span>
                    <p>No intentes aplicarlo a todo el temario de una vez. Elegí un solo tema y completá el ciclo entero. La primera vez va a salir torcido y te va a llevar más tiempo del que quisieras. Es normal: estás instalando un proceso nuevo.</p>
                </div>
            </div>
        </section>
    );
}

function Clase() {
    const link = useLinkDeLaClase();
    return (
        <section className="dq-sec dq-clase-sec dq-revelar" aria-labelledby="dq-clase-titulo">
            <div className="dq-clase">
                <Humo clase="dq-humo--panel" />
                <div className="dq-clase-cab">
                    <span className="dq-etiqueta">PASO 3 · CLASE EN VIVO · GRATIS</span>
                    <h2 className="dq-h2" id="dq-clase-titulo">Seguí aprendiendo en vivo</h2>
                    <p className="dq-lead">Si querés ir más allá del material, sumate a nuestra clase gratuita en vivo. Te registrás, entrás al grupo de WhatsApp y ahí te compartimos el link de acceso y los recordatorios.</p>
                </div>
                <div className="dq-clase-pie">
                    <span className="dq-aviso"><Icono n="clock" />La clase no queda grabada, así que reservate el horario.</span>
                    <a className="dq-cta" href={link || undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!link}>Quiero sumarme a la clase</a>
                </div>
            </div>
        </section>
    );
}

export default function PaginaDescalificados() {
    const raiz = useRef(null);
    const [activo, elegir] = useCiclo();
    useRevelar(raiz);
    useEffect(() => { document.title = 'Learnation'; }, []);
    return (
        // .thalamus la saca de la tipografía forzada de index.css (Inter, pesos 400/600), como a la pantalla del lead.
        <div className="thalamus ln-dq" ref={raiz}>
            <Humo clase="dq-humo--pagina" n={4} />
            <Hero activo={activo} elegir={elegir} />
            <main className="dq-ancho dq-cuerpo">
                <Video />
                <Earn activo={activo} elegir={elegir} />
                <Guia />
                <Clase />
                <footer className="dq-pie"><Logo /></footer>
            </main>
        </div>
    );
}
