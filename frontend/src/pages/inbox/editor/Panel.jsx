// El inspector: flota sobre el lienzo y edita el nodo elegido (o los disparadores si es «Inicio»).
import { Plus, Trash2, X } from 'lucide-react';
import { Button, IconButton, Input, LinkButton, Select, Switch, TextArea } from '../../../components/standard';
import { INICIO, LIMITE_BOTONES, nuevoId, TIPOS } from './grafoFlujo';
import { OPERADOR } from './nodos';

const opciones = (mapa) => Object.entries(mapa).map(([value, label]) => ({ value, label }));

const TIPOS_CONTENIDO = opciones({ texto: 'Texto', imagen: 'Imagen', audio: 'Audio', video: 'Video', archivo: 'Archivo' });
const TIPOS_ACCION = opciones({ variable: 'Guardar variable', etapa: 'Marcar etapa', califica: 'Califica', pausar_bot: 'Pausar bot' });
const CANALES = opciones({ dm: 'Mensaje directo', comentario: 'Comentario' });
const COINCIDENCIAS = opciones({ exacta: 'Es exactamente', contiene: 'Contiene' });
const DESPUES = opciones({ nada: 'Sigue al próximo paso', botones: 'Espera que toque un botón', texto: 'Espera que escriba una respuesta' });
const ESTILOS = opciones({ botones: 'Botones (hasta 3, quedan en el chat)', respuestas_rapidas: 'Respuestas rápidas (hasta 13)' });
const OPERADORES = opciones(OPERADOR);
const CALIFICA = opciones({ si: 'Califica', no: 'No califica' });

// Rótulo arriba, el control y una ayuda opcional abajo. Los controles llevan su propio aria-label: un
// Select es un botón y no se puede envolver en <label>.
function Campo({ label, children, ayuda }) {
    return (
        <div className="pf-campo">
            <span className="t-cap mut">{label}</span>
            {children}
            {ayuda && <span className="pf-ayuda">{ayuda}</span>}
        </div>
    );
}

function Quitar({ titulo, onClick }) {
    return <IconButton label={titulo} icon={<X />} size="xs" danger onClick={onClick} />;
}

function reemplazar(lista, i, cambio) {
    return lista.map((x, j) => (j === i ? { ...x, ...cambio } : x));
}

function Cabecera({ titulo, onCerrar }) {
    return (
        <div className="barra">
            <span className="t-rotulo">{titulo}</span>
            <IconButton label="Cerrar" icon={<X />} size="xs" style={{ marginLeft: 'auto' }} onClick={onCerrar} />
        </div>
    );
}

