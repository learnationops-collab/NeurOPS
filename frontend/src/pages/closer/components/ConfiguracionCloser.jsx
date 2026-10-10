// «Configuración» del closer: se abre en una hoja (HojaModal) desde el menú de sesión del dock. Es la
// misma Configuración de Agendamiento (agendas_v2/secciones/conf), con las pestañas de lo que decide
// el closer: Datos (con su foto), Disponibilidad, Integraciones (Google Calendar y WhatsApp) y Mis
// eventos (sus propios links de agenda).
// Google Calendar y el WhatsApp confirmado son obligatorios para recibir agendas del sistema de
// agendas 2.0 (sin ellos, sus horarios no se ofrecen a los leads; ver app/agendas_v2/servicio.py,
// solo_elegibles). La disponibilidad es el horario de su persona de Team en Agendamiento.
//
// Google vuelve del permiso a /closer/deck?vista=configuracion&google_connected=success
// (app/api/google_calendar.py): la página abre esta hoja en Integraciones y la tarjeta de Calendar
// muestra el resultado.

import { useLayoutEffect, useRef, useState } from 'react';
import { DatosCuenta, TarjetaCalendar, TarjetaDisponibilidad, TarjetaWhatsapp } from '../../agendas_v2/secciones/conf/cuenta';
import MisEventos from '../../agendas_v2/secciones/conf/MisEventos';
import TabApariencia from '../../../temas/TabApariencia';
import { dataThemeDe, puedeElegirTema, useApariencia } from '../../../context/AparienciaContext';
import { Icono } from '../../agendas_v2/ui/base';
import '../../agendas_v2/thalamus.css';

export const TABS_CLOSER = [
    ['datos', 'Datos', 'user'], ['disponibilidad', 'Disponibilidad', 'clock'], ['integraciones', 'Integraciones', 'enchufe'], ['eventos', 'Mis eventos', 'calendar'],
];
// Apariencia solo para los roles que ya pueden elegir tema (context/AparienciaContext.jsx).
const TAB_APARIENCIA = ['apariencia', 'Apariencia', 'sol'];

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
const tabInicial = () => (new URLSearchParams(window.location.search).get('google_connected') ? 'integraciones' : 'datos');

export default function ConfiguracionCloser({ user = null }) {
    const [tab, setTab] = useState(tabInicial);
    const raiz = useRef(null);
    const apariencia = useApariencia();
    const [temaHoja, setTemaHoja] = useState(temaApp);
    useLayoutEffect(() => { setTemaHoja(temaDeLaHoja(raiz.current)); }, []);
    let cuerpo;
    if (tab === 'disponibilidad') cuerpo = <TarjetaDisponibilidad />;
    else if (tab === 'integraciones') cuerpo = <><TarjetaCalendar /><TarjetaWhatsapp /></>;
    else if (tab === 'eventos') cuerpo = <MisEventos />;
    else if (tab === 'apariencia') cuerpo = <TabApariencia />;
    else cuerpo = user ? <DatosCuenta user={user} /> : null;
    return (
        <div ref={raiz} className="thalamus cu-hoja" data-theme={dataThemeDe(apariencia, temaHoja)} aria-label="Configuración">
            <div className="tabs" role="tablist" aria-label="Configuración">
                {(puedeElegirTema(user?.role) ? [...TABS_CLOSER, TAB_APARIENCIA] : TABS_CLOSER).map(([t, n, ico]) => (
                    <button key={t} type="button" className="tab" role="tab" aria-selected={tab === t} aria-controls="cu-cuerpo" onClick={() => setTab(t)}>
                        <Icono n={ico} />{n}
                    </button>
                ))}
            </div>
            <div className="cu-cuerpo" id="cu-cuerpo" role="tabpanel">{cuerpo}</div>
        </div>
    );
}
