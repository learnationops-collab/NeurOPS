// La calificación de la conversación (26/11/2026): se elige la cara, se puede dejar una nota y se manda con «Enviar».
// Mandada, queda el aviso «Calificación enviada»; tocar «Cambiar» la vuelve a abrir.
import { useEffect, useState } from 'react';
import { Check, Frown, Meh, Send, Smile } from 'lucide-react';
import { Button, FieldError } from '../../components/standard';

const CARAS = [
    { valor: 'insatisfactoria', texto: 'Mal', icono: Frown, color: 'var(--error)' },
    { valor: 'regular', texto: 'Regular', icono: Meh, color: 'var(--warning)' },
    { valor: 'satisfactoria', texto: 'Bien', icono: Smile, color: 'var(--success)' },
];

export default function Calificar({ calificacion, calificar }) {
    const [elegida, setElegida] = useState(null);
    const [nota, setNota] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState(null);
    const [editando, setEditando] = useState(!calificacion);
    useEffect(() => { setEditando(!calificacion); setElegida(null); setNota(''); }, [calificacion]);

    if (!editando && calificacion) {
        const c = CARAS.find((x) => x.valor === calificacion) || CARAS[1];
        return (
            <div className="cp-calif cp-calif--lista" role="status" style={{ '--c': c.color }}>
                <span className="cp-calif-ok"><Check size={12} strokeWidth={3} aria-hidden="true" /></span>
                <c.icono size={14} aria-hidden="true" />
                <span>Calificación enviada</span>
                <button type="button" className="cp-calif-cambiar" onClick={() => setEditando(true)}>Cambiar</button>
            </div>
        );
    }
    const enviar = async () => {
        setEnviando(true);
        setError(null);
        const fallo = await calificar(elegida, nota);
        setEnviando(false);
        if (fallo) setError(fallo);
    };
    return (
        <div className="cp-calif" role="group" aria-label="Calificar la conversación">
            <span className="cp-calif-t">¿Cómo viene?</span>
            {CARAS.map(({ valor, texto, icono: Icono, color }) => (
                <button key={valor} type="button" className="cp-calif-cara" aria-pressed={elegida === valor} style={{ '--c': color }}
                    data-tip={texto} aria-label={texto} onClick={() => setElegida((e) => (e === valor ? null : valor))}>
                    <Icono size={16} aria-hidden="true" />
                </button>
            ))}
            {elegida && (
                <>
                    <input className="cp-calif-nota" value={nota} maxLength={500} placeholder="¿Qué pasó? (opcional)" aria-label="Nota de la calificación"
                        onChange={(e) => setNota(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviar()} />
                    <Button size="sm" variant="primary" icon={<Send size={12} />} onClick={enviar} disabled={enviando}>Enviar</Button>
                </>
            )}
            {error && <FieldError>{error}</FieldError>}
        </div>
    );
}
