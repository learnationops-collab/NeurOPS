// Aviso corto abajo de la pantalla. toast(texto, 'ok'|'error', {txt, fn}) — la acción (ej. "Deshacer") dura 6 s.
// Lo dibuja el Toaster estándar (components/standard); esto traduce la forma de Thalamus a la suya.

import { closeToast, toast as toastStd } from '../../../components/standard';

export function toast(texto, tono = 'ok', accion = null) {
    toastStd(texto, tono === 'error' ? 'error' : 'success', accion && { label: accion.txt, onClick: accion.fn });
}
export const cerrarToast = closeToast;

export function copiarTexto(txt, aviso = 'Link copiado') {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => toast(aviso), () => toast(txt));
    else toast(txt);
}
