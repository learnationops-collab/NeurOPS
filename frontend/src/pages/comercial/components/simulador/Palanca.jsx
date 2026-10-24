import React from 'react';
import { X } from 'lucide-react';
import { Segmented } from '../Shared';
import Tip from '../Tip';
import { tocada } from './modelo';
import { textoDe } from './palancas';

const MODOS = [{ key: 'pct', label: '%' }, { key: 'abs', label: 'Valor' }];
const PCT_MIN = -50;
const PCT_MAX = 100;

/** Cuánto salta el control según la magnitud de la base: finos con números chicos. */
const pasoDe = (def, base) => {
    if (def.unidad === 'pct') return 0.5;
    if (def.unidad === 'num') return 1;
    if (def.unidad === 'money') return base >= 100 ? 5 : 0.5;
    return base >= 20 ? 1 : 0.1;
};

const redondear = (v, paso) => Math.round(v / paso) * paso;

/** Los topes del control deslizante: el rango de % o de 0 a 2 veces la base (tasas hasta 100%). */
const rangoDe = (def, modo, base) => {
    if (modo === 'pct') return [PCT_MIN, PCT_MAX];
    if (def.unidad === 'pct') return [0, 100];
    return [0, Math.max(base * 2, def.unidad === 'num' ? 4 : 1)];
};

/**
 * Una palanca: lo que vale en la base, cómo se mueve (porcentaje sobre la base o valor absoluto) y
 * lo que queda. Sin valor está «mantenida». El estado vive en el Simulador, por clave: `show_up` se
 * dibuja en dos embudos y los dos hablan con el mismo.
 */
const Palanca = ({ def, base, resultado, estado, onCambiar, onQuitar }) => {
    const modo = estado?.modo || 'pct';
    const movida = tocada(estado);
    const paso = pasoDe(def, base);
    const [min, max] = rangoDe(def, modo, base);
    const marca = modo === 'pct' ? 0 : base;
    const lugar = Math.max(0, Math.min(100, ((marca - min) / (max - min)) * 100));
    const valorRiel = movida ? Number(estado.valor) : marca;
    const sufijo = def.sufijo || '';
    const cambio = movida && base > 0 ? ((resultado - base) / base) * 100 : null;

    // Un 0% sobre la base es no tocarla.
    const poner = (valor) => onCambiar({ modo, valor: valor === '' || (modo === 'pct' && Number(valor) === 0) ? null : Number(valor) });
    // Cambiar de modo conserva el mismo punto: 10% sobre una base de 50 es un valor de 55.
    const elegirModo = (nuevo) => {
        if (nuevo === modo) return;
        if (!movida || !(base > 0)) {
            onCambiar({ modo: nuevo, valor: null });
        } else if (nuevo === 'abs') {
            onCambiar({ modo: 'abs', valor: Number(redondear(resultado, paso).toFixed(2)) });
        } else {
            onCambiar({ modo: 'pct', valor: Number(((resultado / base - 1) * 100).toFixed(1)) });
        }
    };

    return (
        <div className="palanca" data-tocada={movida ? '1' : '0'}>
            <div className="palanca-cab">
                <span className="t-rotulo">{def.label}</span>
                <Tip texto={def.tip} titulo={def.label} />
                <span className="palanca-v num" data-cambiada={movida ? '1' : '0'}>
                    {textoDe(def.unidad, resultado)}
                </span>
            </div>
            <p className="t-cap num pal-estado" data-tocada={movida ? '1' : '0'}>
                {movida
                    ? `Base ${textoDe(def.unidad, base)}${sufijo}${cambio !== null ? ` · ${cambio >= 0 ? '+' : ''}${cambio.toFixed(1)}%` : ''}`
                    : `Mantenida en ${textoDe(def.unidad, base)}${sufijo}`}
            </p>
            <div className="pal-ctl">
                <Segmented chico opciones={MODOS} valor={modo} onChange={elegirModo}
                    ariaLabel={`Cómo mover ${def.label}`} />
                <input type="number" className="pal-in" inputMode="decimal" step={paso}
                    aria-label={`${def.label}: ${modo === 'pct' ? 'cambio en %' : 'valor'}`}
                    placeholder={modo === 'pct' ? '0' : String(Number(base.toFixed(1)))}
                    value={movida ? estado.valor : ''} onChange={(e) => poner(e.target.value)} />
                <span className="pal-riel">
                    <input type="range" min={min} max={max} step={paso}
                        aria-label={`${def.label}: deslizar`}
                        value={Math.max(min, Math.min(max, valorRiel))}
                        onChange={(e) => poner(redondear(Number(e.target.value), paso).toFixed(2))} />
                    <i className="pal-base" style={{ left: `${lugar}%` }} aria-hidden="true" />
                </span>
                <button type="button" className="pal-x" disabled={!movida} onClick={onQuitar}
                    aria-label={`Volver ${def.label} a la base`} title="Volver a la base">
                    <X />
                </button>
            </div>
            {def.compartida && <p className="pal-comp">{def.compartida}</p>}
        </div>
    );
};

export default Palanca;
