// Sección Flujos: cada automatización como tarjeta con su resultado (entradas, completan, embudo por
// paso y la mayor caída) y, al final de la grilla, las plantillas para arrancar el próximo. El filtro
// por estado, el buscador y «Crear flujo» van en la cabecera. Abrir una tarjeta lleva al lienzo.
import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Workflow } from 'lucide-react';
import { BRAND_AURA, Button, EmptyState, Grid, HeaderActions, InputGroup, Segmented, toast } from '../../components/standard';
import EditorFlujo from './editor/EditorFlujo';
import { ESTADOS } from './estadoFlujo';
import NuevoFlujo from './flujos/NuevoFlujo';
import Plantillas from './flujos/Plantillas';
import Tarjeta from './flujos/Tarjeta';
import { inboxApi } from './api';

const FILTROS = [['todos', 'Todos'], ['activo', 'Activos'], ['pausado', 'Pausados'], ['borrador', 'Borradores']];

function coincide(f, texto) {
    const t = texto.trim().toLowerCase();
    return !t || f.nombre.toLowerCase().includes(t) || f.palabras_clave.some((p) => (p || '').toLowerCase().includes(t));
}

export default function Flujos({ puedeEditar }) {
    const [flujos, setFlujos] = useState(null);
    const [error, setError] = useState(null);
    const [abierto, setAbierto] = useState(null);
    const [filtro, setFiltro] = useState('todos');
    const [buscar, setBuscar] = useState('');
    const [borrando, setBorrando] = useState(null);
    const [creando, setCreando] = useState(null);

    const cargar = useCallback(() => {
        inboxApi.flujos().then(setFlujos).catch(() => setError('No se pudieron cargar los flujos'));
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    const abrir = async (id, nodo = null) => {
        try {
            setAbierto({ flujo: await inboxApi.flujo(id), nodo });
        } catch {
            toast('No se pudo abrir el flujo', 'error');
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
    const pausar = async (flujo) => {
        try {
            await (flujo.estado === 'activo' ? inboxApi.pausarFlujo(flujo.id) : inboxApi.activarFlujo(flujo.id));
            toast(flujo.estado === 'activo' ? `${flujo.nombre} pausado` : `${flujo.nombre} activo`);
            cargar();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo cambiar el estado', 'error');
        }
    };

    if (abierto) {
        return (
            <EditorFlujo flujoInicial={abierto.flujo} nodoInicial={abierto.nodo} lectura={!puedeEditar}
                onVolver={() => { setAbierto(null); cargar(); }} />
        );
    }

    const cuenta = (id) => (flujos || []).filter((f) => id === 'todos' || f.estado === id).length;
    const porEstado = (flujos || []).filter((f) => filtro === 'todos' || f.estado === filtro);
    const visibles = porEstado.filter((f) => coincide(f, buscar));
    const plantillas = puedeEditar && <Plantillas onElegir={setCreando} />;

    let cuerpo;
    if (error) cuerpo = <EmptyState icon={<Workflow size={22} />}>{error}</EmptyState>;
    else if (flujos === null) cuerpo = <EmptyState>Cargando…</EmptyState>;
    else if (!flujos.length && !puedeEditar) {
        cuerpo = (
            <EmptyState icon={<Workflow size={22} />} title="Todavía no hay flujos" aura={BRAND_AURA}>
                Cada flujo arranca con una palabra clave y responde con mensajes, botones y esperas.
            </EmptyState>
        );
    } else if (flujos.length && !visibles.length) {
        cuerpo = <EmptyState>{porEstado.length ? 'Ningún flujo coincide con la búsqueda.' : `No hay flujos en «${FILTROS.find((x) => x[0] === filtro)[1]}».`}</EmptyState>;
    } else {
        cuerpo = (
            <Grid variant="cards" className="fl-grilla">
                {visibles.map((f) => (
                    <Tarjeta key={f.id} f={f} puedeEditar={puedeEditar} borrando={borrando === f.id}
                        onBorrando={setBorrando} onAbrir={abrir} onBorrar={borrar} onPausar={pausar} />
                ))}
                {plantillas}
            </Grid>
        );
    }

    return (
        <>
            <HeaderActions>
                <div className="barra">
                    {flujos?.length > 0 && (
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
            </HeaderActions>
            {cuerpo}
            {creando !== null && (
                <NuevoFlujo plantillaInicial={creando} onCerrar={() => setCreando(null)}
                    onCreado={(f) => { setCreando(null); setAbierto({ flujo: f, nodo: null }); }} />
            )}
        </>
    );
}