function PanelInicio({ disparadores, onCambiar, lectura }) {
    const cambiar = (i, cambio) => onCambiar(reemplazar(disparadores, i, cambio));
    return (
        <>
            <p className="t-sm mut">Qué tiene que escribir o comentar alguien para entrar a este flujo.</p>
            {disparadores.map((d, i) => (
                <div key={d.id} className="pf-bloque">
                    <div className="pf-fila">
                        <Select label="Canal" value={d.canal || 'dm'} disabled={lectura} options={CANALES} onChange={(v) => cambiar(i, { canal: v })} />
                        <Select label="Coincidencia" value={d.coincidencia || 'exacta'} disabled={lectura} options={COINCIDENCIAS} onChange={(v) => cambiar(i, { coincidencia: v })} />
                        {!lectura && <Quitar titulo="Quitar disparador" onClick={() => onCambiar(disparadores.filter((_, j) => j !== i))} />}
                    </div>
                    <Campo label="Palabras clave" ayuda="Separadas por coma. No importan mayúsculas, acentos ni signos.">
                        <Input value={(d.palabras || []).join(', ')} disabled={lectura} aria-label="Palabras clave"
                            onChange={(e) => cambiar(i, { palabras: e.target.value.split(',').map((p) => p.trimStart()) })}
                            placeholder="OBTENER GUIA, GUIA" />
                    </Campo>
                    {d.canal === 'comentario' && (
                        <Campo label="Publicación (opcional)" ayuda="ID de la publicación. Vacío = cualquier publicación.">
                            <Input value={d.publicacion_id || ''} disabled={lectura} aria-label="Publicación"
                                onChange={(e) => cambiar(i, { publicacion_id: e.target.value.trim() || null })} />
                        </Campo>
                    )}
                </div>
            ))}
            {!lectura && (
                <LinkButton icon={<Plus />} onClick={() => onCambiar([...disparadores, { id: nuevoId('d'), canal: 'dm', palabras: [], coincidencia: 'exacta' }])}>
                    Disparador
                </LinkButton>
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
    const ponerSinRespuesta = (si) => {
        const { sin_respuesta: _s, ...resto } = nodo;
        cambiar(si ? { ...resto, sin_respuesta: { minutos: 60 } } : resto, true);
    };
    return (
        <>
            {contenido.map((c, i) => (
                <div key={i} className="pf-bloque">
                    <div className="pf-fila">
                        <Select label="Tipo de contenido" value={c.tipo} disabled={lectura} options={TIPOS_CONTENIDO}
                            onChange={(v) => cambiar({ contenido: reemplazar(contenido, i, v === 'texto' ? { tipo: 'texto', texto: c.texto || '', url: undefined } : { tipo: v, url: c.url || '', texto: undefined }) })} />
                        {!lectura && contenido.length > 1 && (
                            <Quitar titulo="Quitar contenido" onClick={() => cambiar({ contenido: contenido.filter((_, j) => j !== i) })} />
                        )}
                    </div>
                    {c.tipo === 'texto'
                        ? <TextArea value={c.texto || ''} disabled={lectura} aria-label="Texto del mensaje" placeholder="Escribí el mensaje… Podés usar {{nombre}} o {{examen}}"
                            onChange={(e) => cambiar({ contenido: reemplazar(contenido, i, { texto: e.target.value }) })} />
                        : <Input value={c.url || ''} disabled={lectura} aria-label="Enlace del archivo" placeholder="https://…"
                            onChange={(e) => cambiar({ contenido: reemplazar(contenido, i, { url: e.target.value.trim() }) })} />}
                </div>
            ))}
            {!lectura && (
                <LinkButton icon={<Plus />} onClick={() => cambiar({ contenido: [...contenido, { tipo: 'texto', texto: '' }] })}>Contenido</LinkButton>
            )}

            <Campo label="Después de mandarlo">
                <Select label="Después de mandarlo" value={modo} disabled={lectura} options={DESPUES} onChange={ponerModo} />
            </Campo>

            {modo === 'botones' && (
                <div className="pf-bloque">
                    <Campo label="Estilo">
                        <Select label="Estilo de los botones" value={estilo} disabled={lectura} options={ESTILOS} onChange={(v) => cambiar({ estilo_botones: v })} />
                    </Campo>
                    {botones.map((b, i) => (
                        <div key={b.id} className="pf-fila">
                            <Input value={b.titulo} maxLength={20} disabled={lectura} placeholder={`Botón ${i + 1}`} aria-label={`Botón ${i + 1}`}
                                onChange={(e) => cambiar({ botones: reemplazar(botones, i, { titulo: e.target.value }) })} />
                            {!lectura && botones.length > 1 && (
                                <Quitar titulo="Quitar botón" onClick={() => cambiar({ botones: botones.filter((_, j) => j !== i) }, true)} />
                            )}
                        </div>
                    ))}
                    {!lectura && botones.length < LIMITE_BOTONES[estilo] && (
                        <LinkButton icon={<Plus />} onClick={() => cambiar({ botones: [...botones, { id: nuevoId('b'), titulo: '' }] }, true)}>Botón</LinkButton>
                    )}
                </div>
            )}
            {modo === 'texto' && (
                <Campo label="Guardar la respuesta en" ayuda="El nombre de la variable. Después se usa como {{nombre}} o en una condición.">
                    <Input value={nodo.espera?.guardar_en || ''} disabled={lectura} placeholder="examen" aria-label="Guardar la respuesta en"
                        onChange={(e) => cambiar({ espera: { guardar_en: e.target.value.trim() } })} />
                </Campo>
            )}
            {modo !== 'nada' && (
                <div className="pf-check">
                    <span>Si no responde, seguir por otra rama</span>
                    <Switch checked={!!nodo.sin_respuesta} disabled={lectura} label="Si no responde, seguir por otra rama" onChange={ponerSinRespuesta} />
                </div>
            )}
            {nodo.sin_respuesta && (
                <Campo label="Esperar (minutos)" ayuda="De 1 a 1440 (la ventana de Instagram es de 24 h).">
                    <Input variant="number" type="number" min={1} max={1440} value={nodo.sin_respuesta.minutos} disabled={lectura} aria-label="Minutos sin respuesta"
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
                        <Input value={r.campo} disabled={lectura} placeholder="Variable (examen, ultimo_boton…)" aria-label="Variable"
                            onChange={(e) => cambiar({ reglas: reemplazar(reglas, i, { campo: e.target.value.trim() }) })} />
                        {!lectura && reglas.length > 1 && <Quitar titulo="Quitar regla" onClick={() => cambiar({ reglas: reglas.filter((_, j) => j !== i) })} />}
                    </div>
                    <div className="pf-fila">
                        <Select label="Operador" value={r.operador} disabled={lectura} options={OPERADORES} onChange={(v) => cambiar({ reglas: reemplazar(reglas, i, { operador: v }) })} />
                        {!['existe', 'no_existe'].includes(r.operador) && (
                            <Input value={r.valor || ''} disabled={lectura} placeholder="Valor" aria-label="Valor"
                                onChange={(e) => cambiar({ reglas: reemplazar(reglas, i, { valor: e.target.value }) })} />
                        )}
                    </div>
                </div>
            ))}
            {!lectura && <LinkButton icon={<Plus />} onClick={() => cambiar({ reglas: [...reglas, { campo: '', operador: 'igual', valor: '' }] })}>Regla</LinkButton>}
        </>
    );
}

function PanelAccion({ nodo, cambiar, lectura }) {
    const acciones = nodo.acciones || [];
    const cambiarAccion = (i, cambio) => cambiar({ acciones: reemplazar(acciones, i, cambio) });
    return (
        <>
            {acciones.map((a, i) => (
                <div key={i} className="pf-bloque">
                    <div className="pf-fila">
                        <Select label="Acción" value={a.tipo} disabled={lectura} options={TIPOS_ACCION} onChange={(v) => cambiarAccion(i, { tipo: v })} />
                        {!lectura && acciones.length > 1 && <Quitar titulo="Quitar acción" onClick={() => cambiar({ acciones: acciones.filter((_, j) => j !== i) })} />}
                    </div>
                    {a.tipo === 'variable' && (
                        <div className="pf-fila">
                            <Input value={a.nombre || ''} disabled={lectura} placeholder="Variable" aria-label="Variable"
                                onChange={(e) => cambiarAccion(i, { nombre: e.target.value.trim() })} />
                            <Input value={a.valor ?? ''} disabled={lectura} placeholder="Valor" aria-label="Valor"
                                onChange={(e) => cambiarAccion(i, { valor: e.target.value })} />
                        </div>
                    )}
                    {a.tipo === 'etapa' && (
                        <Input variant="number" type="number" min={0} value={a.valor ?? 0} disabled={lectura} aria-label="Etapa"
                            onChange={(e) => cambiarAccion(i, { valor: Number(e.target.value) })} />
                    )}
                    {a.tipo === 'califica' && (
                        <Select label="Califica" value={a.valor ? 'si' : 'no'} disabled={lectura} options={CALIFICA} onChange={(v) => cambiarAccion(i, { valor: v === 'si' })} />
                    )}
                    {a.tipo === 'pausar_bot' && (
                        <Campo label="Horas">
                            <Input variant="number" type="number" min={1} max={720} value={a.horas || 24} disabled={lectura} aria-label="Horas de pausa"
                                onChange={(e) => cambiarAccion(i, { horas: Number(e.target.value) })} />
                        </Campo>
                    )}
                </div>
            ))}
            {!lectura && <LinkButton icon={<Plus />} onClick={() => cambiar({ acciones: [...acciones, { tipo: 'variable', nombre: '', valor: '' }] })}>Acción</LinkButton>}
        </>
    );
}

export default function Panel({ seleccion, lectura, onCambiarNodo, onCambiarDisparadores, onBorrar, onCerrar, esInicioDelFlujo, onHacerInicio }) {
    if (seleccion.id === INICIO) {
        return (
            <aside className="inspector pf" aria-label="Disparadores">
                <Cabecera titulo="Disparadores" onCerrar={onCerrar} />
                <PanelInicio disparadores={seleccion.data.disparadores || []} onCambiar={onCambiarDisparadores} lectura={lectura} />
            </aside>
        );
    }
    const nodo = seleccion.data.nodo;
    // `reemplazo` = true cuando `cambio` es el nodo entero (para quitar claves), no un parche.
    const cambiar = (cambio, reemplazo = false) => onCambiarNodo(reemplazo ? { ...cambio, id: nodo.id, tipo: nodo.tipo } : { ...nodo, ...cambio });
    const titulo = TIPOS[nodo.tipo]?.label;
    return (
        <aside className="inspector pf" aria-label={titulo}>
            <Cabecera titulo={titulo} onCerrar={onCerrar} />
            {nodo.tipo === 'mensaje' && <PanelMensaje nodo={nodo} cambiar={cambiar} lectura={lectura} />}
            {nodo.tipo === 'esperar' && (
                <Campo label="Esperar (minutos)" ayuda="De 1 a 1440. Si pasan 24 h desde su último mensaje, no se le puede escribir.">
                    <Input variant="number" type="number" min={1} max={1440} value={nodo.minutos} disabled={lectura} aria-label="Minutos de espera"
                        onChange={(e) => cambiar({ minutos: Number(e.target.value) })} />
                </Campo>
            )}
            {nodo.tipo === 'condicion' && <PanelCondicion nodo={nodo} cambiar={cambiar} lectura={lectura} />}
            {nodo.tipo === 'accion' && <PanelAccion nodo={nodo} cambiar={cambiar} lectura={lectura} />}
            {nodo.tipo === 'fin' && <p className="t-sm mut">El contacto sale del flujo.</p>}
            {!lectura && (
                <div className="pf-pie">
                    {!esInicioDelFlujo && <Button onClick={onHacerInicio}>Empezar por acá</Button>}
                    <Button variant="danger" icon={<Trash2 />} onClick={onBorrar}>Borrar</Button>
                </div>
            )}
        </aside>
    );
}
