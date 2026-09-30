import Card from '../../../../components/ui/Card';
import MetricTip from './MetricTip';
import MatrizCierres from '../../../../components/dashboard/MatrizCierres';
import { DESTINOS_CIERRES } from '../../../comercial/components/destinos';

/* Cierres con y sin señas, por llamada y por presentación.
 *
 * Los mismos cuatro números que el panel Cierre del dashboard comercial, con la misma pieza
 * (`MatrizCierres`) y el mismo bloque del backend (`current.cierres`). El close rate de verdad es
 * la fila "sin señas"; la de "con señas" existe para ver cuánto de lo que parece un cierre es
 * todavía una reserva.
 *
 * El tooltip del tablero es `MetricTip`: se adapta a la forma `{ titulo, texto }` que espera la
 * matriz. */

const Ayuda = ({ titulo, texto }) => (
    <MetricTip iconOnly title={titulo} note={texto} source="derivado" />
);

const PerformanceCierres = ({ cierres, irA }) => {
    if (!cierres) return null;
    return (
        <Card variant="surface" padding="p-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-base flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-primary" /> Cierres con y sin señas
                <MetricTip iconOnly title="Cómo leer esta tarjeta" source="derivado"
                    formula="sin señas: pago completo + split pay · con señas: + señas sin completar"
                    note="El close rate solo cuenta pagos completos y split pay: una seña es una reserva, no una venta. La fila con señas suma a los leads que dejaron seña y todavía no pagaron, para ver el compromiso de compra completo. Las ventas salen del registro financiero y las llamadas de la bandeja." />
            </h3>
            {cierres.asistieron > 0
                ? <MatrizCierres cierres={cierres} irA={irA} destinos={DESTINOS_CIERRES} Ayuda={Ayuda} />
                : <div className="text-center py-6 text-[11px] text-muted">Ninguna llamada del período tiene todavía un show up cargado.</div>}
        </Card>
    );
};

export default PerformanceCierres;
