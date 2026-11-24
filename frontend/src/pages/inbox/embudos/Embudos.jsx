// Sección Embudos del Inbox (ADR-W204): reemplaza a Flujos y Guía. Cada embudo (Conversión, Lead magnet…) es una
// fila de fases; en cada fase, lo que manda el bot (los flujos de esa fase), lo que manda el setter (la Guía) y
// qué pasa si el lead no contesta (los seguimientos). La Guía y los seguimientos se editan en un borrador y se
// publican juntos, como la Guía de antes; los flujos se guardan y publican en su lienzo, como siempre.
import { useCallback, useMemo, useState } from 'react';
import { FlaskConical, Plus, Settings2 } from 'lucide-react';
import { Button, Chip, EmptyState, Modal, ModalHeader, Panel, Segmented, Skeleton, SkeletonPanel, Switch, toast } from '../../../components/standard';
import { inboxApi } from '../api';
import Flujos from '../Flujos';
import EditorEtapa from '../guia/EditorEtapa';
import HistorialGuia, { Proponer } from '../guia/HistorialGuia';
import PreviaGuia from '../guia/PreviaGuia';
import QuienEsLead from '../guia/QuienEsLead';
import { useGuia } from '../guia/useGuia';
import '../guia/guia.css';
import AjustesEmbudo from './AjustesEmbudo';
import EditorSeguimientos from './EditorSeguimientos';
import MapaFases from './MapaFases';
import Simulador from './Simulador';
import { SALIDAS, TRAMOS_EMBUDO, copia, nuevoId, useEmbudos, useGuiaDe } from './useEmbudos';
import './embudos.css';

const CLAVE = 'inbox-embudo';
const cuando = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' }) : null);
const leer = () => { try { return window.localStorage.getItem(CLAVE); } catch { return null; } };
const guardar = (v) => { try { window.localStorage.setItem(CLAVE, v); } catch { /* sin almacenamiento */ } };

/** Cada fase del embudo con su etapa, aunque la guía publicada no la traiga todavía. */
function completa(contenido, embudo) {
    const c = copia(contenido || {});
    c.quien = c.quien || {};
    c.etapas = c.etapas || {};
    [...embudo.fases, ...SALIDAS].forEach((f) => {
        const e = c.etapas[f.id] || {};
        c.etapas[f.id] = { nota: e.nota || '', pasos: e.pasos || [], seguimientos: e.seguimientos || [] };
    });
    return c;
}

function editadosDe(borrador, publicado, fase) {
    const antes = Object.fromEntries((publicado?.etapas?.[fase]?.pasos || []).map((p) => [p.id, JSON.stringify(p)]));
    return new Set((borrador?.etapas?.[fase]?.pasos || []).filter((p) => antes[p.id] !== JSON.stringify(p)).map((p) => p.id));
}

function Bloque({ letra, color, titulo, ayuda, className = '', children }) {
    return (
        <section className={`em-bloque ${className}`}>
            <div className="em-bcab">
                <span className="em-letra" style={{ '--c': color }}>{letra}</span>
                <h3>{titulo}</h3>
                {ayuda && <span className="t-cap mut">{ayuda}</span>}
            </div>
            {children}
        </section>
    );
}

