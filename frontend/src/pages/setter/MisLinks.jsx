import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Link2 } from 'lucide-react';
import api from '../../services/api';

// Tocar un link lo copia: es lo que el setter pega en WhatsApp o Instagram.
export const copiar = async (url) => {
    try { await navigator.clipboard.writeText(url); toast.success('Link copiado'); } catch { window.prompt('Copiá tu link:', url); }
};

/**
 * Los links de agendamiento del setter (Agendas 2.0, uno por evento de cada funnel de setting) a la vista
 * en el encabezado de su espacio, en cualquier sección: antes vivían solo en el menú del avatar y no los
 * encontraban (corrección del 14/10/2026). Tocar uno lo copia. Sin links, o si el pedido falla, no ocupa
 * nada: el menú del avatar los sigue teniendo, con los de los eventos viejos.
 */
const MisLinks = () => {
    const [links, setLinks] = useState([]);
    useEffect(() => {
        let vivo = true;
        api.get('/setter/agendas-links').then(
            (r) => { if (vivo) setLinks(Array.isArray(r?.data?.links) ? r.data.links : []); },
            () => {},
        );
        return () => { vivo = false; };
    }, []);
    if (!links.length) return null;
    return (
        <div className="setter-links" role="group" aria-label="Tus links de agendamiento">
            {links.map((l) => (
                <button key={l.ruta} type="button" className="pastilla pastilla--sm setter-link"
                    title={`Copiar tu link de ${l.funnel} · ${l.evento}`}
                    onClick={() => copiar(window.location.origin + l.ruta)}>
                    <Link2 size={14} />
                    <span className="setter-link-t">{links.length > 1 ? `${l.funnel} · ${l.evento}` : 'Tu link de agendamiento'}</span>
                    <Copy size={13} />
                </button>
            ))}
        </div>
    );
};

export default MisLinks;
