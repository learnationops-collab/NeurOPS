// De qué funnel es el anuncio del que vino el lead (ADR-W287): venta directa (vino a comprar: el más calificado,
// en cálido) o lead magnet (vino por el recurso gratis). Sale del nombre de la campaña de Meta; sin anuncio, nada.
// En la tarjeta va al lado de la palabra clave; en la lista, en mini al lado del examen.
const FUNNELS = {
    direct: { corto: 'DS', label: 'Direct Sale', color: 'var(--warning)', tip: 'Vino de un anuncio de venta directa: llegó con más intención de compra' },
    lead_magnet: { corto: 'LM', label: 'Lead Magnet', color: 'var(--info)', tip: 'Vino de un anuncio de lead magnet: entró por el recurso gratis' },
};

export default function Funnel({ funnel, mini = false }) {
    const f = FUNNELS[funnel];
    if (!f) return null;
    return (
        <span className={`cv-funnel cv-funnel--${funnel}${mini ? ' cv-funnel--mini' : ''}`} style={{ '--c': f.color }}
            data-tip={`${f.label}|${f.tip}`} aria-label={f.label}>
            <i aria-hidden="true" />{mini ? f.corto : f.label}
        </span>
    );
}
