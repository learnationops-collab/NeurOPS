import React, { useEffect, useRef } from 'react';

/**
 * Cifra que sube hasta su valor conservando prefijo, separador de miles y decimales.
 *
 * Anima el TEXTO ya formateado y no el número: así "$7,108", "63.2%" y "—" pasan por la misma
 * pieza sin que el formato tenga una segunda copia acá. El conteo se escribe en el nodo desde el
 * efecto en vez de por estado porque son unos cincuenta cuadros por cifra y veinte cifras en
 * pantalla: re-renderizar el árbol mil veces para animar un texto no se paga.
 *
 * El render deja siempre el valor final y el efecto solo escribe dentro de los cuadros, nunca en
 * el momento: sin animación (movimiento reducido, pestaña oculta, tests) se lee el número correcto
 * desde el primer momento.
 *
 * Vivía dentro de `Analizar.jsx`; salió a su archivo cuando la tira de totales de Revisar la
 * necesitó (30/09/2026). Allá cada cifra sube desde 0 al llegar los datos. `desdeAnterior` es lo
 * que pidió la tira: cuando cambia el filtro, el número va del que se estaba viendo al nuevo (y si
 * cambia a mitad de un conteo, sigue desde donde iba), que es lo que hace visible que la tira
 * sigue al filtro.
 */

const PARTES = /^([^0-9-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/;

/**
 * Se pregunta en cada conteo y no una vez al cargar el módulo: quien activa "reducir movimiento"
 * con la pantalla abierta deja de ver animaciones sin recargar.
 */
export const movimientoReducido = () => typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const Cifra = ({ valor, className, style, tag: Tag = 'span', desdeAnterior = false, duracion = 820 }) => {
    const ref = useRef(null);
    // El último número que mostró el nodo, también a mitad de un conteo: de ahí arranca el
    // siguiente cuando `desdeAnterior`. `null` si lo último no era un número ("—").
    const ultimo = useRef(null);
    useEffect(() => {
        const el = ref.current;
        const destino = String(valor);
        const m = PARTES.exec(destino);
        const crudo = m ? m[2].replace(/,/g, '') : '';
        const fin = parseFloat(crudo);
        if (!el || !m || !Number.isFinite(fin)) {
            ultimo.current = null;
            return undefined;
        }
        const desde = desdeAnterior && ultimo.current !== null ? ultimo.current : 0;
        if (movimientoReducido() || (desdeAnterior && desde === fin)) {
            ultimo.current = fin;
            return undefined;
        }
        const dec = (crudo.split('.')[1] || '').length;
        // Bajar de "$1,450" a "$900" pasa por montos de cuatro cifras: llevan su coma aunque el
        // destino no la tenga.
        const miles = m[2].includes(',') || Math.abs(desde) >= 1000;
        let id = 0;
        // `null` y no 0: un cuadro puede llegar con la marca de tiempo 0.
        let t0 = null;
        const paso = (t) => {
            if (t0 === null) t0 = t;
            const k = Math.min((t - t0) / duracion, 1);
            const x = desde + (fin - desde) * (1 - (1 - k) ** 3);
            ultimo.current = x;
            let txt = dec ? x.toFixed(dec) : String(Math.round(x));
            if (miles) {
                txt = Number(txt).toLocaleString('en-US',
                    { minimumFractionDigits: dec, maximumFractionDigits: dec });
            }
            el.textContent = m[1] + txt + m[3];
            if (k < 1) {
                id = requestAnimationFrame(paso);
            } else {
                el.textContent = destino;
                ultimo.current = fin;
            }
        };
        id = requestAnimationFrame(paso);
        // Solo se corta el conteo: si el valor cambió, React ya escribió el nuevo antes de esta
        // limpieza, y `ultimo` queda donde iba para que el próximo siga desde ahí.
        return () => cancelAnimationFrame(id);
        // `desdeAnterior` y `duracion` son de la pieza, no del dato: cambiarlos no reinicia nada.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [valor]);
    return <Tag ref={ref} className={className} style={style}>{valor}</Tag>;
};

export default Cifra;
