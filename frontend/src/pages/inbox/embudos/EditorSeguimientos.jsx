// «Si no contesta» de una fase (ADR-W204): los seguimientos en orden de horas desde el último mensaje del lead.
// Setter: le aparece «toca seguimiento N» en Conversaciones. Automático: lo manda el motor, antes de las 24 h
// (`app/automatizaciones/cadencias.py`). Quien no es de la dirección comercial no cambia los automáticos.
import { Bot, Trash2, User } from 'lucide-react';
import { Button, FieldError, IconButton, Input, Segmented, Select, Switch, TextArea } from '../../../components/standard';
import { HORAS_AUTO, nuevoId } from './useEmbudos';

const QUIEN = [
    { value: 'setter', label: 'Setter', icon: <User size={13} /> },
    { value: 'auto', label: 'Automático', icon: <Bot size={13} /> },
];

function Uso({ u }) {
    if (!u) return null;
    const total = u.enviados || u.avisos;
    if (!total && !u.no_salieron) return null;
    const pct = total ? Math.round((100 * u.respondieron) / total) : 0;
    return (
        <span className="em-uso" data-tip={`Últimos 7 días|${u.no_salieron ? `${u.no_salieron} no salieron (ventana cerrada, ya lo tenía…)` : 'Todos salieron'}`}>
            {u.enviados ? `${u.enviados} enviados` : `${u.avisos} avisos`} · {u.respondieron} contestaron ({pct}%)
        </span>
    );
}

function Paso({ s, n, puedeAuto, uso, onCambiar, onQuitar }) {
    const auto = s.quien === 'auto';
    const bloqueado = auto && !puedeAuto;
    const set = (x) => onCambiar({ ...s, ...x });
    const tarde = auto && Number(s.h) > HORAS_AUTO;
    return (
        <div className={`em-seg${auto ? ' em-seg--auto' : ''}`}>
            <div className="em-seg-cab">
                <span className="em-seg-n">{n}</span>
                <label className="em-seg-h">a las
                    <Input variant="number" type="number" min="0.25" step="0.5" value={s.h} disabled={bloqueado}
                        onChange={(e) => set({ h: e.target.value === '' ? '' : Number(e.target.value) })} aria-label="Horas sin respuesta" />
                    h sin respuesta
                </label>
                <Segmented size="sm" label="Quién lo manda" value={s.quien} radio
                    onChange={(q) => set(q === 'auto' ? { quien: q, x: s.x || '', boton: s.boton || '', link: s.link || '' } : { quien: q })}
                    options={QUIEN.map((o) => ({ ...o, props: { disabled: !puedeAuto } }))} />
                <Uso u={uso} />
                {!bloqueado && <IconButton size="xs" label="Quitar el seguimiento" icon={<Trash2 size={13} />} onClick={onQuitar} />}
            </div>
            {auto ? (
                <>
                    <TextArea value={s.x || ''} readOnly={bloqueado} onChange={(e) => set({ x: e.target.value })} maxLength={s.boton ? 640 : 1000}
                        aria-label="Texto del seguimiento" placeholder="Ej.: {nombre}, el {workshop_fecha} voy a dar una clase gratuita…" />
                    <div className="em-seg-boton">
                        <Input value={s.boton || ''} readOnly={bloqueado} maxLength={20} onChange={(e) => set({ boton: e.target.value })}
                            placeholder="Botón (opcional)" aria-label="Texto del botón" />
                        <Input value={s.link || ''} readOnly={bloqueado} onChange={(e) => set({ link: e.target.value })}
                            placeholder="Link del botón: https://… o {workshop_link}" aria-label="Link del botón" />
                    </div>
                    <label className="em-seg-vez">
                        <Switch checked={!!s.unaVez} onChange={bloqueado ? undefined : (v) => set({ unaVez: v })} label="Una sola vez por lead" />
                        Una sola vez por lead (aunque vuelva a quedarse callado)
                    </label>
                    {tarde && <FieldError>Un automático sale antes de las 24 h: Instagram no deja que un bot escriba después. Pasalo a setter o bajá las horas.</FieldError>}
                    {s.boton && !s.link && <FieldError>El botón necesita un link.</FieldError>}
                </>
            ) : (
                <Input value={s.nota || ''} onChange={(e) => set({ nota: e.target.value })} maxLength={300}
                    placeholder="Qué escribir (opcional): sale en el aviso al setter" aria-label="Nota para el setter" />
            )}
        </div>
    );
}

export default function EditorSeguimientos({ lista, puedeAuto, uso, claveBase, variables, otras, onCambiar, onCopiar }) {
    const ordenados = [...(lista || [])].sort((a, b) => Number(a.h) - Number(b.h));
    const cambiar = (id, s) => onCambiar(ordenados.map((x) => (x.id === id ? s : x)));
    const ultimo = ordenados[ordenados.length - 1];
    const agregar = () => onCambiar([...ordenados, { id: nuevoId(), h: ultimo ? Math.min(Number(ultimo.h) + 12, 168) : 4, quien: 'setter' }]);
    const primeroTarde = ordenados.findIndex((s) => Number(s.h) >= 24);
    return (
        <div className="em-segs">
            {ordenados.map((s, i) => {
                const linea = i === primeroTarde;
                return (
                    <div key={s.id} className="em-segs-item">
                        {linea && <div className="em-24">se cierra la ventana de 24 h · desde acá solo escribe una persona</div>}
                        <Paso s={s} n={i + 1} puedeAuto={puedeAuto} uso={uso?.[`${claveBase}:${s.id}`]}
                            onCambiar={(x) => cambiar(s.id, x)} onQuitar={() => onCambiar(ordenados.filter((x) => x.id !== s.id))} />
                    </div>
                );
            })}
            {!ordenados.length && <p className="t-cap mut">Sin seguimientos: si el lead no contesta, no pasa nada.</p>}
            <div className="em-segs-pie">
                <Button onClick={agregar} disabled={ordenados.length >= 8}>Agregar seguimiento</Button>
                {ordenados.length > 0 && otras.length > 0 && (
                    <Select size="sm" value="" onChange={(f) => f && onCopiar(f)} label="Copiar a otra fase"
                        options={[{ value: '', label: 'Copiar a…' }, ...otras.map((f) => ({ value: f.id, label: f.nombre }))]} />
                )}
                <span className="t-cap mut em-vars">Variables: {['nombre', ...Object.keys(variables || {})].map((v) => `{${v}}`).join(' ')}</span>
            </div>
        </div>
    );
}
