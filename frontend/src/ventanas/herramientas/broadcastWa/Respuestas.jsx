// Qué pasa cuando tocan cada botón de una plantilla: el mensaje que sale solo (con sus botones, que siguen la
// respuesta de otro botón de la plantilla o quedan para el setter), a quién se asigna y qué etiqueta lleva.
// Vive en Work: se cambia sin pasar por Meta. Sin configurar, el toque queda para el setter.
import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Accordion, Button, IconButton, Input, LinkButton, Select, Switch, TextArea, toast } from '../../../components/standard';
import Despues, { URL_VALIDA } from './Despues';
import Espera, { espera } from './Espera';

const LARGO_BOTON = 20;
const MAX_BOTONES = 3;
const LINK = '__link__';
const MAX_TOTAL = MAX_BOTONES + 1; // hasta 3 de respuesta y uno con link (ADR-W265)
const VACIA = { texto: '', botones: [], asignar_a: null, demora_segundos: 0 };

const esLink = (b) => b.url != null;
/** Las etiquetas que pone (las reglas viejas solo traen `etiqueta`). */
export const ponen = (r) => r?.etiquetas?.length ? r.etiquetas : (r?.etiqueta ? [r.etiqueta] : []);
const aLista = (t) => t.split(',').map((x) => x.trim()).filter(Boolean);

/** Qué pasa con ese botón, en una línea (también lo usan las ramas del flujo de un taller). */
export function resumen(r, asignables = []) {
    const pone = ponen(r), saca = r?.quitar || [];
    if (!r || (!r.texto && !r.asignar_a && !pone.length && !saca.length)) return 'Queda para el setter';
    const quien = asignables.find((a) => a.id === r.asignar_a)?.nombre;
    const link = (r.botones || []).find(esLink);
    return [r.texto ? `${link ? 'Manda el link' : 'Contesta solo'}${espera(r.demora_segundos)}` : null,
        link?.despues && 'al abrirlo, otro mensaje', quien && `Asigna a ${quien}`,
        pone.length && `+ ${pone.join(', ')}`, saca.length && `− ${saca.join(', ')}`]
        .filter(Boolean).join(' · ');
}

/** Opción única: después de elegir un botón de un mensaje, los otros contestan «ya elegiste». Vale para la plantilla. */
export function OpcionUnica({ nombre, inicial, datos, onCambio }) {
    const [c, setC] = useState(inicial);
    const [guardando, setGuardando] = useState(false);
    const guardar = (cambios) => {
        const nuevo = { ...c, ...cambios };
        setC(nuevo);
        setGuardando(true);
        return datos.guardarConfig(nombre, nuevo).then((guardada) => { setC(guardada); onCambio?.(guardada); })
            .catch((e) => toast(datos.mensaje(e, 'No se pudo guardar'), 'error'))
            .finally(() => setGuardando(false));
    };
    return (
        <div className="bw-cuerpo bw-unica">
            <div className="bw-fila">
                <Switch checked={c.opcion_unica} label="Opción única" disabled={guardando} onChange={(v) => guardar({ opcion_unica: v })} />
                <span><b>Opción única</b> <small className="bw-s">Si ya eligió un botón, los otros de ese mensaje no siguen.</small></span>
            </div>
            {c.opcion_unica && (
                <label className="bw-campo">
                    <span>Si toca otro botón, le contesta</span>
                    <TextArea value={c.texto_repetida} onChange={(e) => setC({ ...c, texto_repetida: e.target.value })}
                        onBlur={() => guardar({})} placeholder="Ya elegiste «{opcion}» 🙌" />
                    <small className="bw-s">{'{opcion}'} es lo que eligió antes; {'{nombre}'}, su primer nombre.</small>
                </label>
            )}
        </div>
    );
}

/**
 * La regla de un botón. `parte`: 'todo' (la lista de Plantillas), 'respuesta' (el nodo de la respuesta en el lienzo
 * del taller: sin «al abrir el link», que es su propio nodo y se abre con `onAbrirDespues`) o 'despues' (solo el
 * mensaje que sale al abrir su link). Las tres guardan la regla entera.
 */
