import { useCallback } from 'react';
import useEstadoGuardado from '../../../hooks/useEstadoGuardado';
import { useDatosCacheados } from '../../../services/cacheDeVistas';
import { useVerRegistros } from '../../../components/standard';
import ContenidoRegistros from '../../admin/marketing/anuncios/ContenidoRegistros';
import FiltroSegmentos from '../../admin/marketing/todos/FiltroSegmentos';
import { COLOR_SEGMENTO } from '../../admin/marketing/todos/segmentos';
import { getSegmentos, getSegmentosRegistros } from '../comercialApi';
import { Panel, PanelCab, Vacio } from './PiezasAnalizar';
import { Segmented, fmt, useMontado } from './Shared';
import '../../admin/marketing/todos/segmentos.css';
import './segmentosPanel.css';

/**
 * Analizar › Segmentos, rehecho el 09/11/2026 (pedido de Mario): lo central es QUÉ PORCENTAJE de A, B, C y D se
 * agenda (o asiste, o compra), en general y por closer, triage, setter, fuente u origen, y poder compararlo de un
 * vistazo. Cada grupo es una barra al 100% partida por segmento; debajo, finita, la del período comparado. Arriba,
 * el General con el rendimiento de cada segmento (show up y cierre). Cada tramo abre la lista que lo suma.
 *
 * Los cortes y las cuentas salen de `app/services/segmentos_comercial.py`: triage va aparte de los closers (otro
 * perfil de llamada) y «Sin agrupar» ya no existe: el General está siempre arriba.
 */
const CIFRAS = [
    { key: 'agendas', label: 'Agendas', lista: 'agendas' },
    { key: 'asistieron', label: 'Asistieron', lista: 'asistieron' },
    { key: 'ventas', label: 'Ventas', lista: 'ventas' },
];
const CORTES = ['closer', 'triage', 'setter', 'fuente', 'origen'];
const INICIAL = { corte: 'closer', campo: 'agendas' };
const normalizar = (m) => ({
    corte: CORTES.includes(m?.corte) ? m.corte : INICIAL.corte,
    campo: CIFRAS.some(c => c.key === m?.campo) ? m.campo : INICIAL.campo,
});

const reparto = (grupo, campo) => {
    const total = grupo.total?.[campo] || 0;
    return grupo.filas.map(f => ({ ...f, n: f[campo] || 0, pct: total ? ((f[campo] || 0) / total) * 100 : 0 }));
};
const repartoPrevio = (grupo, campo) => {
    const total = grupo.total?.previo?.[campo] || 0;
    return grupo.filas.map(f => ({ segmento: f.segmento, n: f.previo?.[campo] || 0,
        pct: total ? ((f.previo?.[campo] || 0) / total) * 100 : 0 }));
};
const redondo = (x) => Math.round(x);

/** Barra al 100%: un tramo por segmento, con su % adentro si entra. */
const Barra = ({ partes, alto = 'md', onVer, nombre, montado }) => (
    <div className={`sgp-barra sgp-barra--${alto}`}>
        {partes.filter(p => p.n > 0).map(p => {
            const titulo = `${p.label || p.segmento}: ${p.n} (${redondo(p.pct)}%)${nombre ? ` · ${nombre}` : ''}`;
            const estilo = { flex: montado ? p.pct : 0.0001, background: COLOR_SEGMENTO[p.segmento] };
            return onVer ? (
                <button key={p.segmento} type="button" style={estilo} title={`${titulo} · ver la lista`}
                    onClick={() => onVer(p)}>
                    {alto !== 'sm' && p.pct >= 9 && <span className="num">{redondo(p.pct)}%</span>}
                </button>
            ) : <i key={p.segmento} style={estilo} title={titulo} />;
        })}
        {!partes.some(p => p.n > 0) && <span className="sgp-vacia">sin datos</span>}
    </div>
);

/** El cambio del total contra el período comparado: «▲ 30%» en verde o «▼ 22%» en rojo. */
const Cambio = ({ actual, previo }) => {
    if (previo === undefined || previo === null || actual === previo) return null;
    if (!previo) return <small className="sgp-cambio" style={{ '--c': 'var(--success)' }}>nuevo</small>;
    const rel = Math.round(((actual - previo) / previo) * 100);
    return (
        <small className="sgp-cambio num" style={{ '--c': rel > 0 ? 'var(--success)' : 'var(--error)' }}
            title={`Antes: ${previo}`}>
            {rel > 0 ? '▲' : '▼'} {Math.abs(rel)}%
        </small>
    );
};

