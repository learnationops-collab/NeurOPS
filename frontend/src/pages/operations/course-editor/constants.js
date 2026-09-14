// Roles reales del sistema (ver app/models/user.py). 'hiring' faltaba en el
// ROLE_OPTIONS viejo de PlaybookLessonFormModal.jsx -- un manager no podia
// publicar una leccion visible solo para ese rol.
export const ROLE_OPTIONS = [
    { value: 'admin', label: 'Admin' },
    { value: 'operator', label: 'Operador' },
    { value: 'closer', label: 'Closer' },
    { value: 'setter', label: 'Setter' },
    { value: 'triage', label: 'Call Confirmer' },
    { value: 'director_comercial', label: 'Dir. Comercial' },
    { value: 'director_marketing', label: 'Dir. Marketing' },
    { value: 'hiring', label: 'Hiring' },
];

export const QUESTION_TYPE_OPTIONS = [
    { value: 'single', label: 'Selección única' },
    { value: 'multiple', label: 'Selección múltiple' },
    { value: 'true_false', label: 'Verdadero/falso' },
];

// Set curado de íconos lucide-react para la tarjeta raíz de un área. 'Orbit' es
// el fallback cuando el roadmap no tiene icon (nulo en la base).
export const ICON_OPTIONS = [
    'Orbit', 'Layers', 'BookOpen', 'Compass', 'Target', 'Rocket', 'ShieldCheck',
    'Users', 'Phone', 'Handshake', 'ClipboardList', 'Wrench', 'Megaphone',
    'TrendingUp', 'Sparkles', 'GraduationCap',
];

export const DEFAULT_ICON = 'Orbit';
