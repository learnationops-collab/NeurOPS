import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileUp, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Chip, Select } from '../../../../components/standard';
import { EsqueletoTablero, PanelCab, Segmented } from '../Shared';
import { Cifron, HUMOS, conSigno, dinero, tonoDe } from './comun';
import { esFresco, guardarCache, leerCache } from '../../../../services/cacheDeVistas';
import { resumenDeCarga } from './Diferencias';
import * as apiFz from './finanzasApi';

/**
 * Finanzas › Cobros (04/11/2026): cada cobro del período con su bruto, su neto en el sistema y su neto
 * según los CSV de Stripe y Hotmart (el cruce de Diferencias, `finance_cobros.py`). Pedido de Mario, para
 * cotejar el cash con lo que entró de verdad. Filtro por closer y por estado, subir los CSV desde acá,
 * aprobar las transferencias a mano y descargar lo filtrado en CSV.
 */

const v = (tono) => `var(--${tono})`;
const TODOS = '';
const ESTADOS = {
    coincide: { label: 'Coincide', tono: 'success' },
    neto_distinto: { label: 'Neto distinto', tono: 'warning' },
    otra_pasarela: { label: 'Otra pasarela', tono: 'brand-primary' },
    sin_csv: { label: 'No está en el CSV', tono: 'error' },
    transferencia: { label: 'Transferencia', tono: 'info' },
    otro_medio: { label: 'Otro medio', tono: 'text-muted' },
    sin_reportar: { label: 'Sin reportar', tono: 'error' },
};
const A_REVISAR = (f) => ['neto_distinto', 'otra_pasarela', 'sin_csv', 'sin_reportar'].includes(f.estado)
    || (f.estado === 'transferencia' && !f.aprobada);
const FILTROS = [['todas', 'Todas'], ['revisar', 'Para revisar'], ...Object.entries(ESTADOS).map(([k, e]) => [k, e.label])];
const COLS = { '--cols': '54px minmax(170px,1.5fr) minmax(90px,.8fr) minmax(90px,.8fr) 96px 104px 104px 96px minmax(150px,1fr)', '--min': '1080px' };

const CABECERA = [['Fecha', 'del cobro'], ['Cliente', 'y closer'], ['Tipo de pago', 'cargado'], ['Procesador', 'reportado'],
    ['Bruto', 'lo cargado', true], ['Neto sistema', 'la plataforma', true], ['Neto CSV', 'Stripe y Hotmart', true],
    ['Diferencia', 'sistema − CSV', true], ['Estado', 'del cruce']];

const normal = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const fechaCorta = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
const suma = (filas, campo) => Math.round(filas.reduce((a, f) => a + (f[campo] || 0), 0) * 100) / 100;
const netoCsv = (f) => (f.estado === 'transferencia' ? f.neto : f.neto_csv);

const csvDe = (filas) => {
    const celda = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
    const cab = ['Fecha', 'Cliente', 'Email', 'Closer', 'Tipo de pago', 'Procesador', 'Bruto', 'Neto sistema',
        'Neto sistema verificado', 'Neto CSV', 'Diferencia', 'Estado', 'Aprobada'];
    const lineas = filas.map(f => [f.fecha?.slice(0, 10), f.cliente, f.email, f.closer, f.tipo_pago, f.procesador,
        f.bruto, f.neto, f.verificado ? 'Sí' : 'No', netoCsv(f), f.diferencia, ESTADOS[f.estado]?.label,
        f.estado === 'transferencia' ? (f.aprobada ? 'Sí' : 'No') : ''].map(celda).join(','));
    return [cab.map(celda).join(','), ...lineas].join('\n');
};

const descargar = (filas, nombre) => {
    const url = URL.createObjectURL(new Blob(['﻿' + csvDe(filas)], { type: 'text/csv;charset=utf-8' }));
    Object.assign(document.createElement('a'), { href: url, download: nombre }).click();
    URL.revokeObjectURL(url);
};

