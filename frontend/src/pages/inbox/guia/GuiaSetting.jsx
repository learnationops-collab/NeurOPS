// La sección Guía del Inbox (ADR-W197): las etapas del setting y lo que se manda en cada una, editable por el
// equipo. Se edita un borrador local y se publica entero (una versión nueva); en el chat sigue lo publicado
// hasta publicar. Las etapas son fijas (`fases.py`) y «Quién es lead» lo cambia la dirección: eso se propone.
import { useEffect, useMemo, useState } from 'react';
import { Button, EmptyState, Panel, Skeleton, SkeletonPanel, toast } from '../../../components/standard';
import { inboxApi } from '../api';
import { FASES, TRAMOS, colorDe } from '../conversaciones/fasesSetting';
import EditorEtapa from './EditorEtapa';
import HistorialGuia, { Proponer } from './HistorialGuia';
import PreviaGuia from './PreviaGuia';
import QuienEsLead from './QuienEsLead';
import { cargarGuia, fijarGuia, useGuia } from './useGuia';
import './guia.css';

const copia = (x) => JSON.parse(JSON.stringify(x));
const cuando = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' }) : null);

/** Los ids de los pasos que cambiaron en una etapa, para marcarlos. */
function editadosDe(borrador, publicado, fase) {
    const antes = Object.fromEntries((publicado?.etapas?.[fase]?.pasos || []).map((p) => [p.id, JSON.stringify(p)]));
    return new Set((borrador?.etapas?.[fase]?.pasos || []).filter((p) => antes[p.id] !== JSON.stringify(p)).map((p) => p.id));
}

function Lista({ sel, onElegir, sucias }) {
    const fila = (id, n, txt, color) => (
        <button key={id} type="button" className={`gu-et${id === sel ? ' gu-et--on' : ''}`} style={{ '--c': color }} onClick={() => onElegir(id)}>
            <span className="gu-et-n">{n}</span><span>{txt}{sucias.has(id) && <span className="gu-sucio" aria-label="con cambios" />}</span>
        </button>
    );
    return (
        <Panel as="nav" size="sm" className="gu-lista" aria-label="Etapas">
            {fila('quien', '?', 'Quién es lead', 'var(--text-muted)')}
            {Object.entries(TRAMOS).map(([t, x]) => (
                <div key={t} className="gu-grupo">
                    <span className="t-rotulo">{x.nombre}</span>
                    {FASES.filter((f) => f.tramo === t).map((f) => fila(f.id, f.n, f.label, colorDe(f)))}
                </div>
            ))}
        </Panel>
    );
}

export default function GuiaSetting() {
    const guia = useGuia();
    const [borrador, setBorrador] = useState(null);
    const [sel, setSel] = useState('dolor');
    const [publicando, setPublicando] = useState(false);
    const [modal, setModal] = useState(null);
    useEffect(() => { cargarGuia(); }, []);
    // Solo al cargar y al publicar otra versión: refrescar la misma no pisa lo que se está editando.
    const [base, setBase] = useState(null);
    const vigente = guia?.contenido ? String(guia.version?.id ?? 'inicial') : null;
    if (vigente !== null && vigente !== base) {
        setBase(vigente);
        setBorrador(copia(guia.contenido));
    }

    const publicado = guia?.contenido;
    const sucias = useMemo(() => {
        if (!borrador || !publicado) return new Set();
        const s = new Set(FASES.map((f) => f.id).filter((f) => JSON.stringify(borrador.etapas[f]) !== JSON.stringify(publicado.etapas[f])));
        if (JSON.stringify(borrador.quien) !== JSON.stringify(publicado.quien)) s.add('quien');
        return s;
    }, [borrador, publicado]);

    if (guia?.error) return <EmptyState>No se pudo cargar la guía.</EmptyState>;
    if (!borrador) return <Skeleton label="Cargando la guía…"><SkeletonPanel className="gu-esqueleto" rows={8} rowHeight={44} /></Skeleton>;

    const puede = guia.puede_aprobar;
    const publicar = async () => {
        setPublicando(true);
        try {
            const r = await inboxApi.publicarGuia(borrador, guia.version.id);
            fijarGuia({ ...guia, ...r });
            toast('Guía publicada: ya sale así en el chat');
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo publicar', 'error');
        } finally {
            setPublicando(false);
        }
    };
    const etapa = borrador.etapas[sel];
    const v = guia.version;
    return (
        <div className="gu">
            <div className="gu-barra">
                <span className="t-cap mut">{v.id ? `Publicada el ${cuando(v.en)}${v.por ? ` por ${v.por}` : ''}` : 'La estructura del documento de setting, sin cambios todavía'}</span>
                <Button variant="ghost" onClick={() => setModal({ tipo: 'historial' })}>Historial</Button>
                {guia.propuestas_pendientes > 0 && (
                    <Button variant="ghost" onClick={() => setModal({ tipo: 'historial', inicial: 'propuestas' })}>
                        {guia.propuestas_pendientes} propuesta{guia.propuestas_pendientes > 1 ? 's' : ''} pendiente{guia.propuestas_pendientes > 1 ? 's' : ''}
                    </Button>
                )}
                {sucias.size > 0 && (
                    <span className="gu-pend">
                        <b>{sucias.size} {sucias.size > 1 ? 'etapas' : 'etapa'} con cambios sin publicar</b>
                        <Button onClick={() => setBorrador(copia(publicado))} disabled={publicando}>Descartar</Button>
                        <Button variant="primary" onClick={publicar} disabled={publicando}>Publicar</Button>
                    </span>
                )}
            </div>
            <p className="gu-ayuda">Cada paso puede tener <b>opción A y opción B</b>: el setter elige cuál mandar y acá ves cuál responde más.
                Una línea en blanco separa los mensajes. <b>{'{nombre}'}</b> y <b>{'{link de agenda}'}</b> se completan solos; lo que va
                entre <b>[corchetes]</b> lo escribe el setter antes de mandar.</p>
            <div className="gu-cuerpo">
                <Lista sel={sel} onElegir={setSel} sucias={sucias} />
                <Panel size="sm" className="gu-centro">
                    {sel === 'quien'
                        ? <QuienEsLead quien={borrador.quien} puede={puede} onCambiar={(quien) => setBorrador({ ...borrador, quien })} onProponer={() => setModal({ tipo: 'proponer' })} />
                        : <EditorEtapa fase={sel} etapa={etapa} guia={guia} editados={editadosDe(borrador, publicado, sel)}
                            onCambiar={(e) => setBorrador({ ...borrador, etapas: { ...borrador.etapas, [sel]: e } })}
                            onProponer={() => setModal({ tipo: 'proponer', etapa: sel })} />}
                </Panel>
                <Panel size="sm" className="gu-previa">
                    {sel === 'quien' ? <p className="t-cap mut">Sale en la etapa No lead del chat.</p> : <PreviaGuia key={sel} pasos={etapa.pasos} />}
                </Panel>
            </div>
            {modal?.tipo === 'proponer' && <Proponer etapa={modal.etapa} onCerrar={() => setModal(null)} />}
            {modal?.tipo === 'historial' && (
                <HistorialGuia puede={puede} inicial={modal.inicial} onCerrar={() => { setModal(null); cargarGuia(); }}
                    onRestaurada={(r) => fijarGuia({ ...guia, ...r })} />
            )}
        </div>
    );
}
