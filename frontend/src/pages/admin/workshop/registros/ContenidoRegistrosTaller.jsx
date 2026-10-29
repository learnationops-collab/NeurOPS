import { useEffect, useMemo, useState } from 'react';
import ListaConfigurable from '../../../../components/listas/ListaConfigurable';
import { EmptyState, Skeleton, SkeletonRow } from '../../../../components/standard';
import api from '../../../../services/api';
import { columnaDe } from '../../marketing/anuncios/ContenidoRegistros';

/**
 * La lista de personas o de cobros detrás de una cifra del Resumen (`GET /workshop/registros`), armada por el
 * backend con el mismo código que la cifra del taller. Arriba, su cuenta; si los talleres guardan otra cifra (se
 * calcularon antes), se dice, porque la lista siempre es de hoy.
 */
const ContenidoRegistrosTaller = ({ ids, metrica, esperado = null }) => {
    const [estado, setEstado] = useState({ datos: null, error: null });
    const clave = ids.join(',');
    useEffect(() => {
        const control = new AbortController();
        setEstado({ datos: null, error: null });
        api.get('workshop/registros', { params: { ids: clave, metrica }, signal: control.signal })
            .then(({ data }) => setEstado({ datos: data, error: null }))
            .catch((e) => {
                if (control.signal.aborted) return;
                console.error('Error cargando la lista del Resumen:', e);
                setEstado({ datos: null, error: e?.response?.data?.error || 'No se pudo traer la lista.' });
            });
        return () => control.abort();
    }, [clave, metrica]);

    const { datos, error } = estado;
    const columnas = useMemo(() => (datos ? datos.columnas.map((c) => columnaDe(c, 'USD')) : []), [datos]);
    if (error) return <EmptyState title={error} />;
    if (!datos) {
        return (
            <Skeleton label="Cargando la lista…">
                {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} step={i} cells={['30%', '14%', '14%', '16%', '14%']} />)}
            </Skeleton>
        );
    }
    const distinto = esperado != null && Math.abs(esperado - datos.total) > 0.5;
    return (
        <>
            <p className="t-body td-fuerte" style={{ margin: '0 0 var(--s3)' }}>{datos.resumen}</p>
            {distinto && (
                <p className="t-sm mut" style={{ margin: '0 0 var(--s3)' }} role="status">
                    Los talleres guardan {datos.columnas.some((c) => c.key === 'monto') ? `$${esperado.toLocaleString('en-US')}` : esperado}: se calcularon antes de
                    los últimos cambios. Esta lista es de hoy y se actualiza con «Actualizar» en cada taller.
                </p>
            )}
            <ListaConfigurable columnas={columnas} filas={datos.filas} clave={(f) => f.id}
                claveGuardado={`wr_registros_${metrica}`} buscar={(f) => Object.values(f).join(' ')}
                buscarPlaceholder="Buscar en la lista" vacio="Ninguna fila suma a esta cifra en esta selección." />
        </>
    );
};

export default ContenidoRegistrosTaller;