// Los cobros de los CSV sin venta en el sistema, como filas de la misma tabla.
const filasSinReportar = (lista) => lista.map(s => ({
    id: s.clave, fecha: s.fecha, cliente: s.movimientos[0]?.nombre || 'Sin nombre', email: s.movimientos[0]?.email || '',
    closer: 'Sin closer', tipo_pago: '—', procesador: s.pasarela, bruto: null, neto: null, neto_csv: s.neto,
    estado: 'sin_reportar', movimientos: s.movimientos, sinVenta: true,
}));

const useCobros = (periodo) => {
    const clave = `finanzas:cobros2:${periodo.desde}|${periodo.hasta}`;
    const [datos, setDatos] = useState(() => leerCache(clave)?.datos ?? null);
    const cargar = useCallback(() => apiFz.getCobros(periodo)
        .then((r) => { guardarCache(clave, r); setDatos(r); })
        .catch(() => toast.error('No se pudieron cargar los cobros')), [periodo, clave]);
    useEffect(() => {
        const guardado = leerCache(clave);
        setDatos(guardado ? guardado.datos : null);
        if (!esFresco(guardado)) cargar();
    }, [cargar]); // eslint-disable-line react-hooks/exhaustive-deps
    return [datos, cargar];
};

const KpisCobros = ({ filas }) => {
    const ventas = filas.filter(f => !f.sinVenta);
    const enCsv = ventas.filter(f => f.neto_csv != null || f.estado === 'transferencia');
    const fuera = ventas.filter(f => f.neto_csv == null && f.estado !== 'transferencia');
    const diferencia = suma(ventas, 'diferencia');
    const revisar = filas.filter(A_REVISAR).length;
    return (
        <div className="fz-grid fz-grid--4">
            <Cifron rotulo="Neto sistema" valor={dinero(suma(ventas, 'neto'))} humo={HUMOS.marca}
                sub={`${ventas.length} cobros · bruto ${dinero(suma(ventas, 'bruto'))}`}
                ayuda="Lo que calcula la plataforma: el neto del extracto si el cobro está verificado; si no, el estimado con la comisión promedio de su procesador." />
            <Cifron rotulo="Neto CSV" valor={dinero(suma(enCsv, 'neto_csv') + suma(enCsv.filter(f => f.estado === 'transferencia'), 'neto'))}
                tono="success" humo={HUMOS.ingreso}
                sub={fuera.length ? `${enCsv.length} cobros · faltan ${fuera.length} por ${dinero(suma(fuera, 'neto'))}` : `${enCsv.length} cobros`}
                ayuda="Lo que llegó según los CSV de Stripe y Hotmart subidos, más las transferencias por su monto. Los cobros que no están en ningún CSV no suman acá." />
            <Cifron rotulo="Diferencia" valor={conSigno(diferencia)} tono={tonoDe(-diferencia)} humo={HUMOS.info}
                sub="neto sistema − neto CSV"
                ayuda="Solo de los cobros que están en el CSV. Positiva: el sistema cuenta más de lo que llegó." />
            <Cifron rotulo="Para revisar" valor={String(revisar)} humo={HUMOS.marca}
                sub="neto distinto, sin CSV, otra pasarela o transferencia sin aprobar"
                ayuda="Los cobros que no cierran con los CSV y las transferencias que todavía no aprobaste." />
        </div>
    );
};

const Detalle = ({ f }) => (
    <div className="fz-fila" style={{ display: 'block', minHeight: 0, padding: '10px 12px', background: v('mat-0'), fontSize: 12.5 }}>
        {f.falta_csv && <p style={{ margin: 0 }}>Falta subir el CSV de {f.falta_csv} de este período.</p>}
        {f.estado === 'sin_csv' && !f.falta_csv && <p style={{ margin: 0 }}>No hay ningún cobro de esta persona en el CSV de {f.procesador} a 3 días o menos. ¿Transferencia o no pagó?</p>}
        {f.estado === 'otra_pasarela' && <p style={{ margin: 0 }}>Se reportó por {f.procesador}, pero el cobro está en {f.pasarela_csv} ({dinero(f.bruto_csv)}). Se corrige en Diferencias.</p>}
        {f.estado === 'transferencia' && <p style={{ margin: 0 }}>No pasa por Stripe ni Hotmart: se coteja con el banco.{f.aprobada_por ? ` Aprobada por ${f.aprobada_por}.` : ''}</p>}
        {!f.verificado && f.neto_csv != null && !f.sinVenta && <p style={{ margin: 0 }}>El neto del sistema es estimado: el cobro no está verificado contra el extracto.</p>}
        {(f.movimientos || []).map(m => (
            <p key={m.id} style={{ margin: '4px 0 0', color: v('text-muted') }}>
                {m.pasarela === 'hotmart' ? 'Hotmart' : 'Stripe'} {fechaCorta(m.fecha)} · {m.nombre} · {m.email}{m.neto != null ? ` · neto ${dinero(m.neto)}` : ''}
            </p>
        ))}
    </div>
);

