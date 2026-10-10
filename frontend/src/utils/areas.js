import {
    BarChart3, Brain, Briefcase, CalendarDays, Filter, Megaphone, MessageCircle, PhoneCall, UserPlus, Wallet, Wrench,
} from 'lucide-react';

// Áreas (10/10/2026): un ROL gestiona un tipo de acceso a una o más ÁREAS. La dirección comercial, por
// ejemplo, trabaja en Ventas (el dashboard comercial) y en Agendamiento; el closer, en Cierres. En el
// Portal (utils/portal.js) cada rol de la persona es un grupo y sus áreas son las tarjetas.
//
// Finances es un área de admin y de la dirección comercial, pero solo con el permiso «ver finanzas»
// (ver `rolDeFinanzas` en cuentasVinculadas.js). Cortex (Learnito y el Playbook) es de todos los roles.

export const AREAS = {
    administracion: { id: 'administracion', label: 'Administración', ruta: '/admin/ventas', Icono: Briefcase },
    ventas: { id: 'ventas', label: 'Ventas', ruta: '/admin/comercial', Icono: BarChart3 },
    agendamiento: { id: 'agendamiento', label: 'Agendamiento', ruta: '/agendas-v2', Icono: CalendarDays },
    cierres: { id: 'cierres', label: 'Cierres', ruta: '/closer/deck?step=confirmations', Icono: PhoneCall },
    setting: { id: 'setting', label: 'Setting', ruta: '/setter/deck?step=agendas', Icono: MessageCircle },
    triage: { id: 'triage', label: 'Triage', ruta: '/triage/deck?step=confirmar', Icono: Filter },
    operaciones: { id: 'operaciones', label: 'Operaciones', ruta: '/ops/dashboard', Icono: Wrench },
    marketing: { id: 'marketing', label: 'Marketing', ruta: '/admin/workshops', Icono: Megaphone },
    talent: { id: 'talent', label: 'Talent', ruta: '/admin/hiring', Icono: UserPlus },
    finanzas: { id: 'finanzas', label: 'Finances', ruta: '/finanzas', Icono: Wallet },
    cortex: { id: 'cortex', label: 'Cortex', ruta: '/cortex', Icono: Brain },
};

// La primera es la de siempre del rol (ver roleLanding.js).
const AREAS_POR_ROL = {
    admin: ['administracion', 'ventas', 'agendamiento'],
    director_comercial: ['ventas', 'agendamiento'],
    closer: ['cierres'],
    setter: ['setting'],
    triage: ['triage'],
    operator: ['operaciones'],
    director_marketing: ['marketing'],
    hiring: ['talent'],
};

export const areasDe = (rol) => (AREAS_POR_ROL[rol] || []).map((id) => AREAS[id]);
