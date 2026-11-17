// Las herramientas que se abren como ventana, por rol: el catálogo, como `config/staff_tools.php` de la
// Academia y `DockTools` de Leadership. Cada una aparece en el menú de sesión (y se puede fijar en el dock)
// y se abre encima de cualquier pantalla. Sumar una es agregar un item acá y su componente en ./herramientas/.
import { lazy } from 'react';
import { CalendarClock } from 'lucide-react';

export const HERRAMIENTAS = [
    {
        key: 'turnos',
        label: 'Turnos',
        hint: 'Los turnos que quedan de triage y de closers, por día',
        Icono: CalendarClock,
        roles: ['setter', 'closer', 'triage', 'admin', 'director_comercial', 'operator'],
        ancho: 820,
        Componente: lazy(() => import('./herramientas/TurnosVentana.jsx')),
    },
];

export const herramienta = (key) => HERRAMIENTAS.find(h => h.key === key) || null;

/** Las del rol activo de la sesión. */
export const herramientasDe = (user) => (user ? HERRAMIENTAS.filter(h => h.roles.includes(user.role)) : []);

/** El id con que una herramienta va al menú de sesión y a las fijadas del dock. */
export const idDeHerramienta = (key) => `tool:${key}`;
