// Por dónde entró el lead, arriba del nombre (Mario, 26/11/2026): el ícono del canal (anuncio, inbound, bienvenida;
// tocarlo lo cambia, lo usa el reporte) y la palabra clave con que escribió. Si no la tiene, el setter la carga
// (queda en la variable `palabra_clave`).
import { useState } from 'react';
import { Check, Hand, Inbox, Megaphone, Pencil, Plus, Radio } from 'lucide-react';
import useEnPantalla from '../../../components/ui/useEnPantalla';
import { toast } from '../../../components/standard';
import { inboxApi } from '../api';
import useDesplegable from './useDesplegable';

const CANALES = [
    ['anuncios', 'Anuncio', Megaphone, 'var(--brand-secondary)'],
    ['inbound', 'Inbound', Inbox, 'var(--info)'],
    ['bienvenida', 'Bienvenida', Hand, 'var(--success)'],
];

function Canal({ contacto, canal, campana, onCambio }) {
    const d = useDesplegable();
    const pop = useEnPantalla();
    const actual = CANALES.find(([v]) => v === canal);
    const [, rotulo, Icono, color] = actual || [null, 'Sin canal', Radio, 'var(--text-muted)'];
    const elegir = async (c) => {
        d.setAbierto(false);
        try {
            await inboxApi.marcarCanal(contacto.id, c);
            onCambio();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo cambiar el canal', 'error');
        }
    };
    return (
        <div className="cv-tarjeta-pop-caja" ref={d.caja}>
            <button type="button" className="cv-origen-canal" style={{ '--c': color }} aria-expanded={d.abierto} aria-label={`Canal: ${rotulo}`}
                data-tip={`${rotulo}|${campana ? `Campaña ${campana}. ` : ''}Tocalo para cambiar el canal (lo usa el reporte)`} onClick={() => d.setAbierto((a) => !a)}>
                <Icono size={13} aria-hidden="true" />
            </button>
            {d.abierto && (
                <div className="cv-tarjeta-pop" ref={pop} role="menu" aria-label="Canal">
                    <span className="t-rotulo">Canal (para el reporte)</span>
                    {CANALES.map(([v, l, I, c]) => (
                        <button key={v} type="button" className="cv-tarjeta-op" role="menuitemradio" aria-checked={v === canal} onClick={() => elegir(v)}>
                            <I size={13} style={{ color: c }} aria-hidden="true" />{l}{v === canal && <Check size={13} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function Clave({ contacto, entrada, onCambio }) {
    const cargada = contacto.variables?.palabra_clave;
    const clave = entrada?.clave || cargada;
    const [editando, setEditando] = useState(false);
    const [valor, setValor] = useState('');
    const guardar = async (e) => {
        e.preventDefault();
        try {
            await inboxApi.corregirVariable(contacto.id, 'palabra_clave', valor.trim());
            setEditando(false);
            onCambio();
        } catch (err) {
            toast(err.response?.data?.message || 'No se pudo guardar', 'error');
        }
    };
    if (editando) {
        return (
            <form className="cv-origen-form" onSubmit={guardar}>
                <input autoFocus value={valor} maxLength={60} placeholder="Palabra clave" aria-label="Palabra clave"
                    onChange={(e) => setValor(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setEditando(false)} />
                <button type="submit" aria-label="Guardar" disabled={!valor.trim()}><Check size={13} /></button>
            </form>
        );
    }
    if (!clave) {
        return (
            <button type="button" className="cv-origen-config" onClick={() => { setValor(''); setEditando(true); }}
                data-tip="Configurar palabra clave|No entró por una palabra clave: cargá con cuál escribió">
                <Plus size={12} aria-hidden="true" />Clave
            </button>
        );
    }
    const tip = entrada?.clave
        ? `Palabra clave|Entró escribiendo «${entrada.clave}»${entrada.campana ? ` · ${entrada.campana}` : ''}`
        : 'Palabra clave|Cargada a mano. Tocala para cambiarla';
    return (
        <button type="button" className="cv-origen-clave" data-tip={tip} disabled={Boolean(entrada?.clave)}
            onClick={() => { setValor(cargada || ''); setEditando(true); }}>
            <span className="cv-elipsis">{clave}</span>
            {!entrada?.clave && <Pencil size={10} aria-hidden="true" />}
        </button>
    );
}

// `children`: lo que va a la derecha de la fila (la espera, la ventana y «No requiere», ADR-W250).
export default function Origen({ contacto, entrada, canal, campana, onCambio, children }) {
    return (
        <div className="cv-origen">
            <Canal contacto={contacto} canal={canal} campana={entrada?.campana || campana} onCambio={onCambio} />
            <Clave contacto={contacto} entrada={entrada} onCambio={onCambio} />
            {children && <span className="cv-origen-der">{children}</span>}
        </div>
    );
}
