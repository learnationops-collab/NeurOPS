// Learnation Thalamus: la herramienta del director comercial para armar formularios, equipo,
// prioridades y eventos de agenda. Dock en el orden real de configuración: 1 Forms · 2 Team ·
// 3 Events · 4 Stats. Configuración (perfil, miembros, funnels) en el botón magenta.

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import './thalamus.css';
import { SECCIONES } from './core/catalogos';
import { confVisible, soloLectura } from './core/permisos';
import { almacen, useDatos, useIniciarAlmacen, usePermisos, useUi } from './data/hooks';
import { Dial, Humo, Icono, LogoThalamus, Toasts, Tooltip } from './ui/base';
import { ui } from './ui/estadoUi';
import { toast } from './ui/toast';
import { irA } from './ui/navegacion';
import Forms from './secciones/forms/Forms';
import Team from './secciones/team/Team';
import Horas from './secciones/team/Horas';
import Eventos from './secciones/eventos/Eventos';
import Stats from './secciones/stats/Stats';
import Configuracion from './secciones/conf/Configuracion';
import MenuYo from './secciones/conf/MenuYo';
import CrearRapido from './secciones/conf/CrearRapido';
import PruebaLead from './reserva/PruebaLead';

// Tema: oscuro, claro o el del sistema. Se aplica a la raíz de Thalamus, no a toda la app.
function atributoTema(tema) { return tema === 'oscuro' ? 'dark' : tema === 'claro' ? 'light' : undefined; }

function Dock() {
    const { seccion, sim } = useUi();
    const { d } = useDatos();
    const perm = usePermisos();
    const nav = useRef(null), ind = useRef(null);
    const visibles = SECCIONES.filter(s => perm.secOk(s.id));
    let n = 0;
    useLayoutEffect(() => {
        const act = nav.current && nav.current.querySelector('[aria-current="page"]');
        if (act && ind.current) { ind.current.style.setProperty('--w', act.offsetWidth + 'px'); ind.current.style.setProperty('--x', act.offsetLeft + 'px'); }
    });
    return (
        <nav className="dock" aria-label="Secciones">
            {sim && <SimEnDock />}
            <div className="dock-barra">
                <Humo clase="humo--barra" />
                <div className="dock-nav" ref={nav}>
                    <span className="dock-ind" ref={ind} aria-hidden="true" />
                    {visibles.map(s => (
                        <button key={s.id} type="button" className="dock-item" data-nav="" aria-current={s.id === seccion ? 'page' : undefined} onClick={() => irA(s.id)}>
                            <span className="dock-num" aria-hidden="true">{s.num ? ++n : ''}</span>
                            <Icono n={s.icon} s={20} />
                            <span className="dock-label">{s.label}</span>
                        </button>
                    ))}
                </div>
            </div>
            {confVisible(d, sim) && (
                <button type="button" className="dock-conf" data-nav="" aria-label="Configuración: perfil y funnels" title="Configuración" onClick={() => ui.set({ conf: { tab: 'perfil' } })}>
                    <Dial />
                </button>
            )}
        </nav>
    );
}

// Aviso de simulación en el dock, con la cruz para volver a la sesión propia.
function SimEnDock() {
    const { sim } = useUi();
    const { d } = useDatos();
    const p = sim.tipo === 'persona' ? d.personas.find(x => x.id === sim.id) : null;
    const r = sim.tipo === 'rol' ? d.roles.find(x => x.id === sim.id) : p && d.roles.find(x => x.id === p.rol);
    const nombre = p ? p.nombre : r ? r.nombre : 'Sin rol';
    const corto = p ? p.nombre.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() : (r ? r.abrev : '?');
    return (
        <div className="dock-sim" role="status" title={'Simulando ' + nombre}>
            <span className="ds-ico" aria-hidden="true"><Icono n="mascara" s={16} /></span>
            <span className="ds-txt"><b>{corto}</b></span>
            <button type="button" className="ds-x" data-nav="" aria-label={'Terminar simulación de ' + nombre} title="Terminar simulación"
                onClick={() => { ui.set({ sim: null, menu: null }); toast('Volviste a tu sesión'); }}>
                <Icono n="x" s={13} />
            </button>
        </div>
    );
}

// Bloquea los controles cuando el rol simulado solo puede mirar. Los botones de navegación llevan
// data-nav y quedan activos. La pantalla del lead (.reserva) nunca se bloquea.
function useBloqueo(ref, ro, activo) {
    useEffect(() => {
        const v = ref.current;
        if (!v) return;
        v.classList.toggle('ro', ro);
        v.querySelectorAll('[data-bloq]').forEach(el => {
            if (el.getAttribute('data-bloq') === 'ce') el.setAttribute('contenteditable', 'true'); else el.disabled = false;
            el.removeAttribute('data-bloq'); el.classList.remove('bloq');
        });
        if (!activo || !ro) return;
        v.querySelectorAll('button,input,select,textarea,[contenteditable="true"]').forEach(el => {
            if (el.closest('.reserva') || el.hasAttribute('data-nav') || el.disabled) return;
            el.classList.add('bloq');
            if (el.getAttribute('contenteditable') === 'true') { el.setAttribute('data-bloq', 'ce'); el.setAttribute('contenteditable', 'false'); }
            else { el.setAttribute('data-bloq', 'dis'); el.disabled = true; }
        });
    });
}

