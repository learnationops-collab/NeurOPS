import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

/**
 * Por qué no se guardó, dicho adentro del editor que falló.
 *
 * El único aviso de error de la ficha es el del cascarón, ARRIBA del panel, y el modal hace scroll
 * entero: en el historial, Pagos y Seguimientos quedan abajo, así que quien tocaba «Guardar
 * cambios» veía el spinner, el editor seguía igual y nada en pantalla le decía qué había pasado
 * —el choque de horario del closer al mover una agenda, un monto que el backend rechazó—. El
 * motivo va al lado del botón que se acaba de tocar.
 *
 * `role="alert"` porque aparece como respuesta a lo que la persona hizo, y tiene que enterarse
 * aunque no esté mirando ese rincón. Cada editor lo borra al volver a intentar o al cambiar un
 * campo: un motivo viejo al lado de datos nuevos diría algo que ya no es cierto.
 */
const MotivoDelFallo = ({ motivo }) => {
    const reducido = useReducedMotion();
    if (!motivo) return null;
    return (
        <motion.small className="t-cap fi-motivo" role="alert"
            {...(reducido ? {} : {
                initial: { opacity: 0, y: -4 },
                animate: { opacity: 1, y: 0 },
                transition: { duration: 0.18, ease: [0.22, 0.7, 0.2, 1] },
            })}>
            <AlertTriangle size={14} aria-hidden="true" />
            <span>{motivo}</span>
        </motion.small>
    );
};

export default MotivoDelFallo;