const General = ({ grupo, campo, onVer, montado, hayPrevio }) => {
    const partes = reparto(grupo, campo.key);
    const antes = hayPrevio ? repartoPrevio(grupo, campo.key) : null;
    return (
        <div className="sgp-general">
            <div className="sgp-general-cab">
                <span className="sgp-rot">General</span>
                <b className="sgp-general-n num">{fmt.num(grupo.total[campo.key] || 0)}</b>
                <small className="sgp-mut">{campo.label.toLowerCase()}</small>
                {hayPrevio && <Cambio actual={grupo.total[campo.key] || 0} previo={grupo.total.previo?.[campo.key]} />}
            </div>
            <Barra partes={partes} alto="lg" montado={montado} nombre="General"
                onVer={(p) => onVer(grupo, p, true)} />
            {antes && <Barra partes={antes} alto="sm" montado={montado} nombre="período comparado" />}
            <div className="sgp-segs">
                {partes.map((p, i) => {
                    const pp = antes ? Math.round(p.pct - antes[i].pct) : null;
                    return (
                        <button key={p.segmento} type="button" className="sgp-seg" disabled={!p.n}
                            style={{ '--c': COLOR_SEGMENTO[p.segmento], '--i': i }} onClick={() => onVer(grupo, p, true)}
                            title={`Ver ${p.n} ${campo.label.toLowerCase()} del segmento ${p.label}`}>
                            <span className="sgp-seg-cab"><i />{p.label}</span>
                            <b className="sgp-seg-pct num">{redondo(p.pct)}%</b>
                            <small className="sgp-mut num">
                                {p.n} {campo.label.toLowerCase()}
                                {pp ? <em style={{ color: pp > 0 ? 'var(--success)' : 'var(--error)' }}> {pp > 0 ? '+' : ''}{pp} pp</em> : null}
                            </small>
                            <span className="sgp-seg-tasas num">
                                <span title="Show up: asistieron ÷ agendas con resultado">SU {p.show_up == null ? '—' : `${p.show_up}%`}</span>
                                <span title="Cierre: ventas ÷ asistieron">CR {p.cierre == null ? '—' : `${p.cierre}%`}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const FilaGrupo = ({ grupo, campo, onVer, montado, hayPrevio, i }) => {
    const total = grupo.total[campo.key] || 0;
    return (
        <div className="sgp-fila" style={{ '--i': i }}>
            <div className="sgp-fila-nombre">
                <b className="trunc">{grupo.label}</b>
                <span className="sgp-fila-n">
                    <small className="num">{fmt.num(total)}</small>
                    {hayPrevio && <Cambio actual={total} previo={grupo.total.previo?.[campo.key]} />}
                </span>
            </div>
            <div className="sgp-fila-barras">
                <Barra partes={reparto(grupo, campo.key)} montado={montado} nombre={grupo.label}
                    onVer={(p) => onVer(grupo, p, false)} />
                {hayPrevio && <Barra partes={repartoPrevio(grupo, campo.key)} alto="sm" montado={montado}
                    nombre={`${grupo.label} · período comparado`} />}
            </div>
        </div>
    );
};

const SegmentosPanel = ({ filtros, rol, elegidos, onElegir, version = 0 }) => {
    const [guardado, poner] = useEstadoGuardado('cm_segmentos_vista_v2', INICIAL, { normalizar });
    const { corte, campo: campoKey } = guardado;
    const montado = useMontado();
    const registros = useVerRegistros();
    const clave = JSON.stringify({ filtros, corte });
    const { datos, error: falla } = useDatosCacheados(`comercial:segmentos:${clave}`,
        (signal) => getSegmentos(filtros, { signal }, corte), { version });
    const campo = CIFRAS.find(c => c.key === campoKey) || CIFRAS[0];

    const abrir = useCallback((grupo, parte, esGeneral) => {
        const delGrupo = esGeneral ? {} : { corte, grupo: grupo.key };
        registros.abrir({
            titulo: `${campo.label} · ${parte.label}${esGeneral ? '' : ` · ${grupo.label}`}`,
            subtitulo: `${datos?.dates?.start ?? ''} a ${datos?.dates?.end ?? ''}`,
            contenido: <ContenidoRegistros fuente="comercial-segmentos" metrica={campo.lista} segmento={parte.segmento}
                cargar={({ signal }) => getSegmentosRegistros(filtros, campo.lista, parte.segmento, { signal }, delGrupo)} />,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [registros.abrir, clave, campo, datos]);

    if (falla && !datos) return null;
    const hayPrevio = Boolean(datos?.comparacion);
    const grupos = (datos?.grupos || []).filter(g => (g.total[campo.key] || 0) > 0 || (g.total.previo?.[campo.key] || 0) > 0);
    const cortes = (datos?.cortes || []).filter(c => CORTES.includes(c.key));

    return (
        <Panel id="p-segmentos" cab={
            <PanelCab titulo={rol === 'setters' ? 'Agendas por segmento' : 'Segmentos'}
                ayuda={'Qué parte de las agendas (o de las que asistieron, o de las ventas) es de cada segmento. Cada '
                    + 'barra suma 100%; la finita de abajo es el período comparado. SU = show up, CR = cierre. Tocá un '
                    + 'tramo para ver la lista.'} />
        }>
            {datos && (
                <div className="sgp-controles">
                    <Segmented opciones={cortes} valor={corte} onChange={(key) => poner({ corte: key })} ariaLabel="Agrupar por" />
                    <Segmented opciones={CIFRAS} valor={campo.key} onChange={(key) => poner({ campo: key })} ariaLabel="Cifra" chico />
                    <FiltroSegmentos segmentos={datos.segmentos} elegidos={elegidos} cuentas={datos.cuentas} onCambiar={onElegir} />
                </div>
            )}
            {!datos ? <Vacio texto="Cargando los segmentos…" /> : (
                <>
                    {datos.general && <General grupo={datos.general} campo={campo} onVer={abrir} montado={montado} hayPrevio={hayPrevio} />}
                    {hayPrevio && (
                        <p className="sgp-leyenda">
                            <span className="sgp-ley-actual" /> este período
                            <span className="sgp-ley-antes" /> {datos.comparacion.desde} a {datos.comparacion.hasta}
                        </p>
                    )}
                    <div className="sgp-filas">
                        {grupos.length ? grupos.map((g, i) => (
                            <FilaGrupo key={g.key} grupo={g} campo={campo} onVer={abrir} montado={montado}
                                hayPrevio={hayPrevio} i={i} />
                        )) : <Vacio texto="Nadie en este corte tiene datos en el período." />}
                    </div>
                </>
            )}
            {registros.panel}
        </Panel>
    );
};

export default SegmentosPanel;
