// El historial (ADR-W229): cada «Enviar» con sus cuentas; tocando uno, sus números con lo que pasó y, si
// respondió, qué tocó y su chat en el Inbox.
import { useEffect, useState } from 'react';
import { Chip, EmptyState, LinkButton, Segmented, Skeleton, SkeletonPanel } from '../../../components/standard';
import { ESTADOS, embudo } from './useBroadcast';

const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

function Lote({ lote, elegido, onElegir }) {
    const e = embudo(lote.por_estado);
    return (
        <button type="button" className={`bw-lote${elegido ? ' bw-lote--on' : ''}`} aria-pressed={elegido} onClick={onElegir}>
            <span className="bw-lote-top">
                <b>{lote.plantilla}</b>
                <span className="bw-s">{fecha(lote.creado_en)} · {lote.por || '—'} · {lote.total} números</span>
                {e.pendientes > 0 ? <Chip subtle color="var(--ln-success, #1f9d6b)">Mandando</Chip> : null}
            </span>
            <span className="bw-embudo">
                <span><b>{e.enviados}</b> enviados</span><span><b>{e.entregados}</b> entregados</span>
                <span><b>{e.leidos}</b> leídos</span><span><b>{e.respondieron}</b> respondieron</span>
                {e.fallaron > 0 && <span><b>{e.fallaron}</b> fallaron</span>}
            </span>
        </button>
    );
}

function descargar(lote, filas) {
    const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lineas = [['telefono', 'nombre', 'estado', 'enviado', 'respuesta', 'error', 'setter'].join(',')]
        .concat(filas.map((f) => [f.telefono, f.nombre, ESTADOS[f.estado]?.label, f.enviado_en, f.respuesta, f.error, f.setter].map(celda).join(',')));
    const url = URL.createObjectURL(new Blob([lineas.join('\n')], { type: 'text/csv;charset=utf-8' }));
    Object.assign(document.createElement('a'), { href: url, download: `broadcast_${lote.plantilla}_${lote.creado_en.slice(0, 10)}.csv` }).click();
    URL.revokeObjectURL(url);
}

function Numeros({ lote, datos }) {
    const [filas, setFilas] = useState(null);
    const [filtro, setFiltro] = useState('todos');
    const total = lote.total;
    useEffect(() => { datos.numeros(lote.lote).then(setFilas).catch(() => setFilas([])); }, [lote.lote, total, datos]);
    if (!filas) return <Skeleton label="Cargando los números…"><SkeletonPanel rows={6} rowHeight={44} /></Skeleton>;
    const cuenta = (k) => filas.filter((f) => f.estado === k).length;
    const opciones = [{ value: 'todos', label: 'Todos', count: filas.length },
        ...['leido', 'respondio', 'fallo', 'pendiente'].filter((k) => cuenta(k)).map((k) => ({ value: k, label: ESTADOS[k].label, count: cuenta(k) }))];
    const vistas = filtro === 'todos' ? filas : filas.filter((f) => f.estado === filtro);
    return (
        <>
            <Segmented size="sm" label="Filtrar por estado" value={filtro} options={opciones} onChange={setFiltro} />
            <div className="bw-tabla">
                <table>
                    <thead><tr><th>Persona</th><th>Estado</th><th>Respuesta</th></tr></thead>
                    <tbody>
                        {vistas.map((f) => (
                            <tr key={f.telefono}>
                                <td>{f.nombre || 'Sin nombre'}<br /><span className="bw-tel">+{f.telefono}</span></td>
                                <td><Chip subtle color={ESTADOS[f.estado]?.color}>{ESTADOS[f.estado]?.label || f.estado}</Chip></td>
                                <td>
                                    {f.contacto_id
                                        ? <>{f.respuesta ? `«${f.respuesta}» · ` : ''}<a className="bw-link" href={`/inbox?c=${f.contacto_id}`}>Abrir chat</a>{f.setter && <><br /><span className="bw-s">{f.setter}</span></>}</>
                                        : <span className="bw-s">{f.error || '—'}</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="bw-pie"><span>{vistas.length} de {filas.length}</span><LinkButton onClick={() => descargar(lote, filas)}>Descargar CSV</LinkButton></div>
        </>
    );
}

export default function Historial({ datos }) {
    const lotes = datos.historial?.lotes;
    const [elegido, setElegido] = useState(null);
    if (!lotes) return <Skeleton label="Cargando el historial…" className="bw-cuerpo"><SkeletonPanel rows={4} rowHeight={64} /></Skeleton>;
    if (!lotes.length) return <EmptyState title="Todavía no se mandó nada">Cada «Enviar» aparece acá con lo que pasó con cada número.</EmptyState>;
    const actual = lotes.find((l) => l.lote === elegido) || lotes[0];
    return (
        <div className="bw-cuerpo">
            {lotes.map((l) => <Lote key={l.lote} lote={l} elegido={l.lote === actual.lote} onElegir={() => setElegido(l.lote)} />)}
            <Numeros lote={actual} datos={datos} />
        </div>
    );
}
