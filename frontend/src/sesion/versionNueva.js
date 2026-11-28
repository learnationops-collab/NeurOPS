// Una pestaña abierta desde antes de un deploy sigue con el código viejo: no le llegan las novedades nuevas ni los
// arreglos (Eli no veía el changelog que sí salía simulándolo, ADR-W285). Cada 5 minutos se mira si index.html
// trae otro paquete; si cambió, Work se recarga al volver a la pestaña o tras 10 minutos sin tocar nada, nunca
// mientras alguien escribe. Solo en la versión construida (en desarrollo no hay `/assets/`).
const CADA = 5 * 60000;
const QUIETO = 10 * 60000;
const GUARDA = 'recarga-por-version';

const paqueteDe = (html) => (/<script\b[^>]*\bsrc="([^"]*\/assets\/[^"]+\.js)"/.exec(html) || [])[1] || null;
const actual = () => document.querySelector('script[type="module"][src*="/assets/"]')?.getAttribute('src') || null;

const escribiendo = () => {
    const el = document.activeElement;
    if (!el) return false;
    if (el.isContentEditable) return true;
    return (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') && Boolean(el.value);
};

export function vigilarVersionNueva() {
    const mio = actual();
    if (!mio) return;
    let nueva = false;
    let ultimoToque = Date.now();

    const recargar = () => {
        if (!nueva || escribiendo()) return;
        const antes = Number(sessionStorage.getItem(GUARDA) || 0);
        if (Date.now() - antes < 60000) return;
        sessionStorage.setItem(GUARDA, String(Date.now()));
        window.location.reload();
    };
    const revisar = async () => {
        if (nueva) return;
        try {
            const r = await fetch('/', { cache: 'no-store', credentials: 'same-origin' });
            const otro = paqueteDe(await r.text());
            if (otro && otro !== mio) nueva = true;
        } catch { /* sin red: se mira en la próxima */ }
    };

    setInterval(async () => {
        await revisar();
        if (nueva && document.visibilityState === 'visible' && Date.now() - ultimoToque > QUIETO) recargar();
    }, CADA);
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState !== 'visible') return;
        await revisar();
        recargar();
    });
    ['pointerdown', 'keydown'].forEach((e) => window.addEventListener(e, () => { ultimoToque = Date.now(); }, { passive: true }));
}
