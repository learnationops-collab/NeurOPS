import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Select } from '../../../../components/standard';
import { EsqueletoTablero, PanelCab } from '../Shared';
import { Cifron, HUMOS, dinero } from './comun';
import { esFresco, guardarCache, leerCache } from '../../../../services/cacheDeVistas';
import * as apiFz from './finanzasApi';

/**
 * Finanzas › Cobros (04/11/2026): cada cobro del período con su cliente, tipo de pago, procesador,
 * bruto (lo reportado) y neto (sin la comisión de la pasarela). Pedido de Mario, para cotejarlo con
 * las transferencias reales. Filtro por closer; se descarga como CSV con lo que se ve.
 */

const TODOS = '';
const COLS = { '--cols': '62px minmax(160px,1.4fr) minmax(110px,1fr) 110px 110px 100px 100px', '--min': '820px' };
const normal = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const fechaCorta = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
const suma = (filas, campo) => Math.round(filas.reduce((a, f) => a + (f[campo] || 0), 0) * 100) / 100;

const csvDe = (filas) => {
    const celda = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
    const cab = ['Fecha', 'Cliente', 'Instagram', 'Email', 'Programa', 'Tipo de pago', 'Procesador', 'Bruto', 'Neto', 'Neto verificado', 'Closer'];
    const lineas = filas.map(f => [f.fecha?.slice(0, 10), f.cliente, f.ig, f.email, f.programa, f.tipo_pago, f.procesador,
        f.bruto, f.neto, f.verificado ? 'Sí' : 'No', f.closer].map(celda).join(','));
    return [cab.map(celda).join(','), ...lineas].join('\n');
};

const descargar = (filas, nombre) => {
    const url = URL.createObjectURL(new Blob(['﻿' + csvDe(filas)], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
    a.click();
    URL.revokeObjectURL(url);
};

const useCobros = (periodo) => {
    const clave = `finanzas:cobros:${periodo.desde}|${periodo.hasta}`;
    const [datos, setDatos] = useState(() => leerCache(clave)?.datos ?? null);
    const cargar = useCallback(() => apiFz.getCobros(periodo)
        .then((r) => { guardarCache(clave, r); setDatos(r); })
        .catch(() => toast.error('No se pudieron cargar los cobros')), [periodo, clave]);
    useEffect(() => {
        const guardado = leerCache(clave);
        setDatos(guardado ? guardado.datos : null);
        if (!esFresco(guardado)) cargar();
    }, [cargar]); // eslint-disable-line react-hooks/exhaustive-deps
    return datos;
};

const KpisCobros = ({ filas }) => {
    const bruto = suma(filas, 'bruto');
    const neto = suma(filas, 'neto');
    return (
        <div className="fz-grid fz-grid--4">
            <Cifron rotulo="Cobros" valor={String(filas.length)} humo={HUMOS.marca}
                ayuda="Los cobros completados de la lista: ventas, cuotas y señas." />
            <Cifron rotulo="Bruto" valor={dinero(bruto)} humo={HUMOS.info}
                ayuda="Lo cobrado según el reporte del closer, antes de la comisión de la pasarela." />
            <Cifron rotulo="Neto" valor={dinero(neto)} tono="success" humo={HUMOS.ingreso}
                ayuda="Lo que queda sin la comisión de la pasarela: el monto del extracto si el cobro está verificado; si no, el estimado con la comisión promedio de su procesador." />
            <Cifron rotulo="Comisiones" valor={dinero(Math.round((bruto - neto) * 100) / 100)} tono="error"
                ayuda="Bruto menos neto: lo que se llevaron las pasarelas." />
        </div>
    );
};

const FilaCobro = ({ f }) => (
    <div className="fz-fila">
        <span className="tdatos-p" style={{ textAlign: 'left' }}>{fechaCorta(f.fecha)}</span>
        <span className="trunc" style={{ display: 'grid' }}>
            <b className="trunc">{f.cliente}</b>
            <small className="trunc" style={{ color: 'var(--text-muted)' }}>{f.closer}{f.ig ? ` · ${f.ig}` : ''}</small>
        </span>
        <span className="trunc">{f.tipo_pago}</span>
        <span className="trunc">{f.procesador}</span>
        <span className="fz-n fz-der">{dinero(f.bruto)}</span>
        <span className="fz-n fz-der" style={{ color: 'var(--success)' }}
            title={f.verificado ? 'Neto del extracto (verificado)' : 'Neto estimado con la comisión promedio'}>
            {dinero(f.neto)}{f.verificado ? '' : '*'}
        </span>
        <span className="fz-n fz-der" style={{ color: 'var(--text-muted)' }}>{dinero(Math.round((f.bruto - f.neto) * 100) / 100)}</span>
    </div>
);

const Cobros = ({ periodo }) => {
    const datos = useCobros(periodo);
    const [closer, setCloser] = useState(TODOS);
    const [buscar, setBuscar] = useState('');

    const todas = datos?.filas;
    const opciones = useMemo(() => [{ value: TODOS, label: 'Todos los closers' },
        ...[...new Set((todas || []).map(f => f.closer))].sort().map(c => ({ value: c, label: c }))], [todas]);
    const filas = useMemo(() => {
        const texto = normal(buscar);
        return (todas || []).filter(f => (closer === TODOS || f.closer === closer)
            && (!texto || normal([f.cliente, f.ig, f.email, f.tipo_pago, f.procesador, f.bruto].join(' ')).includes(texto)));
    }, [todas, closer, buscar]);

    if (!todas) return <EsqueletoTablero />;

    const nombreCsv = `cobros_${periodo.desde}_${periodo.hasta}${closer ? `_${normal(closer).replace(/\s+/g, '-')}` : ''}.csv`;
    return (
        <>
            <KpisCobros filas={filas} />
            <section className="panel">
                <PanelCab titulo="Cobros del período" tip="Un renglón por cobro completado. * = neto estimado (el cobro todavía no se verificó contra el extracto en Diferencias).">
                    <Select size="sm" value={closer} options={opciones} onChange={setCloser} label="Closer" />
                    <label className="busca busca--sm">
                        <Search aria-hidden="true" />
                        <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)}
                            placeholder="Buscar cliente, monto…" aria-label="Buscar en los cobros" />
                    </label>
                    <Button icon={<Download />} onClick={() => descargar(filas, nombreCsv)} disabled={!filas.length}>CSV</Button>
                </PanelCab>
                <div className="fz-scroll">
                    <div className="fz-tabla" style={COLS}>
                        <div className="fz-cab">
                            <span>Fecha</span><span>Cliente</span><span>Tipo de pago</span><span>Procesador</span>
                            <span className="fz-der">Bruto</span><span className="fz-der">Neto</span><span className="fz-der">Comisión</span>
                        </div>
                        {filas.map(f => <FilaCobro key={f.id} f={f} />)}
                        {filas.length === 0 && <p className="fz-vacio">No hay cobros con este filtro en el período.</p>}
                    </div>
                </div>
            </section>
        </>
    );
};

export default Cobros;
