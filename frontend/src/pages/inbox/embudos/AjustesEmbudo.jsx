// Crear o ajustar un embudo (ADR-W204): nombre, para qué es, sus fases (Conversión tiene las del setting, fijas)
// y las variables que completan los seguimientos automáticos ({workshop_fecha}, {workshop_link}…).
import { useState } from 'react';
import { ArrowDown, ArrowUp, Filter, Trash2 } from 'lucide-react';
import { Button, IconButton, Input, LinkButton, Modal, ModalHeader, Select, TextArea, toast } from '../../../components/standard';
import { inboxApi } from '../api';
import { TRAMOS_EMBUDO } from './useEmbudos';

const TRAMOS = Object.entries(TRAMOS_EMBUDO).map(([value, t]) => ({ value, label: t.nombre }));

function Fases({ fases, onCambiar }) {
    const set = (i, x) => onCambiar(fases.map((f, k) => (k === i ? { ...f, ...x } : f)));
    const mover = (i, d) => {
        const j = i + d;
        if (j < 0 || j >= fases.length) return;
        const l = [...fases];
        [l[i], l[j]] = [l[j], l[i]];
        onCambiar(l);
    };
    return (
        <div className="gu-campo">
            <h3>Fases</h3>
            {fases.map((f, i) => (
                <div key={f.id || `n${i}`} className="em-aj-fase">
                    <span className="em-seg-n">{i + 1}</span>
                    <Input value={f.nombre} onChange={(e) => set(i, { nombre: e.target.value })} maxLength={40} aria-label="Nombre de la fase" />
                    <Select size="sm" value={f.tramo} onChange={(t) => set(i, { tramo: t })} options={TRAMOS} label="Quién la lleva" />
                    <IconButton size="xs" label="Subir" icon={<ArrowUp size={13} />} onClick={() => mover(i, -1)} disabled={i === 0} />
                    <IconButton size="xs" label="Bajar" icon={<ArrowDown size={13} />} onClick={() => mover(i, 1)} disabled={i === fases.length - 1} />
                    <IconButton size="xs" label="Quitar la fase" icon={<Trash2 size={13} />} onClick={() => onCambiar(fases.filter((_, k) => k !== i))} disabled={fases.length < 2} />
                </div>
            ))}
            <LinkButton onClick={() => onCambiar([...fases, { nombre: '', tramo: 'manual' }])}>Agregar fase</LinkButton>
            <p className="t-cap mut">Automática: la arranca un flujo del bot. Manual: escribe el setter. Agendamiento: el link y la llamada.
                No lead e In-abrible valen en todos los embudos.</p>
        </div>
    );
}

function Variables({ filas, onCambiar }) {
    const set = onCambiar;
    return (
        <div className="gu-campo">
            <h3>Variables de los seguimientos</h3>
            {filas.map(([k, v], i) => (
                <div key={i} className="em-aj-var">
                    <Input value={k} onChange={(e) => set(filas.map((f, j) => (j === i ? [e.target.value, f[1]] : f)))} placeholder="workshop_fecha" aria-label="Nombre de la variable" />
                    <Input value={v} onChange={(e) => set(filas.map((f, j) => (j === i ? [f[0], e.target.value] : f)))} placeholder="jueves 27/11, 20:00" aria-label="Valor" />
                    <IconButton size="xs" label="Quitar la variable" icon={<Trash2 size={13} />} onClick={() => set(filas.filter((_, j) => j !== i))} />
                </div>
            ))}
            <LinkButton onClick={() => set([...filas, ['', '']])}>Agregar variable</LinkButton>
            <p className="t-cap mut">En el texto o el link de un seguimiento automático, <b>{'{workshop_link}'}</b> se reemplaza por su valor.
                Cambiar la fecha o el link del próximo workshop es cambiarlo acá, sin tocar los mensajes.</p>
        </div>
    );
}

export default function AjustesEmbudo({ embudo, onCerrar, onGuardado }) {
    const nuevo = !embudo;
    const [nombre, setNombre] = useState(embudo?.nombre || '');
    const [descripcion, setDescripcion] = useState(embudo?.descripcion || '');
    const [fases, setFases] = useState(() => (embudo?.fases?.length ? embudo.fases : [{ nombre: 'Entrega', tramo: 'auto' }, { nombre: 'Puente', tramo: 'manual' }]));
    const [variables, setVariables] = useState(() => Object.entries(embudo?.variables || {}));
    const [guardando, setGuardando] = useState(false);
    const guardar = async () => {
        setGuardando(true);
        try {
            const vars = Object.fromEntries(variables.filter(([k]) => k.trim()));
            const cuerpo = { nombre, descripcion, variables: vars, ...(embudo?.conversion ? {} : { fases }) };
            const r = nuevo ? await inboxApi.crearEmbudo(cuerpo) : await inboxApi.guardarEmbudo(embudo.id, cuerpo);
            toast(nuevo ? `Embudo ${r.nombre} creado` : 'Embudo guardado');
            onGuardado(r);
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo guardar', 'error');
            setGuardando(false);
        }
    };
    return (
        <Modal onClose={onCerrar} className="gu-modal gu-modal--ancho" labelledBy="em-aj-t">
            <ModalHeader icon={<Filter size={18} />} titleId="em-aj-t" title={nuevo ? 'Nuevo embudo' : `Ajustes · ${embudo.nombre}`}
                subtitle={nuevo ? 'Por ejemplo, un lead magnet: entrega, consumo y el puente a Conversión.' : null} onClose={onCerrar} />
            <div className="gu-modal-cuerpo">
                <div className="gu-campo"><h3>Nombre</h3><Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} aria-label="Nombre del embudo" /></div>
                <div className="gu-campo"><h3>Para qué es</h3><TextArea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={400} aria-label="Descripción" /></div>
                {embudo?.conversion
                    ? <p className="t-cap mut">Las fases de Conversión son las del setting y alimentan el reporte del setter: cambiarlas se propone.</p>
                    : <Fases fases={fases} onCambiar={setFases} />}
                <Variables filas={variables} onCambiar={setVariables} />
                <div className="gu-modal-pie">
                    <Button onClick={onCerrar}>Cancelar</Button>
                    <Button variant="primary" onClick={guardar} disabled={guardando || !nombre.trim()}>{nuevo ? 'Crear embudo' : 'Guardar'}</Button>
                </div>
            </div>
        </Modal>
    );
}
