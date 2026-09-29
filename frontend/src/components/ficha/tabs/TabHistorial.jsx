import React, { useState } from 'react';
import { fechaLegible as fecha, SeccionColapsable } from '../piezas';
import PlanCuotasForm from '../acciones/PlanCuotasForm';
import { CampoPrograma, CampoTotal } from '../acciones/CamposCobro';

const plata = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-AR')}`;


// El estado de una cuota tal como lo manda `InstallmentPlan.to_dict()`: 'pendiente', 'pagado' y
// 'vencido' (que no es una columna — lo deriva de una cuota pendiente con la fecha pasada). Acá
// estaban escritos en femenino ('pagada', 'vencida'), así que ninguna cuota encontraba su tono ni
// se contaba en el resumen: un plan cobrado entero se leía "0 pagadas" con todos los chips grises.
const CUOTA = {
    pendiente: { label: 'Pendiente', tone: 'idle' },
    pagado: { label: 'Pagada', tone: 'success' },
    vencido: { label: 'Vencida', tone: 'error' },
};

const chipDeCuota = (estado) => CUOTA[String(estado || '').toLowerCase()] || CUOTA.pendiente;

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

const Cifra = ({ rotulo, valor, color = undefined }) => (
    <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <small className="t-rotulo">{rotulo}</small>
        <span className="t-sm trunc" style={{ fontWeight: 700, color }}>{valor}</span>
    </div>
);

/**
 * Los cuatro datos del cobro, arriba del historial y sin abrir nada: el programa, cuánto va a
 * pagar en total, cuánto pagó y cuánto falta.
 *
 * El total es el que ordena a los otros dos: un historial que muestra pagos y cuotas pero no
 * contra qué total se están pagando no dice si el cliente va bien o mal.
 *
 * El programa y el total se corrigen ACÁ, con el lápiz, y no mandando a Acciones: son los mismos
 * `CamposCobro` que monta esa pestaña, así que no hay dos editores ni dos verdades. Lo que queda
 * del otro lado son las ACCIONES —registrar un pago, un seguimiento, una baja—, que son otra cosa
 * que corregir un dato mal cargado.
 */
const ResumenCobro = ({ cobro, programas, puedeEditar, onAccion }) => {
    const deuda = Number(cobro?.deuda) || 0;
    const alDia = deuda < 0.01;
    return (
        <div className="fi-sec" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s6)',
            alignItems: 'flex-start', padding: 'var(--s4) var(--s6)' }}>
            <CampoPrograma cobro={cobro} programas={programas} puedeEditar={puedeEditar}
                onGuardar={(programa_code) => onAccion?.('guardar_programa', { programa_code })} />
            <CampoTotal cobro={cobro} puedeEditar={puedeEditar}
                onGuardar={(total) => onAccion?.('guardar_total', { total })} />
            <Cifra rotulo="Pagado" valor={plata(cobro?.pagado)} />
            <Cifra rotulo="Debe" valor={alDia ? 'Al día' : plata(deuda)}
                color={alDia ? 'var(--success)' : 'var(--error)'} />
        </div>
    );
};

/**
 * Historial: secciones colapsables con el resumen en la cabecera.
 *
 * El resumen es el punto: `4 cuotas de $500 · 1 pagada · 1 vencida` se lee sin
 * abrir nada. Abrir es para ver el detalle, no para enterarse de qué hay.
 *
 * El plan de cuotas se edita ACÁ, en línea. Antes el botón mandaba a la pestaña Acciones, con el
 * argumento de que tenerlo en dos lugares serían dos verdades sobre el mismo plan — pero el
 * closer se da cuenta de que hay que corregirlo mientras lo está MIRANDO, acá, y mandarlo a otra
 * pestaña a buscar la misma tabla no evitaba ninguna contradicción: sólo agregaba un salto.
 *
 * Dos montajes no son dos verdades mientras sea el mismo editor: `PlanCuotasForm` es uno solo,
 * con la misma aritmética (`planCuotas.js`) y la misma acción de guardado, y se monta también en
 * la sub-vista «Armar plan de cuotas» de Acciones.
 */
