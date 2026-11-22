// Un paso de una etapa de la Guía: nombre, atajo «/», cuándo se usa y sus opciones (A, B… o una por respuesta).
// Debajo de cada opción, cuánto respondió en los últimos días (`usoDe`).
import { Button, Input, LinkButton, Select, TextArea } from '../../../components/standard';
import { USOS, claveDe, rotulo, usoDe } from './useGuia';

function Opcion({ paso, j, uso, mejor, onCambiar, onQuitar }) {
    const o = paso.op[j];
    return (
        <div className="gu-op">
            <div className="gu-op-cab">
                {paso.porRespuesta
                    ? <Input className="gu-op-si" value={o.si || ''} onChange={(e) => onCambiar({ ...o, si: e.target.value })} aria-label="Respuesta del lead" placeholder="Si eligió…" />
                    : <span className="t-rotulo">{rotulo(paso, j)}</span>}
                {o.desde && <span className="t-cap mut40">desde {o.desde}</span>}
                {mejor && <span className="gu-mejor">Responden más</span>}
                {paso.op.length > 1 && <LinkButton subtle onClick={onQuitar}>Quitar</LinkButton>}
            </div>
            {o.audio && <p className="gu-audio">Es un audio: <b>{o.audio}</b>. Abajo, lo que dice.</p>}
            <TextArea value={o.x || ''} onChange={(e) => onCambiar({ ...o, x: e.target.value })} aria-label={rotulo(paso, j)} invalid={!o.x && !o.audio} />
            {uso && <span className="t-cap mut"><b>{uso.pct}%</b> respondió · {uso.enviados} enviados</span>}
        </div>
    );
}

export default function PasoGuia({ fase, paso, n, guia, siguiente, editado, onCambiar, onQuitar, onMover }) {
    const set = (x) => onCambiar({ ...paso, ...x });
    const usos = paso.op.map((_, j) => usoDe(guia, claveDe(fase, paso, j)));
    const top = Math.max(...usos.map((u) => u?.pct ?? -1));
    const comparan = !paso.porRespuesta && usos.filter(Boolean).length > 1;
    return (
        <section className={`gu-paso${paso.uso === 'no se usa' ? ' gu-paso--apagado' : ''}${editado ? ' gu-paso--editado' : ''}`}>
            <div className="gu-paso-cab">
                <span className="gu-num">{n}</span>
                <Input className="gu-tit" value={paso.t} onChange={(e) => set({ t: e.target.value })} aria-label="Nombre del paso" />
                <Input className="gu-atajo" value={`/${paso.atajo}`} aria-label="Atajo"
                    onChange={(e) => set({ atajo: e.target.value.replace(/^\/+/, '').toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
                <Select size="sm" label="Cuándo se usa" value={paso.uso || ''} options={USOS} onChange={(uso) => set({ uso })} />
                {paso.uso === 'solo si' && (
                    <Input className="gu-cuando" value={paso.cuando || ''} onChange={(e) => set({ cuando: e.target.value })}
                        placeholder="Por ejemplo: ningún horario le sirve" aria-label="Cuándo" />
                )}
            </div>
            <div className="gu-ops">
                {paso.op.map((o, j) => (
                    <Opcion key={j} paso={paso} j={j} uso={usos[j]} mejor={comparan && usos[j]?.pct === top}
                        onCambiar={(op) => set({ op: paso.op.map((x, k) => (k === j ? op : x)) })}
                        onQuitar={() => set({ op: paso.op.filter((_, k) => k !== j) })} />
                ))}
                {(paso.porRespuesta || paso.op.length < 2) && (
                    <button type="button" className="gu-nueva" onClick={() => set({ op: [...paso.op, { x: '' }] })}>
                        {paso.porRespuesta ? 'Agregar otra respuesta' : 'Agregar opción B'}
                    </button>
                )}
            </div>
            <TextArea className="gu-nota" value={paso.nota || ''} onChange={(e) => set({ nota: e.target.value })}
                placeholder="Nota para el setter (opcional): qué revisar antes de mandarlo" aria-label="Nota del paso" />
            <div className="gu-paso-pie">
                {siguiente && <span className="t-cap mut">Al mandarlo</span>}
                {siguiente && (
                    <Select size="sm" label="Al mandarlo" value={paso.avanza ? 'avanza' : 'sigue'} onChange={(v) => set({ avanza: v === 'avanza' })}
                        options={[{ value: 'sigue', label: 'Sigue en esta etapa' }, { value: 'avanza', label: `Pasa a ${siguiente}` }]} />
                )}
                <span className="gu-pie-der">
                    <Button variant="ghost" onClick={() => onMover(-1)}>Subir</Button>
                    <Button variant="ghost" onClick={() => onMover(1)}>Bajar</Button>
                    <Button variant="ghost" onClick={onQuitar}>Quitar paso</Button>
                </span>
            </div>
        </section>
    );
}
