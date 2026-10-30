import { useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import useEstadoGuardado from '../../../../hooks/useEstadoGuardado';
import { Segmented } from '../../../comercial/components/Shared';
import { ErrorDeCarga } from '../esqueletos';
import { Accordion, Select, Skeleton, SkeletonBlock, useVerRegistros } from '../../../../components/standard';
import { mensajeDeError } from '../anuncios/marketingApi';
import { pedirRegistrosSegmentos, pedirSegmentos } from '../anuncios/segmentosApi';
import ContenidoRegistros from '../anuncios/ContenidoRegistros';
import { useDatosCacheados } from '../../../../services/cacheDeVistas';
import ComparaCon, { comparacionDeUrl } from './ComparaCon';
import { conQuitados, gruposVisibles, normalizarQuitados, quitadosDe } from './ControlesSegmentos';
import FiltroSegmentos from './FiltroSegmentos';
import { abiertosDe, itemsDe } from './bloquesSegmentos';
import { TITULO_DE } from './comparacion';
import { COLUMNAS_SEGMENTO, segmentosDeUrl } from './segmentos';
import './segmentos.css';

/**
 * «Segmentos» de Todos (Gabriela, 28/10/2026): la mezcla de leads A/B/C/D y cómo rinde cada grupo —leads, agendas, show
 * up, ventas y cash—, con «sin segmento» como un grupo más. Kerwin (28/10/2026) pidió partirla por closer, fuente u origen
 * (el setter, VSL, Momentum, Referido…), compararla con otro período y elegir qué se ve, todo recordado por usuario.
 * El filtro de segmento y el VS viven en la URL (`segmento=A,B`, `vs`, `vd`, `vh`). Las cuentas, también las de la
 * comparación y las de cada lista, son del backend (`app/services/segmentos_marketing_service.py`).
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

// Las fuentes que entran en las cifras (el backend las filtra); «Todos» son las tres.
const PESTANAS = [
    { key: 'todos', label: 'Todos' },
    { key: 'setting', label: 'Setting' },
    { key: 'workshop', label: 'Workshop' },
    { key: 'otras', label: 'Otras' },
];
const CORTES_VALIDOS = ['fuente', 'origen', 'closer', 'ninguno'];
const COLUMNAS_CRUCE = COLUMNAS_SEGMENTO.filter((c) => c.key !== 'ticket');
const INICIAL = { fuente: 'todos', corte: 'fuente', campo: 'agendas', ocultas: [], quitados: {}, abiertos: null, orden: { col: 'total', dir: 'desc' } };
const normalizar = (m) => ({
    ...m,
    quitados: normalizarQuitados(m.quitados),
    fuente: PESTANAS.some((p) => p.key === m.fuente) ? m.fuente : INICIAL.fuente,
    corte: CORTES_VALIDOS.includes(m.corte) ? m.corte : INICIAL.corte,
    campo: COLUMNAS_CRUCE.some((c) => c.key === m.campo) ? m.campo : INICIAL.campo,
    ocultas: Array.isArray(m.ocultas) ? m.ocultas.filter((k) => COLUMNAS_SEGMENTO.some((c) => c.key === k)) : [],
    orden: m.orden?.col ? m.orden : INICIAL.orden,
    abiertos: Array.isArray(m.abiertos) ? m.abiertos : null,
});

const NOTA_POR_CORTE = {
    closer: 'Los leads no se parten por closer: un lead todavía no tiene closer.',
    origen: 'Origen: el setter de la agenda o del cobro; VSL, Momentum, Referido… en Otras; Workshop es uno solo.',
};

const SegmentosVista = ({ rango, version, params, cambiar }) => {
    const [guardado, poner] = useEstadoGuardado('mk_segmentos_fuente', INICIAL, { normalizar });
    const { fuente: pestana, corte, campo: campoKey, ocultas, orden } = guardado;
    const comparacion = comparacionDeUrl(params);
    const elegidos = useMemo(() => segmentosDeUrl(params.get('segmento'), ['A', 'B', 'C', 'D', 'sin'].map((key) => ({ key }))), [params]);
    const fuentes = pestana === 'todos' ? undefined : pestana;
    const pedido = {
        desde: rango.desde, hasta: rango.hasta, corte, ...(fuentes ? { fuentes } : {}),
        segmento: elegidos.join(','), ...comparacion.pedido,
    };
    const { datos, error: fallo, cargando } = useDatosCacheados(`mk:segmentos:${JSON.stringify(pedido)}`,
        (signal) => pedirSegmentos(pedido, { signal }),
        { version, onError: (e) => toast.error(mensajeDeError(e, 'No se pudieron cargar los segmentos.')) });
    const registros = useVerRegistros();

    const abrir = useCallback(({ grupo, metrica, titulo, segmento, nombre, previo = false }) => {
        const periodo = previo ? datos.comparacion : { desde: rango.desde, hasta: rango.hasta };
        const lista = { desde: periodo.desde, hasta: periodo.hasta, metrica, segmento, ...(fuentes ? { fuentes } : {}), corte,
            ...(corte === 'ninguno' ? {} : { grupo: grupo.key }) };
        registros.abrir({
            titulo: `${titulo} · ${grupo.label}${nombre ? ` · ${nombre}` : ''}${previo ? ' · período comparado' : ''}`,
            subtitulo: `${periodo.desde} a ${periodo.hasta}`,
            contenido: <ContenidoRegistros fuente="segmentos" metrica={metrica} segmento={segmento}
                cargar={({ signal }) => pedirRegistrosSegmentos(lista, { signal })} />,
        });
    }, [datos, rango.desde, rango.hasta, fuentes, corte, registros.abrir]); // eslint-disable-line react-hooks/exhaustive-deps

    if (fallo && !datos) return <ErrorDeCarga titulo={mensajeDeError(fallo, 'No se pudieron cargar los segmentos.')} onReintentar={() => cambiar({})} />;
    if (!datos) return <EsqueletoSegmentos />;

    // El total de la fila de totales con un filtro puesto abre la lista del filtro, no la de todos los segmentos.
    const verDeTabla = (grupo) => (metrica, titulo, segmento, nombre, previo) => {
        const delFiltro = segmento === '' && elegidos.length > 0;
        abrir({ grupo, metrica, titulo, previo, segmento: delFiltro ? elegidos.join(',') : segmento,
            nombre: delFiltro ? datos.segmentos.filter((s) => elegidos.includes(s.key)).map((s) => s.label).join(' + ') : nombre });
    };
    const verDeCruce = ({ grupo, campo, segmento, nombre, previo }) => {
        const delFiltro = segmento === '' && elegidos.length > 0;
        abrir({ grupo, metrica: campo.lista, titulo: TITULO_DE[campo.lista], previo, segmento: delFiltro ? elegidos.join(',') : segmento,
            nombre: segmento === '' ? (delFiltro ? 'filtro' : 'todos los segmentos') : nombre });
    };

    const columnas = COLUMNAS_SEGMENTO.filter((c) => !ocultas.includes(c.key));
    // Los grupos que Kerwin sacó del análisis (28/10/2026) no se dibujan; se recuerdan por corte.
    const quitados = quitadosDe(guardado, corte);
    const grupos = gruposVisibles(datos.grupos, quitados);
    const cambiarQuitados = (lista) => poner(conQuitados(guardado, corte, lista));
    const campo = COLUMNAS_CRUCE.find((c) => c.key === campoKey) || COLUMNAS_CRUCE[1];
    const ordenar = (col) => poner({ orden: { col, dir: orden.col === col && orden.dir === 'desc' ? 'asc' : 'desc' } });

    // Los bloques son una lista (`bloquesSegmentos.jsx`); acá solo se les pasa lo calculado.
    const items = itemsDe({
        corte, grupos, todosLosGrupos: datos.grupos, quitados, onQuitados: cambiarQuitados, onQuitar: (key) => cambiarQuitados([...quitados, key]),
        columnas, ocultas, onOcultas: (lista) => poner({ ocultas: lista }), moneda: datos.moneda,
        campo, campos: COLUMNAS_CRUCE, onCampo: (key) => poner({ campo: key }), orden, onOrden: ordenar,
        onVerTabla: verDeTabla, onVerCruce: verDeCruce,
    });

    return (
        <div className={`vista mk-vista${cargando ? ' mk-recargando' : ''}`}>
            <div className="sg-barra">
                <Segmented opciones={PESTANAS} valor={pestana} ariaLabel="Fuente de los segmentos" onChange={(key) => poner({ fuente: key })} />
                <div className="sg-control">
                    <span className="t-eyebrow mut">Agrupar por</span>
                    <Select size="sm" label="Agrupar por" value={corte} onChange={(key) => poner({ corte: key })}
                        options={datos.cortes.map((c) => ({ value: c.key, label: c.label }))} />
                </div>
                <ComparaCon vs={comparacion.vs} rango={comparacion.rango} periodo={rango} comparado={datos.comparacion} onCambiar={cambiar} />
            </div>
            <div className="sg-barra">
                <FiltroSegmentos segmentos={datos.segmentos} elegidos={elegidos} cuentas={datos.cuentas}
                    onCambiar={(lista) => cambiar({ segmento: lista.join(',') || null })} />
            </div>
            {comparacion.vs === 'custom' && !comparacion.rango && <p className="t-cap mut">Elegí las dos fechas del período comparado.</p>}
            <Accordion items={items} value={abiertosDe(items, guardado.abiertos)} onChange={(abiertos) => poner({ abiertos })} />
            <p className="t-cap mut">
                {NOTA_POR_CORTE[corte] ? `${NOTA_POR_CORTE[corte]} ` : ''}Agendas por fecha de alta. Costo por lead por segmento: pendiente (Meta no conoce el segmento).
            </p>
            {registros.panel}
        </div>
    );
};

export default SegmentosVista;
