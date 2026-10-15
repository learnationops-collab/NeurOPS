import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, UserPlus } from 'lucide-react';
import { contar } from './movimiento';
import { fmtInt, fmtPct } from './modelo';

/**
 * Piezas chicas del reporte: la cifra que cuenta hasta su valor, el chip de cada canal y el de un
 * aviso. Todas usan `--c` para el color, la convención del dashboard comercial.
 */

/**
 * Una cifra que va de lo que mostraba al valor nuevo. React deja escrito el valor final (así un
 * test o un lector de pantalla leen el número correcto) y el efecto lo cuenta encima.
 */
export const Numero = ({ valor, tipo, className, tag: Tag = 'b' }) => {
    const ref = useRef(null);
    useLayoutEffect(() => { contar(ref.current, valor, tipo); }, [valor, tipo]);
    const texto = tipo === 'pct' ? fmtPct(valor) : fmtInt(valor);
    return <Tag ref={ref} className={className}>{texto}</Tag>;
};

/** El chip con el nombre del canal: el color es el dato. */
export const ChipCanal = ({ canal }) => (
    <span className="rd-chip rd-chip--canal" style={{ '--c': canal.c }}>
        {canal.k === 'bienvenidas'
            ? <UserPlus strokeWidth={1.75} aria-hidden="true" />
            : <i className={`rd-punto${canal.mezcla ? ' mezcla' : ''}`} aria-hidden="true" />}
        {canal.n}
    </span>
);

/** Un aviso del reporte: rojo si bloquea el envío, ámbar si es para revisar. */
export const ChipAviso = ({ aviso }) => (
    <span className="rd-chip" role="status" title={aviso.msg}
        style={{ '--c': aviso.nivel === 'err' ? 'var(--error)' : 'var(--warning)' }}>
        <AlertTriangle strokeWidth={1.75} aria-hidden="true" />
        <span>{aviso.msg}</span>
    </span>
);

const consultaAngosta = '(max-width:700px)';
const esAngosta = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia(consultaAngosta).matches;

/**
 * ¿Pantalla de teléfono? Los embudos de cinco etapas acortan ahí sus bandas: dibujados con las de
 * escritorio, a 375px el SVG se achica tanto que los números no se leen.
 */
export const useAngosto = () => {
    const [angosto, setAngosto] = useState(esAngosta);
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
        const mq = window.matchMedia(consultaAngosta);
        const cambio = () => setAngosto(mq.matches);
        mq.addEventListener?.('change', cambio);
        return () => mq.removeEventListener?.('change', cambio);
    }, []);
    return angosto;
};

/**
 * El % de respuesta a las aperturas de una columna. Desde el 15/10/2026 se carga cuántos
 * respondieron; antes se adivinaba («Te responden» / «Responden poco») comparando las aperturas en
 * dolor con las de entrantes. Sin aperturas no se muestra.
 */
export const ChipRespuesta = ({ tasa: t }) => (t === null || t === undefined ? null : (
    <span className="rd-chip" style={{ '--c': 'var(--success)' }} title="Respondieron sobre las aperturas">
        <Check strokeWidth={1.75} aria-hidden="true" /><Numero valor={t} tipo="pct" /><span>respuesta</span>
    </span>
));
