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

import { useState } from 'react';
import { DatosCuenta, TarjetaCalendar, TarjetaDisponibilidad, TarjetaWhatsapp } from '../../agendas_v2/secciones/conf/cuenta';
import MisEventos from '../../agendas_v2/secciones/conf/MisEventos';
import { Icono } from '../../agendas_v2/ui/base';
import '../../agendas_v2/thalamus.css';

export const TABS_CLOSER = [
    ['datos', 'Datos', 'user'], ['disponibilidad', 'Disponibilidad', 'clock'], ['integraciones', 'Integraciones', 'enchufe'], ['eventos', 'Mis eventos', 'calendar'],
];

// Las tarjetas de Thalamus siguen el modo claro u oscuro de la app.
const temaApp = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
// Volviendo de Google se abre en Integraciones, donde está el resultado.
const tabInicial = () => (new URLSearchParams(window.location.search).get('google_connected') ? 'integraciones' : 'datos');

export default function ConfiguracionCloser({ user = null }) {
    const [tab, setTab] = useState(tabInicial);
    let cuerpo;
    if (tab === 'disponibilidad') cuerpo = <TarjetaDisponibilidad />;
    else if (tab === 'integraciones') cuerpo = <><TarjetaCalendar /><TarjetaWhatsapp /></>;
    else if (tab === 'eventos') cuerpo = <MisEventos />;
    else cuerpo = user ? <DatosCuenta user={user} /> : null;
    return (
        <div className="thalamus cu-hoja" data-theme={temaApp()} aria-label="Configuración">
            <div className="tabs" role="tablist" aria-label="Configuración">
                {TABS_CLOSER.map(([t, n, ico]) => (
                    <button key={t} type="button" className="tab" role="tab" aria-selected={tab === t} aria-controls="cu-cuerpo" onClick={() => setTab(t)}>
                        <Icono n={ico} />{n}
                    </button>
                ))}
            </div>
            <div className="cu-cuerpo" id="cu-cuerpo" role="tabpanel">{cuerpo}</div>
        </div>
    );
}
