import { useState } from 'react';

/**
 * La miniatura del creativo del anuncio; tocarla abre la publicación en Instagram (09/11/2026). La URL
 * de Meta vence: si no carga, deja el hueco para que la fila no se corra hasta la próxima sincronización.
 */
const MiniaturaAnuncio = ({ src, href, nombre }) => {
    const [rota, setRota] = useState(false);
    if (!src || rota) return <span className="mk-miniatura mk-miniatura--vacia" aria-hidden="true" />;
    const imagen = <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setRota(true)} />;
    if (!href) return <span className="mk-miniatura">{imagen}</span>;
    return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="mk-miniatura"
            title="Ver la publicación en Instagram" aria-label={`Ver en Instagram el anuncio ${nombre}`}>
            {imagen}
        </a>
    );
};

export default MiniaturaAnuncio;
