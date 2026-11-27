import React from 'react';
import { motion } from 'framer-motion';
import { Check, Shuffle } from 'lucide-react';
import { Avatar } from '../../../standard';
import { useMovimiento } from '../../piezas';
import Bandera from './Bandera';
import { CUALQUIERA, ciudad } from './reprogramar';

const SUAVE = [0.22, 0.7, 0.2, 1];

/** Paso 1: con quién queda la llamada (el grupo se elige en la cabecera): una persona o «Cualquiera» (los
 *  horarios de todo el grupo). Cada tarjeta: quién, de dónde (bandera) y cuántos horarios libres tiene. */
const PasoPersona = ({ rol, personas, porPersona, actualId, elegida, onElegir, totalGrupo, paisDe, colorDe }) => {
    const mov = useMovimiento();
    const delGrupo = personas
        .filter((p) => p.rol === rol)
        .map((p) => ({ ...p, n: (porPersona[String(p.id)] || []).length }))
        .sort((a, b) => (b.id === actualId) - (a.id === actualId) || b.n - a.n);
    const entra = (i) => (mov.quieto ? {} : {
        initial: { opacity: 0, y: 12, scale: 0.97 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { duration: 0.36, ease: SUAVE, delay: 0.04 + i * 0.06 },
    });

    const tarjeta = (clave, i, cara, nombre, pie, n) => (
        <motion.button key={clave} type="button" className="rp-persona" aria-pressed={elegida === clave}
            style={clave === CUALQUIERA ? undefined : { '--p': colorDe(clave) }}
            disabled={n === 0} onClick={() => onElegir(clave)} {...entra(i)}>
            {cara}
            <span className="rp-persona-txt">
                <b>{nombre}</b>
                {pie}
            </span>
            <span className="rp-persona-n" title={`${n} horarios libres`}>
                <b>{n}</b><small>libres</small>
            </span>
            <span className="rp-persona-check" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
        </motion.button>
    );

    return (
        <div className="rp-paso">

            <div className="rp-personas">
                {tarjeta(CUALQUIERA, 0, (
                    <span className="rp-pila" aria-hidden="true">
                        {delGrupo.length
                            ? delGrupo.slice(0, 3).map((p) => <Avatar key={p.id} name={p.nombre} size="sm" color={colorDe(p.id)} />)
                            : <Shuffle size={18} />}
                    </span>
                ), 'Cualquiera', <span className="rp-persona-pie"><Shuffle size={12} /> Todo el grupo</span>, totalGrupo)}
                {delGrupo.map((p, i) => tarjeta(p.id, i + 1,
                    <Avatar name={p.nombre} size="lg" color={colorDe(p.id)} />,
                    p.nombre,
                    <span className="rp-persona-pie">
                        <Bandera c={paisDe(p.tz)} titulo={ciudad(p.tz)} />
                        {ciudad(p.tz)}
                        {p.id === actualId && <em className="rp-actual">Actual</em>}
                    </span>,
                    p.n))}
            </div>
        </div>
    );
};

export default PasoPersona;
