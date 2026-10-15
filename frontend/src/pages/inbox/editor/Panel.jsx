// El panel de la derecha: edita el nodo elegido en el lienzo (o los disparadores si es «Inicio»).
import { Plus, Trash2, X } from 'lucide-react';
import { INICIO, LIMITE_BOTONES, nuevoId, TIPOS } from './grafoFlujo';
import { OPERADOR } from './nodos';

const TIPOS_CONTENIDO = { texto: 'Texto', imagen: 'Imagen', audio: 'Audio', video: 'Video', archivo: 'Archivo' };
const TIPOS_ACCION = { variable: 'Guardar variable', etapa: 'Marcar etapa', califica: 'Califica', pausar_bot: 'Pausar bot' };

function Campo({ label, children, ayuda }) {
    return (
        <label className="pf-campo">
            <span className="t-cap">{label}</span>
            {children}
            {ayuda && <span className="pf-ayuda">{ayuda}</span>}
        </label>
    );
}

function BotonIcono({ titulo, onClick, children, disabled }) {
    return (
        <button type="button" className="ibtn ibtn--peligro" aria-label={titulo} title={titulo} onClick={onClick} disabled={disabled}>
            {children}
        </button>
    );
}

function reemplazar(lista, i, cambio) {
    return lista.map((x, j) => (j === i ? { ...x, ...cambio } : x));
}

function PanelInicio({ disparadores, onCambiar, lectura }) {
    const cambiar = (i, cambio) => onCambiar(reemplazar(disparadores, i, cambio));
    return (
        <>
            <p className="t-sm mut">Qué tiene que escribir o comentar alguien para entrar a este flujo.</p>
            {disparadores.map((d, i) => (
                <div key={d.id} className="pf-bloque">
                    <div className="pf-fila">
                        <select className="input" value={d.canal || 'dm'} disabled={lectura} onChange={(e) => cambiar(i, { canal: e.target.value })}>
                            <option value="dm">Mensaje directo</option>
                            <option value="comentario">Comentario</option>
                        </select>
                        <select className="input" value={d.coincidencia || 'exacta'} disabled={lectura} onChange={(e) => cambiar(i, { coincidencia: e.target.value })}>
                            <option value="exacta">Es exactamente</option>
                            <option value="contiene">Contiene</option>
                        </select>
                        {!lectura && <BotonIcono titulo="Quitar disparador" onClick={() => onCambiar(disparadores.filter((_, j) => j !== i))}><X size={14} /></BotonIcono>}
                    </div>
                    <Campo label="Palabras clave" ayuda="Separadas por coma. No importan mayúsculas, acentos ni signos.">
                        <input className="input" value={(d.palabras || []).join(', ')} disabled={lectura}
                            onChange={(e) => cambiar(i, { palabras: e.target.value.split(',').map((p) => p.trimStart()) })}
                            placeholder="OBTENER GUIA, GUIA" />
                    </Campo>
                    {d.canal === 'comentario' && (
                        <Campo label="Publicación (opcional)" ayuda="ID de la publicación. Vacío = cualquier publicación.">
                            <input className="input" value={d.publicacion_id || ''} disabled={lectura}
                                onChange={(e) => cambiar(i, { publicacion_id: e.target.value.trim() || null })} />
                        </Campo>
                    )}
                </div>
            ))}
            {!lectura && (
                <button type="button" className="btn btn--linea btn--sm"
                    onClick={() => onCambiar([...disparadores, { id: nuevoId('d'), canal: 'dm', palabras: [], coincidencia: 'exacta' }])}>
                    <Plus />Disparador
                </button>
            )}
        </>
    );
}

