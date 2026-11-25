// La herramienta «Broadcast de WhatsApp» (ADR-W229): mandar una plantilla aprobada a los próximos N de un CSV,
// a mano y con el tope del día a la vista. Lo ya mandado se ve con «Historial». Los que responden entran al Inbox.
import { useState } from 'react';
import { ChevronLeft, History } from 'lucide-react';
import { Button } from '../../../components/standard';
import { useBroadcast } from './useBroadcast';
import Mandar from './Mandar';
import Historial from './Historial';
import './broadcast.css';

export default function BroadcastVentana() {
    const datos = useBroadcast();
    const [vista, setVista] = useState('mandar');
    const enHistorial = vista === 'historial';
    return (
        <div className="bw">
            <div className="bw-barra">
                {enHistorial
                    ? <Button variant="ghost" icon={<ChevronLeft />} onClick={() => setVista('mandar')}>Mandar</Button>
                    : <span className="bw-rotulo">Mandar</span>}
                {!enHistorial && <Button icon={<History />} onClick={() => setVista('historial')}>Historial</Button>}
            </div>
            {enHistorial ? <Historial datos={datos} /> : <Mandar datos={datos} />}
        </div>
    );
}
