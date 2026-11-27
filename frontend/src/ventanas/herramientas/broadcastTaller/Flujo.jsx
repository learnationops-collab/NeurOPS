// El flujo de recordatorios del taller: los pasos en una línea de tiempo (cada uno con su plantilla, a quién y,
// debajo, sus ramas por botón) y el editor del paso elegido. Se edita en borrador y «Programar» lo deja en manos
// del reloj del motor; lo que ya salió queda fijo.
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Pause, Plus, Save, Star } from 'lucide-react';
import { Button, Chip, EmptyState, toast } from '../../../components/standard';
import { embudo, partesDe } from '../broadcastWa/useBroadcast';
import { resumen } from '../broadcastWa/Respuestas';
import PasoEditor from './PasoEditor';
import { cuandoEnPalabras, fechaCorta, mensajeDe, pasoNuevo } from './useBroadcastTaller';

const ESTADOS = {
    borrador: { label: 'Borrador', color: 'var(--ln-text-faint, #8a8ea0)' },
    programado: { label: 'Programado', color: 'var(--ln-info, #3b7dd8)' },
    lanzado: { label: 'Salió', color: 'var(--ln-success, #1f9d6b)' },
    vencido: { label: 'Venció sin salir', color: 'var(--ln-error, #c8433a)' },
};
const A_QUIEN = { todos: 'A todos', no_respondieron: 'Los que no respondieron', tocaron: 'Tocaron', etiqueta: 'Con la etiqueta' };

const limpio = (p) => ({ ...p, excluir: (p.excluir || []).map((x) => x.trim()).filter(Boolean) });

function Ramas({ plantilla, reglas }) {
    const { botones } = partesDe(plantilla);
    if (!botones.length) return null;
    return (
        <div className="bt-ramas">
            {botones.map((b) => {
                const r = (reglas || []).find((x) => x.boton === b);
                return (
                    <div key={b} className="bt-rama">
                        <small>Si toca «{b}»</small>
                        <span>{resumen(r)}</span>
                        {r?.texto && <span className="bt-s">«{r.texto.slice(0, 60)}{r.texto.length > 60 ? '…' : ''}»</span>}
                    </div>
                );
            })}
        </div>
    );
}

function Nodo({ paso, plantilla, reglas, elegido, onElegir }) {
    const estado = ESTADOS[paso.estado] || ESTADOS.borrador;
    const { cuerpo, botones } = partesDe(plantilla);
    const salio = paso.lote ? embudo(paso.por_estado) : null;
    return (
        <div className="bt-paso">
            <span className="bt-cuando">{cuandoEnPalabras(paso)}{paso.momento && <small> · {fechaCorta(paso.momento)}</small>}</span>
            <button type="button" className={`bt-nodo${elegido ? ' bt-nodo--on' : ''}`} onClick={onElegir}>
                <span className="bt-nodo-top"><Chip subtle color={estado.color}>{estado.label}</Chip><b>{paso.nombre || paso.plantilla || 'Paso nuevo'}</b></span>
                {paso.plantilla
                    ? <span className="bt-burbuja">{(cuerpo || paso.plantilla).slice(0, 140)}</span>
                    : <span className="bt-s">Sin plantilla</span>}
                {botones.length > 0 && <span className="bt-botones">{botones.map((b) => <span key={b}>{b}</span>)}</span>}
                <span className="bt-s">
                    {A_QUIEN[paso.a_quien]}{paso.valor ? ` «${paso.valor}»` : ''}
                    {salio ? ` · ${salio.enviados} enviados · ${salio.respondieron} respondieron` : paso.estimado != null ? ` · ~${paso.estimado}` : ''}
                </span>
            </button>
            {plantilla && <Ramas plantilla={plantilla} reglas={reglas} />}
        </div>
    );
}

export default function Flujo({ datos, wa }) {
    const { plan } = datos;
    const [pasos, setPasos] = useState(plan.pasos);
    const [elegido, setElegido] = useState(0);
    const [sucio, setSucio] = useState(false);
    const [ocupado, setOcupado] = useState(false);
    const [reglas, setReglas] = useState({});
    useEffect(() => { if (!sucio) setPasos(plan.pasos); }, [plan.pasos, sucio]);

    const plantillas = wa.plantillas || [];
    const nombres = useMemo(() => [...new Set(pasos.map((p) => p.plantilla).filter(Boolean))], [pasos]);
    useEffect(() => {
        nombres.filter((n) => !(n in reglas) && plantillas.some((p) => p.name === n && partesDe(p).botones.length))
            .forEach((n) => wa.respuestas(n).then((r) => setReglas((x) => ({ ...x, [n]: r.respuestas }))).catch(() => {}));
    }, [nombres, plantillas]); // eslint-disable-line react-hooks/exhaustive-deps
    const botonesDelFlujo = [...new Set(nombres.flatMap((n) => partesDe(plantillas.find((p) => p.name === n)).botones))];

    const cambiar = (i, cambios) => { setPasos(pasos.map((p, j) => (j === i ? { ...p, ...cambios } : p))); setSucio(true); };
    const sumar = () => { setPasos([...pasos, pasoNuevo()]); setElegido(pasos.length); setSucio(true); };
    const quitar = (i) => { setPasos(pasos.filter((_, j) => j !== i)); setElegido(Math.max(0, i - 1)); setSucio(true); };

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
    const actual = pasos[elegido];

    return (
        <div className="bt-col">
            <div className="bt-fila bt-barra-flujo">
                <span className="bt-s">Las horas se cuentan desde el inicio del taller: si lo movés, el flujo se mueve con él.</span>
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
                    <div className="bt-lienzo">
                        <div className="bt-eje">
                            {pasos.map((p, i) => (
                                <Nodo key={p.id || `n${i}`} paso={p} plantilla={plantillas.find((x) => x.name === p.plantilla)}
                                    reglas={reglas[p.plantilla]} elegido={i === elegido} onElegir={() => setElegido(i)} />
                            ))}
                            <button type="button" className="bt-mas" onClick={sumar}><Plus aria-hidden="true" /> Paso</button>
                        </div>
                    </div>
                    {actual && (
                        <PasoEditor key={actual.id || `n${elegido}`} paso={actual} plantillas={plantillas} botonesDelFlujo={botonesDelFlujo}
                            wa={wa} cambiar={(c) => cambiar(elegido, c)} quitar={() => quitar(elegido)}
                            onReglas={(n, lista) => setReglas((x) => ({ ...x, [n]: lista }))} />
                    )}
                </div>
            )}
        </div>
    );
}
