import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Calendar, Check, ChevronDown, Compass, Eye, UserCheck, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { EsqueletoTablero, Humo, PillMenu } from '../Shared';
import TasasComision from './TasasComision';
import ExcluirVentas from './ExcluirVentas';
import DetalleNomina from './DetalleNomina';
import Cifra from '../Cifra';
import RangoFechas, { rangoDe, textoRango } from '../RangoFechas';
import { Cifron, HUMOS, dinero } from './comun';
import * as apiFz from './finanzasApi';

/**
 * Sección Payroll del dashboard comercial (desde el 08/10/2026; antes /admin/payroll): la comisión
 * de cada persona en un rango de fechas, un tile por persona.
 *
 * Tocar un tile abre sus ventas en Revisar › Ventas, en el mismo período (`onVerVentas`): la lista
 * de abajo que había acá se sacó a pedido (08/10/2026), y Revisar ya tiene la tabla, la búsqueda,
 * los totales y la ficha de cada venta. Van las ventas que suman en la comisión: las que se sacaron
 * de la nómina quedan afuera, como en el número del tile. Sacarlas o volver a sumarlas se hace en
 * «Excluir ventas» de la barra (`ExcluirVentas`).
 *
 * «Exportar PDF» imprime la página: el CSS de impresión deja solo esto, con el encabezado que acá
 * no se ve (`.fz-impresion`: período y grupos, que en pantalla dice la barra) y, en hoja nueva, el
 * detalle de ventas de cada persona que se ve (`DetalleNomina`), que en pantalla está en Revisar.
 */

const v = (tono) => `var(--${tono})`;
const iso = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
// En el PDF va el año siempre: el papel se guarda y se mira meses después.
const fechaLarga = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export const PERIODOS_PAYROLL = [
    { key: 'mes', label: 'Este mes' },
    { key: 'mes_pasado', label: 'Mes pasado' },
    { key: '30d', label: 'Últimos 30 días' },
    { key: 'hoy', label: 'Hoy' },
    { key: 'custom', label: 'Personalizado', quedaAbierto: true },
];

/** {preset, desde, hasta} de un período rápido, en fechas locales (como la página vieja). */
export const rangoPayroll = (preset) => {
    const hoy = new Date();
    if (preset === 'mes_pasado') {
        return { preset, desde: iso(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
            hasta: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 0)) };
    }
    if (preset === '30d') return { preset, desde: iso(new Date(hoy.getTime() - 30 * 864e5)), hasta: iso(hoy) };
    if (preset === 'hoy') return { preset, desde: iso(hoy), hasta: iso(hoy) };
    return { preset: 'mes', desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: iso(hoy) };
};

/** La píldora del período, para la barra de arriba (como la del período del tablero). */
export const MenuPeriodoPayroll = ({ rango, onCambiar }) => {
    const elegido = PERIODOS_PAYROLL.find(p => p.key === rango.preset);
    const custom = rango.preset === 'custom';
    return (
        <PillMenu icono={<Calendar size={14} />} rotulo="período"
            texto={custom ? textoRango(rango) : elegido?.label}
            detalle={custom ? null : textoRango(rango)}
            valor={rango.preset} opciones={PERIODOS_PAYROLL} ancho={custom ? 324 : undefined}
            pie={custom ? (
                <RangoFechas rotulo="Período" desde={rango.desde} hasta={rango.hasta}
                    onCambiar={({ desde, hasta }) => {
                        if (rangoDe(desde, hasta)) onCambiar({ preset: 'custom', desde, hasta });
                    }} />
            ) : null}
            onChange={(k) => onCambiar(k === 'custom' ? { ...rango, preset: 'custom' } : rangoPayroll(k))} />
    );
};

const SETTER = { rol: 'Setter', Icono: Compass, tono: 'info', ventas: 'ventas atribuidas' };
const CLOSER = { rol: 'Closer', Icono: UserCheck, tono: 'brand-secondary', ventas: 'ventas cerradas' };
const FULFILLMENT = { rol: 'Fulfillment', Icono: Users, tono: 'success', ventas: 'ingresos' };

