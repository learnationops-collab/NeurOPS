import React from 'react';
import { ChevronDown, ChevronRight, Pencil, X } from 'lucide-react';
import usarPopover from './piezas/usarPopover';
import { opciones } from './estadoFicha';

/**
 * Cabecera de la ficha: una FRANJA, no un bloque de metadatos apilados.
 *
 * El nombre en h2 y al lado, separados por divisores de 1px, los cuatro datos que
 * se miran antes de hacer cualquier cosa. El de Closer no es texto: es el botón
 * para pasarle el lead a otro, que es la acción más frecuente sobre esta franja y
 * hoy vive escondida en el mazo.
 */
const Dato = ({ rotulo, valor, mono = false }) => (
    <>
        <div className="fi-dato">
            <small className="t-rotulo">{rotulo}</small>
            <span className={`t-sm trunc${mono ? ' num' : ''}`} style={{ fontWeight: 600 }}>
                {valor || '—'}
            </span>
        </div>
        <span className="fi-div" aria-hidden="true" />
    </>
);

const FichaHeader = ({ ficha, onAccion, onEditar = null, onCerrar, puedeEditar = true }) => {
    const { abierto, alternar, cerrar, caja } = usarPopover();
    const id = ficha?.identidad || {};
    const closerActual = id.closer?.nombre || null;
    const closers = opciones(ficha, 'closers');
    const puedeReasignar = ficha?.permisos?.reasignar !== false && puedeEditar && closers.length > 0;

    const llamada = id.llamada
        ? [id.llamada.fecha, id.llamada.hora].filter(Boolean).join(' · ')
        : null;
    // Ya vendido: el programa reemplaza al examen, que pasa a ser un dato de origen.
    const esCliente = !!id.programa;

    const pasarA = (closer) => {
        cerrar();
        if (closer.nombre === closerActual) return;
        onAccion?.('reasignar_closer', { closer_id: closer.id, closer: closer.nombre });
    };

    return (
        <div className="fi-cab">
            <div className="fi-cab-datos">
                <h2 className="t-h2 trunc" style={{ flexShrink: 0 }}>{id.nombre || 'Lead sin nombre'}</h2>
                <div className="fi-cab-datos">
                    <Dato rotulo={esCliente ? 'Programa' : 'Examen'} valor={esCliente ? id.programa : id.examen} />
                    <Dato rotulo={esCliente ? 'Ingresó' : 'Llamada'} valor={esCliente ? id.ingreso : llamada} />

                    <div className="fi-dato" ref={caja} style={{ position: 'relative' }}>
                        <small className="t-rotulo">Closer</small>
                        {puedeReasignar ? (
                            <>
                                <button type="button" className="fi-closer-btn"
                                    aria-haspopup="listbox" aria-expanded={abierto}
                                    onClick={alternar}>
                                    <span>{closerActual || 'Sin asignar'}</span>
                                    <span className="t-cap" style={{ color: 'var(--brand-secondary)', fontWeight: 700 }}>
                                        Pasar
                                    </span>
                                    <span className="mut" style={{ display: 'flex' }}>
                                        {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </span>
                                </button>
                                {abierto && (
                                    <div className="fi-pop" role="listbox" aria-label="Pasar el lead a"
                                        style={{ minWidth: 240, padding: 'var(--s2)', gap: 2,
                                            left: 'calc(-1 * var(--s3))' }}>
                                        <small className="t-rotulo" style={{ padding: 'var(--s2) var(--s3)' }}>
                                            Pasar el lead a
                                        </small>
                                        {closers.map(c => {
                                            const on = c.nombre === closerActual;
                                            return (
                                                <button key={c.id ?? c.nombre} type="button" className="fi-opcion"
                                                    role="option" aria-selected={on}
                                                    onClick={() => pasarA(c)}>
                                                    <span>{c.nombre}</span>
                                                    <span className="t-cap mut">{on ? 'Actual' : c.pista}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        ) : (
                            <span className="t-sm trunc" style={{ fontWeight: 600 }}>{closerActual || '—'}</span>
                        )}
                    </div>
                    <span className="fi-div" aria-hidden="true" />

                    <div className="fi-dato">
                        <small className="t-rotulo">Teléfono</small>
                        <span className="t-sm trunc num" style={{ fontWeight: 600 }}>{id.telefono || '—'}</span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--s2)', flexShrink: 0, marginLeft: 'auto' }}>
                {onEditar && (
                    <button type="button" className="ibtn" aria-label="Editar lead" onClick={onEditar}>
                        <Pencil size={16} />
                    </button>
                )}
                <button type="button" className="ibtn" aria-label="Cerrar" onClick={onCerrar}>
                    <X size={17} />
                </button>
            </div>
        </div>
    );
};

export default FichaHeader;