const FilaCobro = ({ f, abierta, onAbrir, onAprobar }) => {
    const e = ESTADOS[f.estado];
    return (
        <>
            <div className="fz-fila" role="button" tabIndex={0} onClick={onAbrir} style={{ cursor: 'pointer' }}
                onKeyDown={(ev) => { if (ev.key === 'Enter') onAbrir(); }} aria-expanded={abierta}>
                <span className="tdatos-p" style={{ textAlign: 'left' }}>{fechaCorta(f.fecha)}</span>
                <span className="trunc" style={{ display: 'grid' }}>
                    <b className="trunc">{f.cliente}</b>
                    <small className="trunc" style={{ color: v('text-muted') }}>{f.closer}{f.ig ? ` · ${f.ig}` : ''}</small>
                </span>
                <span className="trunc">{f.tipo_pago}</span>
                <span className="trunc">{f.procesador}</span>
                <span className="fz-n fz-der">{f.bruto == null ? '—' : dinero(f.bruto)}</span>
                <span className="fz-n fz-der" title={f.verificado ? 'Verificado contra el extracto' : 'Estimado con la comisión promedio'}>
                    {f.neto == null ? '—' : dinero(f.neto)}{f.neto != null && !f.verificado ? '*' : ''}
                </span>
                <span className="fz-n fz-der" style={{ color: v('success') }}>{netoCsv(f) == null ? '—' : dinero(netoCsv(f))}</span>
                <span className="fz-n fz-der" style={{ color: f.diferencia == null ? v('text-muted') : v(tonoDe(-f.diferencia)) }}>
                    {f.diferencia == null ? '—' : conSigno(f.diferencia)}
                </span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Chip color={v(e.tono)} subtle>{e.label}</Chip>
                    {f.estado === 'transferencia' && (
                        <Button size="sm" variant={f.aprobada ? 'primary' : 'secondary'}
                            onClick={(ev) => { ev.stopPropagation(); onAprobar(f); }}>
                            {f.aprobada ? 'Aprobada' : 'Aprobar'}
                        </Button>
                    )}
                </span>
            </div>
            {abierta && <Detalle f={f} />}
        </>
    );
};

const SubirCsv = ({ onListo }) => {
    const input = useRef(null);
    const [subiendo, setSubiendo] = useState(false);
    const subir = async (archivos) => {
        setSubiendo(true);
        for (const archivo of archivos) {
            try {
                toast.success(resumenDeCarga(await apiFz.subirCsv(archivo)));
            } catch (e) {
                const cuerpo = e?.response?.data;
                toast.error(cuerpo?.codigo === 'pasarela'
                    ? `${archivo.name}: no se reconoce de qué pasarela es. Subilo desde Diferencias, que deja elegirla.`
                    : `${archivo.name}: ${cuerpo?.error || 'no se pudo subir'}`);
            }
        }
        setSubiendo(false);
        await onListo();
    };
    return (
        <>
            <input ref={input} type="file" accept=".csv,text/csv" multiple hidden
                onChange={(e) => { const a = [...e.target.files]; e.target.value = ''; if (a.length) subir(a); }} />
            <Button icon={<FileUp />} onClick={() => input.current?.click()} disabled={subiendo}>
                {subiendo ? 'Subiendo…' : 'Subir CSV'}
            </Button>
        </>
    );
};

