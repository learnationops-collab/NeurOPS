import { useCallback, useEffect, useState } from 'react';
import useEstadoGuardado from '../../../hooks/useEstadoGuardado';
import { useVerRegistros } from '../../../components/standard';
import ContenidoRegistros from '../../admin/marketing/anuncios/ContenidoRegistros';
import { AgruparPor, Columnas, VerComo, disposicionDe } from '../../admin/marketing/todos/ControlesSegmentos';
import CruceSegmentos from '../../admin/marketing/todos/CruceSegmentos';
import FiltroSegmentos from '../../admin/marketing/todos/FiltroSegmentos';
import { getSegmentos, getSegmentosRegistros } from '../comercialApi';
import { Panel, PanelCab, Vacio } from './PiezasAnalizar';
import SegmentosGrupo, { COLUMNAS_PANEL } from './SegmentosGrupo';
import '../../admin/marketing/todos/todos.css';
import '../../admin/marketing/todos/segmentos.css';

/**
 * Analizar › Segmentos (Gabriela, 28/10/2026): las agendas del período partidas en A, B, C, D y «sin segmento»
 * (las viejas de Calendly/n8n y quienes no llenaron el formulario). El closer ve su show up y su cierre por
 * segmento; el setter, cuántas de las agendas que generó son de cada uno. Los grupos suman el total, y cada cifra
 * abre la lista de las agendas que la suman (`useVerRegistros`). Cuentas en `app/services/segmentos_comercial.py`.
 *
 * Kerwin (28/10/2026): se puede partir por closer, setter, fuente u origen, y comparar con el período del VS del header
 * (cada cifra trae su diferencia). El corte, la disposición (tablas o cruce) y las columnas se recuerdan por usuario.
 *
 * El filtro (`elegidos`, de la URL del dashboard) acota los segmentos que se ven y el total; el mismo filtro acota los
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
const CORTES = ['ninguno', 'closer', 'setter', 'fuente', 'origen'];
const INICIAL = { corte: 'ninguno', disposicion: '', campo: 'agendas', ocultas: [], orden: { col: 'total', dir: 'desc' } };
const normalizar = (m) => ({ ...m, corte: CORTES.includes(m.corte) ? m.corte : INICIAL.corte,
    ocultas: Array.isArray(m.ocultas) ? m.ocultas : [], orden: m.orden?.col ? m.orden : INICIAL.orden });

const SegmentosPanel = ({ filtros, rol, elegidos, onElegir, version = 0 }) => {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(false);
    const [guardado, poner] = useEstadoGuardado('cm_segmentos_vista', INICIAL, { normalizar });
    const { corte, campo: campoKey, ocultas, orden } = guardado;
    const registros = useVerRegistros();
    const texto = POR_ROL[rol] || POR_ROL.closers;
    // El filtro de segmento (`filtros.segmento`) lo aplica el backend, también al total; los botones traen las cuentas de todos.
    const base = filtros;
    const clave = JSON.stringify({ base, corte });

    useEffect(() => {
        const control = new AbortController();
        setError(false);
        getSegmentos(base, { signal: control.signal }, corte)
            .then(setDatos)
            .catch(() => { if (!control.signal.aborted) setError(true); });
        return () => control.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clave, version]);

    const abrir = useCallback((grupo, metrica, titulo, segmento, nombre, previo = false) => {
        const periodo = previo ? { start: datos.dates.compare_start, end: datos.dates.compare_end } : datos.dates;
        const delGrupo = corte === 'ninguno' ? {} : { corte, grupo: grupo.key };
        registros.abrir({
            titulo: `${titulo}${corte === 'ninguno' ? '' : ` · ${grupo.label}`} · ${nombre}${previo ? ' · período comparado' : ''}`,
            subtitulo: `${periodo.start ?? ''} a ${periodo.end ?? ''}`,
            contenido: <ContenidoRegistros fuente="comercial-segmentos" metrica={metrica} segmento={segmento}
                cargar={({ signal }) => getSegmentosRegistros(base, metrica, segmento, { signal }, { ...delGrupo, previo })} />,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [registros.abrir, clave, datos]);

    if (error && !datos) return null;
    const delFiltro = elegidos.length ? elegidos.join(',') : '';
    const nombreDelFiltro = elegidos.length ? datos?.segmentos.filter((s) => elegidos.includes(s.key)).map((s) => s.label).join(' + ') : 'todos los segmentos';
    const verDe = (grupo) => (metrica, titulo, segmento, nombre, previo) => (
        segmento === '' ? abrir(grupo, metrica, titulo, delFiltro, nombreDelFiltro, previo) : abrir(grupo, metrica, titulo, segmento, nombre, previo));

    const columnasTodas = COLUMNAS_PANEL(texto);
    const columnas = columnasTodas.filter((c) => !ocultas.includes(c.key));
    const grupos = datos ? datos.grupos : [];
    const disposicion = datos ? disposicionDe(guardado.disposicion, corte, grupos.length) : 'tablas';
    const campo = columnasTodas.find((c) => c.key === campoKey) || columnasTodas[0];
    const ordenar = (col) => poner({ orden: { col, dir: orden.col === col && orden.dir === 'desc' ? 'asc' : 'desc' } });

    return (
        <Panel id="p-segmentos" cab={<PanelCab titulo={texto.titulo} ayuda={texto.ayuda} />}>
            {datos && (
                <>
                    <div className="sg-barra">
                        <AgruparPor cortes={datos.cortes} valor={corte} onChange={(key) => poner({ corte: key })} />
                        <VerComo valor={disposicion} onChange={(key) => poner({ disposicion: key })} />
                        {datos.comparacion && <span className="t-cap mut">Contra {datos.comparacion.desde} a {datos.comparacion.hasta}</span>}
                    </div>
                    <div className="sg-barra">
                        <FiltroSegmentos segmentos={datos.segmentos} elegidos={elegidos} cuentas={datos.cuentas} onCambiar={onElegir} />
                        {disposicion === 'tablas' && <Columnas columnas={columnasTodas} ocultas={ocultas} onChange={(lista) => poner({ ocultas: lista })} />}
                    </div>
                </>
            )}
            {!datos ? <Vacio texto="Cargando los segmentos…" /> : disposicion === 'cruce' ? (
                <CruceSegmentos plano grupos={grupos} campo={campo} campos={columnasTodas} onCampo={(key) => poner({ campo: key })}
                    onVer={({ grupo, campo: c, segmento, nombre, previo }) => verDe(grupo)(c.lista, c.label, segmento, nombre, previo)}
                    orden={orden} onOrden={ordenar} />
            ) : grupos.map((g) => (
                <SegmentosGrupo key={g.key} grupo={g} columnas={columnas} titulo={corte === 'ninguno' ? null : g.label} onVer={verDe(g)} />
            ))}
            {registros.panel}
        </Panel>
    );
};

export default SegmentosPanel;
