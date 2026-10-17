// Crear un flujo: el nombre y desde qué arranca (cero o una plantilla). Crea y abre el lienzo.
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, FieldError, Input, Modal, ModalHeader, Select } from '../../../components/standard';
import { inboxApi } from '../api';
import { PLANTILLAS } from './estructuras';

const OPCIONES = [{ value: '', label: 'Desde cero' }, ...PLANTILLAS.map((p) => ({ value: p.id, label: p.nombre }))];

export default function NuevoFlujo({ plantillaInicial = '', onCreado, onCerrar }) {
    const [nombre, setNombre] = useState('');
    const [plantilla, setPlantilla] = useState(plantillaInicial);
    const [error, setError] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const elegida = PLANTILLAS.find((p) => p.id === plantilla);

    const crear = async (e) => {
        e.preventDefault();
        if (!nombre.trim()) { setError('Escribí un nombre.'); return; }
        setOcupado(true);
        try {
            onCreado(await inboxApi.crearFlujo(nombre.trim(), elegida ? structuredClone(elegida.grafo) : undefined));
        } catch (err) {
            setError(err.response?.data?.message || 'No se pudo crear');
            setOcupado(false);
        }
    };

    return (
        <Modal onClose={onCerrar} className="fl-nuevo" labelledBy="fl-nuevo-t">
            <ModalHeader titleId="fl-nuevo-t" title="Nuevo flujo" icon={<Plus />}
                subtitle={elegida ? `${elegida.detalle}. El texto es de ejemplo: cambialo antes de publicar.` : 'Arranca con un mensaje de bienvenida.'} onClose={onCerrar} />
            <form className="fl-nuevo-form" noValidate onSubmit={crear}>
                <label className="pf-campo">
                    <span className="t-cap mut">Nombre</span>
                    <Input value={nombre} maxLength={150} autoFocus autoComplete="off" placeholder="Ej. Obtener guía" invalid={!!error}
                        aria-describedby={error ? 'fl-nuevo-err' : undefined} onChange={(e) => { setNombre(e.target.value); setError(null); }} />
                </label>
                {error && <FieldError id="fl-nuevo-err">{error}</FieldError>}
                <div className="pf-campo">
                    <span className="t-cap mut">Empezar</span>
                    <Select label="Empezar desde" value={plantilla} options={OPCIONES} onChange={setPlantilla} />
                </div>
                <div className="barra">
                    <div className="barra-der">
                        <Button onClick={onCerrar}>Cancelar</Button>
                        <Button variant="primary" type="submit" icon={<Plus />} disabled={ocupado}>Crear y abrir</Button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
