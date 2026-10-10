// «Configuración», la de todos: se abre en una hoja (HojaModal) desde «Configuración» del menú de sesión
// (sesion/menuSesion.js) en cualquier pantalla, a través de sesion/ConfiguracionContext.jsx. Las
// pestañas dependen del rol:
//   Datos (foto, email)                      todos
//   Disponibilidad · Integraciones           quienes reciben agendas (closer, dirección comercial, admin)
//   Mis eventos (sus propios links)          closer
//   Equipo (alta, roles, contraseñas)        admin
//   Apariencia (tema y modo)                 todos
// Las tarjetas son las mismas de la Configuración de Agendamiento (agendas_v2/secciones/conf/cuenta.jsx).
// Google Calendar y el WhatsApp confirmado son obligatorios para recibir agendas del sistema de
// agendas 2.0 (sin ellos, sus horarios no se ofrecen a los leads; ver app/agendas_v2/servicio.py,
// solo_elegibles).
//
// Google vuelve del permiso a /closer/deck?vista=configuracion&google_connected=success
// (app/api/google_calendar.py): la hoja se abre en Integraciones y la tarjeta de Calendar muestra el
// resultado.

import { useLayoutEffect, useRef, useState } from 'react';
import { DatosCuenta, TarjetaCalendar, TarjetaDisponibilidad, TarjetaWhatsapp } from '../pages/agendas_v2/secciones/conf/cuenta';
import MisEventos from '../pages/agendas_v2/secciones/conf/MisEventos';
import TeamManagementPage from '../pages/admin/team/TeamManagementPage';
import TabApariencia from '../temas/TabApariencia';
import { dataThemeDe, puedeElegirTema, useApariencia } from '../context/AparienciaContext';
import { Icono } from '../pages/agendas_v2/ui/base';
import '../pages/agendas_v2/thalamus.css';

const RECIBEN_AGENDAS = ['closer', 'director_comercial', 'admin'];
const PESTANAS = [
    { id: 'datos', nombre: 'Datos', icono: 'user', para: () => true },
    { id: 'disponibilidad', nombre: 'Disponibilidad', icono: 'clock', para: (rol) => RECIBEN_AGENDAS.includes(rol) },
    { id: 'integraciones', nombre: 'Integraciones', icono: 'enchufe', para: (rol) => RECIBEN_AGENDAS.includes(rol) },
    { id: 'eventos', nombre: 'Mis eventos', icono: 'calendar', para: (rol) => rol === 'closer' },
    { id: 'equipo', nombre: 'Equipo', icono: 'users', para: (rol) => rol === 'admin' },
    { id: 'apariencia', nombre: 'Apariencia', icono: 'sol', para: (rol) => puedeElegirTema(rol) },
];
export const pestanasDe = (rol) => PESTANAS.filter(p => p.para(rol));

// Con tema elegido, el modo del tema (y la hoja lo sigue, components/ui/hoja-modal.css). Sin tema, las
// tarjetas de Thalamus van en el modo de la hoja que las contiene, no en el de la página: en el
// estilo glass la hoja (.bg-surface) es navy aunque la app esté en claro (Elegant Blue), y con el modo
// de la clase `dark` el texto salía oscuro sobre oscuro. Se decide por el color del texto de la hoja:
// si es claro, el fondo es oscuro.
const temaApp = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
function temaDeLaHoja(nodo) {
    const hoja = nodo?.closest('.bg-surface');
    const rgb = hoja && getComputedStyle(hoja).color.match(/\d+(\.\d+)?/g);
    if (!rgb || rgb.length < 3) return temaApp();
    const [r, g, b] = rgb.map(Number);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? 'dark' : 'light';
}
// Volviendo de Google se abre en Integraciones, donde está el resultado.
const tabDeLaUrl = () => (new URLSearchParams(window.location.search).get('google_connected') ? 'integraciones' : 'datos');

export default function Configuracion({ user = null, tabInicial = null, onTab = () => {} }) {
    const pestanas = pestanasDe(user?.role);
    const [elegida, setElegida] = useState(() => tabInicial || tabDeLaUrl());
    const tab = pestanas.some(p => p.id === elegida) ? elegida : 'datos';
    const elegir = (id) => { setElegida(id); onTab(id); };
    const raiz = useRef(null);
    const apariencia = useApariencia();
    const [temaHoja, setTemaHoja] = useState(temaApp);
    useLayoutEffect(() => { setTemaHoja(temaDeLaHoja(raiz.current)); }, []);
    let cuerpo;
    if (tab === 'disponibilidad') cuerpo = <TarjetaDisponibilidad />;
    else if (tab === 'integraciones') cuerpo = <><TarjetaCalendar /><TarjetaWhatsapp /></>;
    else if (tab === 'eventos') cuerpo = <MisEventos />;
    else if (tab === 'equipo') cuerpo = <TeamManagementPage embebido />;
    else if (tab === 'apariencia') cuerpo = <TabApariencia />;
    else cuerpo = user ? <DatosCuenta user={user} /> : null;
    return (
        <div ref={raiz} className="thalamus cu-hoja" data-theme={dataThemeDe(apariencia, temaHoja)} aria-label="Configuración">
            <div className="tabs" role="tablist" aria-label="Configuración">
                {pestanas.map(p => (
                    <button key={p.id} type="button" className="tab" role="tab" aria-selected={tab === p.id} aria-controls="cu-cuerpo" onClick={() => elegir(p.id)}>
                        <Icono n={p.icono} />{p.nombre}
                    </button>
                ))}
            </div>
            <div className="cu-cuerpo" id="cu-cuerpo" role="tabpanel">{cuerpo}</div>
        </div>
    );
}
