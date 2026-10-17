// La capa de los flotantes (menús, listas de un desplegable, popovers): la «top layer» del navegador.
import './standard.css';

/**
 * Sube un flotante a la capa superior del navegador (Popover API, `popover="manual"`): se pinta
 * encima de TODO, sin importar dónde viva en el DOM ni el `z-index` de nadie.
 *
 * Por qué: un `z-index` solo compite dentro del contexto de apilamiento de su padre. Una entrada con
 * `animation … both` deja un `transform` en efecto y vuelve a ese padre un contexto propio; el menú
 * de la pastilla del Resumen de Workshop quedaba atrapado ahí y las tarjetas KPI de abajo se pintaban
 * ENCIMA de sus opciones (en una compu con animaciones; con «reducir movimiento» no pasaba).
 *
 * El nodo sigue en su lugar del DOM: el tab, el clic afuera (`contains`) y los estilos por
 * contexto (`.dc-shell .menu`) funcionan igual. `manual` = el navegador no lo cierra solo: lo sigue
 * manejando el componente. La regla `[data-ui-capa]` de standard.css apaga los estilos de fábrica de
 * un popover (centrado, borde, color del sistema). Devuelve false si no pudo (navegador viejo, jsdom):
 * el flotante se queda con su `z-index` de siempre.
 */
export function subirACapa(nodo) {
    if (!nodo || !nodo.isConnected || typeof nodo.showPopover !== 'function') return false;
    if (!nodo.hasAttribute('popover')) nodo.setAttribute('popover', 'manual');
    nodo.setAttribute('data-ui-capa', '');
    if (!nodo.matches(':popover-open')) nodo.showPopover();
    return true;
}

export default subirACapa;
