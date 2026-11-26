// Las plantillas de la cuenta de Meta con su estado, cómo le llegan a la persona y qué pasa al tocar cada botón.
// Editar una aprobada la vuelve a revisión: en su lugar, «Duplicar» abre el formulario con su texto.
import { useState } from 'react';
import { Copy } from 'lucide-react';
import { Button, Chip, ConfirmDelete, EmptyState, Segmented, toast } from '../../../components/standard';
import { partesDe } from './useBroadcast';
import { Vista } from './Mandar';
import Respuestas from './Respuestas';

export const ESTADOS_META = {
    APPROVED: { label: 'Aprobada', color: 'var(--ln-success, #1f9d6b)' },
    PENDING: { label: 'En revisión', color: 'var(--ln-warning, #c98a14)' },
    REJECTED: { label: 'Rechazada', color: 'var(--ln-error, #c8433a)' },
    PAUSED: { label: 'Pausada', color: 'var(--ln-text-faint, #8a8ea0)' },
    DISABLED: { label: 'Desactivada', color: 'var(--ln-text-faint, #8a8ea0)' },
};
const estadoDe = (p) => ESTADOS_META[p.status] || { label: p.status, color: 'var(--ln-text-faint, #8a8ea0)' };
const CATEGORIA = { MARKETING: 'Marketing', UTILITY: 'Utilidad', AUTHENTICATION: 'Autenticación' };

const FILTROS = [
    { value: 'todas', label: 'Todas', cumple: () => true },
    { value: 'APPROVED', label: 'Aprobadas', cumple: (p) => p.status === 'APPROVED' },
    { value: 'PENDING', label: 'En revisión', cumple: (p) => p.status === 'PENDING' },
    { value: 'REJECTED', label: 'Rechazadas', cumple: (p) => p.status === 'REJECTED' },
];

function Fila({ p, elegida, onElegir }) {
    const { cuerpo } = partesDe(p);
    const estado = estadoDe(p);
    return (
        <button type="button" className={`bw-lote${elegida ? ' bw-lote--on' : ''}`} onClick={onElegir}>
            <span className="bw-lote-top">
                <b>{p.name}</b>
                <Chip subtle color={estado.color}>{estado.label}</Chip>
                <span className="bw-s bw-pl-cat">{CATEGORIA[p.category] || p.category} · {p.language}</span>
            </span>
            {p.status === 'REJECTED' && p.rejected_reason && p.rejected_reason !== 'NONE'
                ? <span className="bw-pl-motivo">Meta: {p.rejected_reason}</span>
                : <span className="bw-pl-txt">{cuerpo.replace(/\s+/g, ' ')}</span>}
        </button>
    );
}

function Detalle({ p, datos, onDuplicar, onBorrada }) {
    const [borrando, setBorrando] = useState(false);
    const { botones } = partesDe(p);
    const borrar = () => datos.borrarPlantilla(p.name)
        .then(() => { toast(`${p.name} borrada`); onBorrada(); })
        .catch((e) => toast(datos.mensaje(e, 'No se pudo borrar'), 'error'))
        .finally(() => setBorrando(false));
    return (
        <div className="bw-cuerpo">
            <div>
                <span className="bw-rotulo">Así le llega · {p.name}</span>
                <Vista plantilla={p} />
            </div>
            {botones.length > 0 && <Respuestas key={p.name} nombre={p.name} botones={botones} datos={datos} />}
            {borrando ? (
                <ConfirmDelete name={p.name} article="la plantilla " onCancel={() => setBorrando(false)} onConfirm={borrar}
                    detail="Se borra en Meta. Ese nombre no se puede volver a usar por 30 días." />
            ) : (
                <div className="bw-envio">
                    <span className="bw-ayuda bw-pl-ayuda">Meta suele revisar en minutos; a veces tarda hasta 24 h.</span>
                    <Button icon={<Copy />} onClick={() => onDuplicar(p)}>Duplicar</Button>
                    <Button variant="danger" onClick={() => setBorrando(true)}>Borrar</Button>
                </div>
            )}
        </div>
    );
}

export default function Plantillas({ datos, onDuplicar }) {
    const { todas } = datos;
    const [filtro, setFiltro] = useState('todas');
    const [elegida, setElegida] = useState(null);
    if (todas == null) return <EmptyState title="Trayendo las plantillas de Meta…" />;
    if (!todas.length) return <EmptyState title="Sin plantillas">{datos.error || 'Todavía no hay plantillas en la cuenta.'}</EmptyState>;
    const cumple = FILTROS.find((f) => f.value === filtro).cumple;
    const lista = todas.filter(cumple);
    const actual = todas.find((p) => p.name === elegida) || lista[0];
    return (
        <div className="bw-cuerpo">
            <Segmented size="sm" label="Estado" value={filtro} onChange={setFiltro}
                options={FILTROS.map((f) => ({ value: f.value, label: f.label, count: todas.filter(f.cumple).length }))} />
            <div className="bw-cuerpo bw-pl-lista">
                {lista.map((p) => <Fila key={`${p.name}|${p.language}`} p={p} elegida={actual?.name === p.name} onElegir={() => setElegida(p.name)} />)}
                {!lista.length && <span className="bw-s">Ninguna en este estado.</span>}
            </div>
            {actual && lista.includes(actual) && (
                <Detalle p={actual} datos={datos} onDuplicar={onDuplicar} onBorrada={() => setElegida(null)} />
            )}
        </div>
    );
}
