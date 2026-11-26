// La herramienta «Broadcast de WhatsApp» (ADR-W229): mandar una plantilla aprobada a los próximos N de un CSV,
// a mano y con el tope del día a la vista. Lo ya mandado se ve con «Historial»; las plantillas de Meta, su estado
// y qué pasa al tocar cada botón, con «Plantillas». Los que responden entran al Inbox.
import { useState } from 'react';
import { ChevronLeft, FileText, History, Plus } from 'lucide-react';
import { Button } from '../../../components/standard';
import { useBroadcast } from './useBroadcast';
import Mandar from './Mandar';
import Historial from './Historial';
import Plantillas from './Plantillas';
import PlantillaNueva from './PlantillaNueva';
import './broadcast.css';

const ROTULOS = { mandar: 'Mandar', historial: 'Historial', plantillas: 'Plantillas', nueva: 'Nueva plantilla' };

export default function BroadcastVentana() {
    const datos = useBroadcast();
    const [vista, setVista] = useState('mandar');
    const [base, setBase] = useState(null);
    const nueva = (p = null) => { setBase(p); setVista('nueva'); };
    const volver = vista === 'nueva' ? 'plantillas' : 'mandar';
    return (
        <div className="bw">
            <div className="bw-barra">
                {vista === 'mandar'
                    ? <span className="bw-rotulo">Mandar</span>
                    : <Button variant="ghost" icon={<ChevronLeft />} onClick={() => setVista(volver)}>{ROTULOS[volver]}</Button>}
                <span className="bw-fila">
                    {vista === 'mandar' && <Button icon={<FileText />} onClick={() => setVista('plantillas')}>Plantillas</Button>}
                    {vista === 'mandar' && <Button icon={<History />} onClick={() => setVista('historial')}>Historial</Button>}
                    {vista === 'plantillas' && <Button variant="primary" icon={<Plus />} onClick={() => nueva()}>Nueva plantilla</Button>}
                    {vista === 'nueva' && <span className="bw-rotulo">Nueva plantilla</span>}
                </span>
            </div>
            {vista === 'historial' && <Historial datos={datos} />}
            {vista === 'plantillas' && <Plantillas datos={datos} onDuplicar={nueva} />}
            {vista === 'nueva' && <PlantillaNueva key={base?.name || 'nueva'} base={base} datos={datos} onLista={() => setVista('plantillas')} />}
            {vista === 'mandar' && <Mandar datos={datos} />}
        </div>
    );
}
