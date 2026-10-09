import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, Check, Pencil, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { PanelCab } from '../Shared';
import { CONCEPTOS, FUENTES } from './DetalleNomina';
import { Cifron, HUMOS, dinero } from './comun';
import * as apiFz from './finanzasApi';

/**
 * Las ventas de una persona de Payroll, en la misma vista (08/10/2026): tocar su tile abre esto en
 * lugar de los tiles, «para no pasar al director comercial para ver esas ventas» (Kerwin). Antes el
 * tile llevaba a Revisar › Ventas de /admin/comercial, la vista de la dirección. El estado va en la
 * URL (`?s=payroll&ver=elias`, ver `DashboardComercial`): el botón atrás del navegador vuelve a los
 * tiles y el link se comparte.
 *
 * Son las ventas que cuenta el tile, en el mismo período: las sacadas de la nómina se ven tachadas y
 * no suman, así que el pie cierra con el número del tile. Desde cada fila:
 *  · sacarla de la nómina o volver a sumarla: lo mismo que «Excluir ventas» de la barra (la saca
 *    para todos los que cobran sobre ella), con el mismo endpoint y el valor explícito;
 *  · cambiar su setter o su closer (no en Fulfillment: cobra sobre todo lo que entra, sea de quien
 *    sea). Mueve también las métricas comerciales, así que se abre, se elige y se confirma ahí
 *    mismo, con el aviso a la vista.
 * Cada cambio recalcula Payroll detrás (`onCambio`): los tiles y los KPIs ya están al día al volver.
 * El buscador (09/10/2026, la lista de Fulfillment es larga) filtra por cliente, programa, concepto,
 * setter o closer, sin tildes ni mayúsculas; con algo escrito, el pie suma solo lo que coincide.
 */

