import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../services/api';
import ListaConfigurable from '../../../../components/listas/ListaConfigurable';
import EsqueletoLista from '../../../../components/listas/EsqueletoLista';
import {
    Button, Chip, FieldError, Input, Modal, ModalHeader, Select, SkeletonBlock, Switch, TextArea,
} from '../../../../components/standard';
import { PanelCab } from '../../../comercial/components/Shared';
import { ErrorDeCarga } from '../esqueletos';
import './conversaciones.css';

/**
 * Marketing › Conversaciones (16/10/2026): el catálogo de mensajes del flujo de ManyChat. Cada mensaje tiene
 * el número que el flujo manda en `id_option_send` (al enviarlo) e `id_option` (al responderlo); con el
 * catálogo, Entrantes y las estadísticas lo muestran con nombre. Antes vivía en el panel del setter.
 *
 * La lista suma los números que llegaron en el período sin estar en el catálogo («Sin configurar»), para
 * darlos de alta desde ahí.
 *
 * Mientras llegan el catálogo y las cifras del período (en paralelo): el panel, «Nuevo mensaje» y las
 * columnas ya se ven; las filas son esqueletos.
 */

export const CATEGORIAS = [
    { value: 'opening', label: 'Apertura' },
    { value: 'cualificacion', label: 'Cualificación' },
    { value: 'dolor', label: 'Dolor' },
    { value: 'seguimiento', label: 'Seguimiento' },
];
const rotuloCategoria = (c) => CATEGORIAS.find((x) => x.value === c)?.label || null;

/** A qué rama del flujo pertenece (18/10/2026): recibirlo deja a la persona con esa calificación si
 * ManyChat no mandó ninguna (ver `app/services/rama_mensajes.py`). */
const SIN_RAMA = 'ninguna';
export const RAMAS = [
    { value: SIN_RAMA, label: 'Ninguna' },
    { value: 'calificados', label: 'Calificados' },
    { value: 'descalificados', label: 'Descalificados' },
];
const rotuloRama = (r) => (r ? RAMAS.find((x) => x.value === r)?.label : null);
const num = (n) => (n ?? 0).toLocaleString('en-US');
const pct = (n) => (n == null ? '—' : `${Number(n).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`);

/**
 * Une el catálogo con lo que llegó en el período: una fila por número de mensaje. Sin `estadisticas`
 * todavía (null: el cálculo del período tarda mucho más que el catálogo), las filas salen igual con
 * `cargando` y sus cifras se dibujan como esqueleto hasta que llegan.
 */
export const unir = (mensajes, estadisticas) => {
    if (!estadisticas) return mensajes.map((m) => ({ ...m, configurado: true, stats: null, cargando: true }));
    const porId = new Map(estadisticas.map((e) => [String(e.message_id), e]));
    const filas = mensajes.map((m) => ({ ...m, configurado: true, stats: porId.get(String(m.message_id)) || null }));
    estadisticas.filter((e) => !mensajes.some((m) => String(m.message_id) === String(e.message_id)))
        .forEach((e) => filas.push({ message_id: String(e.message_id), title: null, body: null, category: null,
            is_active: true, configurado: false, stats: e }));
    return filas.sort((a, b) => (Number(a.message_id) || 0) - (Number(b.message_id) || 0));
};

// La cifra de una fila, o su hueso mientras las estadísticas del período no llegaron.
const cifra = (f, texto) => (f.cargando
    ? <SkeletonBlock width={34} height={10} style={{ marginLeft: 'auto' }} />
    : texto);

