// El inspector, fijo a la derecha del lienzo: edita el paso elegido (o los disparadores si es el inicio)
// con sus avisos al lado. Sin nada elegido, resume el flujo: cómo le va y qué falta para publicar.
import { AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { Button, Input } from '../../../components/standard';
import { INICIO, TIPOS } from './grafoFlujo';
import { Campo, PanelAccion, PanelCondicion, PanelInicio, PanelMensaje } from './paneles';
import { porciento, rotuloPaso } from '../estadoFlujo';

function Avisos({ lista }) {
    if (!lista?.length) return null;
    return (
        <div className="pf-avisos" role="note">
            <AlertTriangle size={14} aria-hidden="true" />
            <ul>{lista.map((a) => <li key={a}>{a.charAt(0).toUpperCase() + a.slice(1)}.</li>)}</ul>
        </div>
    );
}

function Resumen({ flujo, metricas, avisos, numeros, nombres, onElegir }) {
    const m = metricas;
    const deNodos = Object.entries(avisos.porNodo);
    const total = avisos.general.length + deNodos.reduce((n, [, l]) => n + l.length, 0);
    return (
        <>
            <div className="pf-cab">
                <span className="t-rotulo">Flujo</span>
                <h3 className="t-h3">{flujo.nombre}</h3>
            </div>
            <div className="datos">
                <div className="dato"><b>{m?.entradas ?? '–'}</b><span>Entradas {m?.dias || 7} d</span></div>
                <div className="dato"><b>{m?.suficiente ? porciento(m.completan) : '–'}</b><span>Completan</span></div>
                <div className="dato"><b>{flujo.ejecuciones_abiertas ?? '–'}</b><span>En curso</span></div>
            </div>
            {m?.mayor_caida && (
                <button type="button" className="pf-caida" onClick={() => onElegir(m.mayor_caida.id)}>
                    <span className="t-rotulo">Mayor caída</span>
                    <strong>{rotuloPaso({ ...m.mayor_caida, nombre: nombres[m.mayor_caida.id] })}</strong>
                    <span className="t-cap">{porciento(m.mayor_caida.caida)} de la gente no sigue después de este paso</span>
                </button>
            )}
            {m && !m.suficiente && m.entradas > 0 && (
                <p className="t-cap mut">Con {m.entradas} {m.entradas === 1 ? 'entrada' : 'entradas'} en {m.dias} días los porcentajes todavía no dicen mucho.</p>
            )}
            <span className="t-rotulo">Antes de publicar</span>
            {total === 0 ? (
                <p className="pf-listo"><CheckCircle2 size={14} aria-hidden="true" /> Sin avisos: se puede publicar.</p>
            ) : (
                <ul className="pf-lista-avisos">
                    {avisos.general.map((a) => <li key={a}><AlertTriangle size={13} aria-hidden="true" />{a}</li>)}
                    {deNodos.map(([id, lista]) => (
                        <li key={id}>
                            <button type="button" onClick={() => onElegir(id)}>
                                <AlertTriangle size={13} aria-hidden="true" />
                                <span><b>{numeros[id] ? `Paso ${numeros[id]}` : 'Paso sin conectar'}{nombres[id] ? ` · ${nombres[id]}` : ''}:</b> {lista.join('; ')}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <p className="t-cap mut40">Elegí una caja del lienzo para editarla.</p>
        </>
    );
}

export default function Panel({
    seleccion, lectura, flujo, metricas, avisos, numeros, nombres, destinos, variables,
    onCambiarNodo, onCambiarDisparadores, onBorrar, onElegir, esInicioDelFlujo, onHacerInicio,
}) {
    if (!seleccion) {
        return (
            <aside className="pf" aria-label="Resumen del flujo">
                <Resumen flujo={flujo} metricas={metricas} avisos={avisos} numeros={numeros} nombres={nombres} onElegir={onElegir} />
            </aside>
        );
    }
    if (seleccion.id === INICIO) {
        return (
            <aside className="pf" aria-label="Disparadores">
                <div className="pf-cab"><span className="t-rotulo">Disparador</span><h3 className="t-h3">Cómo se entra al flujo</h3></div>
                <PanelInicio disparadores={seleccion.data.disparadores || []} onCambiar={onCambiarDisparadores} lectura={lectura} />
                <Avisos lista={avisos.general} />
            </aside>
        );
    }
    const nodo = seleccion.data.nodo;
    // `reemplazo` = true cuando `cambio` es el nodo entero (para quitar claves), no un parche.
    const cambiar = (cambio, reemplazo = false) => onCambiarNodo(reemplazo ? { ...cambio, id: nodo.id, tipo: nodo.tipo, nombre: nodo.nombre } : { ...nodo, ...cambio });
    const tipo = TIPOS[nodo.tipo]?.label;
    const numero = numeros[nodo.id];
    const metrica = metricas?.nodos?.[nodo.id];
    return (
        <aside className="pf" aria-label={tipo}>
            <div className="pf-cab">
                <span className="t-rotulo">{numero ? `Paso ${numero}` : 'Paso sin conectar'} · {tipo}</span>
                <h3 className="t-h3">{nodo.nombre || tipo}</h3>
                {metrica?.alcance > 0 && (
                    <span className="t-cap mut">
                        {metrica.alcance} {metrica.alcance === 1 ? 'persona llegó' : 'personas llegaron'} en {metricas.dias} días
                        {metrica.caida > 0 ? ` · ${porciento(metrica.caida)} no siguió` : ''}
                    </span>
                )}
            </div>
            {nodo.tipo !== 'fin' && (
                <Campo label="Nombre del paso" ayuda="Para encontrarlo en la bandeja y en el embudo. El lead no lo ve.">
                    <Input value={nodo.nombre || ''} maxLength={60} disabled={lectura} aria-label="Nombre del paso" placeholder="Ej. Cualificación · examen"
                        onChange={(e) => onCambiarNodo({ ...nodo, nombre: e.target.value || undefined })} />
                </Campo>
            )}
            <Avisos lista={avisos.porNodo[nodo.id]} />
            {nodo.tipo === 'mensaje' && <PanelMensaje nodo={nodo} cambiar={cambiar} lectura={lectura} variables={variables} destinos={destinos} metrica={metrica} />}
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
