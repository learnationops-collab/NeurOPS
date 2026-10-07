// «Configuración» del closer: se abre en una hoja (HojaModal) desde el menú de sesión del dock. Usa las
// mismas tarjetas que la Configuración de Agendamiento (agendas_v2/secciones/conf/cuenta.jsx), con el
// estilo de Thalamus: su cuenta, Google Calendar, WhatsApp y disponibilidad.
// Google Calendar y el WhatsApp confirmado son obligatorios para recibir agendas del sistema de
// agendas 2.0 (sin ellos, sus horarios no se ofrecen a los leads; ver app/agendas_v2/servicio.py,
// solo_elegibles). La disponibilidad es el horario de su persona de Team en Agendamiento.
//
// Google vuelve del permiso a /closer/deck?vista=configuracion&google_connected=success
// (app/api/google_calendar.py): la página abre esta hoja y la tarjeta de Calendar muestra el resultado.

import { DatosCuenta, TarjetaCalendar, TarjetaDisponibilidad, TarjetaWhatsapp } from '../../agendas_v2/secciones/conf/cuenta';
import '../../agendas_v2/thalamus.css';

// Las tarjetas de Thalamus siguen el modo claro u oscuro de la app.
const temaApp = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

export default function ConfiguracionCloser({ user = null }) {
    return (
        <div className="thalamus cu-hoja" data-theme={temaApp()} aria-label="Configuración">
            {user && <DatosCuenta user={user} />}
            <TarjetaCalendar />
            <TarjetaWhatsapp />
            <TarjetaDisponibilidad />
        </div>
    );
}
