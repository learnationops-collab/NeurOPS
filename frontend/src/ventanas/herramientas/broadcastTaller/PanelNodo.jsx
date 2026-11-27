// El panel de la derecha del flujo: solo el nodo que se tocó en el lienzo (ADR-W262). El paso se edita con
// `PasoEditor` (se guarda con el flujo); la respuesta a un botón y lo que sale al abrir su link, con el editor de
// respuestas por partes (se guardan solos, en la plantilla).
import { ChevronLeft } from 'lucide-react';
import { Button } from '../../../components/standard';
import { partesDe } from '../broadcastWa/useBroadcast';
import { Editor } from '../broadcastWa/Respuestas';
import PasoEditor from './PasoEditor';

function Cabecera({ titulo, sub, onVolver }) {
    return (
        <div className="bt-cuerpo-panel">
            {onVolver && <Button variant="ghost" icon={<ChevronLeft />} onClick={onVolver}>Paso</Button>}
            <span className="bt-rotulo">{titulo}</span>
            {sub && <small className="bt-s">{sub}</small>}
        </div>
    );
}

export default function PanelNodo({ sel, pasos, plantillas, reglas, wa, botonesDelFlujo, cambiar, quitar, onSel, onGuardada, onConfig }) {
    const paso = sel ? pasos[sel.i] : null;
    if (!paso) return <div className="bt-caja bt-editor"><span className="bt-s">Tocá un nodo del flujo para editarlo.</span></div>;
    const plantilla = plantillas.find((p) => p.name === paso.plantilla);
    const datos = reglas[paso.plantilla];
    if (sel.tipo === 'paso') {
        return (
            <PasoEditor key={paso.id || `n${sel.i}`} paso={paso} plantillas={plantillas} botonesDelFlujo={botonesDelFlujo} wa={wa}
                config={datos?.config} cambiar={(c) => cambiar(sel.i, c)} quitar={() => quitar(sel.i)}
                onBoton={(b) => onSel({ tipo: 'resp', i: sel.i, boton: b })} onConfig={(c) => onConfig(paso.plantilla, c)} />
        );
    }
    if (!plantilla || !datos) return <div className="bt-caja bt-editor"><span className="bt-s">Trayendo las respuestas de la plantilla…</span></div>;
    const { botones } = partesDe(plantilla);
    const regla = datos.respuestas.find((r) => r.boton === sel.boton);
    const volver = () => onSel({ tipo: 'paso', i: sel.i });
    const despues = sel.tipo === 'despues';
    return (
        <div className="bt-caja bt-editor">
            <Cabecera onVolver={volver}
                titulo={despues ? `Al abrir el link de «${sel.boton}»` : `Si toca «${sel.boton}»`}
                sub={despues ? 'Sale una sola vez por persona' : `Sale solo · vale para todos los envíos de ${plantilla.name}`} />
            <Editor key={`${plantilla.name}|${sel.boton}|${sel.tipo}|${regla ? JSON.stringify(regla) : ''}`}
                nombre={plantilla.name} boton={sel.boton} botones={botones} inicial={regla} asignables={datos.asignables || []}
                datos={wa} parte={despues ? 'despues' : 'respuesta'} onGuardada={(r) => onGuardada(plantilla.name, r)}
                onAbrirDespues={() => onSel({ tipo: 'despues', i: sel.i, boton: sel.boton })} />
        </div>
    );
}
