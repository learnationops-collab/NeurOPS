import React, { useState } from 'react';
import { DesplegableAgrupado, SelectorFecha, SubVista } from '../../piezas';
import { grupos } from '../../estadoFicha';

const SINO = [{ label: 'Sí', valor: true }, { label: 'No', valor: false }];

/**
 * El lead canceló la llamada.
 *
 * No es descartar. Descartar saca al lead del embudo —no calificaba, o se perdió—;
 * cancelar dice que ESTA cita no se hace y el lead puede seguir vivo. Por eso el
 * seguimiento viene en «Sí» por defecto: cancelar sin dejar cuándo retomar es como
 * se pierde un lead que todavía estaba.
 *
 * El motivo es obligatorio: «canceló» sin motivo no le sirve a nadie después.
 */
const SubCancelo = ({ ficha, onVolver, onConfirmar, guardando = false }) => {
    const [motivo, setMotivo] = useState(null);
    const [agendar, setAgendar] = useState(true);
    const [fecha, setFecha] = useState(null);
    const listas = grupos(ficha, 'motivos_cancelacion');

    const listo = !!motivo && (!agendar || !!fecha);

    return (
        <SubVista titulo="Canceló la llamada" onVolver={onVolver}
            acciones={(
                <button type="button" className="btn btn--cta" disabled={!listo || guardando}
                    onClick={() => onConfirmar({ motivo, fecha_seguimiento: agendar ? fecha : null })}>
                    {guardando ? 'Guardando…' : 'Registrar cancelación'}
                </button>
            )}>
            <p className="t-cap mut">
                La cita se cancela y se libera la agenda del closer. El lead sigue en el embudo.
            </p>

            <DesplegableAgrupado rotulo="¿Por qué canceló?" etiqueta="Motivo de la cancelación"
                placeholder="Elegí un motivo" grupos={listas}
                valor={motivo} onChange={setMotivo}
                onAgregar={() => {}} />

            <div className="fi-campo">
                <small className="t-rotulo">¿Agendás un seguimiento a futuro?</small>
                <div className="fila" style={{ gap: 'var(--s2)' }}>
                    {SINO.map(o => (
                        <button key={o.label} type="button" className="pastilla"
                            aria-pressed={agendar === o.valor}
                            style={agendar === o.valor
                                ? { borderColor: 'var(--brand-secondary)', background: 'var(--brand-secondary-surface)' }
                                : undefined}
                            onClick={() => setAgendar(o.valor)}>
                            {o.label}
                        </button>
                    ))}
                </div>
            </div>

            {agendar && (
                <div style={{ maxWidth: 360 }}>
                    <SelectorFecha rotulo="Contactar el" etiqueta="Contactar el"
                        valor={fecha} onChange={setFecha} />
                </div>
            )}
        </SubVista>
    );
};

export default SubCancelo;
