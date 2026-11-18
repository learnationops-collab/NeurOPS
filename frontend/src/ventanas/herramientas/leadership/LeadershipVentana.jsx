// La herramienta «Leadership» (ventanas/herramientas.js): Leadership rápido, la gestión simplificada de Leadership
// dentro de Work (mockup ../learnation-leadership/docs/mockups/leadership-rapido.html). Anotar algo y dejarlo
// definido con un arquetipo, lo tuyo en el orden de tu Momentum (completar, entregar, cambiar la fecha, pasársela
// a otro) y lo que pediste. Aprobar y lo demás queda en Leadership («Abrir en Leadership»).
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, EmptyState, LinkButton, Segmented, Skeleton, SkeletonRow, toast } from '../../../components/standard';
import { abrirEnLeadership } from '../../../utils/portal';
import Definir from './Definir';
import ListaMia from './ListaMia';
import ListaPedi from './ListaPedi';
import { NOMBRE_R, atajosDeFecha, esLink } from './formato';
import useLeadershipRapido from './useLeadershipRapido';
import './leadership.css';

const deshacer = (fn) => ({ label: 'Deshacer', onClick: () => { fn().catch(e => toast(e.message, 'error')); } });
const PASOS_VACIOS = [{ titulo: '', para: '' }, { titulo: '', para: '' }];

const abrir = (que) => abrirEnLeadership(que).catch(() => toast('No se pudo abrir Leadership', 'error'));

function Cargando() {
    return (
        <Skeleton label="Cargando lo tuyo de Leadership…">
            {[0, 1, 2, 3, 4].map(i => <SkeletonRow key={i} avatar cells={['70%']} height={52} step={i} />)}
        </Skeleton>
    );
}

