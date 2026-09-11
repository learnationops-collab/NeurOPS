// Ruta de aterrizaje de cada rol: a dónde va un usuario recién logueado, a dónde
// lo devuelve ProtectedRoute si entra a una ruta ajena y a dónde abre la pestaña
// de simulación desde Equipo. Es la ÚNICA lista: antes vivía repetida en
// LoginPage, App.jsx y TeamManagementPage, y al sumar el rol `hiring` se
// actualizaron dos de las tres copias — el login no lo conocía, caía en
// `navigate('/login')` y el usuario quedaba clavado en el formulario.
//
// Al agregar un rol nuevo, alcanza con sumarlo acá.
export const ROLE_LANDING_PATHS = {
    admin: '/admin/ventas',
    operator: '/ops/dashboard',
    setter: '/setter/deck?step=cualificacion',
    triage: '/triage/deck?step=confirmar',
    closer: '/closer/deck?step=confirmations',
    director_comercial: '/admin/ventas',
    director_marketing: '/admin/workshops',
    hiring: '/admin/hiring',
};

// Rol desconocido -> /login: el fallback `*` del router ya manda ahí, así que es
// el destino real de cualquier ruta inventada; explicitarlo evita un rebote.
export const roleLandingPath = (role) => ROLE_LANDING_PATHS[role] || '/login';
