// Google Calendar de la cuenta en las pantallas de ajustes (closer, ventas). Es la misma tarjeta de la
// Configuración de Agendamiento y del closer (agendas_v2/secciones/conf/cuenta.jsx), con el estilo de
// Thalamus: una sola implementación para conectar, elegir el calendario de destino y desconectar.

import { TarjetaCalendar } from '../pages/agendas_v2/secciones/conf/cuenta';
import '../pages/agendas_v2/thalamus.css';

// Las tarjetas de Thalamus siguen el modo claro u oscuro de la app.
const temaApp = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

const GoogleCalendarSettings = () => (
    <div className="thalamus cu-hoja" data-theme={temaApp()}>
        <TarjetaCalendar />
    </div>
);

export default GoogleCalendarSettings;
