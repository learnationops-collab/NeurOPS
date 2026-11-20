import React from 'react';
import { fmt } from '../Shared';
import { Panel, PanelCab, Vacio, v } from '../PiezasAnalizar';
import { contactoDe } from '../tablasDef';
import { conteoPorTipo, lineaDe, motivosDe } from './motivosPrompt';

const CONTACTOS = [
    { label: 'Contacto 1', texto: '1er contacto', tono: 'info' },
    { label: 'Contacto 2', texto: '2º contacto', tono: 'info' },
    { label: 'Contacto 3', texto: '3er contacto', tono: 'warning' },
    { label: 'Contacto 4', texto: '4º (último)', tono: 'brand-secondary' },
];

/** Un seguimiento vencido: el día del próximo contacto ya pasó y sigue pendiente. */
const hoy = () => new Date().toISOString().slice(0, 10);
const vencido = (f) => !!f.seguimiento_fecha && f.seguimiento_fecha < hoy();

/**
 * «Seguimientos en curso» (ADR-W190): de las agendas filtradas con un seguimiento pendiente, en qué contacto de
 * la cadencia va cada una (`seguimiento_intento`, 1 a 4). Cada fila abre esas agendas en Revisar.
 */
const SeguimientosCurso = ({ filtradas, irA }) => {
    const con = filtradas.filter(f => f.en_seguimiento);
    const max = Math.max(1, ...CONTACTOS.map(c => con.filter(f => contactoDe(f) === c.label).length));
    const vencidos = con.filter(vencido).length;
    return (
        <Panel cab={<PanelCab titulo="Seguimientos en curso"
            ayuda="Las agendas del filtro con un seguimiento pendiente, por el contacto de la cadencia en el que van (1 a 4, a los 0, 3, 7 y 14 días). Tocá una fila para ver esas agendas." />}>
            {con.length === 0 ? <Vacio texto="Ninguna agenda del filtro tiene un seguimiento pendiente." /> : (
                <>
                    <p className="t-cap mut40" style={{ marginBottom: 'var(--s3)' }}>
                        {fmt.plural(con.length, 'agenda en seguimiento', 'agendas en seguimiento')}
                        {vencidos > 0 ? ` · ${vencidos} con el contacto vencido` : ''}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '8px 12px', alignItems: 'center' }}>
                        {CONTACTOS.map(c => {
                            const n = con.filter(f => contactoDe(f) === c.label).length;
                            const ir = irA && n ? () => irA('agendas', { seguimiento: [c.label], __chip: 'todas_las', __de: c.texto }) : null;
                            return (
                                <React.Fragment key={c.label}>
                                    <button type="button" className="t-sm" disabled={!ir} onClick={ir || undefined}
                                        style={{ textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: ir ? 'pointer' : 'default', color: 'inherit' }}>
                                        {c.texto}
                                    </button>
                                    <div style={{ height: 10, borderRadius: 6, background: 'var(--surface-2, rgba(255,255,255,.06))' }}>
                                        <div style={{ height: '100%', width: `${(n / max) * 100}%`, borderRadius: 6, background: v(c.tono), transition: 'width .4s ease' }} />
                                    </div>
                                    <span className="num t-sm">{n}</span>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </>
            )}
        </Panel>
    );
};

/** «Motivos» (ADR-W190): cuántos motivos escritos hay de cada tipo en las agendas filtradas y los últimos. */
const MotivosFiltro = ({ filtradas }) => {
    const motivos = motivosDe(filtradas);
    return (
        <Panel cab={<PanelCab titulo="Motivos"
            ayuda="Lo que escribió el equipo al marcar no show, cancelación o reprogramación, y la objeción de las llamadas que no cerraron. «Copiar motivos para IA», arriba, los copia con un prompt y sin datos del lead." />}>
            {motivos.length === 0 ? <Vacio texto="Ninguna agenda del filtro tiene un motivo escrito." /> : (
                <>
                    <div className="fila" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 'var(--s3)' }}>
                        {conteoPorTipo(motivos).map(t => (
                            <span key={t.tipo} className="chip" style={{ textTransform: 'none', letterSpacing: 0 }}>
                                {t.tipo} <span className="num">{t.n}</span>
                            </span>
                        ))}
                    </div>
                    <ul className="t-cap" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
                        {motivos.slice(0, 4).map(m => (
                            <li key={`${m.fila.id}-${m.tipo}`} className="trunc mut40" title={lineaDe(m)}>{lineaDe(m)}</li>
                        ))}
                    </ul>
                </>
            )}
        </Panel>
    );
};

const SeguimientosMotivos = ({ filtradas, irA }) => (
    <div className="grid-2">
        <SeguimientosCurso filtradas={filtradas} irA={irA} />
        <MotivosFiltro filtradas={filtradas} />
    </div>
);

export default SeguimientosMotivos;
