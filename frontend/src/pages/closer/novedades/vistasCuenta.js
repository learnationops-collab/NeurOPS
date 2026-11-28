// Qué changelogs vio cada uno, guardado en su cuenta (ADR-W285), como el dock (ADR-W164). Antes vivía solo en el
// navegador: en otra compu, otro navegador o el celular le volvía a salir a quien ya lo había terminado (Dari), y
// simulando se veía lo del navegador de quien simula, no lo de la persona (Eli).
//
// Una tanda vista queda vista: cuenta su VERSION, no la huella del texto. Retocar un texto ya no se lo vuelve a
// abrir a nadie; para mostrarle una tanda nueva a todos se cambia VERSION.
//
// Simulando se lee lo de la cuenta de la persona y no se guarda nada en ella (lo de esa sesión queda en memoria).
import { avisarCambio, registrarParte } from '../../../sesion/dockServidor';

const PARTE = 'novedades';
const CLAVE = (id) => `ln_nv_cuenta_${id}`;
const vacio = () => ({ vistas: {}, aplazos: {}, pasos: {} });
const simulando = new Map();

// La vista de una tanda es `${VERSION}-${huella}`: la base es la VERSION.
export const base = (vista) => (typeof vista === 'string' && vista.includes('-') ? vista.slice(0, vista.lastIndexOf('-')) : String(vista || ''));
// `ln_novedades_12` → `ln_novedades`; `ln_tour_filtros_12` → `ln_tour_filtros`.
const nombre = (t, user) => t.clave(user).replace(/_[^_]+$/, '');

// Lo de antes de ADR-W285, con las claves sueltas del navegador (`ln_novedades_12`, `_aplazo`, `_paso`).
const leerViejo = (id) => {
    const o = vacio();
    const re = new RegExp(`^(ln_(?:novedades|tour_[a-z]+))_${id}(_aplazo|_paso)?$`);
    for (let k = 0; k < localStorage.length; k += 1) {
        const m = re.exec(localStorage.key(k) || '');
        if (!m) continue;
        const valor = localStorage.getItem(m[0]);
        if (!m[2]) { o.vistas[m[1]] = [base(valor)]; continue; }
        try {
            const x = JSON.parse(valor);
            if (!x?.vista) continue;
            const clave = `${m[1]}|${base(x.vista)}`;
            if (m[2] === '_aplazo') o.aplazos[clave] = { desde: Number(x.desde) || Date.now(), hasta: Number(x.hasta) || 0 };
            else o.pasos[clave] = Number(x.i) || 0;
        } catch { /* clave rota: se ignora */ }
    }
    return o;
};

// Juntar dos registros nunca pierde nada: lo visto se suma, el plazo cuenta desde la primera vez que apareció,
// el aplazo llega hasta el más largo y el paso es el más avanzado.
const unir = (...registros) => {
    const r = vacio();
    registros.forEach((o) => {
        if (!o || typeof o !== 'object') return;
        Object.entries(o.vistas || {}).forEach(([k, l]) => {
            r.vistas[k] = [...new Set([...(r.vistas[k] || []), ...(Array.isArray(l) ? l : [])])].filter(Boolean);
        });
        Object.entries(o.aplazos || {}).forEach(([k, x]) => {
            if (!x) return;
            const p = r.aplazos[k];
            r.aplazos[k] = p ? { desde: Math.min(p.desde, x.desde), hasta: Math.max(p.hasta || 0, x.hasta || 0) } : { desde: x.desde, hasta: x.hasta || 0 };
        });
        Object.entries(o.pasos || {}).forEach(([k, i]) => { r.pasos[k] = Math.max(r.pasos[k] || 0, Number(i) || 0); });
    });
    return r;
};

const leerLocal = (id) => {
    let o = null;
    try { o = JSON.parse(localStorage.getItem(CLAVE(id))); } catch { o = null; }
    return unir(o, leerViejo(id));
};

const datos = (user) => {
    const id = user?.id ?? 'anon';
    const cuenta = user?.dock_prefs?.[PARTE];
    if (user?.is_impersonating) return unir(cuenta, simulando.get(id));
    return unir(leerLocal(id), cuenta);
};

const escribir = (user, cambiar) => {
    const id = user?.id ?? 'anon';
    const o = datos(user);
    cambiar(o);
    if (user?.is_impersonating) { simulando.set(id, o); return; }
    localStorage.setItem(CLAVE(id), JSON.stringify(o));
    if (user?.id != null) avisarCambio(PARTE, user.id);
};

registrarParte(PARTE, {
    // La cuenta que todavía no lo tiene recibe lo de este navegador al entrar (ver `hidratarDock`).
    migrar: true,
    leer: (id) => leerLocal(id),
    escribir: (id, valor) => {
        const local = leerLocal(id);
        const junto = unir(local, valor);
        localStorage.setItem(CLAVE(id), JSON.stringify(junto));
        // Si este navegador tenía algo que la cuenta no (visto acá antes de guardarse en la cuenta), se sube.
        if (JSON.stringify(junto) !== JSON.stringify(unir(valor))) setTimeout(() => avisarCambio(PARTE, id), 0);
    },
});

export const tandaVistaEnCuenta = (t, user) => (datos(user).vistas[nombre(t, user)] || []).includes(base(t.vista));

export const marcarVista = (t, user) => escribir(user, (o) => {
    const k = nombre(t, user);
    o.vistas[k] = [...new Set([...(o.vistas[k] || []), base(t.vista)])];
    delete o.pasos[`${k}|${base(t.vista)}`];
});

// El aplazo de esta tanda; la primera vez que se pide, arranca el plazo.
export const leerAplazo = (t, user) => {
    const k = `${nombre(t, user)}|${base(t.vista)}`;
    const a = datos(user).aplazos[k];
    if (a) return a;
    const nuevo = { desde: Date.now(), hasta: 0 };
    escribir(user, (o) => { o.aplazos[k] = nuevo; });
    return nuevo;
};

export const guardarAplazo = (t, user, hasta) => escribir(user, (o) => {
    const k = `${nombre(t, user)}|${base(t.vista)}`;
    o.aplazos[k] = { desde: o.aplazos[k]?.desde ?? Date.now(), hasta };
});

export const leerPaso = (t, user) => datos(user).pasos[`${nombre(t, user)}|${base(t.vista)}`] || 0;

export const guardarPaso = (t, user, i) => escribir(user, (o) => {
    const k = `${nombre(t, user)}|${base(t.vista)}`;
    o.pasos[k] = Math.max(o.pasos[k] || 0, i);
});
