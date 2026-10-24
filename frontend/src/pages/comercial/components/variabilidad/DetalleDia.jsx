import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { fmt } from '../Shared';
import { colorDePersona } from './Graficos';
import { diaConSemana, difDe, valorDe } from './formato';
import { nombreDia, porPersona } from './estadisticos';

/**
 * El día elegido, abierto: su valor contra lo normal y, con la capa Personas, quién lo explica.
 *
 * La lista de ese día (el drill-down de siempre) sigue a un clic: acá se responde la pregunta
 * anterior, «¿por qué fue distinto?». En lo que se suma cada persona trae cuánto se apartó de lo
 * suyo y qué parte del salto del equipo es de ella; en una tasa, su tasa contra la propia y cuánto
 * la sostiene (`pesos`), porque un 0% sobre una llamada no es un hundimiento.
 */
const DetalleDia = ({ serie, activa, dias, i, banda, pasados, conPersonas, irDia, onCerrar }) => {
    const reparto = useMemo(
        () => (conPersonas && activa.personas
            ? porPersona(activa.personas, activa.vals, pasados, i, serie) : null),
        [conPersonas, activa, pasados, i, serie],
    );
    const valor = activa.vals[i];
    const dif = valor - banda.media;
    const mayor = Math.max(...(reparto?.filas || []).map(f => Math.abs(f.desvio)), 1e-9);
    const lider = reparto?.filas.find(f => f.parte !== null && f.parte >= 0.4 && !f.otros);

    return (
        <div className="dia-det" role="group"
            aria-label={`Detalle del ${fmt.fechaLarga(dias[i])}`}>
            <div className="dia-det-cab">
                <b>{diaConSemana(dias[i], nombreDia(dias[i]))}</b>
                <span className="num dia-det-val">{valorDe(serie, valor)}</span>
                {banda.n > 0 && (
                    <span className="t-cap mut40 num">
                        {difDe(serie, dif)} contra la media de {valorDe(serie, banda.media)}
                    </span>
                )}
                <span className="dia-det-der">
                    {irDia && (
                        <button type="button" className="metrica-clic t-cap mut40"
                            onClick={() => irDia(dias[i])}>
                            <span className="metrica-clic-txt">ver la lista de ese día</span>
                        </button>
                    )}
                    <button type="button" className="ibtn ibtn--sm" aria-label="Cerrar el detalle"
                        onClick={onCerrar}><X /></button>
                </span>
            </div>

            {conPersonas && !reparto && (
                <p className="t-cap mut40">Sin reparto por persona para esta serie.</p>
            )}
            {reparto && (
                <>
                    {lider && reparto.salto !== null && (
                        <p className="t-cap dia-det-lider">
                            {lider.nombre} explica el {Math.round(lider.parte * 100)}% de
                            {reparto.salto > 0 ? ' la subida' : ' la caída'} del día.
                        </p>
                    )}
                    <ul className="dia-pers">
                        {reparto.filas.map((f) => {
                            const original = activa.personas.find(p => p.nombre === f.nombre);
                            const color = colorDePersona(original || {}, activa.personas.indexOf(original));
                            const sube = f.desvio >= 0;
                            return (
                                <li key={f.nombre} className={f.activa ? undefined : 'dia-pers--quieta'}>
                                    <i className="pers-punto" style={{ background: `var(--${color})` }} />
                                    <span className="pers-nom">{f.nombre}</span>
                                    <span className="pers-barra" aria-hidden="true">
                                        <i style={{ width: f.activa ? `${(Math.abs(f.desvio) / mayor) * 100}%` : 0,
                                            background: `var(--${sube ? 'success' : 'error'})` }} />
                                    </span>
                                    <span className="num pers-val">
                                        {valorDe(serie, f.valor)}
                                        {f.peso !== null && f.peso !== undefined && (
                                            <small className="mut40" title="Lo que sostiene la tasa ese día">
                                                {' '}de {fmt.num(f.peso)}
                                            </small>
                                        )}
                                    </span>
                                    <span className="num pers-dif mut40"
                                        title={`Lo suyo es ${valorDe(serie, f.habitual)}`}>
                                        {f.activa ? difDe(serie, f.desvio) : '—'}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </div>
    );
};

export default DetalleDia;
