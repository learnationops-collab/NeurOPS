import { useMemo } from 'react';
import toast from 'react-hot-toast';
import useEstadoGuardado from '../../../../hooks/useEstadoGuardado';
import { Segmented } from '../../../comercial/components/Shared';
import { ErrorDeCarga } from '../esqueletos';
import { Skeleton, SkeletonBlock } from '../../../../components/standard';
import { mensajeDeError } from '../anuncios/marketingApi';
import { pedirSegmentos } from '../anuncios/segmentosApi';
import { useDatosCacheados } from '../../../../services/cacheDeVistas';
import FiltroSegmentos from './FiltroSegmentos';
import TablaSegmentos from './TablaSegmentos';
import { SETTING, WORKSHOP } from './comparacion';
import { segmentosDeUrl, totalDe, visibles } from './segmentos';
import './segmentos.css';

/**
 * «Segmentos» de Todos (Gabriela, 28/10/2026): la mezcla de leads A/B/C/D en cada embudo y cómo rinde cada
 * grupo —leads, agendas, show up, ventas y cash—, con «sin segmento» como un grupo más (las agendas viejas de
 * Calendly/n8n y quienes no llenaron el formulario), así los grupos suman siempre el total de la fuente.
 * El filtro vive en la URL (`segmento=A,B`). Cuentas en `app/services/segmentos_marketing_service.py`.
 *
 * El costo por lead por segmento NO se calcula: Meta no conoce el segmento y cómo repartir el gasto es una
 * decisión de negocio todavía abierta (Leadership 839; ver `docs/pendientes_santi.md`).
 */
export const EsqueletoSegmentos = () => (
    <Skeleton label="Cargando los segmentos…" className="vista mk-vista">
        <SkeletonBlock height={300} step={0} />
        <SkeletonBlock height={300} step={1} />
    </Skeleton>
);

const COLOR = { setting: SETTING.color, workshop: WORKSHOP.color };
// «Todos» pone las dos fuentes una sobre otra para compararlas; las otras dos analizan una sola (Kerwin, 28/10/2026).
const PESTANAS = [
    { key: 'todos', label: 'Todos' },
    { key: 'setting', label: 'Setting' },
    { key: 'workshop', label: 'Workshop' },
];
const INICIAL = { fuente: 'todos' };
const normalizar = (mezclado) => (PESTANAS.some((p) => p.key === mezclado.fuente) ? mezclado : INICIAL);

const SegmentosVista = ({ rango, version, params, cambiar, abrirRegistros }) => {
    const [{ fuente: pestana }, poner] = useEstadoGuardado('mk_segmentos_fuente', INICIAL, { normalizar });
    const { datos, error: fallo, cargando } = useDatosCacheados(`mk:segmentos:${rango.desde}:${rango.hasta}`,
        (signal) => pedirSegmentos(rango.desde, rango.hasta, { signal }),
        { version, onError: (e) => toast.error(mensajeDeError(e, 'No se pudieron cargar los segmentos.')) });
    const matriz = datos?.por_segmento;
    const elegidos = useMemo(() => segmentosDeUrl(params.get('segmento'), matriz?.segmentos || []), [params, matriz]);

    if (fallo && !datos) return <ErrorDeCarga titulo={mensajeDeError(fallo, 'No se pudieron cargar los segmentos.')} onReintentar={() => cambiar({})} />;
    if (!matriz) return <EsqueletoSegmentos />;

    const agendasDe = (segmento) => matriz.fuentes.reduce((n, f) => n + f.filas.find((x) => x.segmento === segmento).agendas, 0);
    const cuentas = Object.fromEntries(matriz.segmentos.map((s) => [s.key, agendasDe(s.key)]));
    const nombres = matriz.segmentos.filter((s) => elegidos.includes(s.key)).map((s) => s.label).join(' + ');
    // En la fila de total con un filtro puesto, la lista es la del filtro, no la de todos.
    const abrirDe = (fuente) => (metrica, titulo, segmento, nombre) => {
        const delFiltro = segmento === '' && elegidos.length > 0;
        abrirRegistros(fuente, metrica, titulo, delFiltro ? elegidos.join(',') : segmento, delFiltro ? nombres : nombre);
    };
    return (
        <div className={`vista mk-vista${cargando ? ' mk-recargando' : ''}`}>
            <div className="sg-barra">
                <Segmented opciones={PESTANAS} valor={pestana} ariaLabel="Fuente de los segmentos"
                    onChange={(key) => poner({ fuente: key })} />
                <FiltroSegmentos segmentos={matriz.segmentos} elegidos={elegidos} cuentas={cuentas}
                    onCambiar={(lista) => cambiar({ segmento: lista.join(',') || null })} />
            </div>
            {matriz.fuentes.filter((f) => pestana === 'todos' || f.key === pestana).map((fuente) => {
                const filas = visibles(fuente.filas, elegidos);
                return (
                    <TablaSegmentos key={fuente.key} fuente={fuente} color={COLOR[fuente.key]} filas={filas}
                        total={totalDe(filas, fuente.total, elegidos.length > 0)} moneda={datos.moneda}
                        onVer={abrirDe(fuente.key)} />
                );
            })}
            <p className="t-cap mut">
                Costo por lead por segmento: pendiente. Meta no conoce el segmento del lead, y falta decidir cómo repartir el gasto.
            </p>
        </div>
    );
};

export default SegmentosVista;
