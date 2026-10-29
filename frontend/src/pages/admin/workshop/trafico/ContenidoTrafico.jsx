import { useMemo } from 'react';
import api from '../../../../services/api';
import { useDatosCacheados } from '../../../../services/cacheDeVistas';
import ListaConfigurable from '../../../../components/listas/ListaConfigurable';
import { EmptyState, Skeleton, SkeletonRow } from '../../../../components/standard';
import { COLUMNAS_DETALLE, FACETAS_DETALLE, FACETAS_RANKING, buscarEnVisita, claveRanking, columnasRanking } from './columnas';
import { num } from './trafico';

const EVENTO_CLIC = 'clic_whatsapp';
// El tope del backend: la lista tiene que traer TODAS las filas que suma la cifra (el detalle de la página pide 5.000).
const LIMITE_LISTA = 20000;

/**
 * Lo que se abre al tocar una cifra de Tráfico (ADR-W015): las visitas o los clics al grupo una por una (las mismas
 * filas de «Visitas una por una», con la misma clave de caché) o las landings con sus visitas. La suma de la lista es
 * la cifra del período; si el detalle se recortó (tope de filas), se dice.
 */
const Esqueleto = () => (
    <Skeleton label="Cargando la lista…">
        {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} step={i} cells={['16%', '30%', '14%', '16%', '14%']} />)}
    </Skeleton>
);

const Visitas = ({ desde, hasta, tipo }) => {
    const { datos, error } = useDatosCacheados(`ws:visitas-todas:${desde}:${hasta}`,
        (signal) => api.get('/workshop/landing/trafico/visitas', { params: { desde, hasta, limite: LIMITE_LISTA }, signal })
            .then((r) => r.data));
    const filas = useMemo(
        () => (datos ? datos.visitas.filter((v) => (tipo === 'clics') === (v.evento === EVENTO_CLIC)) : []),
        [datos, tipo]);
    if (error && !datos) return <EmptyState title="No se pudo traer la lista." />;
    if (!datos) return <Esqueleto />;
    return (
        <>
            <p className="t-body td-fuerte" style={{ margin: '0 0 var(--s3)' }}>
                {num(filas.length)} {tipo === 'clics' ? 'clics al grupo de WhatsApp' : 'visitas a las landings'}
                {tipo === 'visitas' && ' · la grabación (/replay/) se cuenta por sesiones y no está en esta lista'}
                {datos.recortado && ` · las ${num(datos.limite)} filas más recientes del período: acotá las fechas para ver el resto`}
            </p>
            <ListaConfigurable columnas={COLUMNAS_DETALLE} facetas={FACETAS_DETALLE} filas={filas} clave={(v) => v.id}
                buscar={buscarEnVisita} buscarPlaceholder="Buscar…" claveGuardado={`ws_trafico_registros_${tipo}_cols`}
                vacio="No hay filas en este período." />
        </>
    );
};

const Landings = ({ datos, medido }) => {
    const total = datos?.totales?.visitas || 0;
    const columnas = useMemo(() => columnasRanking('landing', total, medido), [total, medido]);
    const filas = datos?.por_landing || [];
    return (
        <>
            <p className="t-body td-fuerte" style={{ margin: '0 0 var(--s3)' }}>
                {num(filas.length)} landings · {num(total)} visitas
            </p>
            <ListaConfigurable columnas={columnas} facetas={FACETAS_RANKING.landing} filas={filas} clave={claveRanking('landing')}
                buscar={(f) => f.path} buscarPlaceholder="Buscar una landing" claveGuardado="ws_trafico_registros_landings_cols"
                ordenInicial={{ key: 'visitas', dir: 'desc' }} vacio="Sin visitas en este período." />
        </>
    );
};

/** `tipo`: `visitas`, `clics` o `landings`. `datos` es el resumen del período (para las landings). */
const ContenidoTrafico = ({ tipo, desde, hasta, datos, medido }) => (
    tipo === 'landings' ? <Landings datos={datos} medido={medido} /> : <Visitas desde={desde} hasta={hasta} tipo={tipo} />
);

export default ContenidoTrafico;
