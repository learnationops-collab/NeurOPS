import React, { useEffect, useRef } from 'react';

/**
 * Cifra que sube hasta su valor conservando prefijo, separador de miles y decimales.
 *
 * Anima el TEXTO ya formateado y no el número: así "$7,108", "63.2%" y "—" pasan por la misma
 * pieza sin que el formato tenga una segunda copia acá. El conteo se escribe en el nodo desde el
 * efecto en vez de por estado porque son unos cincuenta cuadros por cifra y veinte cifras en
 * pantalla: re-renderizar el árbol mil veces para animar un texto no se paga.
 *
 * Vivía dentro de `Analizar.jsx`; sale a su archivo para que la tira de totales de Revisar cuente
 * igual que el dashboard.
 */

const QUIETO = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
const PARTES = /^([^0-9-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/;

const Cifra = ({ valor, className, style, tag: Tag = 'span' }) => {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        const destino = String(valor);
        if (!el || QUIETO) return undefined;
        const m = PARTES.exec(destino);
        if (!m) return undefined;
        const crudo = m[2].replace(/,/g, '');
        const fin = parseFloat(crudo);
        if (!Number.isFinite(fin)) return undefined;
        const dec = (crudo.split('.')[1] || '').length;
        const miles = m[2].includes(',');
        let id = 0;
        let t0 = 0;
        const paso = (t) => {
            if (!t0) t0 = t;
            const k = Math.min((t - t0) / 820, 1);
            const x = fin * (1 - (1 - k) ** 3);
            let txt = dec ? x.toFixed(dec) : String(Math.round(x));
            if (miles) {
                txt = Number(txt).toLocaleString('en-US',
                    { minimumFractionDigits: dec, maximumFractionDigits: dec });
            }
            el.textContent = m[1] + txt + m[3];
            if (k < 1) id = requestAnimationFrame(paso);
            else el.textContent = destino;
        };
        id = requestAnimationFrame(paso);
        return () => cancelAnimationFrame(id);
    }, [valor]);
    return <Tag ref={ref} className={className} style={style}>{valor}</Tag>;
};

export default Cifra;
