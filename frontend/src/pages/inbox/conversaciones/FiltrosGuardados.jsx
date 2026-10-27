// Al lado del título: el desplegable de filtros guardados (los predefinidos y los propios de este
// navegador) y el botón para guardar el filtro actual o borrar el propio que está elegido.
import { useState } from 'react';
import { Star, Trash2 } from 'lucide-react';
import { Button, IconButton, InputGroup, Modal, ModalHeader, Select } from '../../../components/standard';
import { filtrar } from './colas';
import { guardarPropios, igual, predefinidos, propios } from './filtros';

function Guardar({ onGuardar, onCerrar }) {
    const [nombre, setNombre] = useState('');
    const enviar = (e) => {
        e.preventDefault();
        if (nombre.trim()) onGuardar(nombre.trim().slice(0, 40));
    };
    return (
        <Modal onClose={onCerrar} className="cv-guardar" labelledBy="cv-guardar-t">
            <ModalHeader icon={<Star size={18} />} title="Guardar filtro" titleId="cv-guardar-t" subtitle="Queda en este navegador" onClose={onCerrar} />
            <form className="cv-guardar-form" onSubmit={enviar}>
                <InputGroup>
                    <label className="sr" htmlFor="cv-guardar-nombre">Nombre</label>
                    <input id="cv-guardar-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Mis ENARM de hoy" autoFocus autoComplete="off" />
                </InputGroup>
                <Button type="submit" variant="primary" disabled={!nombre.trim()}>Guardar</Button>
            </form>
        </Modal>
    );
}

export default function FiltrosGuardados({ lista, filtro, onCambiar, ahora, yo }) {
    const [mios, setMios] = useState(propios);
    const [guardando, setGuardando] = useState(false);
    const todos = [...predefinidos(yo), ...mios];
    const actual = todos.find((g) => igual(g.filtro, filtro));
    const esPropio = actual && mios.some((g) => g.id === actual.id);

    const cambiarMios = (lista_) => { setMios(lista_); guardarPropios(lista_); };
    const guardar = (label) => {
        cambiarMios([...mios, { id: `f${Date.now()}`, label, filtro }]);
        setGuardando(false);
    };

    const options = [
        ...(actual ? [] : [{ value: '', label: 'Filtro personalizado' }]),
        ...todos.map((g) => ({ value: g.id, label: `${g.label} · ${filtrar(lista, { ...g.filtro, ahora }).length}` })),
    ];
    return (
        <>
            <Select label="Filtros guardados" className="cv-guardados" value={actual?.id || ''} options={options}
                onChange={(id) => { const g = todos.find((x) => x.id === id); if (g) onCambiar({ ...g.filtro }); }} />
            {esPropio && (
                <IconButton size="sm" label={`Borrar el filtro «${actual.label}»`} data-tip="Borrar este filtro guardado" icon={<Trash2 size={14} />}
                    onClick={() => cambiarMios(mios.filter((g) => g.id !== actual.id))} />
            )}
            {!actual && (
                <IconButton size="sm" label="Guardar el filtro actual" data-tip="Guardar el filtro actual" icon={<Star size={14} />} onClick={() => setGuardando(true)} />
            )}
            {guardando && <Guardar onGuardar={guardar} onCerrar={() => setGuardando(false)} />}
        </>
    );
}
