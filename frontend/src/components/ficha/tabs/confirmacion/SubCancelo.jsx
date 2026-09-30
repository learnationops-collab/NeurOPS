import React, { useState } from 'react';
import { DesplegableAgrupado, SelectorFecha, SiNo, SubVista } from '../../piezas';
import { grupos } from '../../estadoFicha';

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

            {/* El mismo sí/no segmentado que «Dar de baja»: es la misma pregunta. `start` para
                que la grilla del campo no estire el control a todo el ancho. */}
            <div className="fi-campo" style={{ justifyItems: 'start' }}>
                <small className="t-rotulo">¿Agendás un seguimiento a futuro?</small>
                <SiNo valor={agendar} onElegir={setAgendar} etiqueta="¿Agendás un seguimiento a futuro?" />
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
