import React, { useState } from 'react';
import { DesplegableAgrupado, SelectorFecha, SubVista } from '../../piezas';

const HORAS_POR_DEFECTO = ['09:00', '11:00', '14:00', '16:00', '18:00', '20:00', '21:00'];

/**
 * Reprogramar la llamada: fecha nueva y hora, nada más.
 *
 * El motivo NO se pide acá: el que reprograma ya lo escribió en «Cómo viene»
 * («Pidió reprogramar») o en la nota, y pedirlo dos veces hace que la segunda vez
 * se llene con cualquier cosa.
 */
const SubReprogramar = ({ ficha, onVolver, onConfirmar, guardando = false }) => {
    const [fecha, setFecha] = useState(null);
    const [hora, setHora] = useState(ficha?.identidad?.llamada?.hora || null);
    const horas = ficha?.vocabulario?.horas_agenda?.length
        ? ficha.vocabulario.horas_agenda
        : HORAS_POR_DEFECTO;

    return (
        <SubVista titulo="Reprogramar llamada" onVolver={onVolver}
            acciones={(
                <button type="button" className="btn btn--cta"
                    disabled={!fecha || !hora || guardando}
                    onClick={() => onConfirmar({ fecha, hora })}>
                    {guardando ? 'Reprogramando…' : 'Reprogramar'}
                </button>
            )}>
            <div className="grid-2">
                <SelectorFecha rotulo="Nueva fecha" etiqueta="Nueva fecha"
                    valor={fecha} onChange={setFecha} />
                <DesplegableAgrupado rotulo="Hora" etiqueta="Hora"
                    placeholder="Elegí la hora"
                    grupos={[{ titulo: 'Horarios', tono: 'info', opciones: horas }]}
                    valor={hora} onChange={setHora} />
            </div>
        </SubVista>
    );
};

export default SubReprogramar;
