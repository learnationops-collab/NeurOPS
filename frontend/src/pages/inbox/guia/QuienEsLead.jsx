// Quién es lead y quién no: lo cambia la dirección comercial; el setter lo lee y propone.
import { Button, Input, LinkButton, TextArea } from '../../../components/standard';

function Lista({ titulo, items, puede, onCambiar }) {
    return (
        <div className="gu-campo">
            <h3>{titulo}</h3>
            {items.map((x, i) => (
                <div key={i} className="gu-item">
                    <Input value={x} readOnly={!puede} aria-label={titulo}
                        onChange={(e) => onCambiar(items.map((y, k) => (k === i ? e.target.value : y)))} />
                    {puede && <LinkButton subtle onClick={() => onCambiar(items.filter((_, k) => k !== i))}>Quitar</LinkButton>}
                </div>
            ))}
            {puede && <LinkButton onClick={() => onCambiar([...items, ''])}>Agregar</LinkButton>}
        </div>
    );
}

export default function QuienEsLead({ quien, puede, onCambiar, onProponer }) {
    const set = (x) => onCambiar({ ...quien, ...x });
    return (
        <div className="gu-editor">
            <div className="gu-ecab">
                <h2>Quién es lead</h2>
                {!puede && <Button variant="ghost" className="gu-der" onClick={onProponer}>Proponer un cambio</Button>}
            </div>
            <Lista titulo="Es lead" items={quien.leads || []} puede={puede} onCambiar={(leads) => set({ leads })} />
            <Lista titulo="No es lead (va a No lead)" items={quien.noleads || []} puede={puede} onCambiar={(noleads) => set({ noleads })} />
            <div className="gu-campo">
                <h3>Excepción</h3>
                <TextArea value={quien.excepcion || ''} readOnly={!puede} onChange={(e) => set({ excepcion: e.target.value })} aria-label="Excepción" />
            </div>
        </div>
    );
}
