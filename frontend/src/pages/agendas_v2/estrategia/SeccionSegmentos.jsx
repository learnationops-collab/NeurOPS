import React from 'react';

export const COLOR_SEG = { S1: '#FF3FA4', S2: '#4E8BD8', S3: '#5B6385' };
export const colorSeg = (id) => COLOR_SEG[id] || '#5B6385';

// Cortes del puntaje. El segmento más bajo siempre arranca en 0 para que ningún lead quede afuera.
export default function SeccionSegmentos({ estrategia, editar }) {
    const orden = [...estrategia.segmentos].sort((a, b) => b.desde - a.desde);
    const ascendente = [...orden].reverse();
    const ancho = (s, i) => {
        const techo = i === ascendente.length - 1 ? 101 : ascendente[i + 1].desde;
        return Math.max(techo - s.desde, 0);
    };

    return (
        <section className="ag2-card" aria-labelledby="ag2-seg">
            <div className="ag2-card-h">
                <div>
                    <h2 id="ag2-seg">Segmentos</h2>
                    <p>Desde qué puntaje entra un lead en cada segmento. Cada segmento tiene su propio reparto.</p>
                </div>
            </div>

            <div className="ag2-band" role="img" aria-label="Rangos de puntaje por segmento">
                {ascendente.map((s, i) => (
                    <div key={s.id} style={{ flex: ancho(s, i), background: `${colorSeg(s.id)}33`, color: colorSeg(s.id) }}>{ancho(s, i) > 8 ? s.id : ''}</div>
                ))}
            </div>
            <div className="ag2-scale"><span>0</span><span>50</span><span>100</span></div>

            <div className="ag2-segrows">
                {orden.map((s, i) => (
                    <div key={s.id} className="ag2-segrow">
                        <span className="ag2-segid" style={{ background: `${colorSeg(s.id)}22`, color: colorSeg(s.id) }}>{s.id}</span>
                        <input className="ag2-txt" aria-label={`Nombre de ${s.id}`} value={s.nombre}
                            onChange={(ev) => editar(e => { e.segmentos.find(x => x.id === s.id).nombre = ev.target.value; })} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--v6-tx2)' }}>
                            desde
                            <input className="ag2-num" type="number" min={0} max={100} style={{ width: 52, height: 32 }}
                                disabled={i === orden.length - 1} aria-label={`Puntaje mínimo de ${s.id}`} value={s.desde}
                                onChange={(ev) => editar(e => { e.segmentos.find(x => x.id === s.id).desde = Math.max(1, Math.min(100, Number(ev.target.value) || 0)); })} />
                        </label>
                    </div>
                ))}
            </div>
        </section>
    );
}
