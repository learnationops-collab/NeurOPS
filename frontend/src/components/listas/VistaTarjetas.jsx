import React from 'react';
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
 */
const VistaTarjetas = ({ filas, clave, titulo, subtitulo, chips, campos, onAbrir }) => (
    <div className="tarjetas">
        {filas.map(fila => (
            <button key={clave(fila)} type="button" className="reg-tarjeta"
                aria-label={`Abrir ${titulo(fila)}`}
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
            </button>
        ))}
    </div>
);

export default VistaTarjetas;
