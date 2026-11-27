// «Cuando abre el link»: el mensaje que sale después de que la persona abre el link de un botón (ADR-W261), con
// su espera y, si se quiere, su propio botón con link. Como en ManyChat: WhatsApp no avisa, así que el link pasa
// por Work para saberlo.
import { Plus, X } from 'lucide-react';
import { IconButton, Input, LinkButton, Select, Switch, TextArea } from '../../../components/standard';
import Espera from './Espera';

const LARGO_BOTON = 20;
const MAX_RESPUESTAS = 3;
export const URL_VALIDA = /^https?:\/\/\S+$/;

/** `botones`: los de la plantilla, para que los botones de respuesta de este mensaje sigan a uno (ADR-W265). */
export default function Despues({ valor, onChange, botones = [] }) {
    const d = valor || null;
    const poner = (cambios) => onChange({ ...(d || { texto: '', demora_segundos: 0, titulo: '', url: '' }), ...cambios });
    const respuestas = d?.botones || [];
    const cambiarRespuesta = (i, cambios) => poner({ botones: respuestas.map((b, j) => (j === i ? { ...b, ...cambios } : b)) });
    const destinos = [{ value: '', label: 'Queda para el setter' }, ...botones.map((b) => ({ value: b, label: `Sigue «${b}»` }))];
    return (
        <div className="bw-cuerpo bw-despues">
            <div className="bw-fila">
                <Switch checked={Boolean(d)} label="Mandar otro mensaje al abrir el link" onChange={(v) => onChange(v ? { texto: '', demora_segundos: 0, titulo: '', url: '' } : null)} />
                <span><b>Cuando abre el link</b> <small className="bw-s">le manda otro mensaje (una sola vez)</small></span>
            </div>
            {d && (
                <>
                    <TextArea value={d.texto} onChange={(e) => poner({ texto: e.target.value })}
                        placeholder="Agendá la clase en tu calendario así no te la perdés 👇" />
                    <Espera segundos={d.demora_segundos || 0} onChange={(s) => poner({ demora_segundos: s })} despues="después de abrirlo" />
                    <div className="bw-fila">
                        <Input value={d.titulo || ''} maxLength={LARGO_BOTON} placeholder="Botón (opcional)" aria-label="Texto del botón"
                            onChange={(e) => poner({ titulo: e.target.value })} />
                        <Input value={d.url || ''} placeholder="https://calendar.google.com/…" aria-label="Link del botón"
                            invalid={Boolean(d.url) && !URL_VALIDA.test(d.url.trim())} onChange={(e) => poner({ url: e.target.value })} />
                    </div>
                    <small className="bw-s">Con botón, el mensaje lleva un link (por ejemplo, agregar el evento a Google Calendar).</small>
                    {respuestas.map((b, i) => (
                        <div key={i} className="bw-fila">
                            <Input value={b.titulo} maxLength={LARGO_BOTON} placeholder="Botón de respuesta" aria-label="Texto del botón"
                                invalid={!b.titulo.trim()} onChange={(e) => cambiarRespuesta(i, { titulo: e.target.value })} />
                            <Select size="sm" label="Al tocarlo" value={b.va_a || ''} options={destinos} onChange={(v) => cambiarRespuesta(i, { va_a: v || null })} />
                            <IconButton size="sm" icon={<X />} label="Quitar botón" onClick={() => poner({ botones: respuestas.filter((_, j) => j !== i) })} />
                        </div>
                    ))}
                    {respuestas.length < MAX_RESPUESTAS && (
                        <LinkButton icon={<Plus />} onClick={() => poner({ botones: [...respuestas, { titulo: '', va_a: null }] })}>Botón de respuesta</LinkButton>
                    )}
                    {d.url && respuestas.length > 0 && <small className="bw-s">El link y los botones de respuesta salen en dos mensajes seguidos.</small>}
                </>
            )}
        </div>
    );
}
