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
 *   2. con qué criterio se cortó, un chip por condición, cada uno con su X para quitarlo;
 *   3. si el destino NO cierra exactamente con el número de arriba, la advertencia (`aviso`).
 *
 * El punto 3 existe porque hay cifras del tablero que no se pueden cortar igual que como se
 * calcularon —el "por cobrar" del panel Cash se atribuye por quién tiene HOY la agenda del
 * cliente y la cartera por quién VENDIÓ, por ejemplo—, y en esos casos la regla del proyecto es
 * decirlo en pantalla antes que ofrecer una lista que parezca cerrar y no cierre.
 */
const PanelDetalle = ({ de, aviso, criterios = [], cuantas, total, onQuitarCriterio, onLimpiar }) => {
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

                {aviso && <p className="t-cap drill-aviso-nota">⚠ {aviso}</p>}
            </div>

            <button type="button" className="btn btn--linea btn--sm" onClick={onLimpiar}>
                <RotateCcw size={13} />
                Quitar el filtro
            </button>
        </div>
    );
};

export default PanelDetalle;
