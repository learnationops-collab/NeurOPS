// Las herramientas que se abren como ventana, por rol: el catálogo, como `config/staff_tools.php` de la
// Academia y `DockTools` de Leadership. Cada una aparece en el menú de sesión (y se puede fijar en el dock)
// y se abre encima de cualquier pantalla. Sumar una es agregar un item acá y su componente en ./herramientas/.
import { lazy } from 'react';
import { CalendarClock, Compass, MessageCircle, MessageSquarePlus, Search, Settings, Wallet } from 'lucide-react';
import AccionesConfiguracion from '../sesion/AccionesConfiguracion';

export const HERRAMIENTAS = [
    {
        key: 'buscar',
        label: 'Buscar lead',
        hint: 'Cualquier lead y su ficha, desde cualquier pantalla',
        Icono: Search,
        roles: ['setter', 'closer', 'triage', 'admin', 'director_comercial', 'operator'],
        ancho: 520,
        Componente: lazy(() => import('./herramientas/BuscarLeadVentana.jsx')),
    },
    {
        key: 'turnos',
        label: 'Turnos',
        hint: 'Lo que ve el lead en cada link y segmento, y los días que se pueden agendar',
        Icono: CalendarClock,
        roles: ['setter', 'closer', 'triage', 'admin', 'director_comercial', 'operator'],
        ancho: 1040,
        Componente: lazy(() => import('./herramientas/TurnosVentana.jsx')),
    },
    // Mi sueldo (ADR-W223, pedido de Marlon): de qué se compone el sueldo del mes. El director ve a cualquiera del equipo.
    {
        key: 'mi-sueldo',
        label: 'Mi sueldo',
        hint: 'De qué se compone tu sueldo del mes: base, comisiones, bonos y los pagos que las suman',
        Icono: Wallet,
        roles: ['setter', 'closer', 'director_comercial', 'admin', 'operator'],
        ancho: 1040,
        Componente: lazy(() => import('./herramientas/miSueldo/MiSueldoVentana.jsx')),
    },
    // El chat del equipo, que vive en la Academia (ADR-W171): General · Equipo, quién está conectado y Learnito.
    {
        key: 'chat',
        label: 'Chat',
        hint: 'El chat del equipo con la Academia y Leadership, quién está conectado y Learnito',
        Icono: MessageCircle,
        roles: null,
        ancho: 1080,
        Componente: lazy(() => import('./herramientas/chat/ChatVentana.jsx')),
    },
    // Leadership rápido: lo tuyo de Leadership sin salir de Work (app/api/leadership_rapido.py → /api/v1/rapido).
    // Lo abre el botón Leadership de la tarjeta de sesión; también se fija en el dock.
    {
        key: 'leadership',
        label: 'Leadership',
        hint: 'Lo tuyo de Leadership: anotar, completar, entregar y pasarle algo a otro',
        Icono: Compass,
        roles: null,
        ancho: 520,
        Componente: lazy(() => import('./herramientas/leadership/LeadershipVentana.jsx')),
    },
    // Pedido a los devs (ADR-W181): un cambio, un error o una duda de la plataforma, al Inbox de Leadership de un dev.
    {
        key: 'pedido-devs',
        label: 'Pedido a los devs',
        hint: 'Un cambio, un error o una duda de la plataforma, directo al Inbox de los devs',
        Icono: MessageSquarePlus,
        roles: null,
        ancho: 480,
        Componente: lazy(() => import('./herramientas/PedidoDevsVentana.jsx')),
    },
    // Configuración también es una ventana (ADR-W169), para todos los roles (`roles: null`), pero no va en el
    // menú de Herramientas: se abre desde el avatar y la tarjeta de sesión. `Acciones` va en su cabecera.
    {
        key: 'configuracion',
        label: 'Configuración',
        Icono: Settings,
        roles: null,
        enMenu: false,
        ancho: 1240,
        Acciones: AccionesConfiguracion,
        Componente: lazy(() => import('../sesion/ConfiguracionVentana.jsx')),
    },
];

/** Si el rol de la sesión puede abrir la herramienta (`roles: null` = todos). */
export const permitida = (h, user) => Boolean(h && user && (!h.roles || h.roles.includes(user.role)));

export const herramienta = (key) => HERRAMIENTAS.find(h => h.key === key) || null;

/** Las del rol activo de la sesión. */
export const herramientasDe = (user) => HERRAMIENTAS.filter(h => h.enMenu !== false && permitida(h, user));

/** El id con que una herramienta va al menú de sesión y a las fijadas del dock. */
export const idDeHerramienta = (key) => `tool:${key}`;
