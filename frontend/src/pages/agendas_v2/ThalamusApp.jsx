// Learnation Thalamus: la herramienta del director comercial para armar formularios, equipo,
// prioridades y eventos de agenda. Dock en el orden real de configuración: 1 Forms · 2 Team ·
// 3 Events · 4 Stats. Es el área «Agendamiento». Los funnels se crean y editan desde Events (ModalFunnel).

import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, CalendarDays, ClipboardList, Clock, Filter, LogOut, Users } from 'lucide-react';
import './thalamus.css';
import { useAuth } from '../../contexts/AuthContext';
import { SECCIONES } from './core/catalogos';
import { almacen, useDatos, useIniciarAlmacen, usePermisos, useUi } from './data/hooks';
import { Icono, LogoThalamus, Toasts, Tooltip } from './ui/base';
import { ui } from './ui/estadoUi';
import { toast } from './ui/toast';
import { irA } from './ui/navegacion';
import Forms from './secciones/forms/Forms';
import Team from './secciones/team/Team';
import Horas from './secciones/team/Horas';
import Eventos from './secciones/eventos/Eventos';
import Stats from './secciones/stats/Stats';
import ModalFunnel from './secciones/eventos/ModalFunnel';
import CrearRapido from './secciones/conf/CrearRapido';
import PruebaLead from './reserva/PruebaLead';
import DockSecciones from '../comercial/components/DockSecciones';
import MenuSesion from '../comercial/components/MenuSesion';
import { opcionCambiarDeArea } from '../../utils/areas';
import { opcionesDeRol } from '../../utils/cuentasVinculadas';
import '../comercial/comercial.css';

// Tema: oscuro, claro o el del sistema. Se aplica a la raíz de Thalamus, no a toda la app.
function atributoTema(tema) { return tema === 'oscuro' ? 'dark' : tema === 'claro' ? 'light' : undefined; }

// El dock es el MISMO del área Dirección (DockSecciones + MenuSesion del dashboard comercial): son
// dos áreas de la dirección comercial y se pasa de una a otra con «Cambiar de área» (utils/areas.js).
// Va fuera de `.thalamus` (sus estilos cuelgan de `.dc-shell`, y los de Thalamus le pisarían el
// `.dock`).
const ICONO_DE_SECCION = { preguntas: ClipboardList, team: Users, horas: Clock, eventos: Filter, estadisticas: BarChart3 };

function Dock() {
    const { seccion } = useUi();
    const perm = usePermisos();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const secciones = SECCIONES.filter(s => perm.secOk(s.id)).map(s => ({ id: s.id, label: s.label, Icono: ICONO_DE_SECCION[s.id] || CalendarDays }));
    const grupos = [
        opcionCambiarDeArea(user, 'agendamiento', navigate),
        opcionesDeRol(user, (m) => toast(m, 'error')),
        [{ id: 'salir', label: 'Cerrar sesión', Icono: LogOut, peligro: true,
            onClick: () => { if (window.confirm('¿Cerrar sesión?')) logout(); } }],
    ];
    return (
        <div className="dc-shell dc-shell--embebido">
            <DockSecciones secciones={secciones} activa={seccion} ariaLabel="Secciones de Agendamiento"
                onElegir={irA}
                despues={<MenuSesion nombre={user?.username || ''} rol="Dirección comercial · Agendamiento" grupos={grupos} />} />
        </div>
    );
}

function Vista() {
    const { cargando } = useDatos();
    const { seccion, sim } = useUi();
    const perm = usePermisos();

    let cuerpo;
    if (cargando) cuerpo = <div className="panel vacio"><p className="t-sm mut">Cargando…</p></div>;
    else if (seccion === 'horas' && !perm.secOk('horas') && !sim) {
        cuerpo = (
            <div className="panel vacio">
                <Icono n="clock" s={22} />
                <p className="t-sm mut">Pedile a la dirección comercial que te sume en Team para ver tus horas.</p>
            </div>
        );
    } else if (!perm.secOk(seccion)) {
        cuerpo = <div className="panel vacio"><Icono n="prohibido" s={22} /><p className="t-sm mut">Este rol no tiene acceso a esta sección.</p></div>;
    } else if (seccion === 'preguntas') cuerpo = <Forms />;
    else if (seccion === 'team') cuerpo = <Team />;
    else if (seccion === 'horas') cuerpo = <Horas />;
    else if (seccion === 'eventos') cuerpo = <Eventos />;
    else cuerpo = <Stats />;

    return <main className="vista"><ErrorDeVista seccion={seccion}>{cuerpo}</ErrorDeVista></main>;
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
            if (!e0.prueba && !enLead && e.key && e.key.toLowerCase() === 'n' && !e.altKey && ((e.ctrlKey || e.metaKey) || (!escribe && !e.shiftKey && !e0.crear && !e0.funnel))) {
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

// Con la API, el perfil es del usuario de la sesión. Si está vacío, arranca con su nombre (una sola vez).
function usePerfilDeLaSesion() {
    const { user } = useAuth();
    const { cargado, perfil } = useDatos();
    const hecho = useRef(false);
    useEffect(() => {
        if (hecho.current || !cargado || !user || almacen.adaptador.tipo !== 'api') return;
        hecho.current = true;
        if (perfil.nombre || perfil.apellido) return;
        const partes = String(user.name || user.username || '').trim().split(/\s+/).filter(Boolean);
        if (partes.length) almacen.guardarPerfil({ nombre: partes[0], apellido: partes.slice(1).join(' ') });
    }, [cargado, perfil, user]);
}

export default function ThalamusApp() {
    useIniciarAlmacen();
    usePerfilDeLaSesion();
    useAtajos();
    const estado = useUi();
    const sec = SECCIONES.find(s => s.id === estado.seccion) || SECCIONES[0];
    useEffect(() => { document.title = 'Learnation Thalamus'; }, []);
    return (
        <>
        <div className="thalamus thalamus-app" data-theme={atributoTema(estado.tema)}>
            <Degradados />
            <div className="wrap">
                <header className="tope">
                    <div className="tope-id">
                        <LogoThalamus />
                        <h1 className="t-h1">{sec.label}</h1>
                    </div>
                    {/* Los botones y filtros de la sección van acá, a la derecha del título (ui/EnTope). */}
                    <div className="tope-acc" id="tope-acc" />
                </header>
                <Vista />
            </div>
            {estado.funnel && <ModalFunnel estado={estado.funnel} />}
            {estado.crear && <CrearRapido />}
            {estado.prueba && <PruebaLead />}
            <Toasts />
            <Tooltip />
        </div>
        <Dock />
        </>
    );
}
