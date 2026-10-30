// Los paneles del Triage Dashboard (diseño de Claude Design, 30/10/2026): tarjetas, estados, embudo, low ticket,
// abandonos. Cada cifra que abre una lista llama a `onVer(<clave de triageFiltros>)`.

import { COLOR_DE_ESTADO, embudoDe, estadosDe, pct, pctTexto } from './triageDatos';

export const TARJETA = {
    position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 20, padding: 28,
    borderRadius: 32, background: 'var(--bg-element)', border: '1px solid var(--border-main)',
};
export const ROTULO = { fontSize: 11, fontWeight: 700, letterSpacing: '.24em', color: 'var(--text-muted)', textTransform: 'uppercase' };
const CAJA = { background: 'rgba(2,6,23,.35)', border: '1px solid var(--border-subtle)' };
const resplandor = (color, posicion, medidas = '260px 180px', pc = 22) => ({
    position: 'absolute', inset: 0, pointerEvents: 'none',
    background: `radial-gradient(${medidas} at ${posicion}, color-mix(in oklab, var(--${color}) ${pc}%, transparent), transparent 70%)`,
});
const boton = { background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', textAlign: 'inherit', cursor: 'pointer' };

export const Titulo = ({ texto, lado, children }) => (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22, fontWeight: 800 }}>{texto}</span>
        {lado && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{lado}</span>}
        {children}
    </div>
);

