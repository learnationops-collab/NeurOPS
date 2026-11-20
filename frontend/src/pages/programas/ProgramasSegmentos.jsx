import { useCallback, useMemo } from 'react';
import { EmptyState, Skeleton, SkeletonPanel, useVerRegistros } from '../../components/standard';
import ContenidoRegistros from '../admin/marketing/anuncios/ContenidoRegistros';
import { mensajeDeError } from '../admin/marketing/anuncios/marketingApi';
import { useDatosCacheados } from '../../services/cacheDeVistas';
import { pedirProgramasSegmentos, pedirRegistrosProgramas } from './programasApi';
import TablaProgramas from './TablaProgramas';
import TablaSegmentos from './TablaSegmentos';
import './programas.css';

/**
 * Programas y segmentos (Leadership 1395 y 1403, ADR-W177). Vive en Dirección comercial › Analizar y en
 * Marketing › Todos, con el período de cada una (`periodo`: los parámetros que entiende el backend).
 *
 *  - Por programa (AL, RR, SI): ventas, New Cash, ticket, LTV, % cobrado de lo acordado, y CAC / ROAS con el gasto de
 *    las campañas etiquetadas en Marketing › Meta Ads.
 *  - Por segmento (A/B/C/D) en Setting: CAC y ROAS con el gasto de Setting repartido por agendas (estimado).
 *
 * Cada cifra abre la lista que la suma (`useVerRegistros` + `ContenidoRegistros`, que pide al backend de esta vista).
 * La clave de caché empieza con `mk:` para que etiquetar una campaña (`olvidarCache('mk:')`) la refresque.
 */
const limpio = (periodo) => Object.fromEntries(Object.entries(periodo || {}).filter(([, v]) => v != null && v !== ''));

const ProgramasSegmentos = ({ periodo, version = 0, moneda }) => {
    const params = useMemo(() => limpio(periodo), [periodo]);
    const clave = `mk:programas:${new URLSearchParams(params).toString()}`;
    const { datos, error, cargando } = useDatosCacheados(clave, (signal) => pedirProgramasSegmentos(params, { signal }), { version });
    const registros = useVerRegistros();
    const desde = datos?.desde;
    const hasta = datos?.hasta;

    // `cual`: { metrica, programa } o { metrica, segmento }. Las listas piden con las fechas que usó la cifra.
    const ver = useCallback((cual, titulo) => {
        if (!desde) return;
        const cargar = ({ signal }) => pedirRegistrosProgramas({ desde, hasta }, cual, { signal });
        registros.abrir({
            titulo, subtitulo: `${desde} a ${hasta}`,
            contenido: <ContenidoRegistros fuente="ps" metrica={`${cual.metrica}_${cual.programa ? 'prog' : 'seg'}`}
                desde={desde} hasta={hasta} moneda={moneda} cargar={cargar} />,
        });
    }, [registros.abrir, desde, hasta, moneda]);

    if (error && !datos) return <EmptyState title={mensajeDeError(error, 'No se pudo cargar Programas y segmentos.')} />;
    if (!datos) {
        return (
            <Skeleton label="Cargando programas y segmentos…" className="ps-vista">
                <SkeletonPanel className="ui-panel ps-panel" rows={5} rowHeight={40} />
                <SkeletonPanel className="ui-panel ps-panel" rows={6} rowHeight={40} step={1} />
            </Skeleton>
        );
    }
    return (
        <div className={`ps-vista${cargando ? ' mk-recargando' : ''}`} aria-busy={cargando}>
            <TablaProgramas datos={datos.programas} moneda={moneda} ver={ver} />
            <TablaSegmentos datos={datos.segmentos} moneda={moneda} ver={ver} />
            <p className="t-cap mut ps-pie">
                No hay % de cierre por programa: la agenda no sabe qué programa se va a vender. Ventas, New Cash y ticket son
                los de Analizar (por el programa del tipo de pago); el LTV y el % cobrado salen de las ventas y sus pagos.
            </p>
            {registros.panel}
        </div>
    );
};

export default ProgramasSegmentos;
