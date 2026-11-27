// «Configuración», la de todos, igual en Work, Academy y Leadership (ADR-W167, mockup
// docs/mockups/configuracion-unificada). Se abre en una ventana flotante (ADR-W169: minimizar, maximizar, arrastrar) desde el avatar o la tarjeta de
// sesión, por sesion/ConfiguracionContext.jsx. El mismo contenido en dos vistas (Apariencia › Vista):
//   · Pestañas: las secciones a la izquierda, agrupadas (Vos / Trabajo / Cuenta), y el contenido a la derecha;
//   · Baldosas, como Academy: tu identidad a la izquierda y una baldosa por sección con su resumen; tocar una
//     la abre en la misma ventana, con «volver».
// Las secciones dependen del rol (SECCIONES.para). Las tarjetas son las de la Configuración de Agendamiento
// (agendas_v2/secciones/conf/cuenta.jsx). Google Calendar y el WhatsApp confirmado son obligatorios para
// recibir agendas del sistema de agendas 2.0 (app/agendas_v2/servicio.py, solo_elegibles).
//
// Google vuelve del permiso a /closer/deck?vista=configuracion&google_connected=success: la ventana se abre en
// Integraciones y la tarjeta de Calendar muestra el resultado.

import { useState } from 'react';
import { Bell, CalendarCheck, CalendarDays, ChevronLeft, Clock, KeyRound, LifeBuoy, MessageCircle, Palette, PanelBottom, Timer, User, Users } from 'lucide-react';
import { TarjetaCalendar, TarjetaWhatsapp } from '../pages/agendas_v2/secciones/conf/cuenta';
import { TarjetaDisponibilidad, TarjetaSesiones } from '../pages/agendas_v2/secciones/conf/disponibilidad';
import MisEventos from '../pages/agendas_v2/secciones/conf/MisEventos';
import TeamManagementPage from '../pages/admin/team/TeamManagementPage';
import TabApariencia from '../temas/TabApariencia';
import { puedeElegirTema, useApariencia } from '../context/AparienciaContext';
import { useTemaDeHoja } from './temaDeHoja';
import TabDock from './TabDock';
import { Tooltip } from '../components/standard';
import { TabAyuda, TabCuenta, TabNotificaciones, TabSeguridad, IdentidadConfiguracion, resumenDe } from './configuracionSecciones';
import '../pages/agendas_v2/thalamus.css';
import './configuracion.css';

const RECIBEN_AGENDAS = ['closer', 'triage', 'director_comercial', 'admin'];
const SECCIONES = [
    { id: 'datos', nombre: 'Tu cuenta', desc: 'Tu personaje, tu email y tus roles', Icono: User, grupo: 'Vos', para: () => true },
    { id: 'apariencia', nombre: 'Apariencia', desc: 'Tema, modo, efectos y letra', Icono: Palette, grupo: 'Vos', para: (rol) => puedeElegirTema(rol) },
    { id: 'dock', nombre: 'Dock', desc: 'Abajo o barra lateral', Icono: PanelBottom, grupo: 'Vos', para: () => true },
    { id: 'notificaciones', nombre: 'Notificaciones', desc: 'Qué te avisa y por dónde', Icono: Bell, grupo: 'Vos', para: () => true },
    { id: 'disponibilidad', nombre: 'Disponibilidad', desc: 'Cuándo te ofrecemos a los leads', Icono: Clock, grupo: 'Trabajo', para: (rol) => RECIBEN_AGENDAS.includes(rol) },
    { id: 'sesiones', nombre: 'Sesiones', desc: 'Duración y margen de cada sesión', Icono: Timer, grupo: 'Trabajo', para: (rol) => ['closer', 'triage'].includes(rol) },
    { id: 'google', nombre: 'Google Calendar', desc: 'Dónde se crean tus agendas y qué te bloquea', Icono: CalendarCheck, grupo: 'Trabajo', para: (rol) => RECIBEN_AGENDAS.includes(rol) },
    { id: 'whatsapp', nombre: 'WhatsApp', desc: 'Dónde te avisamos cada agenda nueva', Icono: MessageCircle, grupo: 'Trabajo', para: (rol) => RECIBEN_AGENDAS.includes(rol) },
    { id: 'eventos', nombre: 'Mis eventos', desc: 'Tus links de agendamiento', Icono: CalendarDays, grupo: 'Trabajo', para: (rol) => rol === 'closer' },
    { id: 'equipo', nombre: 'Equipo', desc: 'Altas, roles y contraseñas', Icono: Users, grupo: 'Trabajo', para: (rol) => rol === 'admin' },
    { id: 'seguridad', nombre: 'Seguridad', desc: 'Cómo entrás y tus sesiones', Icono: KeyRound, grupo: 'Cuenta', para: () => true },
    { id: 'ayuda', nombre: 'Ayuda', desc: 'Reportar un problema y tus reportes', Icono: LifeBuoy, grupo: 'Cuenta', para: () => true },
];
export const pestanasDe = (rol) => SECCIONES.filter(p => p.para(rol));