export function Editor({ nombre, boton, botones, inicial, asignables, datos, onGuardada, parte = 'todo', onAbrirDespues }) {
    const [r, setR] = useState({ ...VACIA, ...inicial, pone: ponen(inicial).join(', '), saca: (inicial?.quitar || []).join(', ') });
    const [guardando, setGuardando] = useState(false);
    const cambiar = (campo, valor) => setR((x) => ({ ...x, [campo]: valor }));
    const cambiarBoton = (i, campo, valor) => cambiar('botones', r.botones.map((b, j) => (j === i ? { ...b, [campo]: valor } : b)));
    const guardar = async () => {
        setGuardando(true);
        try {
            const { pone, saca, etiqueta, ...resto } = r; // eslint-disable-line no-unused-vars
            onGuardada(await datos.guardarRespuesta(nombre, boton, { ...resto, etiquetas: aLista(pone), quitar: aLista(saca) }));
            toast(`Guardado: «${boton}»`);
        } catch (e) {
            toast(datos.mensaje(e, 'No se pudo guardar'), 'error');
        } finally {
            setGuardando(false);
        }
    };
    const conLink = r.botones.some(esLink);
    const respuestas = r.botones.filter((b) => !esLink(b)).length;
    // Un solo botón con link por mensaje: la opción aparece en el que ya lo es o si todavía no hay ninguno.
    const destinosDe = (b) => [{ value: '', label: 'Queda para el setter' }, ...botones.map((x) => ({ value: x, label: `Sigue «${x}»` })),
        ...(esLink(b) || !conLink ? [{ value: LINK, label: 'Abre un link' }] : [])];
    const elegirDestino = (i, v) => cambiar('botones', r.botones.map((b, j) => (j !== i ? b
        : v === LINK ? { titulo: b.titulo, url: b.url || '' } : { titulo: b.titulo, va_a: v || null })));
    const linkMal = r.botones.some((b) => esLink(b) && (!URL_VALIDA.test(b.url.trim())
        || (b.despues && b.despues.url && !URL_VALIDA.test(b.despues.url.trim()))
        || (b.despues && b.despues.url && !(b.despues.titulo || '').trim())));
    const iLink = r.botones.findIndex(esLink);
    if (parte === 'despues') {
        return (
            <div className="bw-cuerpo">
                {iLink < 0
                    ? <span className="bw-s">Este botón no tiene link: agregalo en su respuesta.</span>
                    : <Despues valor={r.botones[iLink].despues} botones={botones} onChange={(d) => cambiarBoton(iLink, 'despues', d)} />}
                <div className="bw-fila">
                    <Button variant="primary" disabled={guardando || linkMal || iLink < 0} onClick={guardar}>Guardar</Button>
                </div>
            </div>
        );
    }
    return (
        <div className="bw-cuerpo">
            <label className="bw-campo">
                <span>Mensaje que sale solo</span>
                <TextArea value={r.texto} onChange={(e) => cambiar('texto', e.target.value)} placeholder="Vacío: no contesta nada. {nombre} pone el primer nombre del lead" />
            </label>
            <Espera segundos={r.demora_segundos || 0} onChange={(s) => cambiar('demora_segundos', s)} />
            <div className="bw-campo">
                <span>Botones del mensaje <small className="bw-s">(hasta {MAX_BOTONES} de respuesta y uno con link, de {LARGO_BOTON} caracteres)</small></span>
                {conLink && respuestas > 0 && (
                    <small className="bw-s">WhatsApp no mezcla un link con botones de respuesta: sale tu mensaje con el link y, justo debajo, otro con los demás botones.</small>
                )}
                {r.botones.map((b, i) => (
                    <div key={i} className="bw-cuerpo bw-boton">
                        <div className="bw-fila">
                            <Input value={b.titulo} maxLength={LARGO_BOTON} aria-label="Texto del botón" invalid={!b.titulo.trim()}
                                onChange={(e) => cambiarBoton(i, 'titulo', e.target.value)} />
                            <small className="bw-s bw-cuenta">{b.titulo.length}/{LARGO_BOTON}</small>
                            <Select size="sm" label="Al tocarlo" value={esLink(b) ? LINK : b.va_a || ''} options={destinosDe(b)} onChange={(v) => elegirDestino(i, v)} />
                            <IconButton size="sm" icon={<X />} label="Quitar botón" onClick={() => cambiar('botones', r.botones.filter((_, j) => j !== i))} />
                        </div>
                        {esLink(b) && (
                            <>
                                <Input value={b.url} placeholder="https://drive.google.com/…" aria-label="Link del botón" invalid={linkMal}
                                    onChange={(e) => cambiarBoton(i, 'url', e.target.value)} />
                                {parte === 'respuesta'
                                    ? <LinkButton icon={<Plus />} onClick={onAbrirDespues}>{b.despues ? 'Ver el mensaje al abrir el link' : 'Mensaje al abrir el link'}</LinkButton>
                                    : <Despues valor={b.despues} botones={botones} onChange={(d) => cambiarBoton(i, 'despues', d)} />}
                            </>
                        )}
                    </div>
                ))}
                {r.botones.length < MAX_TOTAL && (respuestas < MAX_BOTONES || !conLink) && (
                    <LinkButton icon={<Plus />} onClick={() => cambiar('botones', [...r.botones, respuestas < MAX_BOTONES ? { titulo: '', va_a: null } : { titulo: '', url: '' }])}>Botón</LinkButton>
                )}
            </div>
            <div className="bw-campo">
                <span>Etiquetas <small className="bw-s">(separadas por coma; sacar una que no tiene no hace nada)</small></span>
                <div className="bw-fila">
                    <Input value={r.pone} onChange={(e) => cambiar('pone', e.target.value)} placeholder="Pone: confirmado" aria-label="Etiquetas que pone" />
                    <Input value={r.saca} onChange={(e) => cambiar('saca', e.target.value)} placeholder="Saca: baja, no va" aria-label="Etiquetas que saca" />
                </div>
            </div>
            <div className="bw-fila">
                <Select size="sm" label="Asignar a" value={r.asignar_a ?? ''} onChange={(v) => cambiar('asignar_a', v === '' ? null : Number(v))}
                    options={[{ value: '', label: 'Sin cambiar la asignación' }, ...asignables.map((a) => ({ value: a.id, label: a.nombre }))]} />
                <Button variant="primary" disabled={guardando || linkMal} onClick={guardar}>Guardar</Button>
            </div>
        </div>
    );
}

