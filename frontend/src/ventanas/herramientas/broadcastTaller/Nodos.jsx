// Los nodos del lienzo del flujo (ADR-W262): el paso (la plantilla que sale a su hora), la respuesta a cada botón
// y lo que sale al abrir un link. Cada botón tiene su enchufe (`data-ancla`) y cada nodo su clave (`data-nodo`):
// con eso `Lienzo` dibuja los cables.
import { Plus } from 'lucide-react';
import { Chip } from '../../../components/standard';
import { embudo, partesDe } from '../broadcastWa/useBroadcast';
import { espera } from '../broadcastWa/Espera';
import { ponen } from '../broadcastWa/Respuestas';

export const ESTADOS = {
    borrador: { label: 'Desactivado', color: 'var(--ln-text-faint, #8a8ea0)' },
    programado: { label: 'Programado', color: 'var(--ln-info, #3b7dd8)' },
    lanzado: { label: 'Salió', color: 'var(--ln-success, #1f9d6b)' },
    vencido: { label: 'Venció sin salir', color: 'var(--ln-error, #c8433a)' },
};
const A_QUIEN = { todos: 'A todos', no_respondieron: 'Los que no respondieron', tocaron: 'Tocaron', etiqueta: 'Con la etiqueta' };

export const claveResp = (i, boton) => `p${i}:r:${boton}`;
export const claveDespues = (i, boton) => `p${i}:d:${boton}`;

const corto = (t, n = 150) => ((t || '').length > n ? `${t.slice(0, n)}…` : t || '');

/** Un botón del mensaje. Tocarlo abre lo que sale de él (sin seleccionar el nodo que lo contiene). */
function Boton({ ancla, link, onTocar, children }) {
    const tocar = onTocar ? (e) => { e.stopPropagation(); onTocar(); } : undefined;
    return (
        <span className={`lz-bt${link ? ' lz-bt--link' : ''}${onTocar ? ' lz-bt--ir' : ''}`} data-ancla={ancla} onClick={tocar}
            title={onTocar ? 'Ver qué pasa al tocarlo' : undefined}>
            {link ? '🔗 ' : ''}{children}
        </span>
    );
}

export function NodoPaso({ i, paso, plantilla, config, elegido, onElegir, onBoton }) {
    const estado = ESTADOS[paso.estado] || ESTADOS.borrador;
    const { cuerpo, botones } = partesDe(plantilla);
    const salio = paso.lote ? embudo(paso.por_estado) : null;
    const mensaje = paso.tipo === 'mensaje' ? paso.mensaje || {} : null;
    return (
        <button type="button" className={`lz-nodo lz-nodo--paso${elegido ? ' lz-nodo--on' : ''}`} data-nodo={`p${i}`} onClick={onElegir}>
            <span className="lz-tipo lz-tipo--paso">{mensaje ? 'Paso · mensaje (24 h)' : 'Paso · plantilla'} <Chip subtle color={estado.color}>{estado.label}</Chip></span>
            <b>{paso.nombre || paso.plantilla || 'Paso nuevo'}</b>
            {mensaje
                ? (mensaje.texto ? <span className="lz-burbuja">{corto(mensaje.texto)}</span> : <span className="lz-s">Sin mensaje</span>)
                : paso.plantilla ? <span className="lz-burbuja">{corto(cuerpo || paso.plantilla)}</span> : <span className="lz-s">Sin plantilla</span>}
            {mensaje?.url && <span className="lz-bts"><Boton link>{mensaje.titulo || 'Abrir'}</Boton></span>}
            {botones.length > 0 && <span className="lz-bts">{botones.map((b) => <Boton key={b} ancla={`p${i}:b:${b}`} onTocar={() => onBoton(b)}>{b}</Boton>)}</span>}
            <span className="lz-s">
                {A_QUIEN[paso.a_quien]}{paso.valor ? ` «${paso.valor}»` : ''}
                {salio ? ` · ${salio.enviados} enviados · ${salio.respondieron} respondieron` : paso.estimado != null ? ` · ~${paso.estimado}` : ''}
                {config?.opcion_unica && !mensaje ? ' · Opción única' : ''}
                {mensaje ? ' · solo con la ventana abierta' : ''}
            </span>
        </button>
    );
}

export function NodoRespuesta({ i, boton, regla, elegido, onElegir, onBoton }) {
    const clave = claveResp(i, boton);
    const pone = ponen(regla), saca = regla?.quitar || [];
    if (!regla || (!regla.texto && !regla.asignar_a && !pone.length && !saca.length)) {
        return (
            <button type="button" className={`lz-nodo lz-nodo--vacio${elegido ? ' lz-nodo--on' : ''}`} data-nodo={clave} onClick={onElegir}>
                <span className="lz-tipo lz-tipo--resp">Si toca «{boton}»</span>
                <span className="lz-s"><Plus aria-hidden="true" /> Queda para el setter · tocá para armar la respuesta</span>
            </button>
        );
    }
    return (
        <button type="button" className={`lz-nodo${elegido ? ' lz-nodo--on' : ''}`} data-nodo={clave} onClick={onElegir}>
            <span className="lz-tipo lz-tipo--resp">Si toca «{boton}»{espera(regla.demora_segundos)}</span>
            {regla.texto ? <span className="lz-burbuja">{corto(regla.texto)}</span> : <span className="lz-s">No contesta: solo asigna o etiqueta</span>}
            {(regla.botones || []).length > 0 && (
                <span className="lz-bts">
                    {regla.botones.map((b, k) => (
                        <Boton key={k} ancla={`${clave}:b${k}`} link={b.url != null}
                            onTocar={b.url != null || b.va_a ? () => onBoton(b) : undefined}>{b.titulo}</Boton>
                    ))}
                </span>
            )}
            {pone.length > 0 && <span className="lz-s lz-tag">+ {pone.join(', ')}</span>}
            {saca.length > 0 && <span className="lz-s lz-tag lz-tag--saca">− {saca.join(', ')}</span>}
        </button>
    );
}

export function NodoDespues({ i, boton, despues, elegido, onElegir, onBoton }) {
    const clave = claveDespues(i, boton);
    return (
        <button type="button" className={`lz-nodo${elegido ? ' lz-nodo--on' : ''}`} data-nodo={clave} onClick={onElegir}>
            <span className="lz-tipo lz-tipo--link">Al abrir el link{espera(despues.demora_segundos)}</span>
            <span className="lz-burbuja">{corto(despues.texto)}</span>
            {(despues.url || (despues.botones || []).length > 0) && (
                <span className="lz-bts">
                    {despues.url && <Boton link>{despues.titulo}</Boton>}
                    {(despues.botones || []).map((b, k) => (
                        <Boton key={k} ancla={`${clave}:b${k}`} onTocar={b.va_a ? () => onBoton(b) : undefined}>{b.titulo}</Boton>
                    ))}
                </span>
            )}
            <span className="lz-s">Sale una sola vez</span>
        </button>
    );
}
