import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { escalonDe } from '../huesos/Huesos';
import './listas.css';

/**
 * Cada registro como una tarjeta con toda su información junta.
 *
 * En la tabla, leer una fila es cruzar la vista con los encabezados de arriba; en una tarjeta cada
 * dato viene con su rótulo al lado. Sirve para lo contrario que la tabla: la tabla es para comparar
 * muchas filas por una columna, la tarjeta para entender una.
 *
 * `campos` es la lista de pares `{ rotulo, valor }` que arma quien la usa —así la tarjeta no sabe
 * nada del dominio— y `chips` lo que va arriba a la derecha. Una tarjeta entera es el botón que
 * abre la ficha del lead: se sigue llamando al mismo `onAbrir` que la fila de la tabla.
 *
 * El rótulo va en `<small>` y no en un `<span>` con `tracking-*`: hay un CSS global con
 * `!important` que anula el tracking y el peso extra en `span`, `div` y `button`, y estos rótulos
 * son justamente de los que necesitan tracking fuerte.
 *
 * ## La entrada de cada tarjeta
 *
 * Cada tarjeta entra por su cuenta, escalonada: la lista se arma a la vista en vez de aparecer
 * entera de golpe. `desde` es dónde arranca la página que está entrando, así que el escalonado se
 * cuenta DENTRO de esa página y no sobre el índice global — si no, con scroll infinito la tarjeta
 * 300 tendría que esperar el escalonado de las 299 anteriores. Sin `AnimatePresence`, por lo mismo
 * que en `ListaAgrupable`: se anima la entrada, no la salida.
 */
const VistaTarjetas = ({ filas, clave, titulo, subtitulo, chips, campos, onAbrir, desde = 0 }) => {
    const quieto = useReducedMotion();
    return (
    <div className="tarjetas">
        {filas.map((fila, i) => (
            <motion.button key={clave(fila)} type="button" className="reg-tarjeta"
                aria-label={`Abrir ${titulo(fila)}`}
                initial={quieto ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={quieto
                    ? { duration: 0 }
                    : { duration: .22, ease: 'easeOut', delay: escalonDe(i - desde) / 1000 }}
                onClick={() => onAbrir(fila)}>
                <span className="reg-tarjeta-cab">
                    <span className="reg-tarjeta-nom">
                        <b>{titulo(fila)}</b>
                        {subtitulo(fila) && <span className="t-cap mut40">{subtitulo(fila)}</span>}
                    </span>
                    <span className="reg-tarjeta-chips">{chips(fila)}</span>
                </span>
                <span className="reg-tarjeta-datos">
                    {campos(fila).map(campo => (
                        <span key={campo.rotulo} className="reg-dato">
                            <small>{campo.rotulo}</small>
                            <span style={campo.color ? { color: campo.color } : undefined}>
                                {campo.valor}
                            </span>
                        </span>
                    ))}
                </span>
            </motion.button>
        ))}
    </div>
    );
};

export default VistaTarjetas;