const COLUMNAS = [
    { key: 'id', header: 'N.º', fija: true, width: 'minmax(56px,.4fr)', alinear: 'der', valor: (f) => Number(f.message_id) || f.message_id },
    { key: 'mensaje', header: 'Mensaje', fija: true, width: 'minmax(180px,2fr)', valor: (f) => f.title || '',
        render: (f) => (f.configurado
            ? <span className="cv-msj"><span className="celda">{f.title}</span><small className="celda mut40">
                {[rotuloCategoria(f.category), f.rama && `rama de ${rotuloRama(f.rama).toLowerCase()}`].filter(Boolean).join(' · ')}
            </small></span>
            : <span className="cv-msj"><span className="celda mut40">Sin configurar</span><small className="celda mut40">Llegó en el período</small></span>) },
    { key: 'enviados', header: 'Enviados', alinear: 'der', width: 'minmax(84px,.7fr)', valor: (f) => f.stats?.total_sends ?? 0,
        render: (f) => cifra(f, num(f.stats?.total_sends)) },
    { key: 'respondidos', header: 'Respondidos', alinear: 'der', width: 'minmax(96px,.8fr)', valor: (f) => f.stats?.total_responses ?? 0,
        render: (f) => cifra(f, num(f.stats?.total_responses)) },
    { key: 'tasa', header: '% respuesta', alinear: 'der', width: 'minmax(96px,.8fr)', valor: (f) => f.stats?.response_rate ?? null,
        ayuda: 'Respondidos ÷ enviados.', render: (f) => cifra(f, f.stats ? pct(f.stats.response_rate) : '—') },
    { key: 'calificados', header: 'Calificados', alinear: 'der', width: 'minmax(92px,.7fr)', valor: (f) => f.stats?.leads_generated ?? 0,
        ayuda: 'Respondieron este mensaje y quedaron calificados.', render: (f) => cifra(f, num(f.stats?.leads_generated)) },
    { key: 'descalificados', header: 'Descalificados', alinear: 'der', width: 'minmax(104px,.8fr)', valor: (f) => f.stats?.disqualified_leads ?? 0,
        render: (f) => cifra(f, num(f.stats?.disqualified_leads)) },
    { key: 'agendas', header: 'Agendas', alinear: 'der', width: 'minmax(76px,.6fr)', valor: (f) => f.stats?.agendas ?? 0, oculta: true,
        render: (f) => cifra(f, num(f.stats?.agendas)) },
    { key: 'activo', header: 'Estado', width: 'minmax(96px,.7fr)', valor: (f) => (f.is_active ? 1 : 0),
        render: (f) => (!f.configurado ? <Chip color="var(--warning)" subtle>Sin configurar</Chip>
            : f.is_active ? <Chip color="var(--success)" subtle>Activo</Chip> : <Chip subtle>Inactivo</Chip>) },
];

const FACETAS = [
    { key: 'categoria', label: 'Categoría', de: (f) => rotuloCategoria(f.category) || 'Sin configurar' },
    { key: 'rama', label: 'Rama', de: (f) => rotuloRama(f.rama) || 'Ninguna' },
    { key: 'estado', label: 'Estado', de: (f) => (!f.configurado ? 'Sin configurar' : f.is_active ? 'Activo' : 'Inactivo') },
];

const VACIO = { message_id: '', title: '', body: '', category: 'cualificacion', rama: SIN_RAMA, is_active: true };

