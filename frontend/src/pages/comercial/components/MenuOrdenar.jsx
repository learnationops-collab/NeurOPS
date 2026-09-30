import React from 'react';
import { ArrowDownUp, ChevronDown } from 'lucide-react';

/**
 * "Ordenar" de la barra de Revisar: el mismo orden que los encabezados de la tabla, pero también
 * para las tarjetas y para el celular, donde el encabezado no se ve.
 *
 * Elegir la columna que ya ordena invierte la dirección; "Orden de la tabla" vuelve al del backend.
 * El estado del orden y del menú abierto viven en `Revisar` (un solo menú abierto por vez, que se
 * cierra al clickear afuera de la barra): acá solo se dibuja y se avisa qué se eligió.
 */
const MenuOrdenar = ({ ordenables, orden, abierto, onAlternar, onElegir }) => {
    if (!ordenables.length) return null;
    const activa = ordenables.find(c => c.key === orden?.key) || null;

    return (
        <div style={{ position: 'relative' }}>
            <button type="button" className={`pastilla${activa ? ' pastilla--on' : ''}`}
                aria-expanded={abierto} aria-haspopup="menu" onClick={onAlternar}>
                <ArrowDownUp size={15} />
                {activa ? `${activa.ordenLabel || activa.header} ${orden.dir === 'desc' ? '↓' : '↑'}` : 'Ordenar'}
                <ChevronDown size={14} />
            </button>
            {abierto && (
                <div className="menu" role="menu" aria-label="Ordenar por">
                    <button type="button" className="menu-item" role="menuitemradio" aria-checked={!activa}
                        onClick={() => onElegir(null)}>
                        <span className="trunc">Orden de la tabla</span>
                    </button>
                    {ordenables.map(c => (
                        <button key={c.key} type="button" className="menu-item" role="menuitemradio"
                            aria-checked={activa?.key === c.key} onClick={() => onElegir(c)}>
                            <span className="trunc">{c.ordenLabel || c.header}</span>
                            {activa?.key === c.key && (
                                <span className="cuenta">{orden.dir === 'desc' ? 'mayor a menor' : 'menor a mayor'}</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MenuOrdenar;
