// El broadcast de un taller (ADR-W259): se abre desde Planificar › Próximos talleres con `abrirVentana('broadcast-taller',
// { tallerId })`. Audiencia (quiénes y a cuántos), Flujo (los recordatorios programados y sus ramas), Plantillas
// (las de Meta, las mismas de la herramienta «Broadcast de WhatsApp») e Historial (lo que salió en cada paso).
import { useState } from 'react';
import { ChevronLeft, Plus } from 'lucide-react';
import { Button, Chip, EmptyState, Segmented } from '../../../components/standard';
import { useBroadcast } from '../broadcastWa/useBroadcast';
import Plantillas from '../broadcastWa/Plantillas';
import PlantillaNueva from '../broadcastWa/PlantillaNueva';
import Audiencia from './Audiencia';
import Flujo from './Flujo';
import Historial from './Historial';
import { fechaCorta, useBroadcastTaller } from './useBroadcastTaller';
import '../broadcastWa/broadcast.css';
import './broadcastTaller.css';

const PESTANAS = [
    { value: 'audiencia', label: 'Audiencia' },
    { value: 'flujo', label: 'Flujo' },
    { value: 'plantillas', label: 'Plantillas' },
    { value: 'historial', label: 'Historial' },
];

function PestanaPlantillas({ wa }) {
    const [nueva, setNueva] = useState(null);
    if (nueva) {
        return (
            <div className="bt-col">
                <Button variant="ghost" icon={<ChevronLeft />} onClick={() => setNueva(null)}>Plantillas</Button>
                <PlantillaNueva key={nueva.base?.name || 'nueva'} base={nueva.base} datos={wa} onLista={() => setNueva(null)} />
            </div>
        );
    }
    return (
        <div className="bt-col">
            <div className="bt-fila bt-fila--entre">
                <span className="bt-s">Las de la cuenta de Meta, con su estado. Un paso solo puede usar una aprobada.</span>
                <Button variant="primary" icon={<Plus />} onClick={() => setNueva({ base: null })}>Nueva plantilla</Button>
            </div>
            <Plantillas datos={wa} onDuplicar={(base) => setNueva({ base })} />
        </div>
    );
}

export default function BroadcastTallerVentana({ item }) {
    const tallerId = item?.tallerId;
    const datos = useBroadcastTaller(tallerId);
    const wa = useBroadcast();
    const [pestana, setPestana] = useState('audiencia');
    const { plan } = datos;
    if (!tallerId) return <EmptyState title="Elegí un taller">Abrí el broadcast desde Planificar › Próximos talleres.</EmptyState>;
    if (!plan) return <EmptyState title={datos.error || 'Cargando el broadcast del taller…'} />;
    const programados = plan.pasos.filter((p) => p.estado === 'programado').length;
    return (
        <div className="bt">
            <div className="bt-cab">
                <span className="bt-cab-t">
                    <b>{plan.taller.nombre}</b>
                    <small className="bt-s">{plan.taller.inicio_at ? fechaCorta(plan.taller.inicio_at) : 'Sin hora cargada'} · audiencia «{plan.etiqueta}»</small>
                </span>
                <span className="bt-fila">
                    <Chip subtle color="#25D366">{plan.audiencia.se_puede} para mandar</Chip>
                    <Chip subtle color="var(--ln-info, #3b7dd8)">{programados} de {plan.pasos.length} programados</Chip>
                </span>
            </div>
            <Segmented size="sm" label="Sección" value={pestana} onChange={setPestana} options={PESTANAS} />
            {pestana === 'audiencia' && <Audiencia key={plan.id} datos={datos} tallerId={tallerId} />}
            {pestana === 'flujo' && <Flujo key={plan.id} datos={datos} wa={wa} />}
            {pestana === 'plantillas' && <PestanaPlantillas wa={wa} />}
            {pestana === 'historial' && <Historial datos={datos} />}
        </div>
    );
}
