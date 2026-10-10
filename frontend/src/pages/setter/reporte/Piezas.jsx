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

/** "Te responden" / "Responden poco": abrir más en dolor que en entrantes es que contestan. */
export const ChipRespuesta = ({ d }) => {
    if (d.ap_dolor > d.ap_entrantes) {
        return (
            <span className="rd-chip" style={{ '--c': 'var(--success)' }}>
                <Check strokeWidth={1.75} aria-hidden="true" /><span>Te responden</span>
            </span>
        );
    }
    if (d.ap_entrantes > d.ap_dolor) {
        return (
            <span className="rd-chip" style={{ '--c': 'var(--warning)' }}>
                <AlertTriangle strokeWidth={1.75} aria-hidden="true" /><span>Responden poco</span>
            </span>
        );
    }
    return null;
};
