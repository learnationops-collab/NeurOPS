import React from 'react';
import { RotateCcw, X } from 'lucide-react';
import './drill.css';

/**
 * El aviso de procedencia de una lista a la que se llegó pinchando un número.
 *
 * Es la mitad que faltaba del drill-down: la lista ya se filtraba, pero nada decía de qué número
 * venía el filtro ni cómo sacárselo. Muestra tres cosas:
 *
 *   1. de qué dato viene (`de`);
 *   2. con qué criterio se cortó, un chip por condición, cada uno con su X para quitarlo.
 *
 * Hubo un tercero: un párrafo de advertencia para las cifras que no se pueden cortar igual que
 * como se calcularon (el "por cobrar" del panel Cash atribuye por quién tiene HOY la agenda del
 * cliente y la cartera por quién VENDIÓ, así que los totales dan distinto). Se sacó por pedido
 * del usuario: eran cinco renglones de letra chica arriba de la lista, cada vez, y los chips del
 * criterio ya dicen por dónde se cortó. El texto no se perdió — sigue en el campo `aviso` de cada
 * destino en `destinos.js`, que es donde explica por qué ese número no cierra.
 */
const PanelDetalle = ({ de, criterios = [], cuantas, total, onQuitarCriterio, onLimpiar }) => {
    if (!de) return null;

    return (
        <div className="drill-aviso" role="status">
            <div className="drill-aviso-cuerpo">
                <p className="t-cap" style={{ fontWeight: 800 }}>
                    Viniste de <b>{de}</b>
                    {cuantas === 0
                        ? ' · ningún registro entra por ese criterio'
                        : ` · ${cuantas} de ${total} registros del período`}
                </p>

                {criterios.length > 0 && (
                    <div className="drill-aviso-criterios">
                        <span className="t-rotulo">Criterio</span>
                        {criterios.map(c => (
                            <button key={`${c.clave}-${c.valor}`} type="button" className="chip"
                                style={{ '--c': 'var(--brand-secondary)', textTransform: 'none',
                                    letterSpacing: 0, fontWeight: 700 }}
                                aria-label={`Quitar ${c.faceta}: ${c.valor}`}
                                onClick={() => onQuitarCriterio(c.clave, c.valor)}>
                                {c.faceta}: {c.valor}
                                <X size={12} />
                            </button>
                        ))}
                    </div>
                )}

                {criterios.length === 0 && (
                    <p className="t-cap mut40">
                        Sin condiciones: ese número se mide sobre todo el período, así que la lista
                        muestra el período completo y la tira de totales de arriba lo repite.
                    </p>
                )}

            </div>

            <button type="button" className="btn btn--linea btn--sm" onClick={onLimpiar}>
                <RotateCcw size={13} />
                Quitar el filtro
            </button>
        </div>
    );
};

export default PanelDetalle;
