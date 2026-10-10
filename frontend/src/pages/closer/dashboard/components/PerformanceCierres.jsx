import Card from '../../../../components/ui/Card';
import MetricTip from './MetricTip';
import MatrizCierres, { LeyendaCierres } from '../../../../components/dashboard/MatrizCierres';
import { DESTINOS_CIERRES } from '../../../comercial/components/destinos';

/* Cierre: ventas y señas, por llamada y por presentación.
 *
 * Los mismos números que el panel Cierre del dashboard comercial, con la misma pieza
 * (`MatrizCierres`), el mismo bloque del backend (`current.cierres`) y la misma cabecera: el
 * título a la izquierda y, a la derecha, la leyenda con cuántas ventas (pago completo + split pay)
 * y cuántas señas hay detrás de las tasas. El close rate de verdad es "Ventas"; "Señas" cuenta
 * aparte las reservas que todavía no se completaron.
 *
 * El tooltip del tablero es `MetricTip`: se adapta a la forma `{ titulo, texto }` que espera la
 * matriz. */

const Ayuda = ({ titulo, texto }) => (
    <MetricTip iconOnly title={titulo} note={texto} source="derivado" />
);

const PerformanceCierres = ({ cierres, irA }) => {
    if (!cierres) return null;
    const hayLlamadas = cierres.asistieron > 0;
    return (
        <Card variant="surface" padding="p-6">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-base flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" /> Cierre
                    <MetricTip iconOnly title="Cómo leer esta tarjeta" source="derivado"
                        formula="ventas: pago completo + split pay · señas: señas sin completar"
                        note="El close rate solo cuenta pagos completos y split pay: una seña es una reserva, no una venta. «Señas» cuenta aparte a los leads que dejaron seña y todavía no pagaron. Arriba, la tasa de presentación: de las llamadas con show up, en cuántas se llegó a la oferta. Abajo, las no cerradas: las llamadas con show up que no terminaron ni en venta ni en seña. Las ventas salen del registro financiero y las llamadas de la bandeja." />
                </h3>
                {hayLlamadas && <LeyendaCierres cierres={cierres} />}
            </div>
            {hayLlamadas
                ? <MatrizCierres cierres={cierres} irA={irA} destinos={DESTINOS_CIERRES} Ayuda={Ayuda} />
                : <div className="text-center py-6 text-[11px] text-muted">Ninguna llamada del período tiene todavía un show up cargado.</div>}
        </Card>
    );
};

export default PerformanceCierres;
