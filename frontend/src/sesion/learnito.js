// Learnito (app/api/copiloto.py): quién lo puede usar y cómo abrirlo desde cualquier lado (el menú de sesión, una
// acción fijada en el dock) sin depender del componente. Desde el 24/10/2026, todo el equipo menos fulfillment (sus
// cuentas son de la Academia); lo que ve cada uno lo decide el servidor (app/services/tablas/alcance.py).
// LearnitoContext.jsx registra acá cómo abrirlo, igual que el Portal (portalBus.js).

export const ROLES_LEARNITO = ['admin', 'operator', 'director_comercial', 'director_marketing', 'closer', 'setter',
    'triage', 'hiring'];

export const puedeUsarLearnito = (user) => ROLES_LEARNITO.includes(user?.role);

let abrir = null;
export const registrarLearnito = (fn) => {
    abrir = fn;
    return () => { if (abrir === fn) abrir = null; };
};
export const abrirLearnito = () => abrir?.();