// Volviendo de Google se abre en Google Calendar, donde está el resultado. 'integraciones' es el nombre viejo.
const tabDeLaUrl = () => (new URLSearchParams(window.location.search).get('google_connected') ? 'google' : null);
const ALIAS = { integraciones: 'google' };

function Cuerpo({ id, user }) {
    if (id === 'disponibilidad') return <TarjetaDisponibilidad />;
    if (id === 'sesiones') return <TarjetaSesiones />;
    if (id === 'google') return <TarjetaCalendar />;
    if (id === 'whatsapp') return <TarjetaWhatsapp />;
    if (id === 'eventos') return <MisEventos />;
    if (id === 'equipo') return <TeamManagementPage embebido />;
    if (id === 'apariencia') return <TabApariencia />;
    if (id === 'dock') return <TabDock />;
    if (id === 'notificaciones') return <TabNotificaciones />;
    if (id === 'seguridad') return <TabSeguridad user={user} />;
    if (id === 'ayuda') return <TabAyuda />;
    return <TabCuenta user={user} />;
}

const Cabeza = ({ s }) => (
    <header className="cu-cab"><h2>{s.nombre}</h2><p>{s.desc}</p></header>
);

export default function Configuracion({ user = null, tabInicial = null, onTab = () => {} }) {
    const secciones = pestanasDe(user?.role);
    const { ajustes } = useApariencia();
    const vista = ajustes?.vista === 'baldosas' ? 'baldosas' : 'pestanas';
    const [elegida, setElegida] = useState(() => ALIAS[tabInicial] || tabInicial || tabDeLaUrl());
    const actual = secciones.find(p => p.id === elegida) || null;
    const elegir = (id) => { setElegida(id); onTab(id); };
    const [raiz, dataTheme] = useTemaDeHoja();

    if (vista === 'baldosas') {
        return (
            <div ref={raiz} className="thalamus cu-hoja cu-hoja--baldosas" data-theme={dataTheme} aria-label="Configuración">
                {actual ? (
                    <div className="cu-detalle">
                        <button type="button" className="cu-volver" onClick={() => elegir(null)}>
                            <ChevronLeft size={16} aria-hidden="true" />Configuración
                        </button>
                        <Cabeza s={actual} />
                        <div className="cu-cuerpo"><Cuerpo id={actual.id} user={user} /></div>
                        <Tooltip />
                    </div>
                ) : (
                    <div className="cu-baldosas">
                        <IdentidadConfiguracion user={user} onElegir={elegir} />
                        <div className="cu-grilla">
                            {secciones.filter(s => s.id !== 'datos').map(s => (
                                <button key={s.id} type="button" className="cu-baldosa" onClick={() => elegir(s.id)}>
                                    <span className="cu-baldosa-ico"><s.Icono size={19} aria-hidden="true" /></span>
                                    <b>{s.nombre}</b>
                                    <small className="trunc">{resumenDe(s.id, { user, ajustes }) || s.desc}</small>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const enPestana = actual || secciones[0];
    const grupos = [...new Set(secciones.map(s => s.grupo))];
    return (
        <div ref={raiz} className="thalamus cu-hoja cu-hoja--pestanas" data-theme={dataTheme} aria-label="Configuración">
            <nav className="cu-pestanas" role="tablist" aria-orientation="vertical" aria-label="Secciones de Configuración">
                {grupos.map(g => (
                    <div key={g} className="cu-grupo" role="presentation">
                        <p className="cu-grupo-tit">{g}</p>
                        {secciones.filter(s => s.grupo === g).map(s => (
                            <button key={s.id} type="button" className="cu-pest" role="tab" aria-selected={enPestana.id === s.id}
                                aria-controls="cu-cuerpo" onClick={() => elegir(s.id)}>
                                <s.Icono size={17} aria-hidden="true" /><span className="trunc">{s.nombre}</span>
                            </button>
                        ))}
                    </div>
                ))}
            </nav>
            <div className="cu-panel" id="cu-cuerpo" role="tabpanel">
                <Cabeza s={enPestana} />
                <div className="cu-cuerpo" key={enPestana.id}><Cuerpo id={enPestana.id} user={user} /></div>
            </div>
            <Tooltip />
        </div>
    );
}
