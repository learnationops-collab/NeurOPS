import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Link2 } from 'lucide-react';
import api from '../../services/api';

// Tocar un link lo copia: es lo que el setter pega en WhatsApp o Instagram.
export const copiar = async (url) => {
    try { await navigator.clipboard.writeText(url); toast.success('Link copiado'); } catch { window.prompt('Copiá tu link:', url); }
};

// Nombre de un link en la bandeja de entrada (menú del rayito).
export const rotuloDeLink = (l) => `${l.setter || l.funnel} · ${l.evento}`;

/**
 * Los links de agendamiento del setter (Agendas 2.0, uno por evento de cada funnel de setting) en el encabezado de
 * su espacio, en cualquier sección (14/10/2026). Desde el 26/11/2026 (Mario: menos texto) es un botón redondo
 * «Links»: al pasar el mouse dice qué es y al tocarlo abre la lista; tocar uno lo copia. Con un solo link, lo copia
 * directo. Sin links, o si el pedido falla, no ocupa nada: el menú del avatar los sigue teniendo.
 *
 * `children` va al final del grupo y se ve aunque no haya links: Turnos y Tálamus (Sales Team, 07/11/2026).
 */
export const BotonIcono = ({ icono: Icono, rotulo, tono, onClick, disabled, children, ...rest }) => (
    <button type="button" className={`setter-ico${tono ? ` setter-ico--${tono}` : ''}`} aria-label={rotulo} title={rotulo}
        disabled={disabled} onClick={onClick} {...rest}>
        <Icono size={16} aria-hidden="true" />
        <span className="setter-ico-t">{children || rotulo}</span>
    </button>
);

const MisLinks = ({ children }) => {
    const [links, setLinks] = useState([]);
    const [abierto, setAbierto] = useState(false);
    const caja = useRef(null);
    useEffect(() => {
        let vivo = true;
        api.get('/setter/agendas-links').then(
            (r) => { if (vivo) setLinks(Array.isArray(r?.data?.links) ? r.data.links : []); },
            () => {},
        );
        return () => { vivo = false; };
    }, []);
    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, [abierto]);
    if (!links.length && !children) return null;
    const tocar = () => (links.length === 1 ? copiar(window.location.origin + links[0].ruta) : setAbierto((a) => !a));
    return (
        <div className="setter-links" role="group" aria-label="Agendamiento">
            {links.length > 0 && (
                <div className="setter-links-caja" ref={caja}>
                    <BotonIcono icono={Link2} rotulo={links.length === 1 ? 'Copiar tu link de agendamiento' : 'Tus links de agendamiento'}
                        aria-expanded={links.length > 1 ? abierto : undefined} onClick={tocar}>Links</BotonIcono>
                    {abierto && (
                        <div className="setter-links-pop" role="menu">
                            {links.map((l) => (
                                <button key={l.ruta} type="button" role="menuitem" className="setter-links-op"
                                    onClick={() => { setAbierto(false); copiar(window.location.origin + l.ruta); }}>
                                    <Link2 size={13} aria-hidden="true" />{l.funnel} · {l.evento}<Copy size={12} aria-hidden="true" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {children}
        </div>
    );
};

export default MisLinks;
