import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Compass, Eye, UserCheck, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { EsqueletoTablero, Humo, PillMenu } from '../Shared';
import TasasComision from './TasasComision';
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
 * de la nómina quedan afuera, como en el número del tile.
 */

const v = (tono) => `var(--${tono})`;
const iso = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;

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

// Filas completas, nunca una tarjeta suelta: los dos setters, los dos closers con el director, y
// los cinco de Fulfillment. `id` es la clave del filtro por grupos de la barra (`FiltroGrupos`).
export const GRUPOS = [
    { id: 'setting', titulo: 'Setting', columnas: 'fz-grid--2', personas: [
        { ...SETTER, id: 'elias', nombre: 'Elias' }, { ...SETTER, id: 'paula', nombre: 'Paula' }] },
    { id: 'closing', titulo: 'Closing', columnas: 'fz-grid--3', personas: [
        { ...CLOSER, id: 'jeancarlo', nombre: 'Jean Carlo' }, { ...CLOSER, id: 'facundo', nombre: 'Facundo' },
        { id: 'marlon', nombre: 'Marlon', rol: 'Director de ventas', Icono: UserCheck, tono: 'warning',
            ventas: 'ventas de closers sin renovaciones' }] },
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

const Tile = ({ persona, datos, onVer }) => {
    const { Icono } = persona;
    // Fulfillment no tiene un % fijo (cada venta trae el suyo, y lo muestra la auditoría): en un
    // tile de un quinto de ancho, «% por programa» se partía en dos renglones al lado del chip.
    const pct = datos.porcentaje_comision == null ? null : `${datos.porcentaje_comision}%`;
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
                <p className="kpi-sub num">
                    {datos.total_ventas} {persona.ventas} · neto {dinero(datos.total_recaudado_neto)}
                </p>
            </div>
            {onVer && (
                <span className="kpi-acciones" aria-hidden="true">
                    <span className="kpi-acc"><Eye size={14} /> Ver ventas</span>
                </span>
            )}
        </button>
    );
};

const Payroll = ({ desde, hasta, onVerVentas, grupos, tasasAbiertas, onCerrarTasas }) => {
    const [datos, setDatos] = useState(null);

    const cargar = useCallback(() => apiFz.getPayroll(desde, hasta).then(setDatos)
        .catch(() => toast.error('No se pudo cargar la nómina')), [desde, hasta]);
    useEffect(() => { setDatos(null); cargar(); }, [cargar]);

    const modal = tasasAbiertas && (
        <TasasComision onCerrar={onCerrarTasas} onGuardado={() => { onCerrarTasas(); setDatos(null); cargar(); }} />
    );
    if (!datos) return <><EsqueletoTablero rotulo="Calculando la nómina…" />{modal}</>;

    const verVentas = (persona) => {
        const ids = (datos[persona.id]?.sales || [])
            .filter(venta => !venta.is_excluded_from_payroll).map(venta => venta.id);
        if (!ids.length || !onVerVentas) return null;
        return () => onVerVentas({ ids, rotulo: `Comisión de ${persona.nombre}`, desde, hasta });
    };

    const visibles = GRUPOS.filter(g => grupos.includes(g.id));
    const comisiones = visibles.flatMap(g => g.personas)
        .reduce((total, p) => total + (datos[p.id]?.comision_total || 0), 0);
    const cash = datos.totales || { cash_neto: 0, cash_bruto: 0, ventas: 0 };
    const peso = cash.cash_neto ? (comisiones / cash.cash_neto) * 100 : null;
    const deQuien = visibles.length === GRUPOS.length ? 'de todo el equipo' : `de ${visibles.map(g => g.titulo).join(' y ')}`;

    return (
        <>
            <div className="fz-grid fz-grid--3">
                <Cifron rotulo="Cash del período" valor={dinero(cash.cash_neto)} tono="success" humo={HUMOS.ingreso}
                    sub={`${cash.ventas} ${cash.ventas === 1 ? 'venta' : 'ventas'} · bruto ${dinero(cash.cash_bruto)}`}
                    ayuda="Todo lo cobrado en el período, neto de la comisión de Stripe y Hotmart: la base sobre la que se calculan las comisiones." />
                <Cifron rotulo="Comisiones" valor={dinero(comisiones)} tono="warning" humo={HUMOS.gasto}
                    sub={`A pagar ${deQuien}`}
                    ayuda="La suma de las comisiones de los grupos que estás viendo, con los porcentajes vigentes en cada mes." />
                <Cifron rotulo="Peso sobre el cash" valor={peso == null ? '—' : `${peso.toFixed(1)}%`} humo={HUMOS.marca}
                    sub="Comisiones ÷ cash del período"
                    ayuda="Cuánto del cash cobrado se va en las comisiones de los grupos que estás viendo." />
            </div>
            {visibles.map(g => (
                <section key={g.id} className="fz-bloque">
                    <p className="t-rotulo">{g.titulo}</p>
                    <div className={`fz-grid ${g.columnas}`}>
                        {g.personas.filter(p => datos[p.id]).map(p => (
                            <Tile key={p.id} persona={p} datos={datos[p.id]} onVer={verVentas(p)} />
                        ))}
                    </div>
                </section>
            ))}
            {modal}
        </>
    );
};

export default Payroll;
