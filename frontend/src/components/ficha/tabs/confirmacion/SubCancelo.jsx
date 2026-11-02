import React, { useState } from 'react';
import { DesplegableAgrupado, SelectorFecha, SiNo, SubVista } from '../../piezas';
import { grupos } from '../../estadoFicha';
import { FieldError, TextArea } from '../../../standard';
import { faltaDeMotivo, motivoAlcanza, preguntaDeMotivo } from '../../../../utils/motivoEstado';

/**
 * El lead canceló la llamada.
 *
 * No es descartar. Descartar saca al lead del embudo —no calificaba, o se perdió—;
 * cancelar dice que ESTA cita no se hace y el lead puede seguir vivo. Por eso el
 * seguimiento viene en «Sí» por defecto: cancelar sin dejar cuándo retomar es como
 * se pierde un lead que todavía estaba.
 *
 * El motivo es obligatorio: «canceló» sin motivo no le sirve a nadie después. Se elige de la lista y se
 * cuenta con palabras propias (mínimo 10 caracteres, ADR-W065); las dos cosas quedan en el hilo del lead.
 */
const SubCancelo = ({ ficha, onVolver, onConfirmar, guardando = false }) => {
    const [motivo, setMotivo] = useState(null);
    const [detalle, setDetalle] = useState('');
    const [agendar, setAgendar] = useState(true);
    const [fecha, setFecha] = useState(null);
    const listas = grupos(ficha, 'motivos_cancelacion');

    const falta = faltaDeMotivo(detalle);
    const listo = !!motivo && motivoAlcanza(detalle) && (!agendar || !!fecha);

    return (
        <SubVista titulo="Canceló la llamada" onVolver={onVolver}
            acciones={(
                <button type="button" className="btn btn--cta" disabled={!listo || guardando}
                    onClick={() => onConfirmar({ motivo: `${motivo}. ${detalle.trim()}`, fecha_seguimiento: agendar ? fecha : null })}>
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
                <small className="t-rotulo">{preguntaDeMotivo('Cancelado')}</small>
                <TextArea aria-label={preguntaDeMotivo('Cancelado')} rows={3} value={detalle}
                    invalid={!!detalle && !!falta} placeholder="Qué dijo, qué pasó…"
                    onChange={(e) => setDetalle(e.target.value)} />
                {falta && <FieldError role="note" icon={false}>{falta}</FieldError>}
            </div>

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