// Filas completas, nunca una tarjeta suelta: los dos setters, los cuatro closers con el director
// (Nerina y Gabriel desde el 08/10/2026), y los cinco de Fulfillment. `id` es la clave del filtro
// por grupos de la barra (`FiltroGrupos`). Marlon cobra dos partidas (`desglose`): sus ventas
// propias, como closer, y las de los otros closers sin renovaciones, como director; su tile suma
// las dos y abajo dice cuánto es cada una.
export const GRUPOS = [
    { id: 'setting', titulo: 'Setting', columnas: 'fz-grid--2', personas: [
        { ...SETTER, id: 'elias', nombre: 'Elias' }, { ...SETTER, id: 'paula', nombre: 'Paula' }] },
    { id: 'closing', titulo: 'Closing', columnas: 'fz-grid--5', personas: [
        ...[['jeancarlo', 'Jean Carlo'], ['facundo', 'Facundo'], ['nerina', 'Nerina'], ['gabriel', 'Gabriel']]
            .map(([id, nombre]) => ({ ...CLOSER, id, nombre })),
        { id: 'marlon', nombre: 'Marlon', rol: 'Director', Icono: UserCheck, tono: 'warning',
            ventas: 'ventas propias y de closers' }] },
    { id: 'fulfillment', titulo: 'Fulfillment', columnas: 'fz-grid--5', personas: [
        ['andy', 'Andy'], ['dari', 'Dari'], ['santi', 'Santi'], ['belu', 'Belu'], ['pedro', 'Pedro'],
    ].map(([id, nombre]) => ({ ...FULFILLMENT, id, nombre })) },
];

// Qué grupos se ven: los tres por defecto, y queda el último elegido (por navegador).
const GRUPOS_GUARDADOS = 'payroll.grupos';

export const leerGrupos = () => {
    try {
        const guardados = JSON.parse(localStorage.getItem(GRUPOS_GUARDADOS) || 'null');
        const validos = Array.isArray(guardados) ? guardados.filter(id => GRUPOS.some(g => g.id === id)) : [];
        if (validos.length) return validos;
    } catch { /* sin almacenamiento o un valor roto: los tres */ }
    return GRUPOS.map(g => g.id);
};

const guardarGrupos = (ids) => {
    try {
        localStorage.setItem(GRUPOS_GUARDADOS, JSON.stringify(ids));
    } catch { /* sin almacenamiento: dura mientras la página está abierta */ }
};

/**
 * El filtro por grupos, para la barra de arriba: cada grupo se prende y se apaga, y siempre queda
 * al menos uno (sin ninguno la sección quedaría vacía sin decir por qué).
 */
export const FiltroGrupos = ({ visibles, onCambiar }) => (
    <div className="tabs" role="group" aria-label="Grupos de la nómina">
        {GRUPOS.map(g => {
            const prendido = visibles.includes(g.id);
            return (
                <button key={g.id} type="button" className="tab" aria-pressed={prendido}
                    disabled={prendido && visibles.length === 1}
                    title={prendido && visibles.length === 1 ? 'Siempre queda al menos un grupo' : undefined}
                    onClick={() => {
                        const siguientes = prendido ? visibles.filter(id => id !== g.id)
                            : GRUPOS.map(x => x.id).filter(id => id === g.id || visibles.includes(id));
                        guardarGrupos(siguientes);
                        onCambiar(siguientes);
                    }}>
                    <span className="punto" style={{ background: prendido ? 'currentColor' : 'var(--text-muted-40)' }} />
                    {g.titulo}
                </button>
            );
        })}
    </div>
);

// Qué personas se ven, entre las de los grupos prendidos: ninguna elegida es todas. También queda
// la última elección; las de un grupo apagado se guardan pero no cuentan.
const PERSONAS = GRUPOS.flatMap(g => g.personas);
const PERSONAS_GUARDADAS = 'payroll.personas';

export const leerPersonas = () => {
    try {
        const guardadas = JSON.parse(localStorage.getItem(PERSONAS_GUARDADAS) || '[]');
        return Array.isArray(guardadas) ? guardadas.filter(id => PERSONAS.some(p => p.id === id)) : [];
    } catch {
        return [];
    }
};

