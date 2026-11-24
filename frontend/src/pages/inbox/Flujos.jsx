// Sección Flujos: cada automatización como tarjeta con su resultado (entradas, completan, embudo por
// paso y la mayor caída) y, al final de la grilla, las plantillas para arrancar el próximo. El filtro
// por estado, el buscador y «Crear flujo» van en la cabecera. Abrir una tarjeta lleva al lienzo.
// Dentro de Embudos (ADR-W204) va `incrustado`: solo los flujos de una fase (`deLaFase`), la barra en el lugar y no
// en la cabecera, y los nuevos quedan en esa fase (`ubicacion`). `onEditando` avisa cuando abre el lienzo.
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Plus, Search, Workflow } from 'lucide-react';
import { BRAND_AURA, Button, EmptyState, Grid, HeaderActions, InputGroup, Segmented, toast } from '../../components/standard';
import EditorFlujo from './editor/EditorFlujo';
import EditorMensajes from './flujos/EditorMensajes';
import { ESTADOS } from './estadoFlujo';
import NuevoFlujo from './flujos/NuevoFlujo';
import Plantillas from './flujos/Plantillas';
import Propuestas from './flujos/Propuestas';
import Tarjeta from './flujos/Tarjeta';
import { inboxApi } from './api';
import { recordado, recordar } from './recuerdo';

const FILTROS = [['todos', 'Todos'], ['activo', 'Activos'], ['pausado', 'Pausados'], ['borrador', 'Borradores']];

function coincide(f, texto) {
    const t = texto.trim().toLowerCase();
    return !t || f.nombre.toLowerCase().includes(t) || f.palabras_clave.some((p) => (p || '').toLowerCase().includes(t));
}

