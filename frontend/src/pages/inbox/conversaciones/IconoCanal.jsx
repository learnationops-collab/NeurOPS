// De qué red es la conversación: Instagram o WhatsApp (contactos `wa:`). Solo el ícono, con su tooltip.
import { Instagram } from 'lucide-react';
import { esWhatsapp } from './colas';

// El globo de WhatsApp en trazo, como los íconos de lucide (que no lo trae).
function Whatsapp({ size }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
            <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
        </svg>
    );
}

export default function IconoCanal({ c, size = 12 }) {
    const wa = esWhatsapp(c);
    return (
        <span className={`cv-canal cv-canal--${wa ? 'wa' : 'ig'}`} data-tip={wa ? 'WhatsApp' : 'Instagram'} aria-label={wa ? 'WhatsApp' : 'Instagram'}>
            {wa ? <Whatsapp size={size} /> : <Instagram size={size} aria-hidden="true" />}
        </span>
    );
}
