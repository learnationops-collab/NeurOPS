// Sección Flujos: las automatizaciones como tarjetas (como las de Forms en Thalamus), el filtro por
// estado y la caja para crear uno, las dos en la cabecera. Abrir una tarjeta lleva al lienzo.
import { useCallback, useEffect, useState } from 'react';
import { Eye, Hash, Pencil, Plus, Trash2, Workflow } from 'lucide-react';
import {
    BRAND_AURA, Button, Card, Chip, ConfirmDelete, EmptyState, FieldError, Grid, HeaderActions, IconButton, InputGroup, Segmented, Status, toast,
} from '../../components/standard';
import EditorFlujo from './editor/EditorFlujo';
import { ESTADOS, estadoDe } from './estadoFlujo';
import { inboxApi } from './api';

const FILTROS = [['todos', 'Todos'], ['activo', 'Activos'], ['pausado', 'Pausados'], ['borrador', 'Borradores']];

function fecha(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// La caja de crear va en la barra de la cabecera; el error, debajo (lo dibuja Flujos).
function Nuevo({ onCreado, error, onError }) {
    const [nombre, setNombre] = useState('');
    const crear = async (e) => {
        e.preventDefault();
        if (!nombre.trim()) { onError('Escribí un nombre.'); return; }
        try {
            onCreado(await inboxApi.crearFlujo(nombre.trim()));
        } catch (err) {
            onError(err.response?.data?.message || 'No se pudo crear');
        }
    };
    return (
        <InputGroup as="form" className="ev-nuevo" prefix={<Plus size={16} />} invalid={!!error} noValidate onSubmit={crear}>
            <label className="sr" htmlFor="fl-nuevo">Nuevo flujo</label>
            <input id="fl-nuevo" value={nombre} maxLength={150} autoComplete="off" placeholder="Nuevo flujo, ej. Obtener guía"
                aria-invalid={!!error} aria-describedby={error ? 'fl-nuevo-err' : undefined}
                onChange={(e) => { setNombre(e.target.value); if (error) onError(null); }} />
            <Button variant="primary" type="submit">Crear</Button>
        </InputGroup>
    );
}

function Tarjeta({ f, puedeEditar, borrando, onBorrando, onAbrir, onBorrar }) {
    const est = estadoDe(f);
    const palabras = f.palabras_clave.filter(Boolean);
    return (
        <Card as="article" className="fcard fl-card" aura={BRAND_AURA} soft>
            <div className="fcard-cab">
                <span className="icono-m"><Workflow /></span>
                <button type="button" className="fcard-nom" onClick={() => onAbrir(f.id)}>{f.nombre}</button>
            </div>
            <div className="fl-estado">
                <Status color={est.color}>{est.texto}</Status>
                {f.version && f.cambios_sin_publicar && (
                    <Status color="var(--warning)" data-tip="Cambios sin publicar|Lo que corre es la última versión publicada.">Sin publicar</Status>
                )}
            </div>
            <div className="fl-palabras" aria-label="Palabras clave">
                {palabras.length
                    ? palabras.map((p) => <Chip key={p} subtle icon={<Hash />}>{p}</Chip>)
                    : <Chip color="var(--warning)" subtle>Sin palabras clave</Chip>}
            </div>
            <div className="datos">
                <div className="dato"><b>{f.nodos}</b><span>{f.nodos === 1 ? 'Paso' : 'Pasos'}</span></div>
                <div className="dato"><b>{f.ejecuciones_abiertas}</b><span>En curso</span></div>
                <div className="dato"><b>{f.version ? `v${f.version}` : '–'}</b><span>Publicada</span></div>
            </div>
            {borrando ? (
                <ConfirmDelete name={f.nombre} detail="No se puede deshacer." icon={<Trash2 />} onCancel={() => onBorrando(null)} onConfirm={() => onBorrar(f)} />
            ) : (
                <div className="fcard-pie">
                    <span className="t-cap mut40">{fecha(f.actualizado_en)}</span>
                    <div className="der">
                        {/* Uno publicado ya corrió con leads: se pausa, no se borra. */}
                        {puedeEditar && !f.version && (
                            <IconButton label={`Eliminar ${f.nombre}`} icon={<Trash2 />} size="sm" danger data-tip="Eliminar" onClick={() => onBorrando(f.id)} />
                        )}
                        <Button icon={puedeEditar ? <Pencil /> : <Eye />} onClick={() => onAbrir(f.id)}>{puedeEditar ? 'Editar' : 'Ver'}</Button>
                    </div>
                </div>
            )}
        </Card>
    );
}

export default function Flujos({ puedeEditar }) {
    const [flujos, setFlujos] = useState(null);
    const [error, setError] = useState(null);
    const [abierto, setAbierto] = useState(null);
    const [filtro, setFiltro] = useState('todos');
    const [borrando, setBorrando] = useState(null);
    const [errNuevo, setErrNuevo] = useState(null);

    const cargar = useCallback(() => {
        inboxApi.flujos().then(setFlujos).catch(() => setError('No se pudieron cargar los flujos'));
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    const abrir = async (id) => {
        try {
            setAbierto(await inboxApi.flujo(id));
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

    if (abierto) {
        return <EditorFlujo flujoInicial={abierto} lectura={!puedeEditar} onVolver={() => { setAbierto(null); cargar(); }} />;
    }

    const cuenta = (id) => (flujos || []).filter((f) => id === 'todos' || f.estado === id).length;
    const visibles = (flujos || []).filter((f) => filtro === 'todos' || f.estado === filtro);

    let cuerpo;
    if (error) cuerpo = <EmptyState icon={<Workflow size={22} />}>{error}</EmptyState>;
    else if (flujos === null) cuerpo = <EmptyState>Cargando…</EmptyState>;
    else if (!flujos.length) {
        cuerpo = (
            <EmptyState icon={<Workflow size={22} />} title="Todavía no hay flujos" aura={BRAND_AURA}>
                Cada flujo arranca con una palabra clave y responde con mensajes, botones y esperas. Lo que corre es la última versión publicada.
                {puedeEditar ? ' Creá el primero desde arriba.' : ''}
            </EmptyState>
        );
    } else if (!visibles.length) {
        cuerpo = <EmptyState>No hay flujos en «{FILTROS.find((x) => x[0] === filtro)[1]}».</EmptyState>;
    } else {
        cuerpo = (
            <Grid variant="cards">
                {visibles.map((f) => (
                    <Tarjeta key={f.id} f={f} puedeEditar={puedeEditar} borrando={borrando === f.id}
                        onBorrando={setBorrando} onAbrir={abrir} onBorrar={borrar} />
                ))}
            </Grid>
        );
    }

    return (
        <>
            <HeaderActions>
                <div className="barra">
                    {flujos?.length > 0 && (
                        <Segmented size="sm" label="Filtrar por estado" value={filtro} onChange={setFiltro}
                            options={FILTROS.map(([value, label]) => ({
                                value,
                                label: <>{label}<span className="fl-cuenta">{cuenta(value)}</span></>,
                                icon: value === 'todos' ? null : <i className="fl-punto" style={{ '--c': ESTADOS[value].color }} />,
                            }))} />
                    )}
                    {puedeEditar && <Nuevo onCreado={(f) => setAbierto(f)} error={errNuevo} onError={setErrNuevo} />}
                </div>
            </HeaderActions>
            {errNuevo && <FieldError id="fl-nuevo-err">{errNuevo}</FieldError>}
            {cuerpo}
        </>
    );
}