export default function LeadershipVentana({ item }) {
    const activa = item?.estado !== 'minimizada';
    const { panel, opciones, error, cargarOpciones, pedir } = useLeadershipRapido({ activa });
    const [tab, setTab] = useState('mio');
    const [texto, setTexto] = useState('');
    const [vista, setVista] = useState(null);           // { modo, ruta, base } = el formulario abierto
    const [entrega, setEntrega] = useState(null);       // { fila, id, pide } = la tarea que pide entrega

    useEffect(() => { if (activa) cargarOpciones(); }, [activa, cargarOpciones]);

    const fallo = (e) => toast(e.message, 'error');
    const reabrirTarea = (id) => () => pedir('post', `/task/${id}/reabrir`);

    const acciones = {
        async completar(el) {
            try {
                if (el.tipo === 'project') {
                    const d = await pedir('post', `/project/${el.id}/completar`);
                    toast(`Paso hecho: ${d.paso.titulo}`, 'success', deshacer(reabrirTarea(d.paso.id)));
                } else if (el.estado === 'hecha') {
                    await pedir('post', `/task/${el.id}/reabrir`);
                } else {
                    await pedir('post', `/task/${el.id}/completar`);
                    toast('Completada', 'success', deshacer(reabrirTarea(el.id)));
                }
            } catch (e) {
                if (e.datos?.error === 'pide_entrega') setEntrega({ fila: `${el.tipo}${el.id}`, id: e.datos.tarea.id, pide: e.datos.pide_entrega });
                else fallo(e);
            }
        },
        async entregar(id, valor) {
            try {
                await pedir('post', `/task/${id}/entregar`, esLink(valor) ? { link: valor } : { texto: valor });
                setEntrega(null);
                toast('Entregada: le llega para revisar', 'success', deshacer(reabrirTarea(id)));
            } catch (e) { fallo(e); }
        },
        cancelarEntrega: () => setEntrega(null),
        async ritual(h) {
            try {
                await pedir('post', `/habit/${h.id}/${h.hecho_hoy ? 'reabrir' : 'completar'}`);
                if (!h.hecho_hoy) toast('Ritual hecho por hoy', 'success', deshacer(() => pedir('post', `/habit/${h.id}/reabrir`)));
            } catch (e) { fallo(e); }
        },
        async fecha(el, valor) {
            const antes = el.fecha || null;
            try {
                await pedir('patch', `/${el.tipo}/${el.id}`, { fecha: valor || null });
                toast(valor ? 'Fecha cambiada' : 'Quedó sin fecha', 'success', deshacer(() => pedir('patch', `/${el.tipo}/${el.id}`, { fecha: antes })));
            } catch (e) { fallo(e); }
        },
        async pasar(el, email) {
            const nombre = opciones?.personas.find(p => p.email === email)?.nombre || 'esa persona';
            try {
                await pedir('patch', `/${el.tipo}/${el.id}`, { para: email });
                toast(`Se la pasaste a ${nombre}`, 'success', deshacer(() => pedir('patch', `/${el.tipo}/${el.id}`, { para: panel.persona.email })));
            } catch (e) { fallo(e); }
        },
        pedirPersonas: cargarOpciones,
        ajustar(el) {
            setVista({
                modo: 'ajustar', ruta: `/${el.tipo}/${el.id}`, base: {
                    titulo: el.titulo, tipo: el.tipo === 'project' ? 'project' : 'quick', clase: el.clase,
                    arquetipo: el.arquetipo?.clave || '', minutos: el.minutos, fecha: el.fecha || '',
                    area: el.area?.clave || '', actividad: el.actividad?.clave || '',
                },
            });
        },
        definir(b) {
            setVista({
                modo: 'definir', ruta: `/inbox/${b.id}`, base: {
                    titulo: b.titulo, tipo: b.clase === 'project' ? 'project' : 'quick', arquetipo: b.arquetipo?.clave || '',
                    minutos: b.minutos, fecha: b.fecha || '', area: b.area?.clave || '', de: b.de,
                    entregaDe: b.entrega ? (b.entrega.nota || 'una entrega') : null,
                    pasos: b.pasos?.length ? b.pasos.map(t => ({ titulo: t, para: '' })) : PASOS_VACIOS,
                },
            });
        },
        async pedirUpdate(it) {
            try {
                const d = await pedir('post', `/${it.tipo}/${it.id}/pedir-update`);
                toast(`Le pediste un update a ${d.para?.nombre || 'esa persona'}`);
            } catch (e) { fallo(e); }
        },
        abrir,
    };

    const guardar = async (datos) => {
        const d = await pedir(vista.modo === 'nuevo' ? 'post' : 'patch', vista.ruta, datos);
        const r = d.elemento?.r;
        toast(d.donde === 'inbox_de' ? `Se la pasaste a ${d.persona?.nombre}`
            : d.donde === 'inbox' ? 'Quedó en tu Inbox, para terminar de definir'
                : r ? `Listo: ${r} · ${NOMBRE_R[r]} en tu Momentum` : 'Listo');
        if (d.donde === 'inbox_de') setTab('pedi');
        setVista(null);
        setTexto('');
    };

    if (vista && opciones) {
        return (
            <div className="lr">
                <Definir opciones={opciones} base={vista.base} modo={vista.modo} onVolver={() => setVista(null)} onGuardar={guardar}
                    onAbrir={vista.ruta.startsWith('/inbox') || vista.modo === 'nuevo' ? null : () => abrir(vista.ruta.slice(1).replace('/', ':'))} />
            </div>
        );
    }

    const hoyIso = atajosDeFecha()[0].value;
    const hoy = panel?.mio.filter(e => e.fecha && e.fecha <= hoyIso && e.estado !== 'hecha').length;
    return (
        <div className="lr">
            <form className="lr-anotar" onSubmit={e => { e.preventDefault(); if (texto.trim()) setVista({ modo: 'nuevo', ruta: '/crear', base: { titulo: texto.trim() } }); }}>
                <Plus size={17} aria-hidden="true" />
                <input value={texto} onChange={e => setTexto(e.target.value)} aria-label="Algo nuevo para Leadership"
                    placeholder="Anotá algo para vos o para alguien del equipo…" />
                <Button variant="primary" type="submit" disabled={!texto.trim()}>Definir</Button>
            </form>

            <div className="lr-tabs">
                <Segmented size="sm" value={tab} label="Qué ver" onChange={setTab} options={[
                    { value: 'mio', label: 'Lo mío', count: panel ? panel.cuentas.mio + panel.cuentas.te_pasaron : undefined },
                    { value: 'pedi', label: 'Lo que pedí', count: panel ? panel.cuentas.pedi_abiertas : undefined },
                ]} />
                {panel && <span className="lr-resumen">{hoy} para hoy{panel.cuentas.te_pasaron ? ` · ${panel.cuentas.te_pasaron} para definir` : ''}</span>}
            </div>

            <div className="lr-cuerpo">
                {!panel && error && <EmptyState title="Leadership no responde">{error}</EmptyState>}
                {!panel && !error && <Cargando />}
                {panel && (tab === 'mio'
                    ? <ListaMia panel={panel} acciones={acciones} entrega={entrega} personas={opciones?.personas} />
                    : <ListaPedi pedi={panel.pedi} acciones={acciones} />)}
            </div>

            <footer className="lr-pie">
                {panel?.aprobar ? (
                    <><span>Tenés {panel.aprobar} {panel.aprobar === 1 ? 'entrega' : 'entregas'} para aprobar</span>
                        <LinkButton onClick={() => abrir('')}>Revisarlas en Leadership</LinkButton></>
                ) : (
                    <><span>En el orden de tu Momentum</span><LinkButton onClick={() => abrir('')}>Abrir Leadership</LinkButton></>
                )}
            </footer>
        </div>
    );
}
