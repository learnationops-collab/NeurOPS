import React from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink } from 'lucide-react';

// Convierte un link de Loom (share o embed) en su URL embebible. Si el link no matchea el
// formato de Loom (p.ej. alguien pegó otra cosa por error), devuelve null y se cae al link
// externo en vez de romper el modal con un iframe vacío.
export const getLoomEmbedUrl = (url) => {
    if (!url) return null;
    const match = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/i);
    return match ? `https://www.loom.com/embed/${match[1]}` : null;
};

// Reproduce un Loom incrustado sin sacar a quien lo mira de la sesión. Se deja siempre el
// link externo como respaldo — tanto si el embed falla como si prefiere verlo a pantalla
// completa en loom.com (a veces el embed tarda más en cargar que loom.com directo).
// Compartido entre BugReportsPanel (reportes) y BugReportThread (mensajes del hilo) — antes
// vivía duplicado solo en BugReportsPanel.
const LoomModal = ({ url, onClose }) => {
    const embedUrl = getLoomEmbedUrl(url);
    // Portal a document.body (mismo patrón que FixIssueModal/LeadEditModal): algunas páginas
    // envuelven sus rutas en un contenedor con transform para animaciones de transición, y eso
    // convierte a ese contenedor en el "containing block" de cualquier descendiente `fixed` —
    // sin el portal, el modal queda anclado ahí en vez del viewport real.
    return createPortal(
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-8" onClick={onClose}>
            {/* z-10: el iframe de abajo es otro hijo "fixed"/"absolute" sin z-index propio dentro
                del mismo contexto de apilamiento — sin esto, al pintarse después en el DOM queda
                por encima del botón y lo vuelve inclickeable. */}
            <button className="fixed top-8 right-8 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-white" onClick={onClose}>
                <X size={20} />
            </button>
            <div className="w-full max-w-3xl space-y-3" onClick={(e) => e.stopPropagation()}>
                {embedUrl ? (
                    <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl" style={{ paddingTop: '62.5%' }}>
                        <iframe
                            src={embedUrl}
                            title="Grabación de Loom"
                            frameBorder="0"
                            allow="fullscreen"
                            allowFullScreen
                            className="absolute inset-0 w-full h-full"
                        />
                    </div>
                ) : (
                    <p className="text-white text-sm text-center">No se pudo generar la vista previa de este link.</p>
                )}
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 text-xs font-bold text-violet-300 hover:text-violet-200"
                >
                    <ExternalLink size={14} /> Abrir en Loom (más rápido si el embed tarda)
                </a>
            </div>
        </div>,
        document.body
    );
};

export default LoomModal;
