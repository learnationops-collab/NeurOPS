// Learnito, el copiloto de los closers (app/api/copiloto.py): quién lo puede usar y cómo abrirlo desde
// cualquier lado (el menú de sesión, una acción fijada en el dock) sin depender del componente.
// LearnitoContext.jsx registra acá cómo abrirlo, igual que el Portal (portalBus.js).

export const ROLES_LEARNITO = ['closer', 'admin', 'operator', 'director_comercial'];

export const puedeUsarLearnito = (user) => ROLES_LEARNITO.includes(user?.role);

let abrir = null;
export const registrarLearnito = (fn) => {
    abrir = fn;
    return () => { if (abrir === fn) abrir = null; };
};
export const abrirLearnito = () => abrir?.();
