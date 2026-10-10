// Abrir el Portal desde cualquier lado (el menú de sesión, la tecla «w», el login) sin depender del
// componente: PortalContext.jsx registra acá cómo abrirlo. `paso`: 'simular' para ir directo a Simular
// a alguien; sin él, empieza por los roles. Un pedido que llega antes de que el Portal esté registrado
// (al montar la app desde un link a /portal) queda guardado y se abre al registrarse.
let abrir = null;
let pendiente;
export const registrarPortal = (fn) => {
    abrir = fn;
    if (pendiente !== undefined) { const p = pendiente; pendiente = undefined; fn(p); }
    return () => { if (abrir === fn) abrir = null; };
};
export const abrirPortal = (paso = null) => {
    if (abrir) abrir(paso);
    else pendiente = paso;
};