/** Alta o edición de un mensaje. `nuevo`: el número todavía no existe en el catálogo. */
const EditarMensaje = ({ inicial, nuevo, onCerrar, onGuardado }) => {
    const [form, setForm] = useState({ ...VACIO, ...inicial, rama: inicial?.rama || SIN_RAMA });
    const [error, setError] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const cambiar = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

    const guardar = async () => {
        if (!String(form.message_id).trim() || !form.title.trim()) {
            setError('Poné el número y el título.');
            return;
        }
        setGuardando(true);
        setError(null);
        try {
            const cuerpo = { message_id: String(form.message_id).trim(), title: form.title.trim(), body: form.body,
                category: form.category, rama: form.rama === SIN_RAMA ? null : form.rama, is_active: form.is_active };
            if (nuevo) await api.post('/conversational/messages', cuerpo);
            else await api.put(`/conversational/messages/${form.id}`, cuerpo);
            toast.success(nuevo ? 'Mensaje agregado' : 'Mensaje guardado');
            onGuardado();
            onCerrar();
        } catch (e) {
            setError(e.response?.data?.message || 'No se pudo guardar.');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Modal onClose={onCerrar} labelledBy="cv-editar-titulo" className="cv-modal">
            <ModalHeader titleId="cv-editar-titulo" title={nuevo ? 'Nuevo mensaje' : `Mensaje ${form.message_id}`}
                subtitle="El número es el que manda el flujo en id_option_send e id_option." onClose={onCerrar} />
            <div className="cv-form">
                <label className="cv-campo">
                    <span className="t-rotulo">Número</span>
                    <Input variant="number" value={form.message_id} disabled={!nuevo} inputMode="numeric"
                        onChange={(e) => cambiar('message_id')(e.target.value)} aria-label="Número del mensaje" />
                </label>
                <label className="cv-campo">
                    <span className="t-rotulo">Título</span>
                    <Input value={form.title} onChange={(e) => cambiar('title')(e.target.value)} placeholder="Cualificación 3"
                        aria-label="Título" />
                </label>
                <div className="cv-campo cv-campo--ancho">
                    <span className="t-rotulo">Categoría</span>
                    <Select value={form.category} options={CATEGORIAS} onChange={cambiar('category')} label="Categoría" />
                </div>
                <div className="cv-campo cv-campo--ancho">
                    <span className="t-rotulo">Rama</span>
                    <Select value={form.rama} options={RAMAS} onChange={cambiar('rama')} label="Rama" />
                </div>
                {form.rama !== SIN_RAMA && (
                    <p className="cv-campo--ancho t-cap mut40 cv-nota">
                        Quien lo reciba queda {form.rama === 'calificados' ? 'calificado' : 'descalificado'} si ManyChat no mandó la calificación.
                    </p>
                )}
                <label className="cv-campo cv-campo--ancho">
                    <span className="t-rotulo">Texto del mensaje</span>
                    <TextArea value={form.body || ''} onChange={(e) => cambiar('body')(e.target.value)}
                        placeholder="Lo que dice el mensaje en ManyChat" aria-label="Texto del mensaje" />
                </label>
                <div className="cv-activo">
                    <Switch checked={form.is_active} onChange={cambiar('is_active')} label="Activo" />
                    <span>{form.is_active ? 'Activo' : 'Inactivo'}</span>
                </div>
                {error && <FieldError>{error}</FieldError>}
            </div>
            <div className="cv-pie">
                <Button onClick={onCerrar}>Cancelar</Button>
                <Button variant="primary" disabled={guardando} onClick={guardar}>Guardar</Button>
            </div>
        </Modal>
    );
};

const ConversacionesVista = ({ desde, hasta, version = 0 }) => {
    const [mensajes, setMensajes] = useState(null);
    const [estadisticas, setEstadisticas] = useState(null);
    const [error, setError] = useState(null);
    const [editando, setEditando] = useState(null); // { inicial, nuevo }
    const [recarga, setRecarga] = useState(0);

    // El catálogo y las cifras del período salen juntos y cada uno llena lo suyo apenas llega: los
    // nombres se ven enseguida y las cifras después (el cálculo del período tarda varios segundos).
    useEffect(() => {
        const control = new AbortController();
        api.get('/conversational/messages', { signal: control.signal })
            .then((m) => { setMensajes(m.data || []); setError(null); })
            .catch((e) => {
                if (e?.name === 'CanceledError') return;
                setError('No se pudieron cargar los mensajes.');
                toast.error('No se pudieron cargar los mensajes.');
            });
        api.get('/conversational/stats/conversational', { params: { start_date: desde, end_date: hasta }, signal: control.signal })
            .then((s) => setEstadisticas(s.data?.table || []))
            .catch((e) => {
                if (e?.name === 'CanceledError') return;
                setEstadisticas((actual) => actual || []);
                toast.error('No se pudieron calcular las cifras del período.');
            });
        return () => control.abort();
    }, [desde, hasta, version, recarga]);

    const filas = useMemo(() => (mensajes ? unir(mensajes, estadisticas) : []), [mensajes, estadisticas]);
    const abrir = useCallback((f) => setEditando(f.configurado
        ? { inicial: f, nuevo: false }
        : { inicial: { ...VACIO, message_id: f.message_id }, nuevo: true }), []);
    const sinConfigurar = filas.filter((f) => !f.configurado).length;

    if (error && !mensajes) return <ErrorDeCarga titulo={error} onReintentar={() => { setError(null); setRecarga((n) => n + 1); }} />;

    return (
        <section className="panel cv-lista" aria-label="Mensajes del flujo">
            <PanelCab titulo="Mensajes del flujo" tip="El número que manda ManyChat en cada paso. Clic: editar.">
                <Button variant="primary" icon={<Plus size={15} aria-hidden="true" />}
                    onClick={() => setEditando({ inicial: VACIO, nuevo: true })}>
                    Nuevo mensaje
                </Button>
            </PanelCab>
            {mensajes && !estadisticas && <span className="ui-skel__sr" role="status">Calculando las cifras del período…</span>}
            {!mensajes && (
                <EsqueletoLista columnas={COLUMNAS} claveGuardado="mk_conversaciones_cols" facetas={FACETAS}
                    label="Cargando los mensajes…" />
            )}
            {sinConfigurar > 0 && (
                <p className="t-cap cv-aviso">
                    {sinConfigurar === 1 ? 'Llegó 1 número sin configurar' : `Llegaron ${sinConfigurar} números sin configurar`}: tocalo para darlo de alta.
                </p>
            )}
            {mensajes && (
                <ListaConfigurable columnas={COLUMNAS} facetas={FACETAS} filas={filas} clave={(f) => f.message_id}
                    onAbrirFila={abrir} claveGuardado="mk_conversaciones_cols" vacio="No hay mensajes cargados."
                    buscar={(f) => [f.message_id, f.title, f.body].filter(Boolean).join(' ')} buscarPlaceholder="Número o título…" />
            )}
            {editando && (
                <EditarMensaje inicial={editando.inicial} nuevo={editando.nuevo} onCerrar={() => setEditando(null)}
                    onGuardado={() => setRecarga((n) => n + 1)} />
            )}
        </section>
    );
};

export default ConversacionesVista;