function Vista() {
    const { cargando, d, perfil } = useDatos();
    const estado = useUi();
    const perm = usePermisos();
    const ref = useRef(null);
    const { seccion, sim } = estado;
    const ro = soloLectura(d, sim, perfil, { seccion, formVista: estado.form ? estado.form.vista : null, teamTab: estado.team.tab });
    useBloqueo(ref, ro, !!sim);

    let cuerpo;
    if (cargando) cuerpo = <div className="panel vacio"><p className="t-sm mut">Cargando…</p></div>;
    else if (seccion === 'horas' && !perm.secOk('horas') && !sim) {
        cuerpo = (
            <div className="panel vacio">
                <Icono n="clock" s={22} />
                <p className="t-sm mut">Vinculá tu persona de Team para ver tus horas.</p>
                <button type="button" className="btn btn--linea btn--sm" onClick={() => ui.set({ conf: { tab: 'perfil' } })}>Ir a Perfil</button>
            </div>
        );
    } else if (!perm.secOk(seccion)) {
        cuerpo = <div className="panel vacio"><Icono n="prohibido" s={22} /><p className="t-sm mut">Este rol no tiene acceso a esta sección.</p></div>;
    } else if (seccion === 'preguntas') cuerpo = <Forms />;
    else if (seccion === 'team') cuerpo = <Team />;
    else if (seccion === 'horas') cuerpo = <Horas />;
    else if (seccion === 'eventos') cuerpo = <Eventos />;
    else cuerpo = <Stats />;

    return <main className="vista" ref={ref}><ErrorDeVista seccion={seccion}>{cuerpo}</ErrorDeVista></main>;
}

// Una vista que falla nunca traba la app: se muestra un aviso y el resto sigue andando.
class ErrorDeVista extends React.Component {
    constructor(p) { super(p); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(e) { console.error(e); }
    componentDidUpdate(prev) { if (prev.seccion !== this.props.seccion && this.state.error) this.setState({ error: null }); }
    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div className="panel vacio">
                <p className="t-sm">Esta vista tuvo un error.</p>
                <button type="button" className="btn btn--linea btn--sm" data-nav="" onClick={() => { ui.set({ form: null, ev: null }); this.setState({ error: null }); }}>
                    <Icono n="rotar" />Volver
                </button>
            </div>
        );
    }
}

function useAtajos() {
    useEffect(() => {
        const fn = (e) => {
            const e0 = ui.getState(), tg = e.target;
            const escribe = /INPUT|TEXTAREA|SELECT/.test(tg.tagName) || tg.isContentEditable;
            const enLead = tg.closest && tg.closest('.reserva');
            // Ctrl/Cmd+Z deshace la configuración; dentro de un campo de texto queda el deshacer del navegador.
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key && e.key.toLowerCase() === 'z' && !escribe && !e0.prueba) {
                e.preventDefault();
                almacen.flush();
                toast(almacen.deshacer() ? 'Cambio deshecho' : 'Nada para deshacer');
                return;
            }
            // Ctrl/Cmd+N donde el navegador lo deja; N sola como respaldo.
            if (!e0.prueba && !enLead && e.key && e.key.toLowerCase() === 'n' && !e.altKey && ((e.ctrlKey || e.metaKey) || (!escribe && !e.shiftKey && !e0.crear && !e0.conf))) {
                e.preventDefault();
                ui.set({ crear: true });
            }
        };
        document.addEventListener('keydown', fn);
        return () => document.removeEventListener('keydown', fn);
    }, []);
}

// Degradados que usan el dial de Configuración y otros íconos (url(#sgG), url(#lnGrad)).
function Degradados() {
    return (
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
            <defs>
                <linearGradient id="lnGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="var(--brand-secondary)" /><stop offset="100%" stopColor="var(--brand-secondary-light)" /></linearGradient>
                <linearGradient id="sgG" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100"><stop offset="0%" stopColor="#FF3FA4" /><stop offset="100%" stopColor="#FF6AD5" /></linearGradient>
            </defs>
        </svg>
    );
}

export default function ThalamusApp() {
    useIniciarAlmacen();
    useAtajos();
    const estado = useUi();
    const sec = SECCIONES.find(s => s.id === estado.seccion) || SECCIONES[0];
    useEffect(() => { document.title = 'Learnation Thalamus'; }, []);
    return (
        <div className={'thalamus thalamus-app' + (estado.sim ? ' simulando' : '')} data-theme={atributoTema(estado.tema)}>
            <Degradados />
            <div className="wrap">
                <header className="tope">
                    <div className="tope-id">
                        <LogoThalamus />
                        <h1 className="t-h1">{sec.label}</h1>
                    </div>
                    <MenuYo />
                </header>
                <Vista />
            </div>
            <Dock />
            {estado.conf && <Configuracion />}
            {estado.crear && <CrearRapido />}
            {estado.prueba && <PruebaLead />}
            <Toasts />
            <Tooltip />
        </div>
    );
}
