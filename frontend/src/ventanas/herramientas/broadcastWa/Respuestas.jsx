// Qué pasa cuando tocan cada botón de una plantilla: el mensaje que sale solo (con sus botones, que siguen la
// respuesta de otro botón de la plantilla o quedan para el setter), a quién se asigna y qué etiqueta lleva.
// Vive en Work: se cambia sin pasar por Meta. Sin configurar, el toque queda para el setter.
import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Accordion, Button, IconButton, Input, LinkButton, Select, TextArea, toast } from '../../../components/standard';

const LARGO_BOTON = 20;
const MAX_BOTONES = 3;
const VACIA = { texto: '', botones: [], asignar_a: null, etiqueta: '', demora_segundos: 0 };
const ESPERAS = [
    { value: 0, label: 'Al instante' },
    { value: 60, label: 'A 1 minuto' },
    { value: 120, label: 'A los 2 minutos' },
    { value: 300, label: 'A los 5 minutos' },
];

function resumen(r, asignables) {
    if (!r || (!r.texto && !r.asignar_a && !r.etiqueta)) return 'Queda para el setter';
    const quien = asignables.find((a) => a.id === r.asignar_a)?.nombre;
    return [r.texto ? (r.demora_segundos ? `Contesta solo a los ${r.demora_segundos / 60} min` : 'Contesta solo') : null, quien && `Asigna a ${quien}`, r.etiqueta && `Etiqueta «${r.etiqueta}»`].filter(Boolean).join(' · ');
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
    const destinos = [{ value: '', label: 'Queda para el setter' }, ...botones.map((b) => ({ value: b, label: `Sigue «${b}»` }))];
    return (
        <div className="bw-cuerpo">
            <label className="bw-campo">
                <span>Mensaje que sale solo</span>
                <TextArea value={r.texto} onChange={(e) => cambiar('texto', e.target.value)} placeholder="Vacío: no contesta nada. {nombre} pone el primer nombre del lead" />
            </label>
            <div className="bw-fila">
                <Select size="sm" label="Sale" value={r.demora_segundos || 0} options={ESPERAS}
                    onChange={(v) => cambiar('demora_segundos', Number(v))} />
            </div>
            <div className="bw-campo">
                <span>Botones del mensaje <small className="bw-s">(hasta {MAX_BOTONES}, de {LARGO_BOTON} caracteres)</small></span>
                {r.botones.map((b, i) => (
                    <div key={i} className="bw-fila">
                        <Input value={b.titulo} maxLength={LARGO_BOTON} aria-label="Texto del botón" invalid={!b.titulo.trim()}
                            onChange={(e) => cambiarBoton(i, 'titulo', e.target.value)} />
                        <small className="bw-s bw-cuenta">{b.titulo.length}/{LARGO_BOTON}</small>
                        <Select size="sm" label="Al tocarlo" value={b.va_a || ''} options={destinos} onChange={(v) => cambiarBoton(i, 'va_a', v || null)} />
                        <IconButton size="sm" icon={<X />} label="Quitar botón" onClick={() => cambiar('botones', r.botones.filter((_, j) => j !== i))} />
                    </div>
                ))}
                {r.botones.length < MAX_BOTONES && (
                    <LinkButton icon={<Plus />} onClick={() => cambiar('botones', [...r.botones, { titulo: '', va_a: null }])}>Botón</LinkButton>
                )}
            </div>
            <div className="bw-fila">
                <Select size="sm" label="Asignar a" value={r.asignar_a ?? ''} onChange={(v) => cambiar('asignar_a', v === '' ? null : Number(v))}
                    options={[{ value: '', label: 'Sin cambiar la asignación' }, ...asignables.map((a) => ({ value: a.id, label: a.nombre }))]} />
                <Input value={r.etiqueta} onChange={(e) => cambiar('etiqueta', e.target.value)} placeholder="Etiqueta (opcional)" aria-label="Etiqueta" maxLength={60} />
                <Button variant="primary" disabled={guardando} onClick={guardar}>Guardar</Button>
            </div>
        </div>
    );
}

export default function Respuestas({ nombre, botones, datos }) {
    const [estado, setEstado] = useState(null);
    useEffect(() => {
        datos.respuestas(nombre).then(setEstado).catch((e) => toast(datos.mensaje(e, 'No se pudieron traer las respuestas'), 'error'));
    }, [nombre]); // eslint-disable-line react-hooks/exhaustive-deps
    if (!estado) return <span className="bw-s">Trayendo qué pasa con cada botón…</span>;
    const de = (b) => estado.respuestas.find((r) => r.boton === b);
    const guardada = (r) => setEstado((e) => ({ ...e, respuestas: [...e.respuestas.filter((x) => x.boton !== r.boton), r] }));
    return (
        <div>
            <span className="bw-rotulo">Cuando tocan un botón</span>
            <Accordion multiple={false} items={botones.map((b) => ({
                key: b, title: b, meta: resumen(de(b), estado.asignables),
                children: () => <Editor nombre={nombre} boton={b} botones={botones} inicial={de(b)} asignables={estado.asignables} datos={datos} onGuardada={guardada} />,
            }))} />
        </div>
    );
}
