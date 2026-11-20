// Anotar resaltando (ADR-W184): el setter selecciona parte de un mensaje del lead y aparece este globo. La cita va
// a «Notas para la venta» y a la ficha del lead (Comunicación), donde la ve el closer.
import { useEffect, useRef, useState } from 'react';
import { Highlighter } from 'lucide-react';
import { Button, Chip, InputGroup, toast } from '../../../components/standard';
import { inboxApi } from '../api';

const TIPOS = ['Dolor', 'Objeción', 'Motivación', 'Dato'];

/** Lo seleccionado dentro de un mensaje del lead: { texto, mensajeId, x, y } o null. */
export function seleccionDelLead() {
    const sel = window.getSelection();
    const texto = sel?.toString().trim();
    if (!texto || !sel.rangeCount) return null;
    const burbuja = sel.anchorNode?.parentElement?.closest('[data-mensaje]');
    if (!burbuja || burbuja.dataset.direccion !== 'entrante') return null;
    const caja = sel.getRangeAt(0).getBoundingClientRect();
    return { texto: texto.slice(0, 1000), mensajeId: Number(burbuja.dataset.mensaje), x: Math.min(caja.left, window.innerWidth - 330), y: caja.bottom + 8 };
}

export default function GloboCita({ contactoId, seleccion, onCerrar, onHecho }) {
    const [tipo, setTipo] = useState('Dolor');
    const [comentario, setComentario] = useState('');
    const [guardando, setGuardando] = useState(false);
    const caja = useRef(null);
    useEffect(() => {
        const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) onCerrar(); };
        const tecla = (e) => { if (e.key === 'Escape') onCerrar(); };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', tecla);
        return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
    }, [onCerrar]);

    const anotar = async (e) => {
        e?.preventDefault();
        setGuardando(true);
        try {
            await inboxApi.anotarCita(contactoId, { texto: seleccion.texto, tipo, comentario, mensaje_id: seleccion.mensajeId });
            window.getSelection()?.removeAllRanges();
            toast('Anotado: lo ve el closer en la ficha');
            onHecho();
        } catch (err) {
            toast(err.response?.data?.message || 'No se pudo anotar', 'error');
            setGuardando(false);
        }
    };
    return (
        <form ref={caja} className="cv-globo" style={{ left: seleccion.x, top: seleccion.y }} onSubmit={anotar} aria-label="Anotar para la venta">
            <blockquote>«{seleccion.texto}»</blockquote>
            <div className="cv-macro-chips">
                {TIPOS.map((t) => <Chip key={t} as="button" type="button" aria-pressed={tipo === t} color={tipo === t ? 'var(--warning)' : undefined} onClick={() => setTipo(t)}>{t}</Chip>)}
            </div>
            <InputGroup>
                <label className="sr" htmlFor="cv-cita-comentario">Comentario</label>
                <input id="cv-cita-comentario" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Para qué le sirve al closer (opcional)" autoComplete="off" />
            </InputGroup>
            <div className="barra">
                <Button onClick={onCerrar}>Cancelar</Button>
                <div className="barra-der"><Button type="submit" variant="primary" icon={<Highlighter />} disabled={guardando}>Anotar</Button></div>
            </div>
        </form>
    );
}
