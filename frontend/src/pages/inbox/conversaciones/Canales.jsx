// Instagram y WhatsApp separados a la vista, y WhatsApp por broadcast (ADR-W259): cada respuesta de un broadcast
// trae `broadcast` (la etiqueta del taller, p. ej. «WS 26/11», o «Broadcast» si salió a mano).
import { Segmented, Select } from '../../../components/standard';
import { esWhatsapp } from './colas';

export default function Canales({ lista, filtro, onCambiar }) {
    const wa = lista.filter(esWhatsapp);
    const broadcasts = Object.entries(wa.reduce((m, c) => (c.broadcast ? { ...m, [c.broadcast]: (m[c.broadcast] || 0) + 1 } : m), {}))
        .sort((a, b) => b[1] - a[1]);
    return (
        <div className="cv-canales">
            <Segmented size="sm" label="Canal" value={filtro.canal || 'todos'}
                onChange={(v) => onCambiar({ ...filtro, canal: v === 'todos' ? null : v, broadcast: v === 'wa' ? filtro.broadcast : null })}
                options={[
                    { value: 'todos', label: 'Todos', count: lista.length },
                    { value: 'ig', label: 'Instagram', count: lista.length - wa.length },
                    { value: 'wa', label: 'WhatsApp', count: wa.length },
                ]} />
            {filtro.canal === 'wa' && broadcasts.length > 0 && (
                <Select size="sm" label="Broadcast" value={filtro.broadcast || ''}
                    onChange={(v) => onCambiar({ ...filtro, broadcast: v || null })}
                    options={[{ value: '', label: 'Todos los broadcasts' }, ...broadcasts.map(([b, n]) => ({ value: b, label: `${b} · ${n}` }))]} />
            )}
        </div>
    );
}
