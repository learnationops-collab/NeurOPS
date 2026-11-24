// Una etapa de la Guía: su nota y sus pasos en orden. Qué etapas hay y en qué orden es fijo (`fases.py`):
// cambiarlo se propone. Apertura y No lead las arranca el bot; los pasos quedan para mandarlos a mano.
import { Button, Chip, TextArea } from '../../../components/standard';
import { TRAMOS, faseDe, siguiente } from '../conversaciones/fasesSetting';
import PasoGuia from './PasoGuia';
import { nuevoId } from './useGuia';

const DEL_BOT = new Set(['apertura', 'nolead']);

// `info` ({n, label, tramo, siguiente}) reemplaza la fase de Conversión en otro embudo (ADR-W204); sin `cabecera`,
// el título lo pone quien lo usa (Embudos).
export default function EditorEtapa({ fase, etapa, guia, editados, onCambiar, onProponer, info, cabecera = true }) {
    const f = info || faseDe(fase);
    const sig = info ? (info.siguiente ? { label: info.siguiente } : null) : siguiente(fase);
    const pasos = etapa.pasos || [];
    const set = (x) => onCambiar({ ...etapa, ...x });
    const cambiarPaso = (i, p) => set({ pasos: pasos.map((x, k) => (k === i ? p : x)) });
    const mover = (i, d) => {
        const j = i + d;
        if (j < 0 || j >= pasos.length) return;
        const l = [...pasos];
        [l[i], l[j]] = [l[j], l[i]];
        set({ pasos: l });
    };
    const agregar = () => {
        const id = nuevoId();
        set({ pasos: [...pasos, { id, t: 'Paso nuevo', atajo: `${fase.slice(0, 4)}-${id.slice(0, 3)}`, uso: '', op: [{ x: '' }] }] });
    };
    return (
        <div className="gu-editor">
            {cabecera && <div className="gu-ecab">
                <Chip subtle color={TRAMOS[f.tramo].color}>{TRAMOS[f.tramo].nombre}</Chip>
                <h2>{f.n}. {f.label}</h2>
                <Button variant="ghost" className="gu-der" onClick={onProponer}>Proponer un cambio a la etapa</Button>
            </div>}
            {DEL_BOT.has(fase) && <p className="gu-bot">Esta etapa la arranca el bot. Lo de abajo es para mandarlo a mano si el bot no salió.</p>}
            <TextArea className="gu-nota" value={etapa.nota || ''} onChange={(e) => set({ nota: e.target.value })}
                placeholder="Nota de la etapa (opcional): sale arriba de los mensajes cuando el lead pasa a esta etapa" aria-label="Nota de la etapa" />
            {pasos.map((p, i) => (
                <PasoGuia key={p.id} fase={fase} paso={p} n={i + 1} guia={guia} siguiente={sig?.label} editado={editados.has(p.id)}
                    onCambiar={(np) => cambiarPaso(i, np)} onQuitar={() => set({ pasos: pasos.filter((_, k) => k !== i) })}
                    onMover={(d) => mover(i, d)} />
            ))}
            {!pasos.length && <p className="t-cap mut">Esta etapa no tiene mensajes.</p>}
            <Button className="gu-agregar" onClick={agregar}>Agregar paso</Button>
        </div>
    );
}
