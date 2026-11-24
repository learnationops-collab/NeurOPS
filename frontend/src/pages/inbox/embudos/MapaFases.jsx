// Arriba de Embudos (ADR-W204): las fases del embudo en orden, agrupadas por tramo, con lo que tiene cada una
// (bot, pasos de la Guía, seguimientos de setter y automáticos). Tocar una la abre abajo.
import { SALIDAS, TRAMOS_EMBUDO } from './useEmbudos';

function Fase({ f, n, etapa, on, sucia, conBot, onElegir }) {
    const segs = etapa?.seguimientos || [];
    const autos = segs.filter((s) => s.quien === 'auto').length;
    const pasos = (etapa?.pasos || []).length;
    return (
        <button type="button" className={`em-fase${on ? ' em-fase--on' : ''}`} onClick={() => onElegir(f.id)} aria-pressed={on}>
            <b>{n}. {f.nombre}{sucia && <span className="gu-sucio" aria-label="con cambios" />}</b>
            <span className="em-fase-ic">
                {conBot && <i className="em-ic em-ic--bot">Bot</i>}
                <i className="em-ic">{pasos} {pasos === 1 ? 'paso' : 'pasos'}</i>
                {segs.length - autos > 0 && <i className="em-ic">{segs.length - autos} seg.</i>}
                {autos > 0 && <i className="em-ic em-ic--auto">{autos} auto</i>}
            </span>
        </button>
    );
}

export default function MapaFases({ fases, etapas, sel, sucias, onElegir }) {
    const grupos = [];
    fases.forEach((f, i) => {
        const u = grupos[grupos.length - 1];
        if (u && u.tramo === f.tramo) u.fases.push([f, i + 1]);
        else grupos.push({ tramo: f.tramo, fases: [[f, i + 1]] });
    });
    return (
        <div className="em-mapa" style={{ '--cols': fases.length }}>
            {grupos.map((g, k) => (
                <div key={k} className="em-tramo" style={{ '--n': g.fases.length, '--c': TRAMOS_EMBUDO[g.tramo]?.color }}>
                    <span className="em-tramo-t">{TRAMOS_EMBUDO[g.tramo]?.nombre}</span>
                    <div className="em-tramo-f">
                        {g.fases.map(([f, n]) => (
                            <Fase key={f.id} f={f} n={n} etapa={etapas?.[f.id]} on={sel === f.id} sucia={sucias.has(f.id)}
                                conBot={f.tramo === 'auto'} onElegir={onElegir} />
                        ))}
                    </div>
                </div>
            ))}
            <div className="em-salidas">
                <span className="em-tramo-t">Salen del embudo</span>
                {SALIDAS.map((f) => (
                    <button key={f.id} type="button" className={`em-salida${sel === f.id ? ' em-fase--on' : ''}`} onClick={() => onElegir(f.id)}>
                        {f.nombre}{sucias.has(f.id) && <span className="gu-sucio" aria-label="con cambios" />}
                    </button>
                ))}
            </div>
        </div>
    );
}