const Cobros = ({ periodo }) => {
    const [datos, recargar] = useCobros(periodo);
    const [closer, setCloser] = useState(TODOS);
    const [estado, setEstado] = useState('todas');
    const [buscar, setBuscar] = useState('');
    const [abierta, setAbierta] = useState(null);

    const todas = useMemo(() => (datos ? [...datos.filas, ...filasSinReportar(datos.sin_reportar || [])] : null), [datos]);
    const opciones = useMemo(() => [{ value: TODOS, label: 'Todos los closers' },
        ...[...new Set((todas || []).map(f => f.closer))].sort().map(c => ({ value: c, label: c }))], [todas]);
    const deCloser = useMemo(() => {
        const texto = normal(buscar);
        return (todas || []).filter(f => (closer === TODOS || f.closer === closer)
            && (!texto || normal([f.cliente, f.email, f.ig, f.tipo_pago, f.procesador, f.bruto].join(' ')).includes(texto)));
    }, [todas, closer, buscar]);
    const filas = deCloser.filter(f => estado === 'todas' || (estado === 'revisar' ? A_REVISAR(f) : f.estado === estado));
    const cuenta = (k) => deCloser.filter(f => k === 'todas' || (k === 'revisar' ? A_REVISAR(f) : f.estado === k)).length;

    const aprobar = async (f) => {
        try {
            await apiFz.marcarRevisada(f.clave, !f.aprobada);
            await recargar();
        } catch {
            toast.error('No se pudo guardar la aprobación');
        }
    };

    if (!todas) return <EsqueletoTablero />;

    const faltan = Object.entries(datos.csv || {}).filter(([, d]) => !d.con_csv).map(([p]) => p);
    const nombreCsv = `cobros_${periodo.desde}_${periodo.hasta}${closer ? `_${normal(closer).replace(/\s+/g, '-')}` : ''}.csv`;
    return (
        <>
            <KpisCobros filas={deCloser} />
            <section className="panel">
                <PanelCab titulo="Cobros del período" tip="Cada cobro del sistema contra los CSV de Stripe y Hotmart subidos (misma persona y 3 días o menos, la regla de Diferencias). * = neto estimado. Tocá una fila para ver el cobro de la pasarela.">
                    <Select size="sm" value={closer} options={opciones} onChange={setCloser} label="Closer" />
                    <label className="busca busca--sm">
                        <Search aria-hidden="true" />
                        <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)}
                            placeholder="Buscar cliente, monto…" aria-label="Buscar en los cobros" />
                    </label>
                    <SubirCsv onListo={recargar} />
                    <Button icon={<Download />} onClick={() => descargar(filas, nombreCsv)} disabled={!filas.length}>CSV</Button>
                </PanelCab>
                {faltan.length > 0 && (
                    <p className="fz-nota" style={{ marginBottom: 12 }}>
                        Falta subir el CSV de {faltan.join(' y ')} de este período: sus cobros quedan «No está en el CSV».
                    </p>
                )}
                <div className="fz-dif-filtros">
                    <Segmented chico opciones={FILTROS.map(([key, label]) => ({ key, label, cuenta: cuenta(key) }))}
                        valor={estado} onChange={setEstado} ariaLabel="Estado del cotejo" />
                </div>
                <div className="fz-scroll fz-scroll--fija">
                    <div className="fz-tabla" style={COLS}>
                        <div className="fz-cab">
                            {CABECERA.map(([nombre, que, der]) => (
                                <span key={nombre} className={`fz-cab2${der ? ' fz-der' : ''}`}>{nombre}<small>{que}</small></span>
                            ))}
                        </div>
                        {filas.map(f => (
                            <FilaCobro key={f.id} f={f} abierta={abierta === f.id}
                                onAbrir={() => setAbierta(a => (a === f.id ? null : f.id))} onAprobar={aprobar} />
                        ))}
                        {filas.length === 0 && <p className="fz-vacio">No hay cobros con este filtro en el período.</p>}
                    </div>
                </div>
            </section>
        </>
    );
};

export default Cobros;
