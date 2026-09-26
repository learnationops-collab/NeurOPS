import React from 'react';
import { Inbox } from 'lucide-react';

const Fila = ({ pregunta, respuesta }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)',
        gap: 'var(--s4)', padding: 'var(--s3) 0', borderTop: '1px solid var(--border-subtle)' }}>
        <span className="t-sm mut">{pregunta}</span>
        <span className="t-sm" style={{ fontWeight: 600 }}>{respuesta || '—'}</span>
    </div>
);

/**
 * Formulario de origen del lead, solo lectura.
 *
 * Es el contexto con el que el closer entra a la llamada, no un formulario para
 * editar: lo que el lead contestó en el setting o en el workshop no se corrige
 * desde acá. Pregunta en gris, respuesta en negrita, una fila por par.
 */
const TabFormulario = ({ ficha }) => {
    const form = ficha?.formulario || {};
    const respuestas = form.respuestas || [];
    const encuesta = form.encuesta || [];

    if (!respuestas.length && !encuesta.length) {
        return (
            <div className="vacio-grande">
                <span className="vacio-icono"><Inbox /></span>
                <p className="t-h3">Sin formulario</p>
                <p className="t-sm mut">
                    Este lead no llegó por un formulario, o el que completó no quedó guardado.
                </p>
            </div>
        );
    }

    return (
        <div style={{ display: 'grid', gap: 'var(--s6)' }}>
            <div>
                {form.fuente_form && (
                    <div className="fila" style={{ gap: 'var(--s2)', marginBottom: 'var(--s3)' }}>
                        <small className="t-rotulo">Formulario de origen</small>
                        <span className="chip" style={{ '--c': 'var(--info)' }}>{form.fuente_form}</span>
                    </div>
                )}
                {respuestas.map((r, i) => (
                    <Fila key={r.clave ?? i} pregunta={r.pregunta} respuesta={r.respuesta} />
                ))}
            </div>

            {encuesta.length > 0 && (
                <div>
                    <small className="t-rotulo" style={{ display: 'block', marginBottom: 'var(--s3)' }}>
                        Encuesta posterior
                    </small>
                    {encuesta.map((r, i) => (
                        <Fila key={i} pregunta={r.pregunta} respuesta={r.respuesta} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default TabFormulario;
