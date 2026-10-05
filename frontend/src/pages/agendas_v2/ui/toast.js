// Aviso corto abajo de la pantalla. toast(texto, 'ok'|'error', {txt, fn}) — la acción (ej. "Deshacer") dura 6 s.

let actual = null, t = null;
const subs = new Set();
const emitir = () => subs.forEach(fn => fn());

export function toast(texto, tono = 'ok', accion = null) {
    clearTimeout(t);
    actual = { texto, tono, accion, id: Date.now() };
    emitir();
    t = setTimeout(() => { actual = null; emitir(); }, accion ? 6000 : tono === 'error' ? 5200 : 2400);
}
export function cerrarToast() { clearTimeout(t); actual = null; emitir(); }
export const toastStore = { subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }, getState: () => actual };

export function copiarTexto(txt, aviso = 'Link copiado') {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => toast(aviso), () => toast(txt));
    else toast(txt);
}
