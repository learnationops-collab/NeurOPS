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
const VACIA = { texto: '', botones: [], asignar_a: null, etiqueta: '', demora_segundos: 0 };

const esLink = (b) => b.url != null;

/** Qué pasa con ese botón, en una línea (también lo usan las ramas del flujo de un taller). */
export function resumen(r, asignables = []) {
    if (!r || (!r.texto && !r.asignar_a && !r.etiqueta)) return 'Queda para el setter';
    const quien = asignables.find((a) => a.id === r.asignar_a)?.nombre;
    const link = (r.botones || []).find(esLink);
    return [r.texto ? `${link ? 'Manda el link' : 'Contesta solo'}${espera(r.demora_segundos)}` : null,
        link?.despues && 'al abrirlo, otro mensaje', quien && `Asigna a ${quien}`, r.etiqueta && `Etiqueta «${r.etiqueta}»`]
        .filter(Boolean).join(' · ');
}

/** Opción única: después de elegir un botón de un mensaje, los otros contestan «ya elegiste». Vale para la plantilla. */
function OpcionUnica({ nombre, inicial, datos }) {
    const [c, setC] = useState(inicial);
    const [guardando, setGuardando] = useState(false);
    const guardar = (cambios) => {
        const nuevo = { ...c, ...cambios };
        setC(nuevo);
        setGuardando(true);
        return datos.guardarConfig(nombre, nuevo).then(setC)
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

function Editor({ nombre, boton, botones, inicial, asignables, datos, onGuardada }) {
    const [r, setR] = useState({ ...VACIA, ...inicial, etiqueta: inicial?.etiqueta || '' });
    const [guardando, setGuardando] = useState(false);
    const cambiar = (campo, valor) => setR((x) => ({ ...x, [campo]: valor }));
    const cambiarBoton = (i, campo, valor) => cambiar('botones', r.botones.map((b, j) => (j === i ? { ...b, [campo]: valor } : b)));
    const guardar = async () => {
        setGuardando(true);
        try {
            onGuardada(await datos.guardarRespuesta(nombre, boton, { ...r, etiqueta: r.etiqueta.trim() || null }));
            toast(`Guardado: «${boton}»`);
        } catch (e) {
            toast(datos.mensaje(e, 'No se pudo guardar'), 'error');
        } finally {
            setGuardando(false);
        }
    };
    const destinos = [{ value: '', label: 'Queda para el setter' }, ...botones.map((b) => ({ value: b, label: `Sigue «${b}»` })),
        ...(r.botones.length === 1 ? [{ value: LINK, label: 'Abre un link' }] : [])];
    const conLink = r.botones.some(esLink);
    const elegirDestino = (i, v) => cambiar('botones', r.botones.map((b, j) => (j !== i ? b
        : v === LINK ? { titulo: b.titulo, url: b.url || '' } : { titulo: b.titulo, va_a: v || null })));
    const linkMal = r.botones.some((b) => esLink(b) && (!URL_VALIDA.test(b.url.trim())
        || (b.despues && b.despues.url && !URL_VALIDA.test(b.despues.url.trim()))
        || (b.despues && b.despues.url && !(b.despues.titulo || '').trim())));
    return (
        <div className="bw-cuerpo">
            <label className="bw-campo">
                <span>Mensaje que sale solo</span>
                <TextArea value={r.texto} onChange={(e) => cambiar('texto', e.target.value)} placeholder="Vacío: no contesta nada. {nombre} pone el primer nombre del lead" />
            </label>
            <Espera segundos={r.demora_segundos || 0} onChange={(s) => cambiar('demora_segundos', s)} />
            <div className="bw-campo">
                <span>Botones del mensaje <small className="bw-s">(hasta {MAX_BOTONES}, de {LARGO_BOTON} caracteres; uno con link va solo)</small></span>
                {r.botones.map((b, i) => (
                    <div key={i} className="bw-cuerpo bw-boton">
                        <div className="bw-fila">
                            <Input value={b.titulo} maxLength={LARGO_BOTON} aria-label="Texto del botón" invalid={!b.titulo.trim()}
                                onChange={(e) => cambiarBoton(i, 'titulo', e.target.value)} />
                            <small className="bw-s bw-cuenta">{b.titulo.length}/{LARGO_BOTON}</small>
                            <Select size="sm" label="Al tocarlo" value={esLink(b) ? LINK : b.va_a || ''} options={destinos} onChange={(v) => elegirDestino(i, v)} />
                            <IconButton size="sm" icon={<X />} label="Quitar botón" onClick={() => cambiar('botones', r.botones.filter((_, j) => j !== i))} />
                        </div>
                        {esLink(b) && (
                            <>
                                <Input value={b.url} placeholder="https://drive.google.com/…" aria-label="Link del botón" invalid={linkMal}
                                    onChange={(e) => cambiarBoton(i, 'url', e.target.value)} />
                                <Despues valor={b.despues} onChange={(d) => cambiarBoton(i, 'despues', d)} />
                            </>
                        )}
                    </div>
                ))}
                {r.botones.length < MAX_BOTONES && !conLink && (
                    <LinkButton icon={<Plus />} onClick={() => cambiar('botones', [...r.botones, { titulo: '', va_a: null }])}>Botón</LinkButton>
                )}
            </div>
            <div className="bw-fila">
                <Select size="sm" label="Asignar a" value={r.asignar_a ?? ''} onChange={(v) => cambiar('asignar_a', v === '' ? null : Number(v))}
                    options={[{ value: '', label: 'Sin cambiar la asignación' }, ...asignables.map((a) => ({ value: a.id, label: a.nombre }))]} />
                <Input value={r.etiqueta} onChange={(e) => cambiar('etiqueta', e.target.value)} placeholder="Etiqueta (opcional)" aria-label="Etiqueta" maxLength={60} />
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
