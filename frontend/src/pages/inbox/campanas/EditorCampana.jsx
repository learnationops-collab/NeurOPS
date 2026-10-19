// Crear o editar una campaña: nombre, embudo, pago u orgánica, vigencia, flujo, palabras clave y las
// campañas de Meta de donde sale su gasto. El servidor rechaza una palabra que ya está en otra campaña
// con fechas que se pisan, y ese mensaje se muestra tal cual.
import { useState } from 'react';
import { Megaphone, Plus, Trash2, X } from 'lucide-react';
import {
    Button, Chip, ConfirmDelete, FieldError, IconButton, Input, InputGroup, Modal, ModalHeader, Segmented, Select,
} from '../../../components/standard';
import { inboxApi } from '../api';
import { Campo } from '../editor/paneles';
import { EMBUDOS, TIPOS, cuerpo, errorDe, formulario, sumarPalabra } from './campana';

function Quitable({ children, label, onQuitar, lectura }) {
    return (
        <Chip className="cp-chip">
            {children}
            {!lectura && <IconButton label={label} icon={<X />} size="xs" onClick={onQuitar} />}
        </Chip>
    );
}

export default function EditorCampana({ campana, flujos, campanasMeta, lectura, onGuardada, onBorrada, onCerrar }) {
    const [f, setF] = useState(() => formulario(campana));
    const [palabra, setPalabra] = useState('');
    const [error, setError] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const [borrando, setBorrando] = useState(false);
    const cambiar = (cambio) => { setF((x) => ({ ...x, ...cambio })); setError(null); };

    const sumar = () => {
        cambiar({ palabras: sumarPalabra(f.palabras, palabra) });
        setPalabra('');
    };
    const guardar = async (e) => {
        e.preventDefault();
        if (lectura) return;
        const problema = errorDe(f);
        if (problema) { setError(problema); return; }
        setOcupado(true);
        try {
            const datos = cuerpo(f);
            onGuardada(campana ? await inboxApi.guardarCampana(campana.id, datos) : await inboxApi.crearCampana(datos));
        } catch (err) {
            setError(err.response?.data?.message || 'No se pudo guardar');
            setOcupado(false);
        }
    };
    const borrar = async () => {
        try {
            await inboxApi.borrarCampana(campana.id);
            onBorrada(campana);
        } catch (err) {
            setBorrando(false);
            setError(err.response?.data?.message || 'No se pudo eliminar');
        }
    };

    const nombreMeta = (id) => campanasMeta.find((m) => m.id === id)?.nombre || id;
    const metaLibres = campanasMeta.filter((m) => !f.campanas_meta.includes(m.id))
        .map((m) => ({ value: m.id, label: `${m.nombre || m.id}${m.activa ? '' : ' (sin anuncios activos)'}` }));
    const opcionesFlujo = [{ value: '', label: 'Sin flujo (no responde)' },
        ...flujos.map((fl) => ({ value: String(fl.id), label: `${fl.nombre}${fl.estado === 'activo' ? '' : ` (${fl.estado})`}` }))];

    return (
        <Modal onClose={onCerrar} className="cp-editor" labelledBy="cp-editor-t">
            <ModalHeader titleId="cp-editor-t" icon={<Megaphone />} onClose={onCerrar}
                title={campana ? campana.nombre : 'Nueva campaña'}
                subtitle="Sus palabras clave llevan al flujo mientras esté vigente." />
            <form className="cp-form" noValidate onSubmit={guardar}>
                <Campo label="Nombre">
                    <Input value={f.nombre} maxLength={150} autoFocus={!campana} disabled={lectura} autoComplete="off"
                        placeholder="Ej. Guía MIR octubre" aria-label="Nombre" onChange={(e) => cambiar({ nombre: e.target.value })} />
                </Campo>
                <div className="cp-fila">
                    <Campo label="Embudo">
                        <Select label="Embudo" value={f.embudo} options={EMBUDOS} disabled={lectura} onChange={(v) => cambiar({ embudo: v })} />
                    </Campo>
                    <Campo label="Tipo">
                        <Segmented size="sm" label="Tipo" value={f.tipo} options={TIPOS} itemProps={{ disabled: lectura }} onChange={(v) => cambiar({ tipo: v })} />
                    </Campo>
                </div>
                <div className="cp-fila">
                    <Campo label="Primer día">
                        <Input variant="date" type="date" value={f.desde} disabled={lectura} aria-label="Primer día"
                            onChange={(e) => cambiar({ desde: e.target.value })} />
                    </Campo>
                    <Campo label="Último día" ayuda="Vacío: sigue hasta que la termines.">
                        <Input variant="date" type="date" value={f.hasta} min={f.desde} disabled={lectura} aria-label="Último día"
                            onChange={(e) => cambiar({ hasta: e.target.value })} />
                    </Campo>
                </div>
                <Campo label="Flujo" ayuda="Varias campañas pueden usar el mismo flujo.">
                    <Select label="Flujo" value={String(f.flujo_id)} options={opcionesFlujo} disabled={lectura}
                        onChange={(v) => cambiar({ flujo_id: v })} />
                </Campo>
                <Campo label="Palabras clave" ayuda="El mensaje del lead tiene que ser exactamente la palabra (sin importar tildes ni mayúsculas).">
                    {!lectura && (
                        <InputGroup>
                            <input value={palabra} maxLength={100} placeholder="Escribí una palabra y Enter" aria-label="Nueva palabra clave"
                                onChange={(e) => setPalabra(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); sumar(); } }} />
                            <Button size="sm" icon={<Plus />} onClick={sumar} disabled={!palabra.trim()}>Agregar</Button>
                        </InputGroup>
                    )}
                    <div className="cp-chips">
                        {f.palabras.map((p) => (
                            <Quitable key={p} label={`Quitar ${p}`} lectura={lectura}
                                onQuitar={() => cambiar({ palabras: f.palabras.filter((x) => x !== p) })}>{p}</Quitable>
                        ))}
                    </div>
                </Campo>
                <Campo label="Campañas de Meta" ayuda="De acá sale su gasto. Puede ser ninguna (orgánica) o varias.">
                    {!lectura && metaLibres.length > 0 && (
                        <Select label="Sumar campaña de Meta" value="" options={[{ value: '', label: 'Sumar una campaña de Meta…' }, ...metaLibres]}
                            onChange={(v) => v && cambiar({ campanas_meta: [...f.campanas_meta, v] })} />
                    )}
                    <div className="cp-chips">
                        {f.campanas_meta.map((id) => (
                            <Quitable key={id} label={`Quitar ${nombreMeta(id)}`} lectura={lectura}
                                onQuitar={() => cambiar({ campanas_meta: f.campanas_meta.filter((x) => x !== id) })}>{nombreMeta(id)}</Quitable>
                        ))}
                    </div>
                </Campo>
                {error && <FieldError>{error}</FieldError>}
                {borrando ? (
                    <ConfirmDelete name={campana.nombre} article="la campaña " detail="Solo se puede si nadie entró por ella."
                        icon={<Trash2 />} onCancel={() => setBorrando(false)} onConfirm={borrar} />
                ) : (
                    <div className="barra">
                        {campana && !lectura && <Button variant="danger" icon={<Trash2 />} onClick={() => setBorrando(true)}>Eliminar</Button>}
                        <div className="barra-der">
                            <Button onClick={onCerrar}>{lectura ? 'Cerrar' : 'Cancelar'}</Button>
                            {!lectura && <Button variant="primary" type="submit" disabled={ocupado}>{campana ? 'Guardar' : 'Crear campaña'}</Button>}
                        </div>
                    </div>
                )}
            </form>
        </Modal>
    );
}
