// El dock de cada uno guardado en su cuenta (ADR-W164, como Leadership): lo fijado, la navegación editada
// de cada pantalla y el modo (abajo o lateral). Los almacenes (fijadas.js, ventanas/navegacionDock.js,
// ventanas/modoDock.js) siguen leyendo el navegador al instante; esto los llena con lo de la cuenta al
// entrar y le manda cada cambio al servidor (un PUT, agrupado). Así otra compu arranca igual.
// Simulando a otro no se lee ni se guarda nada.
import api from '../services/api';

const partes = new Map(); // nombre → { leer(userId), escribir(userId, valor) }
let usuario = null;
let prefs = null;
let timer = null;

/** Cada almacén se anota con cómo leer y escribir su parte en el navegador. */
export function registrarParte(nombre, parte) { partes.set(nombre, parte); }

function guardarPronto() {
    clearTimeout(timer);
    timer = setTimeout(() => {
        if (!usuario || !prefs) return;
        api.put('/auth/me/dock', { dock_prefs: prefs }).catch((e) => {
            // Queda en el navegador y se reintenta con el próximo cambio; pero al recargar gana lo de la cuenta.
            console.error(`Dock: no se guardó en la cuenta (${e?.response?.status || e?.message})`);
        });
    }, 800);
}

/** Un almacén cambió su parte: se guarda en la cuenta. */
export function avisarCambio(nombre, userId) {
    if (!usuario || (userId != null && usuario.id !== userId) || !prefs) return;
    const parte = partes.get(nombre);
    if (!parte) return;
    prefs = { ...prefs, [nombre]: parte.leer(userId) };
    guardarPronto();
}

/**
 * Al tener sesión: lo de la cuenta pisa lo del navegador. Si la cuenta todavía no tiene nada, se le sube lo
 * que había en este navegador (lo de antes de ADR-W164).
 */
export function hidratarDock(user) {
    if (!user || user.is_impersonating || !user.dock_prefs || typeof user.dock_prefs !== 'object') { usuario = null; prefs = null; return; }
    if (usuario?.id === user.id && prefs) return;
    usuario = user;
    const guardado = user.dock_prefs;
    if (Object.keys(guardado).length) {
        prefs = { ...guardado };
        partes.forEach((parte, nombre) => { if (guardado[nombre] !== undefined) parte.escribir(user.id, guardado[nombre]); });
    } else {
        prefs = {};
        partes.forEach((parte, nombre) => { prefs[nombre] = parte.leer(user.id); });
        guardarPronto();
    }
}