export default function Flujos({ puedeEditar, incrustado = false, deLaFase = null, ubicacion = null, onEditando }) {
    const [flujos, setFlujos] = useState(() => recordado('flujos'));
    const [error, setError] = useState(null);
    const [abierto, setAbierto] = useState(null);
    const [filtro, setFiltro] = useState('todos');
    const [buscar, setBuscar] = useState('');
    const [borrando, setBorrando] = useState(null);
    const [creando, setCreando] = useState(null);
    const [textos, setTextos] = useState(null); // id del flujo cuyos mensajes se editan
    const [clonando, setClonando] = useState(false);

    const cargar = useCallback(() => {
        inboxApi.flujos().then((l) => setFlujos(recordar('flujos', l))).catch(() => setError('No se pudieron cargar los flujos'));
    }, []);
    useEffect(() => { cargar(); }, [cargar]);
    const editando = !!(abierto || textos);
    useEffect(() => { onEditando?.(editando); }, [editando, onEditando]);
    // Un flujo nuevo o clonado desde Embudos queda en la fase que se está mirando.
    const ubicar = async (f) => (ubicacion ? inboxApi.guardarFlujo(f.id, ubicacion) : f);

    // El setter abre lo publicado para proponer cambios de estructura (ADR-W147); sin versión, solo lo mira.
    const abrir = async (id, nodo = null) => {
        try {
            if (!puedeEditar) {
                const f = await inboxApi.paraProponer(id).catch(() => null);
                if (f) { setAbierto({ flujo: f, nodo, modo: 'proponer' }); return; }
            }
            setAbierto({ flujo: await inboxApi.flujo(id), nodo });
        } catch {
            toast('No se pudo abrir el flujo', 'error');
        }
    };
    const abrirPropuesta = async (pid) => {
        try {
            const d = await inboxApi.propuesta(pid);
            const revisar = puedeEditar && d.propuesta.estado === 'pendiente';
            setAbierto({ flujo: d.flujo, nodo: null, modo: revisar ? 'revisar' : undefined, propuesta: d.propuesta, soloVer: !revisar });
        } catch {
            toast('No se pudo abrir la propuesta', 'error');
        }
    };
    const borrar = async (flujo) => {
        try {
            await inboxApi.borrarFlujo(flujo.id);
            setBorrando(null);
            toast(`${flujo.nombre} eliminado`);
            cargar();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo eliminar', 'error');
        }
    };
    // La copia es un borrador nuevo con el mismo grafo: no corre hasta que se publique.
    const clonar = async (flujo) => {
        if (clonando) return;
        setClonando(true);
        try {
            const { grafo } = await inboxApi.flujo(flujo.id);
            const copia = await ubicar(await inboxApi.crearFlujo(`${flujo.nombre} (copia)`.slice(0, 150), structuredClone(grafo)));
            toast(`${flujo.nombre} clonado: es un borrador`);
            setAbierto({ flujo: copia, nodo: null });
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo clonar', 'error');
        } finally {
            setClonando(false);
        }
    };
    const pausar = async (flujo) => {
        try {
            await (flujo.estado === 'activo' ? inboxApi.pausarFlujo(flujo.id) : inboxApi.activarFlujo(flujo.id));
            toast(flujo.estado === 'activo' ? `${flujo.nombre} pausado` : `${flujo.nombre} activo`);
            cargar();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo cambiar el estado', 'error');
        }
    };

    if (textos) return <EditorMensajes id={textos} onVolver={() => { setTextos(null); cargar(); }} />;
    if (abierto) {
        return (
            <EditorFlujo flujoInicial={abierto.flujo} nodoInicial={abierto.nodo} lectura={!puedeEditar || !!abierto.soloVer}
                modo={abierto.modo} propuesta={abierto.propuesta} onVolver={() => { setAbierto(null); cargar(); }} />
        );
    }

    const deAca = (flujos || []).filter((f) => !deLaFase || deLaFase(f));
    const cuenta = (id) => deAca.filter((f) => id === 'todos' || f.estado === id).length;
    const porEstado = deAca.filter((f) => filtro === 'todos' || f.estado === filtro);
    const visibles = porEstado.filter((f) => coincide(f, buscar));
    const plantillas = puedeEditar && <Plantillas onElegir={setCreando} />;

    let cuerpo;
    if (error) cuerpo = <EmptyState icon={<Workflow size={22} />}>{error}</EmptyState>;
    else if (flujos === null) cuerpo = <EmptyState>Cargando…</EmptyState>;
    else if (!deAca.length && incrustado) {
        cuerpo = <p className="t-cap mut">Ningún flujo arranca en esta fase.{puedeEditar ? ' Creá uno con «Crear flujo».' : ''}</p>;
    } else if (!flujos.length && !puedeEditar) {
        cuerpo = (
            <EmptyState icon={<Workflow size={22} />} title="Todavía no hay flujos" aura={BRAND_AURA}>
                Cada flujo arranca con una palabra clave y responde con mensajes, botones y esperas.
            </EmptyState>
        );
    } else if (deAca.length && !visibles.length) {
        cuerpo = <EmptyState>{porEstado.length ? 'Ningún flujo coincide con la búsqueda.' : `No hay flujos en «${FILTROS.find((x) => x[0] === filtro)[1]}».`}</EmptyState>;
    } else {
        cuerpo = (
            <Grid variant="cards" className="fl-grilla">
                {visibles.map((f) => (
                    <Tarjeta key={f.id} f={f} puedeEditar={puedeEditar} borrando={borrando === f.id}
                        onBorrando={setBorrando} onAbrir={abrir} onBorrar={borrar} onPausar={pausar} onClonar={clonar} clonando={clonando} onEditarMensajes={setTextos} />
                ))}
                {!incrustado && plantillas}
            </Grid>
        );
    }

    const Barra = incrustado ? Fragment : HeaderActions;
    return (
        <>
            <Barra>
                <div className="barra">
                    {deAca.length > 1 && (
                        <>
                            <Segmented size="sm" label="Filtrar por estado" value={filtro} onChange={setFiltro}
                                options={FILTROS.map(([value, label]) => ({
                                    value, label, count: cuenta(value),
                                    icon: value === 'todos' ? null : <i className="fl-punto" style={{ '--c': ESTADOS[value].color }} />,
                                }))} />
                            <InputGroup className="fl-buscar" prefix={<Search size={16} />}>
                                <label className="sr" htmlFor="fl-buscar">Buscar flujo o palabra clave</label>
                                <input id="fl-buscar" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar flujo o palabra clave" autoComplete="off" />
                            </InputGroup>
                        </>
                    )}
                    {puedeEditar && (
                        <div className="barra-der">
                            <Button variant="primary" icon={<Plus />} onClick={() => setCreando('')}>Crear flujo</Button>
                        </div>
                    )}
                </div>
            </Barra>
            <Propuestas key={flujos?.length} onAbrir={abrirPropuesta} />
            {cuerpo}
            {creando !== null && (
                <NuevoFlujo plantillaInicial={creando} onCerrar={() => setCreando(null)}
                    onCreado={async (f) => { setCreando(null); setAbierto({ flujo: await ubicar(f).catch(() => f), nodo: null }); }} />
            )}
        </>
    );
}
