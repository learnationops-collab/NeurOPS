import { useEffect, useMemo, useState } from 'react';
import ListaConfigurable from '../../../../components/listas/ListaConfigurable';
import { EmptyState, Skeleton, SkeletonRow } from '../../../../components/standard';
import { mensajeDeError, pedirRegistros } from './marketingApi';
import { formatear } from './metricas';

/**
 * Lo que se abre al tocar una cifra de Setting o de Workshop (`useRegistrosMarketing`): la lista de lo que
 * la suma, que arma el backend con el mismo código que la cifra (`fuentes_registros_service.py`). Arriba,
 * su cuenta en una línea: la suma de la lista es la cifra que se tocó.
 */
const fecha = (v) => {
    if (!v) return '—';
    const [d, h] = String(v).split('T');
    const [a, m, dia] = d.split('-');
    return `${dia}/${m}/${a}${h && h !== '00:00:00' ? ` ${h.slice(0, 5)}` : ''}`;
};

const columnaDe = (c, moneda) => ({
    key: c.key, header: c.header, width: c.ancho, valor: (f) => f[c.key], alinear: ['dinero', 'numero'].includes(c.tipo) ? 'der' : undefined,
    oculta: !!c.oculta,
    render: (f) => {
        const v = f[c.key];
        if (c.tipo === 'fecha') return <span style={{ whiteSpace: 'nowrap' }}>{fecha(v)}</span>;
        if (c.tipo === 'dinero') return formatear(v, 'money', moneda);
        if (c.tipo === 'numero') return formatear(v, 'num');
        if (c.tipo === 'si_no') return <b style={{ color: v === 'Sí' ? 'var(--success)' : 'var(--text-muted)' }}>{v}</b>;
        return <span title={v} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>;
    },
});

const ContenidoRegistros = ({ fuente, metrica, desde, hasta, moneda, segmento = undefined }) => {
    const [estado, setEstado] = useState({ datos: null, error: null });
    useEffect(() => {
        const control = new AbortController();
        pedirRegistros(fuente, metrica, desde, hasta, { signal: control.signal }, segmento)
            .then((datos) => setEstado({ datos, error: null }))
            .catch((e) => { if (!control.signal.aborted) setEstado({ datos: null, error: mensajeDeError(e, 'No se pudo traer la lista.') }); });
        return () => control.abort();
    }, [fuente, metrica, desde, hasta, segmento]);

    const { datos, error } = estado;
    const columnas = useMemo(() => (datos ? datos.columnas.map((c) => columnaDe(c, moneda)) : []), [datos, moneda]);

    if (error) return <EmptyState title={error} />;
    if (!datos) {
        return (
            <Skeleton label="Cargando la lista…">
                {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} step={i} cells={['30%', '12%', '12%', '16%', '14%']} />)}
            </Skeleton>
        );
    }
    return (
        <>
            <p className="t-body td-fuerte" style={{ margin: '0 0 var(--s3)' }}>{datos.resumen}</p>
            <ListaConfigurable columnas={columnas} filas={datos.filas} clave={(f) => f.id}
                claveGuardado={`mk_registros_${fuente}_${metrica}${segmento === undefined ? '' : '_seg'}`}
                buscar={(f) => Object.values(f).join(' ')} buscarPlaceholder="Buscar en la lista"
                vacio="Ninguna fila suma a esta cifra en el período." />
        </>
    );
};

export default ContenidoRegistros;
