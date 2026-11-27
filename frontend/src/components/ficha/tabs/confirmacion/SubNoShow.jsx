import React, { useState } from 'react';
import { SelectorFecha, SiNo, SubVista } from '../../piezas';
import { FieldError, TextArea } from '../../../standard';
import { faltaDeMotivo, motivoAlcanza, preguntaDeMotivo } from '../../../../utils/motivoEstado';

/**
 * El lead no apareció: no contestó la confirmación ni se presentó (ADR-W210). Queda «No Show», con su
 * motivo, y si se quiere la fecha para volver a escribirle (en «Sí» por defecto, como «Canceló»).
 */
const SubNoShow = ({ onVolver, onConfirmar, guardando = false }) => {
    const [motivo, setMotivo] = useState('');
    const [agendar, setAgendar] = useState(true);
    const [fecha, setFecha] = useState(null);
    const falta = faltaDeMotivo(motivo);
    const listo = motivoAlcanza(motivo) && (!agendar || !!fecha);

    return (
        <SubVista titulo="No show" onVolver={onVolver}
            acciones={(
                <button type="button" className="btn btn--cta" disabled={!listo || guardando}
                    onClick={() => onConfirmar({ motivo: motivo.trim(), fecha_seguimiento: agendar ? fecha : null })}>
                    {guardando ? 'Guardando…' : 'Registrar no show'}
                </button>
            )}>
            <div className="fi-campo">
                <small className="t-rotulo">{preguntaDeMotivo('No Show')}</small>
                <TextArea aria-label={preguntaDeMotivo('No Show')} rows={3} value={motivo} autoFocus
                    invalid={!!motivo && !!falta} placeholder="Ej.: le escribí 3 veces y lo llamé 2, no contestó nada"
                    onChange={(e) => setMotivo(e.target.value)} />
                {motivo && falta && <FieldError role="note" icon={false}>{falta}</FieldError>}
            </div>

            <div className="fi-campo" style={{ justifyItems: 'start' }}>
                <small className="t-rotulo">¿Le volvés a escribir más adelante?</small>
                <SiNo valor={agendar} onElegir={setAgendar} etiqueta="¿Le volvés a escribir más adelante?" />
            </div>

            {agendar && (
                <div style={{ maxWidth: 360 }}>
                    <SelectorFecha rotulo="Escribirle el" etiqueta="Escribirle el" valor={fecha} onChange={setFecha} />
                </div>
            )}
        </SubVista>
    );
};

export default SubNoShow;
