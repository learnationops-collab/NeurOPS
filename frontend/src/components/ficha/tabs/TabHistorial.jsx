import React from 'react';
import { fechaLegible as fecha, SeccionColapsable } from '../piezas';

const plata = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-AR')}`;


const TONO_CUOTA = { pagada: 'success', vencida: 'error', pendiente: 'idle' };

const Chip = ({ label, tono = 'idle' }) => (
    <span className="chip" style={{ '--c': `var(--${tono})` }}>{label}</span>
);

/** Fila del historial: fecha · detalle · monto/chip. Siempre las mismas tres columnas. */
const Fila = ({ a, b, c = null, chip = null }) => (
    <div className="fi-sec-fila">
        <span className="t-sm mut">{a || '—'}</span>
        <span className="t-sm">{b}</span>
        <span className="fila" style={{ gap: 'var(--s3)', whiteSpace: 'nowrap', justifyContent: 'flex-end' }}>
            {c && <span className="t-sm num" style={{ fontWeight: 600 }}>{c}</span>}
            {chip && <Chip label={chip.label} tono={chip.tone} />}
        </span>
    </div>
);

const Vacio = ({ texto }) => <p className="t-cap mut40" style={{ paddingTop: 'var(--s3)' }}>{texto}</p>;

/**
 * Historial: secciones colapsables con el resumen en la cabecera.
 *
 * El resumen es el punto: `4 cuotas de $500 · 1 pagada · 1 vencida` se lee sin
 * abrir nada. Abrir es para ver el detalle, no para enterarse de qué hay.
 *
 * El plan de cuotas se muestra en solo lectura acá: editarlo es una acción de cobro
 * y vive en la pestaña Acciones, con su total, su validación de suma y su reparto.
 * Tenerlo editable en dos lugares sería tener dos verdades sobre el mismo plan.
 */
const TabHistorial = ({ ficha, irA }) => {
    const hist = ficha?.historial || {};
    const cobro = ficha?.cobro || {};
    const conf = ficha?.confirmacion || {};

    const agendas = hist.agendas || [];
    const seguimientos = hist.seguimientos || [];
    const pagos = cobro.pagos || [];
    const cuotas = cobro.cuotas || [];
    const eventos = hist.eventos || [];

    const etapas = ficha?.vocabulario?.etapas_confirmacion || [];
    // `como_viene` llega como {clave, label}; la clave es la que busca en el vocabulario.
    const claveComoViene = conf.como_viene?.clave ?? conf.como_viene;
    const comoViene = (ficha?.vocabulario?.como_viene || [])
        .flatMap(g => g.opciones || [])
        .find(o => o.clave === claveComoViene);
    const etapaLabel = etapas.find(e => e.clave === conf.etapa)?.label;

    const cuenta = (estado) => cuotas.filter(c => (c.estado || '').toLowerCase() === estado).length;
    const resumenCuotas = !cuotas.length
        ? 'Sin plan'
        : [
            `${cuotas.length} ${cuotas.length === 1 ? 'cuota' : 'cuotas'} de ${plata(cuotas[0].monto)}`,
            `${cuenta('pagada')} pagada${cuenta('pagada') === 1 ? '' : 's'}`,
            cuenta('vencida') ? `${cuenta('vencida')} vencida${cuenta('vencida') === 1 ? '' : 's'}` : null,
        ].filter(Boolean).join(' · ');

    const totalPagado = pagos.reduce((x, p) => x + (Number(p.monto) || 0), 0);

    return (
        <div style={{ display: 'grid', gap: 'var(--s3)' }}>
            <SeccionColapsable titulo="Confirmación"
                resumen={[etapaLabel && `Etapa: ${etapaLabel}`, comoViene?.label || 'Sin estado']
                    .filter(Boolean).join(' · ')}>
                {etapas.length ? etapas.map((e, i) => {
                    const idx = Math.max(0, etapas.findIndex(x => x.clave === conf.etapa));
                    const chip = conf.cerrada || i < idx
                        ? { label: 'Hecho', tone: 'success' }
                        : i === idx ? { label: 'Actual', tone: 'info' } : { label: 'Pendiente', tone: 'idle' };
                    return <Fila key={e.clave} a="" b={e.label} chip={chip} />;
                }) : <Vacio texto="Sin etapas registradas." />}
            </SeccionColapsable>

            <SeccionColapsable titulo="Agendas"
                resumen={agendas.length
                    ? `${agendas.length} ${agendas.length === 1 ? 'agenda' : 'agendas'}`
                        + (agendas[0]?.fecha ? ` · próxima ${fecha(agendas[0].fecha)}` : '')
                    : 'Sin agendas'}>
                {agendas.length
                    ? agendas.map((a, i) => <Fila key={`${a.fecha}-${i}`} a={fecha(a.fecha)} b={a.detalle} chip={a.chip} />)
                    : <Vacio texto="Este lead todavía no tiene ninguna agenda." />}
            </SeccionColapsable>

            <SeccionColapsable titulo="Plan de cuotas" resumen={resumenCuotas}>
                {cuotas.length ? (
                    <>
                        {cuotas.map((c, i) => (
                            <Fila key={c.id ?? i} a={fecha(c.fecha)} b={`Cuota ${c.numero ?? i + 1}`}
                                c={plata(c.monto)}
                                chip={{ label: c.estado || 'Pendiente',
                                    tone: TONO_CUOTA[(c.estado || '').toLowerCase()] || 'idle' }} />
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--s3)' }}>
                            <button type="button" className="btn btn--linea btn--sm" onClick={() => irA?.('acciones')}>
                                Editar el plan
                            </button>
                        </div>
                    </>
                ) : <Vacio texto="Sin plan de cuotas armado." />}
            </SeccionColapsable>

            <SeccionColapsable titulo="Seguimientos"
                resumen={seguimientos.length
                    ? `${seguimientos.length} ${seguimientos.length === 1 ? 'registrado' : 'registrados'}`
                        + (seguimientos[0]?.fecha ? ` · último ${fecha(seguimientos[0].fecha)}` : '')
                    : 'Sin seguimientos'}>
                {seguimientos.length
                    ? seguimientos.map((s, i) => <Fila key={`${s.fecha}-${i}`} a={fecha(s.fecha)} b={s.nota} c={s.canal} />)
                    : <Vacio texto="No se registró ningún seguimiento." />}
            </SeccionColapsable>

            <SeccionColapsable titulo="Pagos"
                resumen={pagos.length
                    ? `${pagos.length} ${pagos.length === 1 ? 'pago' : 'pagos'} · ${plata(totalPagado)} en total`
                    : 'Sin pagos'}>
                {pagos.length
                    ? pagos.map((p, i) => <Fila key={`${p.fecha}-${i}`} a={fecha(p.fecha)} b={p.medio} c={plata(p.monto)} />)
                    : <Vacio texto="Todavía no entró ningún pago." />}
            </SeccionColapsable>

            {/* Los eventos del log solo aparecen si el backend los manda: son ruido
                para el uso diario y sirven cuando hay que auditar algo. */}
            {eventos.length > 0 && (
                <SeccionColapsable titulo="Registro de eventos"
                    resumen={`${eventos.length} ${eventos.length === 1 ? 'evento' : 'eventos'}`}>
                    {eventos.map((e, i) => (
                        <Fila key={e.id ?? i} a={fecha(e.fecha || e.created_at)} b={e.detalle || e.evento || e.tipo} />
                    ))}
                </SeccionColapsable>
            )}
        </div>
    );
};

export default TabHistorial;
