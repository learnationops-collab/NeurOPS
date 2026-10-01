import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Las dos fechas de un rango "Personalizado": el del período o el de la comparación.
 *
 * Son días de CALENDARIO LOCAL en `YYYY-MM-DD`, que es justo lo que da y recibe un
 * `<input type="date">`. Nunca pasan por `toISOString()`: eso es la fecha en UTC, y en UTC−3
 * después de las 21 h ya es "mañana".
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n) => String(n).padStart(2, '0');
const diaLocal = (f) => `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
const aFecha = (iso) => {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d);
};
const sumarDias = (iso, n) => {
    const f = aFecha(iso);
    f.setDate(f.getDate() + n);
    return diaLocal(f);
};

/**
 * ¿Es un día de verdad? Además del formato, que exista (no 31/02) y que el año tenga cuatro
 * cifras de este siglo: tipeando el año en el input, Chrome pasa por 0002, 0020 y 0202 antes de
 * 2026, y ninguno de esos es una fecha que alguien quiso elegir.
 */
export const esFecha = (v) => {
    const m = ISO.exec(v || '');
    if (!m) return false;
    const [a, mes, d] = m.slice(1).map(Number);
    if (a < 2000 || a > 2099) return false;
    const f = new Date(a, mes - 1, d);
    return f.getFullYear() === a && f.getMonth() === mes - 1 && f.getDate() === d;
};

/** El rango de la URL, en orden; `null` si le falta una punta. Un link con las fechas al revés
 *  se da vuelta (el backend hace lo mismo), así lo que dice la píldora es lo que se pidió. */
export const rangoDe = (desde, hasta) => {
    if (!esFecha(desde) || !esFecha(hasta)) return null;
    return desde <= hasta ? { desde, hasta } : { desde: hasta, hasta: desde };
};

/** "08/09 – 14/09", o "08/09" si es un solo día. El año va solo si alguna punta no es de este. */
export const textoRango = ({ desde, hasta }) => {
    const anio = String(new Date().getFullYear());
    const conAnio = desde.slice(0, 4) !== anio || hasta.slice(0, 4) !== anio;
    const corta = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}${conAnio ? `/${iso.slice(2, 4)}` : ''}`;
    return desde === hasta ? corta(desde) : `${corta(desde)} – ${corta(hasta)}`;
};

/** Del 1 del mes en curso a hoy. */
export const mesEnCurso = () => {
    const hoy = new Date();
    return { desde: diaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: diaLocal(hoy) };
};

/** Los mismos días, justo antes: con lo que arranca una comparación personalizada. */
export const rangoAnterior = ({ desde, hasta }) => {
    const dias = Math.round((aFecha(hasta) - aFecha(desde)) / 864e5) + 1;
    return { desde: sumarDias(desde, -dias), hasta: sumarDias(desde, -1) };
};

// Cuánto se espera después de la última tecla para pedir el rango. Tipeando "15" el input pasa
// por el 01: sin la espera se pedía (y se ordenaba) un rango que nadie eligió.
const ESPERA_MS = 600;

/**
 * Lo que vale es lo de la URL (`desde`/`hasta`); lo que se tipea es un borrador hasta que se
 * confirma: al salir del campo, con Enter o tras `ESPERA_MS` sin tocar nada (el calendario del
 * navegador elige sin sacar el foco, así que salir del campo no alcanzaba).
 *
 * El rango nunca queda al revés. Si "desde" pasa a "hasta", la otra punta se mueve hasta la que se
 * tocó y queda un solo día, a la vista en los dos campos y en la píldora: la fecha que se eligió
 * queda donde se la eligió, y correr el rango hacia adelante no exige tocar primero el final.
 *
 * Borrar una fecha también se confirma: el tablero pasa a pedir las dos, en vez de seguir
 * mostrando un rango que ya no es el que dicen los campos.
 */
const RangoFechas = ({ desde = '', hasta = '', onCambiar, rotulo = 'Rango' }) => {
    const [borrador, setBorrador] = useState({ desde, hasta });
    const borradorRef = useRef(borrador);
    const confirmado = useRef({ desde, hasta });
    const tocado = useRef('desde');
    const espera = useRef(null);
    const onCambiarRef = useRef(onCambiar);
    useEffect(() => { onCambiarRef.current = onCambiar; }, [onCambiar]);

    const ponerBorrador = useCallback((b) => {
        borradorRef.current = b;
        setBorrador(b);
    }, []);

    // La URL manda: si cambia por otro lado (el otro montaje del mazo, "atrás", un link), los
    // campos la siguen.
    useEffect(() => {
        confirmado.current = { desde, hasta };
        ponerBorrador({ desde, hasta });
    }, [desde, hasta, ponerBorrador]);

    const confirmar = useCallback((forzar, desmontando = false) => {
        clearTimeout(espera.current);
        espera.current = null;
        let { desde: d, hasta: h } = borradorRef.current;
        // A medio tipear no se pide nada; al salir del campo, lo que no es fecha cuenta como vacío.
        if (!forzar && !(esFecha(d) && esFecha(h))) return;
        if (!esFecha(d)) d = '';
        if (!esFecha(h)) h = '';
        if (d && h && d > h) {
            if (tocado.current === 'hasta') d = h;
            else h = d;
        }
        if (!desmontando && (d !== borradorRef.current.desde || h !== borradorRef.current.hasta)) {
            ponerBorrador({ desde: d, hasta: h });
        }
        if (d === confirmado.current.desde && h === confirmado.current.hasta) return;
        confirmado.current = { desde: d, hasta: h };
        onCambiarRef.current?.({ desde: d, hasta: h });
    }, [ponerBorrador]);

    // Si el menú se cierra con algo sin confirmar, se confirma igual: cerrar no es descartar. Se mira
    // el borrador y no la espera porque al hacer clic afuera el menú se desmonta antes de que el
    // campo pierda el foco, y un campo vaciado no deja nada esperando.
    useEffect(() => () => {
        const b = borradorRef.current;
        if (b.desde !== confirmado.current.desde || b.hasta !== confirmado.current.hasta) confirmar(true, true);
    }, [confirmar]);

    const cambiar = useCallback((campo, valor) => {
        tocado.current = campo;
        ponerBorrador({ ...borradorRef.current, [campo]: valor });
        clearTimeout(espera.current);
        espera.current = setTimeout(() => confirmar(false), ESPERA_MS);
    }, [confirmar, ponerBorrador]);
    const alSalir = useCallback(() => confirmar(true), [confirmar]);
    const conEnter = useCallback((e) => { if (e.key === 'Enter') confirmar(true); }, [confirmar]);

    // `max` con año de cuatro cifras: sin él, Chrome deja tipear años de seis.
    const comun = { type: 'date', className: 'rango-dia num', min: '2000-01-01', max: '2099-12-31',
        onBlur: alSalir, onKeyDown: conEnter };

    return (
        <div className="rango" role="group" aria-label={rotulo}>
            <input {...comun} aria-label={`${rotulo}: desde`} value={borrador.desde}
                onChange={(e) => cambiar('desde', e.target.value)} />
            <span className="rango-a" aria-hidden="true">–</span>
            <input {...comun} aria-label={`${rotulo}: hasta`} value={borrador.hasta}
                onChange={(e) => cambiar('hasta', e.target.value)} />
        </div>
    );
};

export default RangoFechas;
