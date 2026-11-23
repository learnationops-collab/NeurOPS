// La vista de un día: pendientes, victoria, mañana y números. Un día no laborable muestra solo su aviso.
import { Check } from 'lucide-react';
import { Button } from '../../components/standard';
import Pendientes from './Pendientes';
import Victoria from './Victoria';
import Manana from './Manana';
import Numeros from './Numeros';
import { sinMovimiento } from './animar';

const irAPendientes = () => {
    const c = document.getElementById('rp-c-pen');
    c?.scrollIntoView({ behavior: sinMovimiento() ? 'auto' : 'smooth', block: 'start' });
    c?.querySelector('input:placeholder-shown')?.focus({ preventScroll: true });
};

export default function Hoy({ dia, resueltas, editar, cargarResultado, corrigiendo, onCorregir }) {
    const pasado = dia.fecha !== dia.hoy;
    if (dia.no_laborable) {
        return (
            <section className="rp-card ui-panel">
                <div className="rp-listo">
                    <span className="ico"><Check size={24} strokeWidth={3} /></span>
                    <b>Marcaste {pasado ? 'este día' : 'hoy'} como no laborable</b>
                    <p>No vas a figurar como pendiente. Los números que haya se guardan igual.</p>
                    <Button onClick={() => editar({ no_laborable: false }, true)}>Sí trabajé</Button>
                </div>
            </section>
        );
    }
    const p = dia.pendientes || {};
    const hayPend = (p.agendas?.length || 0) + (p.avisos?.length || 0) + (p.mano?.length || 0) + Object.keys(resueltas).length > 0;
    return (
        <>
            {hayPend && <Pendientes pendientes={p} resueltas={resueltas} pasado={pasado} editar={editar} cargarResultado={cargarResultado} />}
            <Victoria victoria={dia.victoria} candidatos={dia.candidatos || []} pasado={pasado} editar={editar} />
            <Manana manana={dia.manana} rol={dia.rol} pasado={pasado} editar={editar} />
            <Numeros numeros={dia.numeros} fecha={dia.fecha} corrigiendo={corrigiendo} onCorregir={onCorregir}
                editar={editar} onIrPendientes={irAPendientes} />
        </>
    );
}
