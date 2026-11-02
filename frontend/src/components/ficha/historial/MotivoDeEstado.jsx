import React, { useId, useState } from 'react';
import { Button, FieldError, TextArea } from '../../standard';
import { faltaDeMotivo, preguntaDeMotivo } from '../../../utils/motivoEstado';
import { mensajeDeError } from '../fichaApi';
import MotivoDelFallo from './MotivoDelFallo';

/**
 * El motivo de corregir a mano una agenda a «Reagendado», «No Show» o «Cancelado» (ADR-W065), debajo
 * de su fila en «Agendas». Corregir el estado no lo cuenta nadie más: sin esto el hilo del lead no
 * dice por qué quedó así. El texto va al backend junto al estado y queda como nota en Comunicación.
 *
 * El botón de guardar sigue apagado hasta que el texto alcanza (10 caracteres sin espacios sobrantes);
 * el backend lo vuelve a comprobar.
 */
const MotivoDeEstado = ({ estado, etiqueta, onConfirmar, onCancelar }) => {
    const id = useId();
    const [texto, setTexto] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState(null);
    const pregunta = preguntaDeMotivo(estado);
    const falta = faltaDeMotivo(texto);

    const guardar = async () => {
        if (falta || guardando) return;
        setGuardando(true);
        setError(null);
        try {
            await onConfirmar(texto.trim());
        } catch (err) {
            // El motivo va al lado del botón: el aviso del cascarón queda arriba, fuera de la vista.
            setError(mensajeDeError(err));
            setGuardando(false);
        }
    };

    return (
        <div className="fi-agenda-editor" role="group" aria-label={`${pregunta} ${etiqueta}`}
            onKeyDown={(e) => {
                if (e.key === 'Escape') {
                    // Cierra ESTE editor y nada más: el cascarón escucha Escape para cerrar la ficha.
                    e.stopPropagation();
                    onCancelar();
                }
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) guardar();
            }}>
            <div className="fi-campo">
                <div className="fi-campo-cab">
                    <label className="t-rotulo" htmlFor={`${id}-motivo`}>{pregunta}</label>
                    <small className="t-cap mut">Queda en Comunicación</small>
                </div>
                <TextArea id={`${id}-motivo`} rows={3} autoFocus value={texto} disabled={guardando}
                    invalid={!!texto && !!falta} placeholder="Lo que pasó, con tus palabras"
                    onChange={(e) => { setTexto(e.target.value); setError(null); }} />
                {falta && <FieldError role="note" icon={false}>{falta}</FieldError>}
            </div>

            <MotivoDelFallo motivo={error} />

            <div className="fi-agenda-pie">
                <Button disabled={guardando} onClick={onCancelar}>Cancelar</Button>
                <Button variant="primary" disabled={guardando || !!falta} onClick={guardar}>
                    {guardando ? 'Guardando…' : `Guardar como ${etiqueta}`}
                </Button>
            </div>
        </div>
    );
};

export default MotivoDeEstado;
