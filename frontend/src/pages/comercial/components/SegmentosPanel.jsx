import { useCallback, useEffect, useMemo, useState } from 'react';
import { useVerRegistros } from '../../../components/standard';
import ContenidoRegistros from '../../admin/marketing/anuncios/ContenidoRegistros';
import FiltroSegmentos from '../../admin/marketing/todos/FiltroSegmentos';
import { COLOR_SEGMENTO } from '../../admin/marketing/todos/segmentos';
import { getSegmentos, getSegmentosRegistros } from '../comercialApi';
import { Panel, PanelCab, Vacio } from './PiezasAnalizar';
import { fmt } from './Shared';
import '../../admin/marketing/todos/todos.css';
import '../../admin/marketing/todos/cifra.css';
import '../../admin/marketing/todos/segmentos.css';

/**
 * Analizar › Segmentos (Gabriela, 28/10/2026): las agendas del período partidas en A, B, C, D y «sin segmento»
 * (las viejas de Calendly/n8n y quienes no llenaron el formulario). El closer ve su show up y su cierre por
 * segmento; el setter, cuántas de las agendas que generó son de cada uno. Los grupos suman el total, y cada cifra
 * abre la lista de las agendas que la suman (`useVerRegistros`). Cuentas en `app/services/segmentos_comercial.py`.
 *
 * El filtro (`elegidos`, de la URL del dashboard) acota los grupos que se ven y el total; el mismo filtro acota los
 * KPIs de arriba (closers) y las listas de Revisar.
 */
const POR_ROL = {
    closers: { titulo: 'Segmentos', agendas: 'Agendas', asistieron: 'Asistieron', ventas: 'Ventas',
        ayuda: 'Las agendas del período por segmento del lead: cuántas asistieron (show up) y cuántas terminaron en venta (cierre). '
            + '«Sin segmento» son las agendas de antes del triage y quienes no llenaron el formulario.' },
    setters: { titulo: 'Agendas por segmento', agendas: 'Agendas generadas', asistieron: 'Asistieron', ventas: 'Ventas',
        ayuda: 'Las agendas generadas del período por segmento del lead, con cuántas asistieron y cuántas terminaron en venta. '
            + '«Sin segmento» son las agendas de antes del triage y quienes no llenaron el formulario.' },
};

const pct = (a, b) => (b ? Number(((a * 100) / b).toFixed(1)) : null);
const pctTexto = (v) => (v === null ? '—' : `${String(v).replace('.', ',')}%`);

const sumar = (filas) => {
    // Un solo grupo: el total es ese grupo, con las tasas que ya redondeó el servidor.
    if (filas.length === 1) return { ...filas[0], segmento: null, label: 'Total del filtro' };
    const t = { segmento: null, label: filas.length === 5 ? 'Total' : 'Total del filtro' };
    ['agendas', 'realizadas', 'asistieron', 'ventas', 'sin_reporte'].forEach((k) => { t[k] = filas.reduce((a, f) => a + f[k], 0); });
    t.show_up = pct(t.asistieron, t.realizadas);
    t.cierre = pct(t.ventas, t.asistieron);
    return t;
};

const Cifra = ({ valor, sub, ver, titulo }) => (
    <div className="sg-celda">
        {ver && valor > 0
            ? (
                <span className="td-cc">
                    <button type="button" className="td-cc-cifra t-body num td-fuerte" onClick={ver} aria-label={`${valor}: ver la lista de ${titulo.toLowerCase()}`}>{fmt.num(valor)}</button>
                </span>
            )
            : <span className="t-body num td-fuerte">{fmt.num(valor)}</span>}
        {sub && <span className="sg-pct t-cap">{sub}</span>}
    </div>
);