export default function Embudos() {
    const { datos, error, cargar } = useEmbudos();
    const lista = datos?.embudos || [];
    const [slug, setSlug] = useState(() => leer() || 'conversion');
    const embudo = lista.find((e) => e.id === slug) || lista[0] || null;
    const puede = !!datos?.puede_editar;
    const [guia, fijar, recargar] = useGuiaDe(embudo);
    const guiaConversion = useGuia();
    const [borrador, setBorrador] = useState(null);
    const [base, setBase] = useState(null);
    const [sel, setSel] = useState(null);
    const [editando, setEditando] = useState(false);
    const [modal, setModal] = useState(null);
    const [publicando, setPublicando] = useState(false);

    // Solo al cargar y al publicar otra versión: refrescar la misma no pisa lo que se está editando.
    const vigente = embudo && guia?.contenido && guia.embudo?.id === embudo.id ? `${embudo.id}:${guia.version?.id ?? 'inicial'}` : null;
    if (vigente !== null && vigente !== base) {
        setBase(vigente);
        setBorrador(completa(guia.contenido, embudo));
    }
    const listo = !!(embudo && borrador && base?.startsWith(`${embudo.id}:`));
    const publicado = useMemo(() => (listo ? completa(guia.contenido, embudo) : null), [listo, guia, embudo]);
    const fasesTodas = useMemo(() => (embudo ? [...embudo.fases, ...SALIDAS] : []), [embudo]);
    // Sin elegir (o al cambiar de embudo), Dolor en Conversión y la primera en los demás.
    const fase = fasesTodas.find((f) => f.id === sel) || fasesTodas.find((f) => embudo?.conversion && f.id === 'dolor') || fasesTodas[0];

    const sucias = useMemo(() => {
        if (!listo || !publicado) return new Set();
        const s = new Set(fasesTodas.map((f) => f.id).filter((f) => JSON.stringify(borrador.etapas[f]) !== JSON.stringify(publicado.etapas[f])));
        if (JSON.stringify(borrador.quien) !== JSON.stringify(publicado.quien)) s.add('quien');
        return s;
    }, [listo, borrador, publicado, fasesTodas]);

    const onEditando = useCallback((v) => setEditando(v), []);
    if (error) return <EmptyState>No se pudieron cargar los embudos.</EmptyState>;
    if (!embudo || !listo || !fase) return <Skeleton label="Cargando los embudos…"><SkeletonPanel className="gu-esqueleto" rows={8} rowHeight={44} /></Skeleton>;

    const elegirEmbudo = (s) => {
        if (s === embudo.id) return;
        if (sucias.size) { toast('Publicá o descartá los cambios antes de cambiar de embudo', 'error'); return; }
        setSlug(s);
        guardar(s);
    };
    const publicar = async () => {
        setPublicando(true);
        try {
            const r = await inboxApi.publicarGuia(borrador, guia.version.id, null, embudo.conversion ? undefined : embudo.id);
            fijar({ ...guia, ...r });
            toast('Publicado: ya corre así');
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo publicar', 'error');
        } finally {
            setPublicando(false);
        }
    };
    const prender = async (v) => {
        try {
            await inboxApi.guardarEmbudo(embudo.id, { seguimientos_activos: v });
            toast(v ? 'Seguimientos prendidos: cuentan las conversaciones que empiecen desde ahora' : 'Seguimientos apagados');
            cargar();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo cambiar', 'error');
        }
    };
    const etapa = borrador.etapas[fase.id];
    const setEtapa = (id, e) => setBorrador((b) => ({ ...b, etapas: { ...b.etapas, [id]: e } }));
    const n = embudo.fases.findIndex((f) => f.id === fase.id) + 1;
    const esSalida = SALIDAS.some((f) => f.id === fase.id);
    const conBot = fase.tramo === 'auto';
    const tramo = TRAMOS_EMBUDO[fase.tramo] || { nombre: 'Sale del embudo', color: 'var(--error)' };
    const primera = embudo.fases[0]?.id;
    const deLaFase = (f) => (f.embudo_id ?? null) === embudo.pk && (f.fase || primera) === fase.id;
    const copiarA = (dest) => {
        setEtapa(dest, { ...borrador.etapas[dest], seguimientos: etapa.seguimientos.map((s) => ({ ...s, id: nuevoId() })) });
        toast(`Seguimientos copiados a ${fasesTodas.find((f) => f.id === dest)?.nombre}: publicá para que corran`);
    };
    const v = guia.version;
    return (
        <div className={`em${editando ? ' em--flujo' : ''}`}>
            <div className="em-barra">
                <Segmented label="Embudo" value={embudo.id} onChange={elegirEmbudo}
                    options={lista.map((e) => ({ value: e.id, label: e.nombre, count: e.leads, props: { title: `${e.leads} leads escribieron en los últimos ${datos.dias_leads} días` } }))} />
                {puede && <Button variant="ghost" icon={<Plus />} onClick={() => setModal({ tipo: 'nuevo' })}>Embudo</Button>}
                {puede && <Button variant="ghost" icon={<Settings2 />} onClick={() => setModal({ tipo: 'ajustes' })}>Ajustes</Button>}
                <label className="em-prender" data-tip="Seguimientos|Apagados, los automáticos no salen y a los setters no les llegan avisos. Al prenderlos solo cuentan las conversaciones que empiecen desde ese momento: las de antes no reciben nada.">
                    <Switch checked={embudo.seguimientos_activos} onChange={puede ? prender : undefined} label="Seguimientos" />
                    {embudo.seguimientos_activos && embudo.seguimientos_desde
                        ? `Seguimientos prendidos · conversaciones desde el ${new Date(embudo.seguimientos_desde).toLocaleString('es-AR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                        : 'Seguimientos apagados'}
                </label>
                <span className="em-barra-der">
                    <Button icon={<FlaskConical />} onClick={() => setModal({ tipo: 'simular' })}>Simular conversación</Button>
                    <Button variant="ghost" onClick={() => setModal({ tipo: 'historial' })}>Historial</Button>
                    {embudo.conversion && <Button variant="ghost" onClick={() => setModal({ tipo: 'quien' })}>Quién es lead</Button>}
                </span>
            </div>
            <div className="em-estado">
                {embudo.descripcion && <span className="t-cap mut">{embudo.descripcion}</span>}
                <span className="t-cap mut">{v.id ? `Publicado el ${cuando(v.en)}${v.por ? ` por ${v.por}` : ''}` : 'Sin publicar todavía'}</span>
                {guia.propuestas_pendientes > 0 && (
                    <Button variant="ghost" onClick={() => setModal({ tipo: 'historial', inicial: 'propuestas' })}>
                        {guia.propuestas_pendientes} propuesta{guia.propuestas_pendientes > 1 ? 's' : ''} pendiente{guia.propuestas_pendientes > 1 ? 's' : ''}
                    </Button>
                )}
                {sucias.size > 0 && (
                    <span className="gu-pend">
                        <b>{sucias.size} {sucias.size > 1 ? 'cambios' : 'cambio'} sin publicar</b>
                        <Button onClick={() => setBorrador(copia(publicado))} disabled={publicando}>Descartar</Button>
                        <Button variant="primary" onClick={publicar} disabled={publicando}>Publicar</Button>
                    </span>
                )}
            </div>
            <Panel size="sm" className="em-mapa-panel">
                <MapaFases fases={embudo.fases} etapas={borrador.etapas} sel={fase.id} sucias={sucias} onElegir={setSel} />
            </Panel>
            <div className="em-cuerpo">
                <Panel size="sm" className="em-centro">
                    <div className="gu-ecab em-fcab">
                        <Chip subtle color={tramo.color}>{tramo.nombre}</Chip>
                        <h2>{esSalida ? fase.nombre : `${n}. ${fase.nombre}`}</h2>
                        <Button variant="ghost" className="gu-der" onClick={() => setModal({ tipo: 'proponer', etapa: fase.id })}>Proponer un cambio a la fase</Button>
                    </div>
                    {conBot && (
                        <Bloque letra="A" color="var(--info)" titulo="Lo manda el bot" ayuda="Los flujos que arrancan en esta fase. Abrir uno lleva al lienzo." className="em-bloque--flujos">
                            <Flujos incrustado puedeEditar={puede} deLaFase={deLaFase} ubicacion={{ embudo: embudo.id, fase: fase.id }} onEditando={onEditando} />
                        </Bloque>
                    )}
                    <Bloque letra={conBot ? 'B' : 'A'} color="#7D63E6" titulo={conBot ? 'Si el bot no salió: lo manda el setter' : 'Lo manda el setter'}
                        ayuda="Los pasos de la Guía: salen en el «/» del chat con su atajo.">
                        <p className="gu-ayuda">Cada paso puede tener <b>opción A y opción B</b>: el setter elige cuál mandar y acá ves cuál responde más.
                            Una línea en blanco separa los mensajes. <b>{'{nombre}'}</b> y <b>{'{link de agenda}'}</b> se completan solos; lo que va
                            entre <b>[corchetes]</b> lo escribe el setter antes de mandar.</p>
                        <EditorEtapa key={`${embudo.id}:${fase.id}`} fase={fase.id} etapa={etapa} guia={guia} cabecera={false}
                            info={embudo.conversion ? undefined : { n, label: fase.nombre, tramo: fase.tramo, siguiente: embudo.fases[n]?.nombre }}
                            editados={editadosDe(borrador, publicado, fase.id)} onCambiar={(e) => setEtapa(fase.id, e)}
                            onProponer={() => setModal({ tipo: 'proponer', etapa: fase.id })} />
                    </Bloque>
                    {!esSalida && (
                        <Bloque letra={conBot ? 'C' : 'B'} color="var(--brand-secondary)" titulo="Si no contesta"
                            ayuda="Se cuenta desde el último mensaje del lead, si lo último es nuestro. Si contesta, se corta.">
                            <EditorSeguimientos lista={etapa.seguimientos} puedeAuto={puede} uso={guia.seguimientos_uso}
                                claveBase={`${embudo.id}:${fase.id}`} variables={embudo.variables}
                                otras={embudo.fases.filter((f) => f.id !== fase.id)}
                                onCambiar={(l) => setEtapa(fase.id, { ...etapa, seguimientos: l })} onCopiar={copiarA} />
                        </Bloque>
                    )}
                </Panel>
                <Panel size="sm" className="gu-previa em-previa">
                    <PreviaGuia key={`${embudo.id}:${fase.id}`} pasos={etapa.pasos} />
                    <Button icon={<FlaskConical />} onClick={() => setModal({ tipo: 'simular' })}>Simular la conversación completa</Button>
                </Panel>
            </div>
            {modal?.tipo === 'simular' && (
                <Simulador embudo={embudo} embudos={lista} borrador={borrador} guiaConversion={guiaConversion} onCerrar={() => setModal(null)} />
            )}
            {modal?.tipo === 'proponer' && <Proponer etapa={modal.etapa} onCerrar={() => setModal(null)} />}
            {modal?.tipo === 'historial' && (
                <HistorialGuia puede={guia.puede_aprobar} embudo={embudo.conversion ? undefined : embudo.id} inicial={modal.inicial}
                    onCerrar={() => { setModal(null); recargar(); }} onRestaurada={(r) => fijar({ ...guia, ...r })} />
            )}
            {modal?.tipo === 'quien' && (
                <Modal onClose={() => setModal(null)} className="gu-modal gu-modal--ancho" labelledBy="em-quien-t">
                    <ModalHeader titleId="em-quien-t" title="Quién es lead" subtitle="Se publica con el resto de los cambios." onClose={() => setModal(null)} />
                    <div className="gu-modal-cuerpo">
                        <QuienEsLead quien={borrador.quien} puede={guia.puede_aprobar} onCambiar={(quien) => setBorrador({ ...borrador, quien })}
                            onProponer={() => setModal({ tipo: 'proponer' })} />
                    </div>
                </Modal>
            )}
            {(modal?.tipo === 'nuevo' || modal?.tipo === 'ajustes') && (
                <AjustesEmbudo embudo={modal.tipo === 'ajustes' ? embudo : null} onCerrar={() => setModal(null)}
                    onGuardado={(r) => { setModal(null); cargar(); if (modal.tipo === 'nuevo') { setSlug(r.id); guardar(r.id); } }} />
            )}
        </div>
    );
}
