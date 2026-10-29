import { Segmented } from '../../../comercial/components/Shared';

/**
 * Los controles que Marketing y Closing comparten en Segmentos (Kerwin, 28/10/2026), todos recordados por usuario por
 * la vista que los usa (`useEstadoGuardado`): por qué cortar cada segmento (closer, fuente, origen…), cómo verlo (una
 * tabla por grupo o el cruce grupo × segmento) y qué columnas mostrar.
 */
export const DISPOSICIONES = [
    { key: 'tablas', label: 'Tablas' },
    { key: 'cruce', label: 'Cruce' },
];

/** Sin elección guardada: un corte con pocos grupos se lee mejor en tablas; con muchos, en el cruce. */
export const disposicionDe = (guardada, corte, grupos) => (
    DISPOSICIONES.some((d) => d.key === guardada) ? guardada : (corte === 'ninguno' || grupos <= 3 ? 'tablas' : 'cruce')
);

export const AgruparPor = ({ cortes, valor, onChange }) => (
    <div className="sg-control">
        <span className="t-eyebrow mut">Agrupar por</span>
        <Segmented opciones={cortes} valor={valor} ariaLabel="Agrupar por" chico onChange={onChange} />
    </div>
);

export const VerComo = ({ valor, onChange }) => (
    <div className="sg-control">
        <span className="t-eyebrow mut">Ver como</span>
        <Segmented opciones={DISPOSICIONES} valor={valor} ariaLabel="Ver como" chico onChange={onChange} />
    </div>
);

/** Las columnas de las tablas: una cada una, al menos una a la vista. `ocultas` son las claves que se escondieron. */
export const Columnas = ({ columnas, ocultas, onChange }) => {
    const alternar = (key) => {
        const oculta = ocultas.includes(key);
        if (!oculta && columnas.length - ocultas.length <= 1) return;
        onChange(oculta ? ocultas.filter((k) => k !== key) : [...ocultas, key]);
    };
    return (
        <div className="sg-filtro" role="group" aria-label="Columnas a mostrar">
            <span className="t-eyebrow mut">Columnas</span>
            {columnas.map((c) => (
                <button key={c.key} type="button" className="chip sg-chip" aria-pressed={!ocultas.includes(c.key)}
                    style={{ '--c': 'var(--brand-secondary)' }} onClick={() => alternar(c.key)}>{c.label}</button>
            ))}
        </div>
    );
};
