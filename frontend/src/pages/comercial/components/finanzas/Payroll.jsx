import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Check, ClipboardList, Compass, UserCheck, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { EsqueletoFilas, EsqueletoTablero, Humo, PanelCab, PillMenu } from '../Shared';
import Cifra from '../Cifra';
import RangoFechas, { rangoDe, textoRango } from '../RangoFechas';
import { HUMOS, dinero } from './comun';
import * as apiFz from './finanzasApi';

/**
 * Sección Payroll del dashboard comercial (desde el 08/10/2026; antes /admin/payroll): la comisión
 * de cada persona en un rango de fechas y, debajo, las ventas que la componen, con la casilla que
 * saca una venta de la nómina.
 *
 * Cada persona es un tile; tocarlo elige la auditoría de abajo. Los de Fulfillment no tienen un %
 * fijo: cada venta trae el suyo (depende del programa y de la fuente), y la tabla lo muestra.
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
// los cinco de Fulfillment.
const GRUPOS = [
    { titulo: 'Setters', columnas: 'fz-grid--2', personas: [
        { ...SETTER, id: 'elias', nombre: 'Elias' }, { ...SETTER, id: 'paula', nombre: 'Paula' }] },
    { titulo: 'Closers y dirección', columnas: 'fz-grid--3', personas: [
        { ...CLOSER, id: 'jeancarlo', nombre: 'Jean Carlo' }, { ...CLOSER, id: 'facundo', nombre: 'Facundo' },
        { id: 'marlon', nombre: 'Marlon', rol: 'Director de ventas', Icono: UserCheck, tono: 'warning',
            ventas: 'ventas de closers sin renovaciones' }] },
    { titulo: 'Fulfillment', columnas: 'fz-grid--5', personas: [
        ['andy', 'Andy'], ['dari', 'Dari'], ['santi', 'Santi'], ['belu', 'Belu'], ['pedro', 'Pedro'],
    ].map(([id, nombre]) => ({ ...FULFILLMENT, id, nombre })) },
];
const PERSONAS = GRUPOS.flatMap(g => g.personas);

const AUDITORIA = {
    elias: 'Ventas atribuidas a Elias como setter.',
    paula: 'Ventas atribuidas a Paula como setter.',
    jeancarlo: 'Ventas cerradas por Jean Carlo.',
    facundo: 'Ventas cerradas por Facundo.',
    marlon: 'Ventas de Jean Carlo y Facundo, sin renovaciones: el 5% de Marlon.',
};
const AUDITORIA_FULFILLMENT = 'Renovaciones, upsells, cuotas y conversiones de seña que le pagan comisión. El % depende del programa y de la fuente.';

const FUENTES = { renovacion: 'Renovación', upsell: 'Upsell', conversion: 'Conversión', cuota: 'Cuota' };

const fecha = (iso_) => (iso_ ? `${iso_.slice(8, 10)}/${iso_.slice(5, 7)}` : '—');

const Tile = ({ persona, datos, activa, onElegir }) => {
    const { Icono } = persona;
    // Fulfillment no tiene un % fijo (cada venta trae el suyo, y lo muestra la auditoría): en un
    // tile de un quinto de ancho, «% por programa» se partía en dos renglones al lado del chip.
    const pct = datos.porcentaje_comision == null ? null : `${datos.porcentaje_comision}%`;
    return (
        <button type="button" className="kpi caja fz-persona" aria-pressed={activa} onClick={onElegir}>
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
        </button>
    );
};

const Payroll = ({ desde, hasta }) => {
    const [datos, setDatos] = useState(null);
    const [activa, setActiva] = useState('elias');

    const cargar = useCallback(() => apiFz.getPayroll(desde, hasta).then(setDatos)
        .catch(() => toast.error('No se pudo cargar la nómina')), [desde, hasta]);
    useEffect(() => { setDatos(null); cargar(); }, [cargar]);

    const alternar = async (venta) => {
        try {
            await apiFz.alternarExclusion(venta.id);
            await cargar();
        } catch {
            toast.error('No se pudo cambiar la venta en la nómina');
        }
    };

    if (!datos) {
        return (
            <>
                <EsqueletoTablero rotulo="Calculando la nómina…" />
                <section className="panel"><EsqueletoFilas lineas={6} /></section>
            </>
        );
    }

    const persona = PERSONAS.find(p => p.id === activa) || PERSONAS[0];
    const auditada = datos[persona.id];
    const esFulfillment = persona.rol === 'Fulfillment';
    const cols = {
        '--cols': `48px 64px minmax(140px,1fr) minmax(110px,.8fr) 90px${esFulfillment ? ' 130px' : ''} 100px 100px`,
        '--min': esFulfillment ? '860px' : '730px',
    };

    return (
        <>
            {GRUPOS.map(g => (
                <section key={g.titulo} className="fz-bloque">
                    <p className="t-rotulo">{g.titulo}</p>
                    <div className={`fz-grid ${g.columnas}`}>
                        {g.personas.filter(p => datos[p.id]).map(p => (
                            <Tile key={p.id} persona={p} datos={datos[p.id]} activa={p.id === persona.id}
                                onElegir={() => setActiva(p.id)} />
                        ))}
                    </div>
                </section>
            ))}

            <section className="panel">
                <PanelCab titulo={`Auditoría · ${persona.nombre}`}
                    tip={`${AUDITORIA[persona.id] || AUDITORIA_FULFILLMENT} La casilla saca una venta de la nómina: deja de sumar para todos los que cobran sobre ella.`}>
                    <span className="chip" style={{ '--c': v('info') }}>
                        <ClipboardList /> {auditada.total_ventas} {auditada.total_ventas === 1 ? 'venta' : 'ventas'}
                    </span>
                    <button type="button" className="btn btn--linea btn--sm" onClick={() => window.print()}>
                        Exportar PDF
                    </button>
                </PanelCab>
                <div className="fz-scroll">
                    <div className="fz-tabla" style={cols}>
                        <div className="fz-cab">
                            <span className="fz-centro">Nómina</span>
                            <span>Fecha</span>
                            <span>Cliente</span>
                            <span>Programa</span>
                            <span>Método</span>
                            {esFulfillment && <span>Fuente</span>}
                            <span className="fz-der">Bruto</span>
                            <span className="fz-der">Comisión</span>
                        </div>
                        {auditada.sales.map(venta => {
                            const excluida = venta.is_excluded_from_payroll;
                            const comision = venta.comision ?? (venta.monto_neto * auditada.porcentaje_comision) / 100;
                            return (
                                <div key={venta.id} className={`fz-fila${excluida ? ' fz-excluida' : ''}`}>
                                    <span className="fz-centro" style={{ display: 'flex' }}>
                                        <button type="button" className="fz-check" aria-pressed={!excluida}
                                            aria-label={`${excluida ? 'Volver a sumar' : 'Sacar de la nómina'} la venta de ${venta.nombre_cliente}`}
                                            onClick={() => alternar(venta)}>
                                            <Check />
                                        </button>
                                    </span>
                                    <span className="num mut">{fecha(venta.date)}</span>
                                    <span className="trunc fz-tachable" style={{ fontWeight: 700 }}>{venta.nombre_cliente}</span>
                                    <span className="trunc mut">{venta.tipo_pago}</span>
                                    <span className="trunc mut">{venta.metodo_pago}</span>
                                    {esFulfillment && (
                                        <span className="trunc">{FUENTES[venta.fuente] || venta.fuente} · <b>{venta.porcentaje}%</b></span>
                                    )}
                                    <span className="fz-n fz-der mut">{dinero(venta.monto_bruto)}</span>
                                    <span className="fz-n fz-der fz-tachable" style={{ color: v('success') }}>{dinero(comision)}</span>
                                </div>
                            );
                        })}
                        {auditada.sales.length === 0 && <p className="fz-vacio">No hay ventas que le paguen comisión en este período.</p>}
                    </div>
                </div>
            </section>
        </>
    );
};

export default Payroll;
