// El flujo de recordatorios del taller (ADR-W262): a la izquierda el lienzo (cada paso es una fila y lo que sale de
// sus botones crece hacia la derecha) y a la derecha el panel del nodo tocado. Los pasos se editan en borrador y
// «Programar» los deja en manos del reloj del motor; las respuestas a los botones se guardan solas en la plantilla.
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Pause, Plus, Save, Star } from 'lucide-react';
import { Button, EmptyState, toast } from '../../../components/standard';
import { partesDe } from '../broadcastWa/useBroadcast';
import Lienzo from './Lienzo';
import PanelNodo from './PanelNodo';
import { mensajeDe, pasoNuevo } from './useBroadcastTaller';

const limpio = (p) => ({ ...p, excluir: (p.excluir || []).map((x) => x.trim()).filter(Boolean) });

/** Las respuestas de cada plantilla del flujo ({respuestas, config, asignables}), pedidas una vez y puestas al día. */
function useReglas(nombres, plantillas, wa) {
    const [reglas, setReglas] = useState({});
    useEffect(() => {
        nombres.filter((n) => !(n in reglas) && plantillas.some((p) => p.name === n && partesDe(p).botones.length))
            .forEach((n) => wa.respuestas(n).then((r) => setReglas((x) => ({ ...x, [n]: r }))).catch(() => {}));
    }, [nombres, plantillas]); // eslint-disable-line react-hooks/exhaustive-deps
    const guardada = (n, regla) => setReglas((x) => ({
        ...x, [n]: { ...x[n], respuestas: [...(x[n]?.respuestas || []).filter((r) => r.boton !== regla.boton), regla] },
    }));
    const config = (n, c) => setReglas((x) => ({ ...x, [n]: { ...x[n], config: c } }));
    return { reglas, guardada, config };
}

export default function Flujo({ datos, wa }) {
    const { plan } = datos;
    const [pasos, setPasos] = useState(plan.pasos);
    const [sel, setSel] = useState(plan.pasos.length ? { tipo: 'paso', i: 0 } : null);
    const [sucio, setSucio] = useState(false);
    const [ocupado, setOcupado] = useState(false);
    useEffect(() => { if (!sucio) setPasos(plan.pasos); }, [plan.pasos, sucio]);

    const plantillas = wa.plantillas || [];
    const nombres = useMemo(() => [...new Set(pasos.map((p) => p.plantilla).filter(Boolean))], [pasos]);
    const { reglas, guardada, config } = useReglas(nombres, plantillas, wa);
    const botonesDelFlujo = [...new Set(nombres.flatMap((n) => partesDe(plantillas.find((p) => p.name === n)).botones))];

    const cambiar = (i, cambios) => { setPasos(pasos.map((p, j) => (j === i ? { ...p, ...cambios } : p))); setSucio(true); };
    const sumar = () => { setPasos([...pasos, pasoNuevo()]); setSel({ tipo: 'paso', i: pasos.length }); setSucio(true); };
    const quitar = (i) => {
        setPasos(pasos.filter((_, j) => j !== i));
        setSel(pasos.length > 1 ? { tipo: 'paso', i: Math.max(0, i - 1) } : null);
        setSucio(true);
    };

    const correr = async (accion, ok) => {
        setOcupado(true);
        try {
            if (sucio) await datos.guardar({ pasos: pasos.map(limpio) });
            setSucio(false);
            const r = accion ? await accion() : null;
            toast(ok(r));
        } catch (e) {
            toast(mensajeDe(e, 'No se pudo guardar'), 'error');
        } finally {
            setOcupado(false);
        }
    };
    const borradores = pasos.filter((p) => p.estado === 'borrador').length;
    const programados = pasos.filter((p) => p.estado === 'programado').length;

    return (
        <div className="bt-col">
            <div className="bt-fila bt-barra-flujo">
                <span className="bt-s">Las horas se cuentan desde el inicio del taller. Arrastrá el lienzo para moverte; tocá un nodo para editarlo.</span>
                <span className="bt-fila">
                    <Button icon={<Star />} disabled={ocupado || !pasos.length}
                        onClick={() => correr(datos.estandar, (r) => `Cada taller nuevo arranca con estos ${r.pasos} pasos`)}>Guardar como estándar</Button>
                    {sucio && <Button icon={<Save />} disabled={ocupado} onClick={() => correr(null, () => 'Flujo guardado')}>Guardar</Button>}
                    {programados > 0 && !borradores && (
                        <Button icon={<Pause />} disabled={ocupado} onClick={() => correr(datos.pausar, () => 'Pausado: los pasos volvieron a borrador')}>Pausar</Button>
                    )}
                    <Button variant="primary" icon={<CalendarClock />} disabled={ocupado || !borradores}
                        onClick={() => correr(datos.programar, (r) => `${r.programados} pasos programados`)}>
                        {borradores ? `Programar ${borradores}` : 'Programado'}
                    </Button>
                </span>
            </div>
            {!pasos.length ? (
                <EmptyState title="Sin pasos" action={<Button icon={<Plus />} onClick={sumar}>Primer paso</Button>}>
                    Armá la secuencia: bienvenida, recordatorios antes del taller, el link al empezar y el replay después.
                </EmptyState>
            ) : (
                <div className="bt-flujo">
                    <Lienzo pasos={pasos} plantillas={plantillas} reglas={reglas} sel={sel} onSel={setSel} onSumarPaso={sumar} />
                    <PanelNodo sel={sel} pasos={pasos} plantillas={plantillas} reglas={reglas} wa={wa} botonesDelFlujo={botonesDelFlujo}
                        cambiar={cambiar} quitar={quitar} onSel={setSel} onGuardada={guardada} onConfig={config} />
                </div>
            )}
        </div>
    );
}
