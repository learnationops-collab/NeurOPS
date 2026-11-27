// El panel de la derecha del flujo: solo el nodo que se tocó en el lienzo (ADR-W262). El paso se edita con
// `PasoEditor` (se guarda con el flujo); la respuesta a un botón y lo que sale al abrir su link, con el editor de
// respuestas por partes (se guardan solos). Los botones son los de la plantilla o, en un paso de mensaje común, los
// del mensaje (ADR-W272): `fuenteDe` dice cuáles y con qué clave.
import { ChevronLeft } from 'lucide-react';
import { Button } from '../../../components/standard';
import { Editor } from '../broadcastWa/Respuestas';
import PasoEditor from './PasoEditor';
import { fuenteDe, LINK_BOTON } from './useBroadcastTaller';

function Cabecera({ titulo, sub, onVolver }) {
    return (
        <div className="bt-cuerpo-panel">
            {onVolver && <Button variant="ghost" icon={<ChevronLeft />} onClick={onVolver}>Paso</Button>}
            <span className="bt-rotulo">{titulo}</span>
            {sub && <small className="bt-s">{sub}</small>}
        </div>
    );
}

export default function PanelNodo({ sel, pasos, plantillas, reglas, wa, botonesDelFlujo, cambiar, quitar, onSel, onGuardada, onConfig,
    sucio, ocupado, onEstado }) {
    const paso = sel ? pasos[sel.i] : null;
    if (!paso) return <div className="bt-caja bt-editor"><span className="bt-s">Tocá un nodo del flujo para editarlo.</span></div>;
    const fuente = fuenteDe(paso, plantillas);
    const datos = fuente.clave ? reglas[fuente.clave] : null;
    if (sel.tipo === 'paso') {
        return (
            <PasoEditor key={paso.id || `n${sel.i}`} paso={paso} plantillas={plantillas} botonesDelFlujo={botonesDelFlujo} wa={wa}
                config={datos?.config} cambiar={(c) => cambiar(sel.i, c)} quitar={() => quitar(sel.i)}
                sucio={sucio} ocupado={ocupado} onEstado={(activo) => onEstado(paso.id, activo)}
                onBoton={(b) => onSel({ tipo: 'resp', i: sel.i, boton: b })}
                onLink={() => onSel({ tipo: 'despues', i: sel.i, boton: LINK_BOTON })}
                onConfig={(c) => onConfig(fuente.clave, c)} />
        );
    }
    if (!fuente.clave) return <div className="bt-caja bt-editor"><span className="bt-s">Guardá el flujo para armar lo que pasa al tocar este botón.</span></div>;
    if (!datos) return <div className="bt-caja bt-editor"><span className="bt-s">Trayendo las respuestas…</span></div>;
    const botones = fuente.link ? [...fuente.botones, LINK_BOTON] : fuente.botones;
    const regla = datos.respuestas.find((r) => r.boton === sel.boton);
    const volver = () => onSel({ tipo: 'paso', i: sel.i });
    const despues = sel.tipo === 'despues';
    const nombreBoton = sel.boton === LINK_BOTON ? fuente.link?.titulo || 'el link' : sel.boton;
    const deQuien = fuente.plantilla ? `vale para todos los envíos de ${fuente.plantilla.name}` : 'del mensaje de este paso';
    return (
        <div className="bt-caja bt-editor">
            <Cabecera onVolver={volver}
                titulo={despues ? `Al abrir el link de «${nombreBoton}»` : `Si toca «${nombreBoton}»`}
                sub={despues ? 'Sale una sola vez por persona' : `Sale solo · ${deQuien}`} />
            <Editor key={`${fuente.clave}|${sel.boton}|${sel.tipo}|${regla ? JSON.stringify(regla) : ''}`}
                nombre={fuente.clave} boton={sel.boton} botones={fuente.botones} inicial={regla} asignables={datos.asignables || []}
                datos={wa} parte={despues ? 'despues' : 'respuesta'} onGuardada={(r) => onGuardada(fuente.clave, r)}
                onAbrirDespues={() => onSel({ tipo: 'despues', i: sel.i, boton: sel.boton })} />
            {botones.length === 0 && <small className="bt-s">Este paso no tiene botones.</small>}
        </div>
    );
}
