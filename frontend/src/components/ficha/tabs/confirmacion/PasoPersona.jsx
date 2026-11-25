import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Avatar, Segmented } from '../../../standard';
import { useMovimiento } from '../../piezas';
import { CUALQUIERA, ciudad } from './reprogramar';

const SUAVE = [0.22, 0.7, 0.2, 1];

/** Paso 1: con quién queda la llamada. Primero el grupo (closers o triage) y después una persona o
 *  «Cualquiera» (se ofrecen los horarios de todo el grupo). */
const PasoPersona = ({ rol, onRol, personas, porPersona, actualId, elegida, onElegir, totalGrupo }) => {
    const mov = useMovimiento();
    const delGrupo = personas
        .filter((p) => p.rol === rol)
        .map((p) => ({ ...p, n: (porPersona[String(p.id)] || []).length }))
        .sort((a, b) => (b.id === actualId) - (a.id === actualId) || b.n - a.n);
    const actual = personas.find((p) => p.id === actualId);
    const entra = (i) => (mov.quieto ? {} : {
        initial: { opacity: 0, y: 10, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { duration: 0.3, ease: SUAVE, delay: i * 0.05 },
    });

    const tarjeta = (clave, i, contenido, n, deshabilitada) => (
        <motion.button key={clave} type="button" className="rp-persona" aria-pressed={elegida === clave}
            disabled={deshabilitada} onClick={() => onElegir(clave)} {...entra(i)}>
            {contenido}
            <span className="rp-persona-n"><b>{n}</b><small>{n === 1 ? 'horario' : 'horarios'}</small></span>
            <span className="rp-persona-check" aria-hidden="true"><Check size={14} /></span>
        </motion.button>
    );

    return (
        <div className="rp-paso">
            <div className="rp-grupo">
                <Segmented size="md" radio label="Grupo" value={rol} onChange={onRol}
                    options={[{ value: 'closer', label: 'Closers' }, { value: 'triage', label: 'Triage' }]} />
                {actual && <small className="t-cap mut">{`Hoy la tiene ${actual.nombre} (${actual.rol})`}</small>}
            </div>

            <div className="rp-personas">
                {tarjeta(CUALQUIERA, 0, (
                    <>
                        <span className="rp-pila" aria-hidden="true">
                            {delGrupo.slice(0, 3).map((p) => <Avatar key={p.id} name={p.nombre} size="sm" />)}
                        </span>
                        <span className="rp-persona-txt">
                            <b>Cualquiera</b>
                            <small>Los horarios de todo el grupo</small>
                        </span>
                    </>
                ), totalGrupo, totalGrupo === 0)}
                {delGrupo.map((p, i) => tarjeta(p.id, i + 1, (
                    <>
                        <Avatar name={p.nombre} size="md" />
                        <span className="rp-persona-txt">
                            <b>{p.nombre}</b>
                            <small>{p.id === actualId ? `La actual · ${ciudad(p.tz)}` : ciudad(p.tz)}</small>
                        </span>
                    </>
                ), p.n, p.n === 0))}
            </div>
        </div>
    );
};

export default PasoPersona;
