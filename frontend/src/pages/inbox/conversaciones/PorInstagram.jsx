// El seguimiento por Instagram con un toque (ADR-W286). Pasadas 24 h del último mensaje del lead Work no puede
// escribirle hasta que Meta apruebe Human Agent; desde la app de Instagram sí. Un toque copia el texto, abre el chat
// de ese lead en Instagram y deja anotado quién lo abrió: cuando el mensaje sale, Work lo marca solo como seguimiento
// y a su nombre. «Siguiente» pasa a la conversación de abajo en la lista (la del filtro que esté puesto).
import { useState } from 'react';
import { ChevronsRight, Instagram } from 'lucide-react';
import { Button, toast } from '../../../components/standard';
import { inboxApi } from '../api';
import { linkInstagram } from './ventana';

export const siguienteConversacion = () => window.dispatchEvent(new Event('cv:siguiente'));

export default function PorInstagram({ contacto, texto, compacto = false }) {
    const [abierto, setAbierto] = useState(false);
    const link = linkInstagram(contacto);
    if (!link) return null;
    const limpio = (texto || '').trim();
    const abrir = () => {
        // Todo en el mismo toque: el navegador solo deja copiar y abrir otra pestaña si viene de un clic.
        if (limpio) navigator.clipboard?.writeText(limpio).catch(() => {});
        window.open(link, '_blank', 'noopener,noreferrer');
        setAbierto(true);
        inboxApi.abrirEnInstagram(contacto.id, limpio).catch(() => {});
        toast(limpio ? 'Texto copiado: pegalo en Instagram y mandalo. Queda marcado como seguimiento.' : 'Mandalo en Instagram: queda marcado como seguimiento.');
    };
    return (
        <span className={`cv-porig${compacto ? ' cv-porig--compacto' : ''}`}>
            <Button size="xs" variant="primary" icon={<Instagram />} onClick={abrir}
                data-tip={limpio ? 'Seguimiento por Instagram|Copia el texto y abre su chat en Instagram' : 'Seguimiento por Instagram|Abre su chat en Instagram'}>
                {limpio ? 'Copiar y abrir Instagram' : 'Abrir Instagram'}
            </Button>
            {abierto && (
                <Button size="xs" icon={<ChevronsRight />} onClick={siguienteConversacion} data-tip="Siguiente|La conversación de abajo en la lista">
                    Siguiente
                </Button>
            )}
        </span>
    );
}
