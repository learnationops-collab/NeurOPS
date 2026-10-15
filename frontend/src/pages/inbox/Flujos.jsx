// Sección Flujos: la lista de automatizaciones y la entrada al lienzo de cada una.
import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Workflow } from 'lucide-react';
import EditorFlujo from './editor/EditorFlujo';
import { inboxApi } from './api';

const ESTADO = { borrador: 'Borrador', activo: 'Activo', pausado: 'Pausado' };

function fecha(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Nuevo({ onCreado }) {
    const [abierto, setAbierto] = useState(false);
    const [nombre, setNombre] = useState('');
    const [error, setError] = useState(null);
    const crear = async (e) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        try {
            onCreado(await inboxApi.crearFlujo(nombre.trim()));
        } catch (err) {
            setError(err.response?.data?.message || 'No se pudo crear');
        }
    };
    if (!abierto) return <button type="button" className="btn btn--cta" onClick={() => setAbierto(true)}><Plus />Nuevo flujo</button>;
    return (
        <form className="fl-nuevo" onSubmit={crear}>
            <input className="input" autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del flujo (ej. Obtener guía)" maxLength={150} />
            <button type="submit" className="btn btn--cta" disabled={!nombre.trim()}>Crear</button>
            <button type="button" className="btn btn--linea" onClick={() => { setAbierto(false); setNombre(''); }}>Cancelar</button>
            {error && <p className="campo-err" role="alert">{error}</p>}
        </form>
    );
}

export default function Flujos({ puedeEditar }) {
    const [flujos, setFlujos] = useState(null);
    const [error, setError] = useState(null);
    const [abierto, setAbierto] = useState(null);

    const cargar = useCallback(() => {
        inboxApi.flujos().then(setFlujos).catch(() => setError('No se pudieron cargar los flujos'));
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    const abrir = async (id) => {
        try {
            setAbierto(await inboxApi.flujo(id));
        } catch {
            setError('No se pudo abrir el flujo');
        }
    };
    const borrar = async (flujo) => {
        if (!window.confirm(`¿Borrar «${flujo.nombre}»? No se puede deshacer.`)) return;
        try {
            await inboxApi.borrarFlujo(flujo.id);
            cargar();
        } catch (e) {
            setError(e.response?.data?.message || 'No se pudo borrar');
        }
    };

    if (abierto) {
        return <EditorFlujo flujoInicial={abierto} lectura={!puedeEditar} onVolver={() => { setAbierto(null); cargar(); }} />;
    }

    return (
        <div className="fl">
            <div className="fl-cab">
                <p className="t-sm mut">Cada flujo arranca con una palabra clave y responde con mensajes, botones y esperas. Lo que corre es la última versión publicada.</p>
                {puedeEditar && <Nuevo onCreado={(f) => setAbierto(f)} />}
            </div>
            {error && <p className="campo-err" role="alert">{error}</p>}
            {flujos === null && !error && <div className="panel vacio"><p className="t-sm mut">Cargando…</p></div>}
            {flujos?.length === 0 && (
                <div className="panel vacio">
                    <Workflow size={22} />
                    <p className="t-sm mut">Todavía no hay flujos.{puedeEditar ? ' Creá el primero con «Nuevo flujo».' : ''}</p>
                </div>
            )}
            {flujos?.length > 0 && (
                <ul className="fl-lista">
                    {flujos.map((f) => (
                        <li key={f.id} className="panel panel--sm fl-item">
                            <button type="button" className="fl-abrir" onClick={() => abrir(f.id)}>
                                <span className="fl-nombre t-h3">{f.nombre}</span>
                                <span className="fl-meta t-sm mut">
                                    {f.palabras_clave.filter(Boolean).length ? f.palabras_clave.filter(Boolean).join(' · ') : 'Sin palabras clave'}
                                    {' · '}{f.nodos} {f.nodos === 1 ? 'paso' : 'pasos'}
                                    {f.ejecuciones_abiertas > 0 && ` · ${f.ejecuciones_abiertas} en curso`}
                                </span>
                            </button>
                            <span className={`chip ef-estado ef-estado--${f.estado}`}>{ESTADO[f.estado] || f.estado}{f.version ? ` · v${f.version}` : ''}</span>
                            {f.version && f.cambios_sin_publicar && <span className="chip chip--n ef-sucio">Cambios sin publicar</span>}
                            <span className="t-sm mut fl-fecha">{fecha(f.actualizado_en)}</span>
                            {puedeEditar && !f.version && (
                                <button type="button" className="ibtn ibtn--peligro" aria-label={`Borrar ${f.nombre}`} onClick={() => borrar(f)}><Trash2 size={15} /></button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
