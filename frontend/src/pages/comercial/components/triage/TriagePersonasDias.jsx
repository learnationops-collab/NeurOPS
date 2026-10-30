// «Por persona» y «Día por día» del Triage Dashboard (diseño de Claude Design, 30/10/2026).

import { iniciales, pct } from './triageDatos';
import { ROTULO, TARJETA, Titulo } from './TriagePaneles';

const CAJA = { background: 'rgba(2,6,23,.35)', border: '1px solid var(--border-subtle)' };
const COLUMNAS = 'minmax(80px,1.4fr) repeat(6,minmax(0,1fr))';
const nombreDia = (dia) => new Date(`${dia}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

/** Una tarjeta por persona: su % de asistencia y las cuatro cuentas con su barra. Tocarla la elige. */
export function PorPersona({ personas, onElegir }) {
    if (!personas.length) return null;
    const mayor = Math.max(1, ...personas.map((p) => p.agendas));
    return (
        <div style={{ ...TARJETA, gap: 18 }}>
            <Titulo texto="Por persona" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
                {personas.map((p) => {
                    const tasa = Math.round(pct(p.asistencias, p.agendas));
                    const color = tasa >= 40 ? 'success' : tasa > 0 ? 'warning' : 'error';
                    const filas = [['Agendas', p.agendas, 'brand-primary'], ['Confirmadas', p.confirmadas, 'info'],
                        ['Asistieron', p.asistencias, 'brand-secondary'], ['Calificados', p.calificados, 'success']];
                    return (
                        <button key={p.id} type="button" onClick={() => onElegir(String(p.id))}
                            style={{ ...CAJA, display: 'flex', flexDirection: 'column', gap: 14, padding: 18, borderRadius: 20, color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--brand-secondary)', color: 'var(--ink)', fontSize: 12, fontWeight: 900,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{iniciales(p.nombre)}</span>
                                    <span style={{ fontSize: 15, fontWeight: 800 }}>{p.nombre}</span>
                                </span>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, color: `var(--${color})`,
                                    background: `var(--${color}-surface)`, border: `1px solid var(--${color}-border)` }}>{tasa}% asist.</span>
                            </span>
                            {filas.map(([rotulo, n, c]) => (
                                <span key={rotulo} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                                        <span>{rotulo}</span><b style={{ color: '#fff' }}>{n}</b>
                                    </span>
                                    <span style={{ display: 'block', height: 4, borderRadius: 4, background: 'rgba(255,255,255,.08)' }}>
                                        <span style={{ display: 'block', height: 4, borderRadius: 4, width: `${(n / mayor) * 100}%`, background: `var(--${c})` }} />
                                    </span>
                                </span>
                            ))}
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {p.descalificados} descalificados · {p.cerrado} de {p.pitch_low_ticket} low ticket
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/** Una fila por día con sus seis cuentas y una barra: asistieron, confirmadas que no asistieron y sin confirmar. */
export function DiaPorDia({ dias }) {
    if (!dias.length) return null;
    const mayor = Math.max(1, ...dias.map((d) => d.agendas));
    const rotulos = ['AGEND.', 'CONF.', 'ASIST.', 'CALIF.', 'DESC.', 'LT'];
    const leyenda = [['Asistieron', 'success'], ['Confirmadas', 'info'], ['Sin confirmar', 'idle']];
    return (
        <div style={{ ...TARJETA, gap: 18 }}>
            <Titulo texto="Día por día" />
            <div style={{ display: 'grid', gridTemplateColumns: COLUMNAS, gap: '0 8px', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
                <small style={{ ...ROTULO, fontSize: 11, letterSpacing: '.1em' }}>DÍA</small>
                {rotulos.map((r) => <small key={r} style={{ ...ROTULO, fontSize: 11, letterSpacing: '.1em', textAlign: 'right' }}>{r}</small>)}
            </div>
            {dias.map((d) => {
                const valores = [d.agendas, d.confirmadas, d.asistencias, d.calificados, d.descalificados, d.cerrado];
                const ancho = (n) => `${(n / mayor) * 100}%`;
                return (
                    <div key={d.dia} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: COLUMNAS, gap: '0 8px', fontSize: 15, fontWeight: 700 }}>
                            <span style={{ fontWeight: 600 }}>{nombreDia(d.dia)}</span>
                            {valores.map((n, i) => (
                                <span key={i} style={{ textAlign: 'right', color: !n ? 'var(--text-muted-40)' : i === 4 ? 'var(--warning)' : i === 3 ? 'var(--success)' : undefined }}>{n}</span>
                            ))}
                        </div>
                        <div style={{ display: 'flex', height: 6, gap: 2, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,.06)' }}>
                            <div style={{ width: ancho(d.asistencias), background: 'var(--success)' }} />
                            <div style={{ width: ancho(Math.max(0, d.confirmadas - d.asistencias)), background: 'var(--info)' }} />
                            <div style={{ width: ancho(Math.max(0, d.agendas - d.confirmadas)), background: 'var(--idle)' }} />
                        </div>
                    </div>
                );
            })}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                {leyenda.map(([texto, color]) => (
                    <span key={texto} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--${color})` }} />{texto}
                    </span>
                ))}
            </div>
        </div>
    );
}
