// Solo lectura (el setter, 10/10/2026): dentro de Thalamus todo control que no sea de navegación queda
// deshabilitado. Es la marca que ya usaba el prototipo para su simulador de roles: lo que solo lleva
// de un lado a otro (pestañas, abrir un evento, copiar un link, probar) lleva `data-nav`; lo demás
// cambia la configuración. La pantalla del lead (.reserva: la prueba y la vista previa) nunca se
// bloquea, porque probar no agenda nada.
//
// Mira el DOM y no cada componente: así un control nuevo nace bloqueado sin que nadie se acuerde de
// pasarle un permiso. Lo que se agrega después (una tarjeta, un desplegable) se bloquea al aparecer, y
// si React vuelve a habilitar algo, se deshabilita de nuevo. Es la capa de la pantalla: el almacén no
// manda escrituras en solo lectura y el servidor las rechaza igual (app/agendas_v2/api_admin.py).

import { useEffect } from 'react';

const CONTROLES = 'button,input,select,textarea,[contenteditable="true"]';

export function bloquear(raiz) {
    raiz.querySelectorAll(CONTROLES).forEach(el => {
        if (el.hasAttribute('data-nav') || el.closest('.reserva')) return;
        if (el.getAttribute('contenteditable') === 'true') el.setAttribute('contenteditable', 'false');
        else if (!el.disabled) el.disabled = true;
    });
}

export function useSoloLectura(ref, activo) {
    useEffect(() => {
        const raiz = ref.current;
        if (!activo || !raiz) return undefined;
        bloquear(raiz);
        const obs = new MutationObserver(() => bloquear(raiz));
        obs.observe(raiz, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'contenteditable'] });
        return () => obs.disconnect();
    }, [ref, activo]);
}