/** Las cuatro tarjetas de arriba; «Ver registros ›» abre su lista. */
export function Tarjetas({ m, onVer }) {
    const tarjetas = [
        { rotulo: 'AGENDAS', valor: m.agendas, sub: `${m.agendas} ${m.agendas === 1 ? 'llamada' : 'llamadas'} en el período`, color: 'info', ver: 'agendas' },
        { rotulo: 'ASISTENCIA', valor: pctTexto(m.asistencias, m.asistencias + m.no_show), sub: `${m.asistencias} asistieron · ${m.no_show} no show · ${m.canceladas} canceló`, color: 'success', ver: 'asistencias' },
        { rotulo: 'CALIFICADOS', valor: pctTexto(m.calificados, m.asistencias), sub: `${m.calificados} pasados al closer · ${m.pasadas_asistieron} ya asistieron con él`, color: 'brand-secondary', ver: 'calificados' },
        { rotulo: 'CIERRES LOW TICKET', valor: pctTexto(m.cerrado, m.pitch_low_ticket), sub: `${m.cerrado} de ${m.pitch_low_ticket} presentaciones`, color: 'error', ver: 'cerrado' },
    ];
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
            {tarjetas.map((t) => (
                <div key={t.rotulo} style={{ ...TARJETA, gap: 6, padding: '22px 22px 18px', borderRadius: 28 }}>
                    <div style={resplandor(t.color, '100% 100%')} />
                    <small style={{ ...ROTULO, position: 'relative' }}>{t.rotulo}</small>
                    <span style={{ position: 'relative', fontSize: 40, fontWeight: 900, lineHeight: 1.1, color: `var(--${t.color})` }}>{t.valor}</span>
                    <span style={{ position: 'relative', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{t.sub}</span>
                    <button type="button" onClick={() => onVer(t.ver)}
                        style={{ ...boton, position: 'relative', alignSelf: 'flex-end', marginTop: 6, fontSize: 12, fontWeight: 700, color: 'var(--brand-secondary)' }}>
                        Ver registros ›
                    </button>
                </div>
            ))}
        </div>
    );
}

/** Estados de las llamadas: la dona con el % que asistió y cada estado con su barra. */
export function Estados({ m, onVer }) {
    const estados = estadosDe(m);
    let acumulado = 0;
    const tramos = estados.map((e) => { const desde = acumulado; acumulado += e.pct; return `var(--${e.color}) ${desde}% ${acumulado}%`; });
    return (
        <div style={TARJETA}>
            <div style={resplandor('brand-secondary', '100% 100%', '420px 260px', 18)} />
            <Titulo texto="Estados" lado={<><b style={{ color: '#fff' }}>{m.agendas}</b> llamadas</>} />
            <div style={{ ...CAJA, position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 28, padding: 22, borderRadius: 20 }}>
                <div style={{ width: 150, height: 150, flexShrink: 0, borderRadius: '50%', background: `conic-gradient(${tramos.join(', ')})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 108, height: 108, borderRadius: '50%', background: 'var(--ink)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                        <span style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}>{Math.round(pct(m.asistencias, m.agendas))}%</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>asistieron</span>
                    </div>
                </div>
                <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {estados.map((e) => (
                        <button key={e.clave} type="button" onClick={() => onVer(`st:${e.clave}`)} style={{ ...boton, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14, fontWeight: 700 }}>
                                <span>{e.clave}</span><span style={{ color: `var(--${e.color})` }}>{e.n} · {e.pct}%</span>
                            </span>
                            <span style={{ display: 'block', height: 4, borderRadius: 4, background: 'rgba(255,255,255,.08)' }}>
                                <span style={{ display: 'block', height: 4, borderRadius: 4, width: `${e.pct}%`, background: `var(--${e.color})` }} />
                            </span>
                        </button>
                    ))}
                </div>
            </div>
            <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'baseline' }}>
                <small style={ROTULO}>DE LOS QUE ASISTIERON</small>
                <span style={{ fontSize: 14, color: 'var(--text-muted)' }}><b style={{ fontSize: 20, fontWeight: 900, color: 'var(--success)' }}>{m.calificados}</b> calificados</span>
                <span style={{ fontSize: 14, color: 'var(--text-muted)' }}><b style={{ fontSize: 20, fontWeight: 900, color: 'var(--warning)' }}>{m.descalificados}</b> descalificados</span>
            </div>
        </div>
    );
}

/** El embudo de cuatro etapas y la que más se cae. */
export function Embudo({ m, onVer }) {
    const { etapas, cuello } = embudoDe(m);
    const mayor = Math.max(1, ...etapas.map((e) => e.n));
    return (
        <div style={TARJETA}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <small style={ROTULO}>EMBUDO</small>
                {cuello && (
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', padding: '5px 12px', borderRadius: 999, color: 'var(--error)',
                        background: 'var(--error-surface)', border: '1px solid var(--error-border)' }}>
                        CUELLO DE BOTELLA · {cuello}
                    </span>
                )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {etapas.map((e) => (
                    <button key={e.clave} type="button" onClick={() => onVer(e.filtro)}
                        style={{ ...boton, display: 'grid', gridTemplateColumns: '110px minmax(0,1fr) 56px', alignItems: 'center', gap: 12 }}>
                        <small style={{ ...ROTULO, letterSpacing: '.16em' }}>{e.clave}</small>
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: `max(${(e.n / mayor) * 100}%, 56px)`, height: 34, borderRadius: 10, background: `var(--${e.color})`,
                                color: ['brand-secondary', 'success'].includes(e.color) ? 'var(--ink)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900 }}>
                                {e.n}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.nota || ' '}</span>
                        </span>
                        <span style={{ textAlign: 'right', fontSize: 15, fontWeight: 800, color: cuello === e.clave ? 'var(--error)' : 'var(--text-on-surface)' }}>
                            {e.de ? pctTexto(e.n, e.de) : ''}
                        </span>
                    </button>
                ))}
            </div>
            <small style={ROTULO}>DE {m.agendas} AGENDAS A {m.calificados} CALIFICADOS</small>
        </div>
    );
}

/** El low ticket de 100 USD de los descalificados: el cierre grande y los cuatro estados. */
export function LowTicket({ m, onVer }) {
    const cajas = [['CIERRES', m.cerrado, 'success', 'cerrado'], ['NO CIERRES', m.no_cerrado, 'error', 'no_cerrado'],
        ['SEGUIMIENTO', m.seguimiento, 'info', 'seguimiento'], ['PERDIDO', m.descartado, 'idle', 'descartado']];
    return (
        <div style={TARJETA}>
            <div style={resplandor('warning', '0% 0%', '380px 240px', 14)} />
            <Titulo texto="Low ticket" lado="Descalificados · oferta de 100 USD" />
            <div style={{ ...CAJA, position: 'relative', display: 'flex', alignItems: 'baseline', gap: 12, padding: '20px 22px', borderRadius: 20 }}>
                <span style={{ fontSize: 56, fontWeight: 900, lineHeight: 1, color: m.cerrado ? 'var(--success)' : 'var(--error)' }}>{Math.round(pct(m.cerrado, m.pitch_low_ticket))}%</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>cierre · {m.cerrado} de {m.pitch_low_ticket} presentaciones</span>
            </div>
            <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                {cajas.map(([rotulo, n, color, ver]) => (
                    <button key={rotulo} type="button" onClick={() => onVer(ver)}
                        style={{ ...boton, display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 0', borderTop: `2px solid var(--${color})` }}>
                        <small style={{ ...ROTULO, letterSpacing: '.2em' }}>{rotulo}</small>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            <b style={{ fontSize: 26, fontWeight: 900, color: '#fff' }}>{n}</b> {pctTexto(n, m.pitch_low_ticket)}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}

/** Los que dejaron el formulario a medias: cuántos y qué se hizo con ellos. */
export function Abandonos({ a }) {
    if (!a) return null;
    const sinTocar = Math.max(0, a.total - a.contactados - a.no_contesta);
    const filas = [['Contactados', a.contactados, 'success'], ['No contestó', a.no_contesta, 'warning'], ['Sin tocar', sinTocar, 'idle']];
    return (
        <div style={TARJETA}>
            <Titulo texto="Abandonos del formulario" lado="No terminaron de agendar" />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 56, fontWeight: 900, lineHeight: 1 }}>{a.total}</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>sin agendar</span>
            </div>
            <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', gap: 3 }}>
                {filas.filter(([, n]) => n > 0).map(([rotulo, n, color]) => <div key={rotulo} style={{ flex: n, background: `var(--${color})` }} />)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {filas.map(([rotulo, n, color]) => (
                    <div key={rotulo} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderTop: '1px solid var(--border-subtle)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--${color})` }} />{rotulo}
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}><b style={{ color: '#fff', fontSize: 16 }}>{n}</b> · {pctTexto(n, a.total)}</span>
                    </div>
                ))}
            </div>
            {sinTocar > 0 && (
                <div style={{ padding: '12px 16px', borderRadius: 16, background: 'var(--warning-surface)', border: '1px solid var(--warning-border)', fontSize: 13, lineHeight: 1.45 }}>
                    {sinTocar} de {a.total} todavía no {sinTocar === 1 ? 'recibió' : 'recibieron'} contacto.
                </div>
            )}
        </div>
    );
}

export { COLOR_DE_ESTADO };
