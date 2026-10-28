import React from 'react';
import { Inbox } from 'lucide-react';
import { Chip } from '../../standard';

const conSigno = (n) => (n > 0 ? '+' : '') + n;
const tonoPuntos = (n) => (n > 0 ? 'var(--success)' : n < 0 ? 'var(--danger)' : 'var(--idle)');

// `puntos`: lo que esa respuesta suma o resta al segmento A/B/C/D (solo las preguntas que cuentan).
const Fila = ({ pregunta, respuesta, puntos }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr) auto',
        gap: 'var(--s4)', padding: 'var(--s3) 0', borderTop: '1px solid var(--border-subtle)' }}>
        <span className="t-sm mut">{pregunta}</span>
        <span className="t-sm" style={{ fontWeight: 600 }}>{respuesta || '—'}</span>
        <span>{puntos != null && (
            <Chip subtle color={tonoPuntos(puntos)} title="Puntos de esta respuesta para el segmento">
                {conSigno(puntos)} pts
            </Chip>
        )}</span>
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
    const conPuntos = respuestas.filter(r => r.puntos != null);
    const total = conPuntos.reduce((s, r) => s + r.puntos, 0);

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
                    <Fila key={r.clave ?? i} pregunta={r.pregunta} respuesta={r.respuesta} puntos={r.puntos} />
                ))}
                {conPuntos.length > 0 && (
                    <Fila pregunta="Segmento" puntos={total}
                        respuesta={`Suma de ${conPuntos.length} respuestas. A desde +4 · B +1 a +3 · C −1 a 0 · D −2 o menos`} />
                )}
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