/** `onCambio(respuestas)`: avisa lo guardado (el flujo de un taller muestra las ramas al día). */
export default function Respuestas({ nombre, botones, datos, onCambio }) {
    const [estado, setEstado] = useState(null);
    useEffect(() => {
        datos.respuestas(nombre).then(setEstado).catch((e) => toast(datos.mensaje(e, 'No se pudieron traer las respuestas'), 'error'));
    }, [nombre]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (estado && onCambio) onCambio(estado.respuestas); }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps
    if (!estado) return <span className="bw-s">Trayendo qué pasa con cada botón…</span>;
    const de = (b) => estado.respuestas.find((r) => r.boton === b);
    const guardada = (r) => setEstado((e) => ({ ...e, respuestas: [...e.respuestas.filter((x) => x.boton !== r.boton), r] }));
    return (
        <div>
            <span className="bw-rotulo">Cuando tocan un botón</span>
            <OpcionUnica key={nombre} nombre={nombre} inicial={estado.config || { opcion_unica: false, texto_repetida: '' }} datos={datos} />
            <Accordion multiple={false} items={botones.map((b) => ({
                key: b, title: b, meta: resumen(de(b), estado.asignables),
                children: () => <Editor nombre={nombre} boton={b} botones={botones} inicial={de(b)} asignables={estado.asignables} datos={datos} onGuardada={guardada} />,
            }))} />
        </div>
    );
}