const hoyMasUnDia = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setMinutes(0, 0, 0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T10:00`;
};

/** Un desplegable chico de estado, con el vocabulario que manda el backend. */
const SelectorEstado = ({ etiqueta, valor, opciones, disabled, onCambiar }) => (
    <span className="ln-field" style={{ height: 34, minWidth: 0 }}>
        <select value={valor || ''} disabled={disabled} aria-label={etiqueta}
            onChange={(e) => onCambiar(e.target.value)}>
            {opciones.map(o => (
                // Los no editables se muestran pero no se eligen: «Venta» no es un estado que se
                // fije a mano —es que exista una venta cruzada— y ponerlo acá marcaría una venta
                // que la contabilidad no tiene. Mismo criterio que el libro de registros.
                <option key={o.key} value={o.key} disabled={o.editable === false}>{o.label}</option>
            ))}
        </select>
    </span>
);

/**
 * La sección «Agendas»: todas las llamadas del cliente, con su estado corregible en la fila y un
 * formulario para agendar otra.
 *
 * Se corrige acá y no saltando al reporte de la llamada porque son dos cosas distintas: reportar
 * es contar cómo fue la llamada, y esto es arreglar un dato que quedó mal cargado en CUALQUIERA
 * de las agendas del cliente — incluida la de hace tres meses, que es justamente la que ninguna
 * otra pantalla deja tocar.
 */
const Agendas = ({ agendas, vocabulario, closerId, puedeEditar, onAccion }) => {
    const [agregando, setAgregando] = useState(false);
    const [cuando, setCuando] = useState(hoyMasUnDia);
    const [ocupada, setOcupada] = useState(null);

    const preCall = vocabulario?.pre_call || [];
    const postCall = vocabulario?.post_call || [];

    const corregir = async (agendaId, campo, valor) => {
        setOcupada(`${agendaId}:${campo}`);
        try {
            // El tercer argumento apunta la acción a ESTA agenda, no a la que abrió la ficha.
            await onAccion?.('estado_agenda', { campo, valor }, agendaId);
        } catch {
            // El aviso del cascarón ya lo dice; la fila vuelve a su valor al recargar la ficha.
        } finally {
            setOcupada(null);
        }
    };

    const agendar = async () => {
        setOcupada('nueva');
        try {
            await onAccion?.('crear_agenda', { fecha: cuando, closer_id: closerId || null });
            setAgregando(false);
        } catch {
            // Se queda abierto: el error más común es que ese closer ya tiene esa hora ocupada.
        } finally {
            setOcupada(null);
        }
    };

    return (
        <>
            {agendas.length ? agendas.map((a) => (
                <div key={a.id} className="fi-sec-fila" style={{ gridTemplateColumns: '110px minmax(0,1fr) auto' }}>
                    <span className="t-sm mut">{fecha(a.fecha) || '—'}</span>
                    <span className="t-sm trunc">{a.detalle}</span>
                    <span className="fila" style={{ gap: 'var(--s2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {puedeEditar ? (
                            <>
                                <SelectorEstado etiqueta={`Pre call de la agenda del ${fecha(a.fecha)}`}
                                    valor={a.pre_call} opciones={preCall}
                                    disabled={ocupada === `${a.id}:pre_call`}
                                    onCambiar={(v) => corregir(a.id, 'pre_call', v)} />
                                <SelectorEstado etiqueta={`Post call de la agenda del ${fecha(a.fecha)}`}
                                    valor={a.post_call} opciones={postCall}
                                    disabled={ocupada === `${a.id}:post_call`}
                                    onCambiar={(v) => corregir(a.id, 'post_call', v)} />
                            </>
                        ) : a.chip && <Chip label={a.chip.label} tono={a.chip.tone} />}
                    </span>
                </div>
            )) : <Vacio texto="Este lead todavía no tiene ninguna agenda." />}

            {puedeEditar && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--s3)',
                    alignItems: 'center', paddingTop: 'var(--s3)', flexWrap: 'wrap' }}>
                    {agregando ? (
                        <>
                            <span className="ln-field" style={{ height: 34 }}>
                                <input type="datetime-local" value={cuando} aria-label="Fecha y hora de la llamada"
                                    onChange={(e) => setCuando(e.target.value)} />
                            </span>
                            <button type="button" className="btn btn--linea btn--sm"
                                disabled={ocupada === 'nueva'} onClick={() => setAgregando(false)}>
                                Cancelar
                            </button>
                            <button type="button" className="btn btn--sm"
                                disabled={ocupada === 'nueva' || !cuando} onClick={agendar}>
                                Agendar
                            </button>
                        </>
                    ) : (
                        <button type="button" className="btn btn--linea btn--sm" onClick={() => setAgregando(true)}>
                            Agendar otra llamada
                        </button>
                    )}
                </div>
            )}
        </>
    );
};

/**
 * La sección «Plan de cuotas»: la tabla de siempre, y el editor en línea al tocar «Editar».
 *
 * Se monta cerrado. Abrir el editor de entrada haría que leer el plan —que es para lo que se abre
 * el historial— empezara con ocho campos de formulario en pantalla.
 */
const PlanDeCuotas = ({ ficha, cuotas, onAccion, puedeEditar }) => {
    const [editando, setEditando] = useState(false);
    const [guardando, setGuardando] = useState(false);

    const guardar = async (payload) => {
        setGuardando(true);
        try {
            // El aviso —de éxito o de error— lo pone el cascarón, igual que en Acciones.
            await onAccion?.('guardar_plan', payload);
            setEditando(false);
        } catch {
            // Se queda abierto con lo cargado, para corregir sin volver a tipear el plan entero.
        } finally {
            setGuardando(false);
        }
    };

    if (editando) {
        return (
            // La `key` son las cuotas guardadas: al volver de un guardado, el editor se remonta
            // con el plan que quedó en la base y no con el que tenía en la mano.
            <PlanCuotasForm key={(ficha?.cobro?.cuotas || []).map(c => c.id).join('-')}
                ficha={ficha} onGuardar={guardar} guardando={guardando}>
                {({ boton }) => (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--s3)' }}>
                        <button type="button" className="btn btn--linea btn--sm"
                            disabled={guardando} onClick={() => setEditando(false)}>
                            Cancelar
                        </button>
                        {boton}
                    </div>
                )}
            </PlanCuotasForm>
        );
    }

    return (
        <>
            {cuotas.length
                ? cuotas.map((c, i) => (
                    <Fila key={c.id ?? i} a={fecha(c.fecha_vencimiento || c.fecha)}
                        b={`Cuota ${c.numero_cuota ?? c.numero ?? i + 1}`}
                        c={plata(c.monto)} chip={chipDeCuota(c.estado)} />
                ))
                : <Vacio texto="Sin plan de cuotas armado." />}
            {puedeEditar && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--s3)' }}>
                    <button type="button" className="btn btn--linea btn--sm" onClick={() => setEditando(true)}>
                        {cuotas.length ? 'Editar el plan' : 'Armar el plan'}
                    </button>
                </div>
            )}
        </>
    );
};

const TabHistorial = ({ ficha, onAccion, puedeEditar = true }) => {
    const hist = ficha?.historial || {};
    const cobro = ficha?.cobro || {};
    const conf = ficha?.confirmacion || {};

    const agendas = hist.agendas || [];
    const seguimientos = hist.seguimientos || [];
    const pagos = cobro.pagos || [];
    const cuotas = cobro.cuotas || [];
    const eventos = hist.eventos || [];

    const puedeCobrar = puedeEditar && ficha?.permisos?.cobrar !== false;
    // Corregir el estado de una agenda es reportar, no cobrar: es el mismo permiso con el que la
    // ruta lo comprueba.
    const puedeReportar = puedeEditar && ficha?.permisos?.reportar !== false;
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
            `${cuenta('pagado')} pagada${cuenta('pagado') === 1 ? '' : 's'}`,
            cuenta('vencido') ? `${cuenta('vencido')} vencida${cuenta('vencido') === 1 ? '' : 's'}` : null,
        ].filter(Boolean).join(' · ');

    const totalPagado = pagos.reduce((x, p) => x + (Number(p.monto) || 0), 0);

    // La banda del cobro es de un cliente: un lead que todavía no compró no tiene nada que poner
    // ahí y la franja quedaría en cuatro guiones.
    const esCliente = pagos.length > 0 || cuotas.length > 0 || cobro.total != null
        || (Number(cobro.deuda) || 0) > 0;

    return (
        <div style={{ display: 'grid', gap: 'var(--s3)' }}>
            {esCliente && (
                <ResumenCobro cobro={cobro} programas={ficha?.vocabulario?.programas}
                    puedeEditar={puedeCobrar} onAccion={onAccion} />
            )}

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
                <Agendas agendas={agendas} vocabulario={ficha?.vocabulario}
                    closerId={ficha?.identidad?.closer?.id}
                    puedeEditar={puedeReportar} onAccion={onAccion} />
            </SeccionColapsable>

            <SeccionColapsable titulo="Plan de cuotas" resumen={resumenCuotas}>
                <PlanDeCuotas ficha={ficha} cuotas={cuotas} onAccion={onAccion}
                    puedeEditar={puedeCobrar} />
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
                    resumen={`${eventos.length} ${eventos.length === 1 ? 'evento' : 'eventos'}`
                        + (eventos[0]?.fecha ? ` · último ${fecha(eventos[0].fecha)}` : '')}>
                    {eventos.map((e, i) => (
                        <Fila key={e.id ?? i} a={fecha(e.fecha)} b={e.detalle} c={e.autor} />
                    ))}
                </SeccionColapsable>
            )}
        </div>
    );
};

export default TabHistorial;
