import React from 'react';
import { Gauge, Plus, X } from 'lucide-react';
import { IconButton, LinkButton, Segmented, Stepper } from '../../../../../components/standard';
import { PTS_MAX, maximoDe, pesoDe, ptsDe } from '../../lib/formularios';

// Cuánto suma cada pregunta al score (ver app/services/hiring_puntaje.py):
// los puntos de las opciones van en cada opción; acá la importancia y, en las
// numéricas, los tramos.

const IMPORTANCIA = [
    { value: 0, label: 'No suma' },
    { value: 1, label: '×1' },
    { value: 2, label: '×2' },
    { value: 3, label: '×3' },
];

/** Los puntos de una opción, 0 a 3. */
export const PtsOpcion = ({ o, onCambiar }) => (
    <Stepper value={ptsDe(o)} min={0} max={PTS_MAX} label="Puntos"
        display={`${ptsDe(o)} pts`} onChange={(pts) => onCambiar({ pts })} />
);

const Tramos = ({ q, onCambiar }) => {
    const tramos = q.tramos || [];
    const set = (j, cambio) => onCambiar({ tramos: tramos.map((t, k) => (k === j ? { ...t, ...cambio } : t)) });
    const ultimo = tramos.length ? tramos[tramos.length - 1].hasta : 0;
    const unidad = q.unidad ? ` ${q.unidad}` : '';
    return (
        <div className="tl-ed-tramos">
            {tramos.map((t, j) => (
                <div key={j} className="tl-ed-tramo">
                    <span>Hasta</span>
                    <input className="tl-input tl-input--sm" inputMode="numeric" aria-label={`Tramo ${j + 1}: hasta`}
                        value={t.hasta ?? ''} onChange={(e) => set(j, { hasta: Number(e.target.value.replace(/\D/g, '') || 0) })} />
                    <Stepper value={ptsDe(t)} min={0} max={PTS_MAX} label="Puntos"
                        display={`${ptsDe(t)} pts`} onChange={(pts) => set(j, { pts })} />
                    <IconButton size="sm" danger icon={<X size={14} />} label="Quitar tramo"
                        onClick={() => onCambiar({ tramos: tramos.filter((_, k) => k !== j) })} />
                </div>
            ))}
            <LinkButton icon={<Plus size={14} />} onClick={() => onCambiar({ tramos: [...tramos, { hasta: ultimo + 100, pts: 0 }] })}>
                Tramo
            </LinkButton>
            <small>{tramos.length ? `Más de ${ultimo}${unidad}: 0 pts. Se toma el primer tramo que alcanza.` : 'Sin tramos: el número no suma.'}</small>
        </div>
    );
};

const explicacion = (q, max) => {
    if (q.tipo === 'radio') return max ? `Suma los puntos de la opción elegida (máximo ${max}).` : 'Poné puntos en las opciones para que sume.';
    if (q.tipo === 'check') return max ? `Suma las marcadas, con tope de ${PTS_MAX} pts.` : 'Poné puntos en las opciones para que sume.';
    if (q.tipo === 'parrafo' || q.tipo === 'texto') return `Hasta ${PTS_MAX} pts según lo concreta que es: largo, cifras y hechos propios.`;
    if (q.tipo === 'link') return `${PTS_MAX} pts si lo carga.`;
    return null;
};

const PuntajePregunta = ({ q, onCambiar }) => {
    if (!['radio', 'check', 'numero', 'parrafo', 'texto', 'link'].includes(q.tipo) || q.mail) return null;
    const peso = pesoDe(q);
    const max = maximoDe(q);
    return (
        <div className={`tl-ed-puntaje${peso > 0 && max > 0 ? ' is-activo' : ''}`}>
            <div className="tl-ed-puntaje-cab">
                <span className="tl-ed-etq"><Gauge size={12} aria-hidden="true" /> Importancia en el score</span>
                <Segmented size="sm" value={peso} options={IMPORTANCIA} label="Importancia en el score"
                    onChange={(v) => onCambiar({ peso: v })} />
            </div>
            {q.tipo === 'numero' && peso > 0 && <Tramos q={q} onCambiar={onCambiar} />}
            {peso > 0 && explicacion(q, max) && <small>{explicacion(q, max)}</small>}
        </div>
    );
};

export default PuntajePregunta;