const guardarPersonas = (ids) => {
    try {
        localStorage.setItem(PERSONAS_GUARDADAS, JSON.stringify(ids));
    } catch { /* sin almacenamiento: dura mientras la página está abierta */ }
};

/** Las elegidas que están en los grupos prendidos (`[]` si no hay ninguna: se ven todas). */
const elegidasVisibles = (grupos, elegidas) => GRUPOS.filter(g => grupos.includes(g.id))
    .flatMap(g => g.personas).filter(p => elegidas.includes(p.id));

/** Columnas para n tiles sin una fila con uno solo: 2, 3, 4 o 5 (6 y 9 de a tres; 7 y 8 de a cuatro). */
const columnasPara = (n) => (n <= 5 ? Math.max(n, 2) : n % 3 === 0 ? 3 : n <= 8 ? 4 : 5);

const nombres = (personas) => (personas.length <= 2
    ? personas.map(p => p.nombre).join(' y ') : `${personas.length} personas`);

/**
 * El desplegable de personas, para la barra de arriba (al lado de los grupos): una o varias de los
 * grupos prendidos, con su casilla, y «Todas» para volver a verlas a todas. El menú queda abierto
 * mientras se eligen.
 */
export const FiltroPersonas = ({ grupos, elegidas, onCambiar }) => {
    const [abierto, setAbierto] = useState(false);
    const ref = useRef(null);
    const menuRef = useRef(null);
    const visibles = GRUPOS.filter(g => grupos.includes(g.id));
    const marcadas = elegidasVisibles(grupos, elegidas);

    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, [abierto]);

    // Como el de `PillMenu`: si el menú no entra en la pantalla, se corre lo justo.
    useLayoutEffect(() => {
        const menu = menuRef.current;
        if (!abierto || !menu) return;
        menu.style.transform = '';
        const caja = menu.getBoundingClientRect();
        const borde = document.documentElement.clientWidth - 16;
        const corrimiento = caja.left < 16 ? 16 - caja.left : caja.right > borde ? borde - caja.right : 0;
        if (corrimiento) menu.style.transform = `translateX(${Math.round(corrimiento)}px)`;
    }, [abierto]);

    const cambiar = (ids) => { guardarPersonas(ids); onCambiar(ids); };
    const alternar = (id) => cambiar(elegidas.includes(id) ? elegidas.filter(x => x !== id)
        : PERSONAS.map(p => p.id).filter(x => x === id || elegidas.includes(x)));

    return (
        <div style={{ position: 'relative' }} ref={ref}>
            <button type="button" className={`pastilla${marcadas.length ? ' pastilla--on' : ''}`}
                aria-expanded={abierto} aria-haspopup="true" onClick={() => setAbierto(a => !a)}>
                <Users size={14} />
                <span className="trunc">{marcadas.length ? nombres(marcadas) : 'Todas las personas'}</span>
                <ChevronDown size={14} />
            </button>
            {abierto && (
                <div ref={menuRef} className="menu" role="menu" aria-label="Personas de la nómina">
                    <button type="button" className="menu-item" role="menuitemradio"
                        aria-checked={!marcadas.length} onClick={() => cambiar([])}>
                        <span className="trunc">Todas las personas</span>
                        {!marcadas.length && <Check size={13} style={{ marginLeft: 'auto' }} />}
                    </button>
                    {visibles.map(g => (
                        <div key={g.id} role="group" aria-label={g.titulo}>
                            <hr className="menu-sep" />
                            <p className="t-rotulo fz-menu-grupo">{g.titulo}</p>
                            {g.personas.map(p => {
                                const marcada = marcadas.some(m => m.id === p.id);
                                return (
                                    <button key={p.id} type="button" className="menu-item menu-item--ico"
                                        role="menuitemcheckbox" aria-checked={marcada} onClick={() => alternar(p.id)}>
                                        <span className="menu-caja" aria-hidden="true">{marcada && <Check size={11} />}</span>
                                        <span className="trunc">{p.nombre}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Las dos partidas de Marlon, en el orden en que se leen (el JSON llega con las claves ordenadas).
export const PARTIDAS = [['propia', 'propias'], ['director', 'director']];
const pctDe = (n) => (n == null ? '—' : `${n}%`);

/** La línea de abajo del tile: cuántas ventas y el neto, o, con dos partidas, cuánto es cada una. */
const lecturaDe = (persona, datos) => (datos.desglose
    ? PARTIDAS.filter(([k]) => datos.desglose[k]).map(([k, rotulo]) => `${rotulo} ${dinero(datos.desglose[k].comision_total)}`).join(' · ')
    : `${datos.total_ventas} ${persona.ventas} · neto ${dinero(datos.total_recaudado_neto)}`);

const Tile = ({ persona, datos, onVer }) => {
    const { Icono } = persona;
    // Fulfillment no tiene un % fijo (cada venta trae el suyo, y lo muestra la auditoría): en un
    // tile de un quinto de ancho, «% por programa» se partía en dos renglones al lado del chip.
    // Marlon tiene uno por partida: el de sus ventas propias y el de director.
    const pct = datos.desglose
        ? PARTIDAS.filter(([k]) => datos.desglose[k]).map(([k]) => pctDe(datos.desglose[k].porcentaje)).join(' · ')
        : datos.porcentaje_comision == null ? null : `${datos.porcentaje_comision}%`;
    return (
        <button type="button" className="kpi caja fz-persona" onClick={onVer} disabled={!onVer}
            title={onVer ? `Ver en Revisar las ventas de ${persona.nombre}` : 'Sin ventas en este período'}>
            <Humo colores={persona.tono === 'success' ? HUMOS.ingreso : persona.tono === 'warning' ? HUMOS.gasto : HUMOS.marca} />
            <div className="kpi-cab">
                <span className="chip" style={{ '--c': v(persona.tono) }}><Icono /> {persona.rol}</span>
                {pct && <span className="t-cap mut40 num">{pct}</span>}
            </div>
            <p className="fz-persona-nom">{persona.nombre}</p>
            <div className="kpi-cifra">
                <Cifra tag="p" className="kpi-n" valor={dinero(datos.comision_total)} style={{ color: v('success') }} />
                <p className="kpi-sub num">{lecturaDe(persona, datos)}</p>
            </div>
            {onVer && (
                <span className="kpi-acciones" aria-hidden="true">
                    <span className="kpi-acc"><Eye size={14} /> Ver ventas</span>
                </span>
            )}
        </button>
    );
};

const Payroll = ({ desde, hasta, onVerVentas, grupos, personas = [], tasasAbiertas, onCerrarTasas, excluirAbierto, onCerrarExcluir }) => {
    const [datos, setDatos] = useState(null);

    const cargar = useCallback(() => apiFz.getPayroll(desde, hasta).then(setDatos)
        .catch(() => toast.error('No se pudo cargar la nómina')), [desde, hasta]);
    useEffect(() => { setDatos(null); cargar(); }, [cargar]);

    // El detalle de ventas del PDF se arma solo mientras se imprime: siempre montado eran cientos
    // de filas escondidas y cada nombre dos veces en la página. `flushSync` porque el navegador
    // toma la hoja apenas termina `beforeprint` (vale también para Ctrl+P).
    const [imprimiendo, setImprimiendo] = useState(false);
    useEffect(() => {
        const antes = () => flushSync(() => setImprimiendo(true));
        const despues = () => setImprimiendo(false);
        window.addEventListener('beforeprint', antes);
        window.addEventListener('afterprint', despues);
        return () => {
            window.removeEventListener('beforeprint', antes);
            window.removeEventListener('afterprint', despues);
        };
    }, []);

    const modal = tasasAbiertas && (
        <TasasComision onCerrar={onCerrarTasas} onGuardado={() => { onCerrarTasas(); setDatos(null); cargar(); }} />
    );
    if (!datos) return <><EsqueletoTablero rotulo="Calculando la nómina…" />{modal}</>;
    // Recalcula sin volver al esqueleto: los tiles cambian detrás del modal a cada venta tocada.
    const excluir = excluirAbierto && (
        <ExcluirVentas datos={datos} personas={GRUPOS.flatMap(g => g.personas)}
            onCerrar={onCerrarExcluir} onCambio={cargar} />
    );

    const verVentas = (persona) => {
        const ids = (datos[persona.id]?.sales || [])
            .filter(venta => !venta.is_excluded_from_payroll).map(venta => venta.id);
        if (!ids.length || !onVerVentas) return null;
        return () => onVerVentas({ ids, rotulo: `Comisión de ${persona.nombre}`, desde, hasta });
    };

    // Los grupos prendidos y, adentro, las personas elegidas (o todas): los tiles, la suma de
    // comisiones y el PDF dicen lo mismo.
    const marcadas = elegidasVisibles(grupos, personas);
    const visibles = GRUPOS.filter(g => grupos.includes(g.id)).map(g => ({
        ...g, personas: g.personas.filter(p => !marcadas.length || marcadas.includes(p)),
    })).filter(g => g.personas.length);
    const comisiones = visibles.flatMap(g => g.personas)
        .reduce((total, p) => total + (datos[p.id]?.comision_total || 0), 0);
    const cash = datos.totales || { cash_neto: 0, cash_bruto: 0, ventas: 0 };
    const peso = cash.cash_neto ? (comisiones / cash.cash_neto) * 100 : null;
    const deQuien = marcadas.length ? `a ${nombres(marcadas)}`
        : visibles.length === GRUPOS.length ? 'de todo el equipo' : `de ${visibles.map(g => g.titulo).join(' y ')}`;
    // Elegidas algunas personas van juntas en una grilla, sin los títulos de grupo (el chip de cada
    // tile ya dice cuál es): de a una por grupo quedaba un tile suelto por renglón y media pantalla
    // vacía. Las columnas siguen a la cantidad, para que no quede una fila con uno solo.
    const secciones = marcadas.length
        ? [{ id: 'elegidas', titulo: null, personas: marcadas, columnas: `fz-grid--${columnasPara(marcadas.length)}` }]
        : visibles;

    return (
        <>
            <div className="fz-impresion">
                <p className="t-eyebrow">
                    Payroll · {marcadas.length ? marcadas.map(p => p.nombre).join(', ') : visibles.map(g => g.titulo).join(', ')}
                </p>
                <h1 className="t-h2">Nómina · {fechaLarga(desde)} – {fechaLarga(hasta)}</h1>
            </div>
            <div className="fz-grid fz-grid--3">
                <Cifron rotulo="Cash del período" valor={dinero(cash.cash_neto)} tono="success" humo={HUMOS.ingreso}
                    sub={`${cash.ventas} ${cash.ventas === 1 ? 'venta' : 'ventas'} · bruto ${dinero(cash.cash_bruto)}`}
                    ayuda="Todo lo cobrado en el período, neto de la comisión de Stripe y Hotmart: la base sobre la que se calculan las comisiones." />
                <Cifron rotulo="Comisiones" valor={dinero(comisiones)} tono="warning" humo={HUMOS.gasto}
                    sub={`A pagar ${deQuien}`}
                    ayuda="La suma de las comisiones de las personas que estás viendo, con los porcentajes vigentes en cada mes." />
                <Cifron rotulo="Peso sobre el cash" valor={peso == null ? '—' : `${peso.toFixed(1)}%`} humo={HUMOS.marca}
                    sub="Comisiones ÷ cash del período"
                    ayuda="Cuánto del cash cobrado se va en las comisiones de las personas que estás viendo." />
            </div>
            {secciones.map(g => (
                <section key={g.id} className="fz-bloque">
                    {g.titulo && <p className="t-rotulo">{g.titulo}</p>}
                    <div className={`fz-grid ${g.columnas}`}>
                        {g.personas.filter(p => datos[p.id]).map(p => (
                            <Tile key={p.id} persona={p} datos={datos[p.id]} onVer={verVentas(p)} />
                        ))}
                    </div>
                </section>
            ))}
            {imprimiendo && <DetalleNomina personas={secciones.flatMap(g => g.personas)} datos={datos} />}
            {modal}
            {excluir}
        </>
    );
};

export default Payroll;
