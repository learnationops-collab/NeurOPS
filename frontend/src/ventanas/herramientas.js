// Las herramientas que se abren como ventana, por rol: el catálogo, como `config/staff_tools.php` de la
// Academia y `DockTools` de Leadership. Cada una aparece en el menú de sesión (y se puede fijar en el dock)
// y se abre encima de cualquier pantalla. Sumar una es agregar un item acá y su componente en ./herramientas/.
import { lazy } from 'react';
import { CalendarClock, MessageCircle, Search, Settings } from 'lucide-react';
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
        hint: 'Los turnos que quedan de triage y de closers, por día',
        Icono: CalendarClock,
        roles: ['setter', 'closer', 'triage', 'admin', 'director_comercial', 'operator'],
        ancho: 820,
        Componente: lazy(() => import('./herramientas/TurnosVentana.jsx')),
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
    // Configuración también es una ventana (ADR-W169), para todos los roles (`roles: null`), pero no va en el
    // menú de Herramientas: se abre desde el avatar y la tarjeta de sesión. `Acciones` va en su cabecera.
    {
        key: 'configuracion',
        label: 'Configuración',
        Icono: Settings,
        roles: null,
        enMenu: false,
        ancho: 900,
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
