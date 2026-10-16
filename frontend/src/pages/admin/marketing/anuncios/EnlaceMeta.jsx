import { ExternalLink } from 'lucide-react';
import { marcarIdaAMeta } from './enlacesMeta';

/**
 * Un enlace que abre el Administrador de anuncios de Meta en otra pestaña (ver `enlacesMeta.js`). Lleva
 * siempre el ícono de «sale de la app», para que no se confunda con los botones que llevan a la
 * pestaña Meta Ads de acá (clasificar, conectar). Abrirlo marca la ida: al volver, la pantalla trae lo
 * que se haya cambiado allá. Sin `href` (falta la cuenta), no se dibuja.
 */
const EnlaceMeta = ({ href, children, className = 'btn btn--linea btn--sm', titulo, rotulo }) => {
    if (!href) return null;
    return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={`mk-enlace-meta ${className}`}
            onClick={marcarIdaAMeta} onAuxClick={marcarIdaAMeta}
            title={titulo || 'Abre el Administrador de anuncios de Meta en otra pestaña'}
            aria-label={rotulo}>
            {children}
            <ExternalLink aria-hidden="true" />
        </a>
    );
};

export default EnlaceMeta;