const SegmentosPanel = ({ filtros, rol, elegidos, onElegir, version = 0 }) => {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(false);
    const registros = useVerRegistros();
    const texto = POR_ROL[rol] || POR_ROL.closers;
    // Sin la clave del segmento: este bloque trae todos los grupos y el filtro se aplica acá.
    const { segmento: _fuera, ...base } = filtros;
    const clave = JSON.stringify(base);

    useEffect(() => {
        const control = new AbortController();
        setError(false);
        getSegmentos(base, { signal: control.signal })
            .then(setDatos)
            .catch(() => { if (!control.signal.aborted) setError(true); });
        return () => control.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clave, version]);

    const abrir = useCallback((metrica, titulo, segmento, nombre) => registros.abrir({
        titulo: `${titulo} · ${nombre}`,
        subtitulo: `${datos?.dates?.start ?? ''} a ${datos?.dates?.end ?? ''}`,
        contenido: <ContenidoRegistros cargar={({ signal }) => getSegmentosRegistros(base, metrica, segmento, { signal })} />,
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [registros.abrir, clave, datos]);

    const filas = useMemo(() => (datos ? datos.filas.filter((f) => !elegidos.length || elegidos.includes(f.segmento)) : []), [datos, elegidos]);
    const total = useMemo(() => (datos ? (elegidos.length ? sumar(filas) : { ...datos.total }) : null), [datos, filas, elegidos]);
    if (error && !datos) return null;
    const cuentas = datos ? Object.fromEntries(datos.filas.map((f) => [f.segmento, f.agendas])) : null;
    const delFiltro = elegidos.length ? elegidos.join(',') : '';

    const fila = (f, esTotal) => {
        const seg = esTotal ? delFiltro : f.segmento;
        const nombre = esTotal ? (elegidos.length ? filas.map((x) => x.label).join(' + ') : 'todos los segmentos') : f.label;
        const ver = (metrica, titulo) => () => abrir(metrica, titulo, seg, nombre);
        return (
            <div key={f.segmento ?? 'total'} className={`sg-fila sp-fila${esTotal ? ' sg-fila--total' : ''}`} role="row">
                <div className="sg-nombre" role="rowheader">
                    {!esTotal && <i className="sg-punto" style={{ background: COLOR_SEGMENTO[f.segmento] }} aria-hidden="true" />}
                    <span className="t-body td-fuerte">{f.label}</span>
                </div>
                <Cifra valor={f.agendas} titulo={texto.agendas} ver={ver('agendas', texto.agendas)} />
                <Cifra valor={f.asistieron} titulo="Asistieron" ver={ver('asistieron', 'Asistieron')}
                    sub={f.show_up === null ? null : `${pctTexto(f.show_up)} show up`} />
                <Cifra valor={f.ventas} titulo={texto.ventas} ver={ver('ventas', texto.ventas)}
                    sub={f.cierre === null ? null : `${pctTexto(f.cierre)} cierre`} />
                <Cifra valor={f.sin_reporte} titulo="Sin reporte" ver={ver('sin_reporte', 'Sin reporte')} />
            </div>
        );
    };

    return (
        <Panel id="p-segmentos" cab={<PanelCab titulo={texto.titulo} ayuda={texto.ayuda} />}>
            {datos && <FiltroSegmentos segmentos={datos.segmentos} elegidos={elegidos} cuentas={cuentas} onCambiar={onElegir} />}
            {!datos ? <Vacio texto="Cargando los segmentos…" /> : (
                <div className="sg-tabla" role="table" aria-label="Agendas por segmento">
                    <div className="sg-fila sp-fila sg-fila--cab t-eyebrow mut" role="row">
                        <span role="columnheader">Segmento</span>
                        <span role="columnheader">{texto.agendas}</span>
                        <span role="columnheader">{texto.asistieron}</span>
                        <span role="columnheader">{texto.ventas}</span>
                        <span role="columnheader">Sin reporte</span>
                    </div>
                    {filas.map((f) => fila(f, false))}
                    {fila(total, true)}
                </div>
            )}
            {registros.panel}
        </Panel>
    );
};

export default SegmentosPanel;
