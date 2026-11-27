// Las fichas de los archivos: miniatura si es imagen, ícono si es PDF o texto. `quitar` agrega la X (en el redactor).
import { FileText, X } from 'lucide-react';

export default function Adjuntos({ archivos, quitar }) {
    if (!archivos?.length) return null;
    return (
        <ul className="cp-adjuntos">
            {archivos.map((a) => {
                const f = typeof a === 'string' ? { id: a, nombre: a } : a;
                return (
                    <li key={f.id || f.nombre} className="cp-adjunto" data-tip={f.nombre}>
                        {f.url && f.tipo?.startsWith('image/') ? <img src={f.url} alt="" /> : <span className="cp-adjunto-ico"><FileText size={14} /></span>}
                        <span className="cp-adjunto-n">{f.nombre}</span>
                        {quitar && (
                            <button type="button" aria-label={`Quitar ${f.nombre}`} onClick={() => quitar(f.id)}><X size={11} /></button>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