function PanelMensaje({ nodo, cambiar, lectura }) {
    const contenido = nodo.contenido || [];
    const modo = nodo.botones?.length ? 'botones' : nodo.espera ? 'texto' : 'nada';
    const estilo = nodo.estilo_botones || 'botones';
    const botones = nodo.botones || [];
    const ponerModo = (m) => {
        const { botones: _b, espera: _e, sin_respuesta: _s, estilo_botones: _st, ...resto } = nodo;
        if (m === 'botones') cambiar({ ...resto, botones: [{ id: nuevoId('b'), titulo: '' }] }, true);
        else if (m === 'texto') cambiar({ ...resto, espera: { guardar_en: '' } }, true);
        else cambiar(resto, true);
    };
    return (
        <>
            {contenido.map((c, i) => (
                <div key={i} className="pf-bloque">
                    <div className="pf-fila">
                        <select className="input" value={c.tipo} disabled={lectura}
                            onChange={(e) => cambiar({ contenido: reemplazar(contenido, i, e.target.value === 'texto' ? { tipo: 'texto', texto: c.texto || '', url: undefined } : { tipo: e.target.value, url: c.url || '', texto: undefined }) })}>
                            {Object.entries(TIPOS_CONTENIDO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        {!lectura && contenido.length > 1 && (
                            <BotonIcono titulo="Quitar" onClick={() => cambiar({ contenido: contenido.filter((_, j) => j !== i) })}><Trash2 size={14} /></BotonIcono>
                        )}
                    </div>
                    {c.tipo === 'texto'
                        ? <textarea className="input area" rows={4} value={c.texto || ''} disabled={lectura} placeholder="Escribí el mensaje… Podés usar {{nombre}} o {{examen}}"
                            onChange={(e) => cambiar({ contenido: reemplazar(contenido, i, { texto: e.target.value }) })} />
                        : <input className="input" value={c.url || ''} disabled={lectura} placeholder="https://…"
                            onChange={(e) => cambiar({ contenido: reemplazar(contenido, i, { url: e.target.value.trim() }) })} />}
                </div>
            ))}
            {!lectura && (
                <button type="button" className="btn btn--linea btn--sm" onClick={() => cambiar({ contenido: [...contenido, { tipo: 'texto', texto: '' }] })}>
                    <Plus />Contenido
                </button>
            )}

            <Campo label="Después de mandarlo">
                <select className="input" value={modo} disabled={lectura} onChange={(e) => ponerModo(e.target.value)}>
                    <option value="nada">Sigue al próximo paso</option>
                    <option value="botones">Espera que toque un botón</option>
                    <option value="texto">Espera que escriba una respuesta</option>
                </select>
            </Campo>

            {modo === 'botones' && (
                <div className="pf-bloque">
                    <Campo label="Estilo">
                        <select className="input" value={estilo} disabled={lectura} onChange={(e) => cambiar({ estilo_botones: e.target.value })}>
                            <option value="botones">Botones (hasta 3, quedan en el chat)</option>
                            <option value="respuestas_rapidas">Respuestas rápidas (hasta 13)</option>
                        </select>
                    </Campo>
                    {botones.map((b, i) => (
                        <div key={b.id} className="pf-fila">
                            <input className="input" value={b.titulo} maxLength={20} disabled={lectura} placeholder={`Botón ${i + 1}`}
                                onChange={(e) => cambiar({ botones: reemplazar(botones, i, { titulo: e.target.value }) })} />
                            {!lectura && botones.length > 1 && (
                                <BotonIcono titulo="Quitar botón" onClick={() => cambiar({ botones: botones.filter((_, j) => j !== i) }, true)}><X size={14} /></BotonIcono>
                            )}
                        </div>
                    ))}
                    {!lectura && botones.length < LIMITE_BOTONES[estilo] && (
                        <button type="button" className="btn btn--linea btn--sm" onClick={() => cambiar({ botones: [...botones, { id: nuevoId('b'), titulo: '' }] }, true)}>
                            <Plus />Botón
                        </button>
                    )}
                </div>
            )}
            {modo === 'texto' && (
                <Campo label="Guardar la respuesta en" ayuda="El nombre de la variable. Después se usa como {{nombre}} o en una condición.">
                    <input className="input" value={nodo.espera?.guardar_en || ''} disabled={lectura} placeholder="examen"
                        onChange={(e) => cambiar({ espera: { guardar_en: e.target.value.trim() } })} />
                </Campo>
            )}
            {modo !== 'nada' && (
                <label className="pf-check">
                    <input type="checkbox" checked={!!nodo.sin_respuesta} disabled={lectura}
                        onChange={(e) => {
                            const { sin_respuesta: _s, ...resto } = nodo;
                            cambiar(e.target.checked ? { ...resto, sin_respuesta: { minutos: 60 } } : resto, true);
                        }} />
                    <span>Si no responde, seguir por otra rama</span>
                </label>
            )}
            {nodo.sin_respuesta && (
                <Campo label="Esperar (minutos)" ayuda="De 1 a 1440 (la ventana de Instagram es de 24 h).">
                    <input className="input" type="number" min={1} max={1440} value={nodo.sin_respuesta.minutos} disabled={lectura}
                        onChange={(e) => cambiar({ sin_respuesta: { minutos: Number(e.target.value) } })} />
                </Campo>
            )}
        </>
    );
}

function PanelCondicion({ nodo, cambiar, lectura }) {
    const reglas = nodo.reglas || [];
    return (
        <>
            <p className="t-sm mut">Sigue por «Sí» si se cumplen todas las reglas.</p>
            {reglas.map((r, i) => (
                <div key={i} className="pf-bloque">
                    <div className="pf-fila">
                        <input className="input" value={r.campo} disabled={lectura} placeholder="Variable (examen, ultimo_boton…)"
                            onChange={(e) => cambiar({ reglas: reemplazar(reglas, i, { campo: e.target.value.trim() }) })} />
                        {!lectura && reglas.length > 1 && <BotonIcono titulo="Quitar regla" onClick={() => cambiar({ reglas: reglas.filter((_, j) => j !== i) })}><X size={14} /></BotonIcono>}
                    </div>
                    <div className="pf-fila">
                        <select className="input" value={r.operador} disabled={lectura} onChange={(e) => cambiar({ reglas: reemplazar(reglas, i, { operador: e.target.value }) })}>
                            {Object.entries(OPERADOR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        {!['existe', 'no_existe'].includes(r.operador) && (
                            <input className="input" value={r.valor || ''} disabled={lectura} placeholder="Valor"
                                onChange={(e) => cambiar({ reglas: reemplazar(reglas, i, { valor: e.target.value }) })} />
                        )}
                    </div>
                </div>
            ))}
            {!lectura && <button type="button" className="btn btn--linea btn--sm" onClick={() => cambiar({ reglas: [...reglas, { campo: '', operador: 'igual', valor: '' }] })}><Plus />Regla</button>}
        </>
    );
}

function PanelAccion({ nodo, cambiar, lectura }) {
    const acciones = nodo.acciones || [];
    return (
        <>
            {acciones.map((a, i) => (
                <div key={i} className="pf-bloque">
                    <div className="pf-fila">
                        <select className="input" value={a.tipo} disabled={lectura} onChange={(e) => cambiar({ acciones: reemplazar(acciones, i, { tipo: e.target.value }) })}>
                            {Object.entries(TIPOS_ACCION).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        {!lectura && acciones.length > 1 && <BotonIcono titulo="Quitar acción" onClick={() => cambiar({ acciones: acciones.filter((_, j) => j !== i) })}><X size={14} /></BotonIcono>}
                    </div>
                    {a.tipo === 'variable' && (
                        <div className="pf-fila">
                            <input className="input" value={a.nombre || ''} disabled={lectura} placeholder="Variable"
                                onChange={(e) => cambiar({ acciones: reemplazar(acciones, i, { nombre: e.target.value.trim() }) })} />
                            <input className="input" value={a.valor ?? ''} disabled={lectura} placeholder="Valor"
                                onChange={(e) => cambiar({ acciones: reemplazar(acciones, i, { valor: e.target.value }) })} />
                        </div>
                    )}
                    {a.tipo === 'etapa' && (
                        <input className="input" type="number" min={0} value={a.valor ?? 0} disabled={lectura}
                            onChange={(e) => cambiar({ acciones: reemplazar(acciones, i, { valor: Number(e.target.value) }) })} />
                    )}
                    {a.tipo === 'califica' && (
                        <select className="input" value={a.valor ? 'si' : 'no'} disabled={lectura}
                            onChange={(e) => cambiar({ acciones: reemplazar(acciones, i, { valor: e.target.value === 'si' }) })}>
                            <option value="si">Califica</option><option value="no">No califica</option>
                        </select>
                    )}
                    {a.tipo === 'pausar_bot' && (
                        <input className="input" type="number" min={1} max={720} value={a.horas || 24} disabled={lectura}
                            onChange={(e) => cambiar({ acciones: reemplazar(acciones, i, { horas: Number(e.target.value) }) })} />
                    )}
                </div>
            ))}
            {!lectura && <button type="button" className="btn btn--linea btn--sm" onClick={() => cambiar({ acciones: [...acciones, { tipo: 'variable', nombre: '', valor: '' }] })}><Plus />Acción</button>}
        </>
    );
}

export default function Panel({ seleccion, lectura, onCambiarNodo, onCambiarDisparadores, onBorrar, onCerrar, esInicioDelFlujo, onHacerInicio }) {
    if (!seleccion) {
        return (
            <aside className="pf pf--vacio">
                <p className="t-sm mut">Elegí una caja del lienzo para editarla, o agregá una desde la barra de arriba.</p>
                <p className="t-sm mut">Arrastrá desde el punto de una salida hasta otra caja para conectarlas.</p>
            </aside>
        );
    }
    if (seleccion.id === INICIO) {
        return (
            <aside className="pf">
                <div className="pf-cab"><h3 className="t-h3">Disparadores</h3><button type="button" className="ibtn" aria-label="Cerrar" onClick={onCerrar}><X size={16} /></button></div>
                <PanelInicio disparadores={seleccion.data.disparadores || []} onCambiar={onCambiarDisparadores} lectura={lectura} />
            </aside>
        );
    }
    const nodo = seleccion.data.nodo;
    // `reemplazo` = true cuando `cambio` es el nodo entero (para quitar claves), no un parche.
    const cambiar = (cambio, reemplazo = false) => onCambiarNodo(reemplazo ? { ...cambio, id: nodo.id, tipo: nodo.tipo } : { ...nodo, ...cambio });
    return (
        <aside className="pf">
            <div className="pf-cab">
                <h3 className="t-h3">{TIPOS[nodo.tipo]?.label}</h3>
                <button type="button" className="ibtn" aria-label="Cerrar" onClick={onCerrar}><X size={16} /></button>
            </div>
            {nodo.tipo === 'mensaje' && <PanelMensaje nodo={nodo} cambiar={cambiar} lectura={lectura} />}
            {nodo.tipo === 'esperar' && (
                <Campo label="Esperar (minutos)" ayuda="De 1 a 1440. Si pasan 24 h desde su último mensaje, no se le puede escribir.">
                    <input className="input" type="number" min={1} max={1440} value={nodo.minutos} disabled={lectura}
                        onChange={(e) => cambiar({ minutos: Number(e.target.value) })} />
                </Campo>
            )}
            {nodo.tipo === 'condicion' && <PanelCondicion nodo={nodo} cambiar={cambiar} lectura={lectura} />}
            {nodo.tipo === 'accion' && <PanelAccion nodo={nodo} cambiar={cambiar} lectura={lectura} />}
            {nodo.tipo === 'fin' && <p className="t-sm mut">El contacto sale del flujo.</p>}
            {!lectura && (
                <div className="pf-pie">
                    {!esInicioDelFlujo && (
                        <button type="button" className="btn btn--linea btn--sm" onClick={onHacerInicio}>Empezar por acá</button>
                    )}
                    <button type="button" className="btn btn--linea btn--sm btn--peligro" onClick={onBorrar}><Trash2 />Borrar</button>
                </div>
            )}
        </aside>
    );
}