const fecha = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
const fechaLarga = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const v = (tono) => `var(--${tono})`;
// Para reconocer el nombre de la venta entre las personas que se pueden elegir: «Marlon García» y
// «Marlon Garcia» son la misma.
const normal = (texto) => (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
// Las dos partidas de Marlon como las dice su tile.
const PARTIDAS = { propia: 'propias', director: 'director' };

/** De qué es la venta para esta persona: la partida de Marlon, la fuente en Fulfillment. */
export const conceptoDe = (persona, venta) => {
    if (venta.concepto) return CONCEPTOS[venta.concepto] || venta.concepto;
    if (persona.rol === 'Fulfillment') return FUENTES[venta.fuente] || venta.fuente || 'Fulfillment';
    return persona.rol === 'Setter' ? 'Setting' : 'Propia';
};

const idDe = (lista, nombre) => lista?.find(p => normal(p.nombre) === normal(nombre))?.id;

/** Si la venta coincide con lo buscado (ya normalizado) en alguno de los textos que se ven en su fila. */
const coincide = (persona, venta, texto) => !texto
    || [venta.nombre_cliente, venta.instagram, venta.tipo_pago, conceptoDe(persona, venta), venta.setter, venta.closer]
        .some(campo => normal(campo).includes(texto));

/**
 * El cambio de atribución de una venta, abierto debajo de su fila: el setter y el closer con las
 * personas de cada rol, el aviso de lo que mueve y el botón que lo hace. Nada se guarda al elegir:
 * recién con «Cambiar atribución», que pide que algo haya cambiado.
 */
const EditorAtribucion = ({ venta, personas, desde, hasta, onCerrar, onCambio }) => {
    const quieto = useReducedMotion();
    const actual = { setter: idDe(personas?.setters, venta.setter), closer: idDe(personas?.closers, venta.closer) };
    const [setter, setSetter] = useState(null);   // null: el que tiene
    const [closer, setCloser] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const elegido = { setter: setter ?? actual.setter ?? '', closer: closer ?? actual.closer ?? '' };
    const cambio = {
        ...(elegido.setter !== '' && String(elegido.setter) !== String(actual.setter ?? '') ? { setter_id: Number(elegido.setter) } : {}),
        ...(elegido.closer !== '' && String(elegido.closer) !== String(actual.closer ?? '') ? { closer_id: Number(elegido.closer) } : {}),
    };
    const hayCambio = Object.keys(cambio).length > 0;

    const guardar = async () => {
        setGuardando(true);
        try {
            await apiFz.cambiarAtribucion(venta.id, { ...cambio, desde, hasta });
            toast.success('Atribución cambiada');
            onCerrar();
            onCambio();
        } catch (e) {
            toast.error(e?.response?.data?.error || 'No se pudo cambiar la atribución');
        } finally {
            setGuardando(false);
        }
    };

    // Un nombre que no está entre las elegibles (una fuente como «workshop», un closer que ya no
    // está) se ve igual, como lo actual, y no se puede volver a elegir.
    const select = (rol, rotulo, lista, nombreActual) => (
        <label className="fz-atr-campo">
            <small>{rotulo}</small>
            <select className="fz-select" aria-label={rotulo} disabled={!personas || guardando}
                value={String(elegido[rol])}
                onChange={(e) => (rol === 'setter' ? setSetter : setCloser)(e.target.value)}>
                {actual[rol] == null && <option value="" disabled>{nombreActual || 'Sin asignar'}</option>}
                {(lista || []).map(p => (
                    <option key={p.id} value={String(p.id)}>{p.activo ? p.nombre : `${p.nombre} (inactiva)`}</option>
                ))}
            </select>
        </label>
    );

    return (
        <motion.div className="fz-atribucion" role="group" aria-label={`Atribución de la venta de ${venta.nombre_cliente}`}
            initial={quieto ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            transition={quieto ? { duration: 0 } : { duration: 0.22, ease: [0.32, 0.72, 0, 1] }}>
            {select('setter', 'Setter', personas?.setters, venta.setter)}
            {select('closer', 'Closer', personas?.closers, venta.closer)}
            <p className="fz-nota fz-atr-aviso">
                <AlertTriangle />
                <span>
                    {personas ? 'Cambia también las métricas comerciales. El setter es el de la agenda del lead: '
                        + 'pasa con las otras ventas de ese lead.' : 'Cargando las personas…'}
                </span>
            </p>
            <span className="fz-acciones">
                <button type="button" className="btn btn--linea btn--sm" onClick={onCerrar} disabled={guardando}>Cancelar</button>
                <button type="button" className="btn btn--cta btn--sm" onClick={guardar} disabled={!hayCambio || guardando}>
                    {guardando ? 'Cambiando…' : 'Cambiar atribución'}
                </button>
            </span>
        </motion.div>
    );
};

/**
 * Lo que la persona recibió en su cuenta por transferencia de un cliente en el período (09/10/2026):
 * cada pago, el total que se le descuenta y lo que queda por pagarle (sueldo base + comisión −
 * transferencias, `a_pagar` del backend). Va solo si recibió algo. Se marca en la ficha del cliente,
 * sección Pagos.
 */
export const TransferenciasRecibidas = ({ persona, datos }) => {
    const pagos = datos.transferencias || [];
    if (!pagos.length) return null;
    const neto = datos.a_pagar ?? ((datos.sueldo_base || 0) + (datos.comision_total || 0) - (datos.transferencias_recibidas || 0));
    return (
        <section className="panel">
            <PanelCab titulo="Descuentos · transferencias recibidas"
                tip={`Pagos de clientes que se le hicieron por transferencia a ${persona.nombre}: la plata ya la tiene, así que se le descuenta de lo que se le paga. No cambia su comisión ni lo que cuesta. Se marcan en la ficha del cliente, sección Pagos.`} />
            <div className="fz-scroll">
                <div className="fz-tabla" style={{ '--cols': '56px minmax(150px,1fr) minmax(96px,.6fr) 110px', '--min': '480px' }}>
                    <div className="fz-cab">
                        <span>Fecha</span>
                        <span>Cliente</span>
                        <span>Medio</span>
                        <span className="fz-der">Monto</span>
                    </div>
                    {pagos.map(pago => (
                        <div key={pago.id} className="fz-fila">
                            <span className="num mut">{fecha(pago.date)}</span>
                            <span className="fz-nom">
                                <b title={pago.nombre_cliente}>{pago.nombre_cliente || 'Sin nombre'}</b>
                                <small className="trunc" title={pago.tipo_pago}>{pago.tipo_pago}</small>
                            </span>
                            <span className="trunc mut">{pago.metodo_pago}</span>
                            <span className="fz-n fz-der" style={{ color: v('error') }}>{dinero(-pago.monto)}</span>
                        </div>
                    ))}
                    <div className="fz-fila fz-total">
                        <span className="fz-rot" style={{ gridColumn: '1 / 4' }}>
                            Descuentos · {neto < -0.004 ? 'debe devolver' : 'a pagar'} {dinero(Math.abs(neto))}
                        </span>
                        <span className="fz-n fz-der" style={{ color: v('error') }}>{dinero(-datos.transferencias_recibidas)}</span>
                    </div>
                </div>
            </div>
        </section>
    );
};

const VentasDePersona = ({ persona, datos, desde, hasta, onVolver, onCambio }) => {
    const [cambios, setCambios] = useState({});   // id -> excluida, hasta que vuelve la nómina
    const [enCurso, setEnCurso] = useState(() => new Set());
    const [editando, setEditando] = useState(null);
    const [personas, setPersonas] = useState(null);
    const [buscar, setBuscar] = useState('');
    const quieto = useReducedMotion();
    const { Icono } = persona;

    // Se abre desde un tile que puede estar abajo de todo (los de Fulfillment): la lista arranca
    // arriba, con «Volver a Payroll» a la vista, y no a la altura donde estaba el tile.
    useEffect(() => {
        if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: quieto ? 'auto' : 'smooth' });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    // Fulfillment es un pozo de equipo: cobra sobre todo lo que entra, así que la atribución de una
    // venta no le cambia nada y no se edita desde acá.
    const atribuible = persona.rol !== 'Fulfillment';

    const ventas = useMemo(() => [...(datos.sales || [])]
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id)
        .map(venta => ({ ...venta, excluida: cambios[venta.id] ?? venta.is_excluded_from_payroll })),
    [datos.sales, cambios]);
    const excluidas = ventas.filter(venta => venta.excluida).length;
    const texto = normal(buscar);
    const visibles = texto ? ventas.filter(venta => coincide(persona, venta, texto)) : ventas;
    // Con una búsqueda, el pie suma las que coinciden y suman; sin ella, los totales de la nómina
    // (los del tile, al centavo).
    const sumanVisibles = visibles.filter(venta => !venta.excluida);
    const pie = texto
        ? {
            rotulo: `${visibles.length} de ${ventas.length} coinciden · ${sumanVisibles.length} `
                + (sumanVisibles.length === 1 ? 'suma' : 'suman'),
            neto: sumanVisibles.reduce((t, venta) => t + (venta.monto_neto || 0), 0),
            comision: sumanVisibles.reduce((t, venta) => t + (venta.comision || 0), 0),
        }
        : {
            rotulo: `${datos.total_ventas} ${datos.total_ventas === 1 ? 'venta suma' : 'ventas suman'}`
                + (excluidas ? ` · ${excluidas} ${excluidas === 1 ? 'excluida' : 'excluidas'}` : ''),
            neto: datos.total_recaudado_neto,
            comision: datos.comision_total,
        };

    const alternar = async (venta) => {
        const excluir = !venta.excluida;
        setCambios(c => ({ ...c, [venta.id]: excluir }));
        setEnCurso(s => new Set(s).add(venta.id));
        try {
            await apiFz.marcarExclusion(venta.id, excluir);
            onCambio();
        } catch {
            setCambios(c => ({ ...c, [venta.id]: !excluir }));
            toast.error('No se pudo cambiar la venta en la nómina');
        } finally {
            setEnCurso((s) => { const n = new Set(s); n.delete(venta.id); return n; });
        }
    };

    const editar = (venta) => {
        setEditando(e => (e === venta.id ? null : venta.id));
        if (!personas) {
            apiFz.getPersonasAtribuibles().then(setPersonas)
                .catch(() => toast.error('No se pudieron cargar los setters y closers'));
        }
    };

    // Marlon cobra dos partidas, cada una con su % y su monto (`desglose`): en un cuarto de ancho
    // van los dos números arriba y qué es cada uno abajo.
    const partidas = datos.desglose ? Object.entries(CONCEPTOS).filter(([k]) => datos.desglose[k]) : [];
    const porcentaje = partidas.length
        ? { valor: partidas.map(([k]) => `${datos.desglose[k].porcentaje ?? '—'}%`).join(' · '),
            sub: partidas.map(([k]) => PARTIDAS[k]).join(' · ') }
        : datos.porcentaje_comision != null ? { valor: `${datos.porcentaje_comision}%`, sub: 'Sobre el neto de cada venta' }
            : { valor: 'Por venta', sub: persona.rol === 'Fulfillment' ? 'Según el programa y la fuente' : 'Cambió dentro del período' };
    // Lo que recibió por transferencia de un cliente (09/10/2026), también arriba y en rojo, como en
    // su tile: la lista de abajo dice de qué pagos sale. Con descuento, «A pagar en el período»
    // sobra: lo que se le paga es el «a pagar» del renglón rojo.
    const recibidas = datos.transferencias_recibidas || 0;
    const subComision = [
        partidas.length ? partidas.map(([k]) => `${PARTIDAS[k]} ${dinero(datos.desglose[k].comision_total)}`).join(' · ')
            : recibidas > 0.004 ? null : 'A pagar en el período',
        datos.sueldo_base > 0 ? `base ${dinero(datos.sueldo_base)} aparte` : null,
    ].filter(Boolean).join(' · ');
    const aPagar = datos.a_pagar ?? ((datos.sueldo_base || 0) + (datos.comision_total || 0) - recibidas);
    const descuento = recibidas > 0.004 && (
        <span className="fz-persona-descuento" style={{ display: 'block' }}>
            descuentos {dinero(-recibidas)} · {aPagar < -0.004 ? `debe devolver ${dinero(-aPagar)}` : `a pagar ${dinero(aPagar)}`}
        </span>
    );
    const cols = ['48px', '56px', 'minmax(150px,1.3fr)', 'minmax(84px,.6fr)', 'minmax(96px,.7fr)', 'minmax(104px,.7fr)',
        '96px', '52px', '100px', ...(atribuible ? ['44px'] : [])].join(' ');

    return (
        <div className="fz-ventas">
            <div className="fz-ventas-cab">
                <button type="button" className="btn btn--linea btn--sm" onClick={onVolver}>
                    <ArrowLeft /> Volver a Payroll
                </button>
                <span className="chip" style={{ '--c': v(persona.tono) }}><Icono /> {persona.rol}</span>
                <h2 className="t-h2 trunc">{persona.nombre}</h2>
                <span className="t-cap mut40 num fz-ventas-periodo">{fechaLarga(desde)} – {fechaLarga(hasta)}</span>
            </div>

            <div className="fz-grid fz-grid--4">
                <Cifron rotulo="Comisión" valor={dinero(datos.comision_total)} tono="success" humo={HUMOS.ingreso}
                    sub={descuento ? <>{subComision}{descuento}</> : subComision}
                    ayuda="La suma de la comisión de cada venta que suma, con el % del mes de cada una: el número de su tile. Las excluidas no cuentan." />
                <Cifron rotulo="Neto que suma" valor={dinero(datos.total_recaudado_neto)} humo={HUMOS.info}
                    sub="Sin la comisión de Stripe y Hotmart"
                    ayuda="El cash neto de las ventas que le pagan comisión en el período, sin las excluidas." />
                <Cifron rotulo="Ventas" valor={String(datos.total_ventas)} humo={HUMOS.marca}
                    sub={excluidas ? `${excluidas} ${excluidas === 1 ? 'excluida' : 'excluidas'} aparte` : 'Ninguna excluida'}
                    ayuda="Las ventas que suman en su comisión. Las sacadas de la nómina se ven abajo, tachadas." />
                <Cifron rotulo="Porcentaje" valor={porcentaje.valor} humo={HUMOS.gasto} sub={porcentaje.sub}
                    ayuda="El % con el que cobra en el período. Si cambió en el medio, o es de Fulfillment, cada venta trae el suyo." />
            </div>

            <TransferenciasRecibidas persona={persona} datos={datos} />

            <section className="panel">
                <PanelCab titulo={`Ventas de ${persona.nombre}`}
                    tip={atribuible
                        ? 'La casilla saca la venta de la nómina de todos los que cobran sobre ella, o la vuelve a sumar. El lápiz cambia su setter o su closer. Cada cambio se guarda al momento y recalcula Payroll.'
                        : 'La casilla saca la venta de la nómina de todos los que cobran sobre ella, o la vuelve a sumar. Fulfillment cobra sobre todo lo que entra, así que la atribución de cada venta no cambia su comisión y no se edita acá.'}>
                    {ventas.length > 0 && (
                        <label className="busca busca--sm fz-ventas-busca">
                            <Search aria-hidden="true" />
                            <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)}
                                placeholder="Buscar cliente, programa, setter…" aria-label={`Buscar en las ventas de ${persona.nombre}`} />
                        </label>
                    )}
                </PanelCab>
                <div className="fz-scroll">
                    <div className="fz-tabla" style={{ '--cols': cols, '--min': atribuible ? '980px' : '920px' }}>
                        <div className="fz-cab">
                            <span className="fz-centro">Nómina</span>
                            <span>Fecha</span>
                            <span>Cliente</span>
                            <span>Concepto</span>
                            <span>Setter</span>
                            <span>Closer</span>
                            <span className="fz-der">Neto</span>
                            <span className="fz-der">%</span>
                            <span className="fz-der">Comisión</span>
                            {atribuible && <span className="fz-centro" aria-label="Atribución" />}
                        </div>
                        {visibles.map(venta => (
                            <React.Fragment key={venta.id}>
                                <div className={`fz-fila${venta.excluida ? ' fz-excluida' : ''}${editando === venta.id ? ' fz-fila--abierta' : ''}`}>
                                    <span className="fz-centro" style={{ display: 'flex' }}>
                                        <button type="button" className="fz-check" aria-pressed={!venta.excluida}
                                            disabled={enCurso.has(venta.id)}
                                            aria-label={`${venta.excluida ? 'Volver a sumar' : 'Sacar de la nómina'} la venta de ${venta.nombre_cliente}`}
                                            onClick={() => alternar(venta)}>
                                            <Check />
                                        </button>
                                    </span>
                                    <span className="num mut">{fecha(venta.date)}</span>
                                    <span className="fz-nom">
                                        <b className="fz-tachable" title={venta.nombre_cliente}>{venta.nombre_cliente}</b>
                                        <small className="trunc" title={venta.tipo_pago}>{venta.tipo_pago}</small>
                                    </span>
                                    <span className="trunc mut">{conceptoDe(persona, venta)}</span>
                                    <span className="trunc" title={venta.setter}>{venta.setter}</span>
                                    <span className="trunc" title={venta.closer}>{venta.closer}</span>
                                    <span className="fz-n fz-der mut">{dinero(venta.monto_neto)}</span>
                                    <span className="num fz-der mut">{venta.porcentaje != null ? `${venta.porcentaje}%` : '—'}</span>
                                    <span className="fz-n fz-der fz-tachable" style={{ color: v('success') }}>{dinero(venta.comision)}</span>
                                    {atribuible && (
                                        <span className="fz-centro" style={{ display: 'flex' }}>
                                            <button type="button" className="ibtn ibtn--sm" aria-expanded={editando === venta.id}
                                                aria-label={`Cambiar la atribución de la venta de ${venta.nombre_cliente}`}
                                                title="Cambiar setter o closer" onClick={() => editar(venta)}>
                                                <Pencil />
                                            </button>
                                        </span>
                                    )}
                                </div>
                                {editando === venta.id && (
                                    <EditorAtribucion venta={venta} personas={personas} desde={desde} hasta={hasta}
                                        onCerrar={() => setEditando(null)} onCambio={onCambio} />
                                )}
                            </React.Fragment>
                        ))}
                        {ventas.length === 0 && (
                            <p className="fz-vacio">Sin ventas que le paguen comisión en este período.</p>
                        )}
                        {ventas.length > 0 && visibles.length === 0 && (
                            <p className="fz-vacio">Ninguna venta coincide con «{buscar.trim()}».</p>
                        )}
                        {visibles.length > 0 && (
                            <div className="fz-fila fz-total">
                                <span className="fz-rot" style={{ gridColumn: '1 / 7' }}>{pie.rotulo}</span>
                                <span className="fz-n fz-der">{dinero(pie.neto)}</span>
                                <span />
                                <span className="fz-n fz-der" style={{ color: v('success') }}>{dinero(pie.comision)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default VentasDePersona;
