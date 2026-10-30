/**
 * Las cuentas de Marketing (porcentajes, costos, ROAS, ticket, CAC) NO se escriben acá: las manda el backend
 * en `tablero.formulas` (`app/services/marketing_formulas.py`, una sola definición, Leadership 834) y esta
 * función las aplica a lo que la pantalla suma al filtrar. Cambiar una cuenta es cambiar un renglón del backend.
 */
let FORMULAS = [];

/** Guarda las cuentas que llegaron del backend (se ignora una lista vacía: no pisa lo que ya se sabe). */
export const usarFormulas = (lista) => {
    if (Array.isArray(lista) && lista.length) FORMULAS = lista;
};

const dividir = (num, den, decimales) => (den ? Number((num / den).toFixed(decimales)) : null);

/** Las cifras que salen de `base` según las cuentas del backend; las mismas de `marketing_formulas.aplicar`. */
export const aplicarFormulas = (base) => {
    const gasto = Number(base.gasto) || 0;
    const entrada = { ...base, leads: base.leads ?? base.entrantes };
    const salida = {};
    FORMULAS.forEach((f) => {
        const denKey = f.den.find((k) => entrada[k] !== null && entrada[k] !== undefined);
        if (!(f.num in entrada) || denKey === undefined) return;
        if (f.con_gasto && gasto <= 0) { salida[f.key] = null; return; }
        salida[f.key] = dividir((Number(entrada[f.num]) || 0) * (f.por || 1), Number(entrada[denKey]), f.dec);
    });
    return salida;
};
