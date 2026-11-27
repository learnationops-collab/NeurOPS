// Un paso del flujo: cuándo sale, qué plantilla, qué va en cada variable, a quién y a quién no. Las ramas (qué pasa
// al tocar cada botón) son las respuestas de la plantilla: se editan acá mismo con el editor de Plantillas.
import { Trash2 } from 'lucide-react';
import { Button, Input, Segmented, Select, Stepper } from '../../../components/standard';
import { partesDe } from '../broadcastWa/useBroadcast';
import Respuestas from '../broadcastWa/Respuestas';
import { A_QUIEN, VARIABLES, variablesDe } from './useBroadcastTaller';

const MODOS = [
    { value: 'relativo', label: 'Antes o después' },
    { value: 'hora', label: 'Día y hora' },
    { value: 'ahora', label: 'Al programar' },
];
const UNIDADES = [{ value: '1', label: 'min' }, { value: '60', label: 'horas' }, { value: '1440', label: 'días' }];

const unidadDe = (m) => (m && m % 1440 === 0 ? 1440 : m && m % 60 === 0 ? 60 : 1);

function Cuando({ paso, cambiar }) {
    const m = Number(paso.minutos) || 0;
    const unidad = unidadDe(Math.abs(m));
    const poner = (cifra, u, signo) => cambiar({ minutos: Math.round(Number(cifra) || 0) * u * signo });
    const signo = m > 0 ? 1 : -1;
    return (
        <div className="bt-campo">
            <span>Cuándo</span>
            <Segmented size="sm" label="Cuándo" value={paso.modo} onChange={(modo) => cambiar({ modo })} options={MODOS} />
            {paso.modo === 'relativo' && (
                <div className="bt-fila">
                    <Input variant="number" type="number" min="0" value={Math.abs(m) / unidad} aria-label="Cuánto"
                        onChange={(e) => poner(e.target.value, unidad, signo)} />
                    <Select size="sm" label="Unidad" value={String(unidad)} options={UNIDADES}
                        onChange={(u) => poner(Math.abs(m) / unidad, Number(u), signo)} />
                    <Segmented size="sm" label="Antes o después" value={signo < 0 ? 'antes' : 'despues'}
                        onChange={(v) => poner(Math.abs(m) / unidad, unidad, v === 'antes' ? -1 : 1)}
                        options={[{ value: 'antes', label: 'antes' }, { value: 'despues', label: 'después' }]} />
                </div>
            )}
            {paso.modo === 'hora' && (
                <div className="bt-fila">
                    <Stepper value={Number(paso.dias) || 0} min={-14} max={14} label="Días desde el taller"
                        display={(Number(paso.dias) || 0) === 0 ? 'Ese día' : `${paso.dias > 0 ? '+' : ''}${paso.dias} d`}
                        onChange={(dias) => cambiar({ dias })} />
                    <Input type="time" value={paso.hora || ''} aria-label="Hora" onChange={(e) => cambiar({ hora: e.target.value })} />
                    <small className="bt-s">hora de Argentina</small>
                </div>
            )}
        </div>
    );
}

function Variables({ paso, plantilla, cambiar }) {
    const n = variablesDe(partesDe(plantilla).cuerpo);
    if (!n) return null;
    const lista = Array.from({ length: n }, (_, i) => paso.parametros[i] ?? (i === 0 ? 'nombre' : ''));
    const poner = (i, v) => cambiar({ parametros: lista.map((x, j) => (j === i ? v : x)) });
    return (
        <div className="bt-campo">
            <span>Qué va en cada variable</span>
            {lista.map((p, i) => {
                const fijo = typeof p === 'object' && p !== null;
                return (
                    <div key={i} className="bt-fila">
                        <b className="bt-var">{`{{${i + 1}}}`}</b>
                        <Select size="sm" label={`Variable ${i + 1}`} value={fijo ? 'fijo' : p}
                            options={[{ value: '', label: 'Elegí…' }, ...VARIABLES]}
                            onChange={(v) => poner(i, v === 'fijo' ? { fijo: '' } : v)} />
                        {fijo && <Input value={p.fijo} placeholder="Texto" aria-label="Texto fijo" onChange={(e) => poner(i, { fijo: e.target.value })} />}
                    </div>
                );
            })}
        </div>
    );
}

export default function PasoEditor({ paso, plantillas, botonesDelFlujo, wa, cambiar, quitar }) {
    const bloqueado = paso.estado === 'lanzado' || paso.estado === 'vencido';
    const plantilla = plantillas.find((p) => p.name === paso.plantilla);
    const { botones } = partesDe(plantilla);
    if (bloqueado) {
        return (
            <div className="bt-caja bt-editor">
                <span className="bt-rotulo">{paso.nombre || 'Paso'} · ya salió</span>
                <p className="bt-s">Un paso que ya salió no se cambia: su historial queda. Para mandar otra cosa, sumá un paso nuevo.</p>
            </div>
        );
    }
    return (
        <div className="bt-caja bt-editor">
            <div className="bt-fila bt-fila--entre">
                <span className="bt-rotulo">Paso</span>
                <Button variant="ghost" icon={<Trash2 />} onClick={quitar}>Quitar</Button>
            </div>
            <label className="bt-campo">
                <span>Nombre</span>
                <Input value={paso.nombre || ''} maxLength={60} placeholder="Recordatorio 2 h" onChange={(e) => cambiar({ nombre: e.target.value })} />
            </label>
            <Cuando paso={paso} cambiar={cambiar} />
            <div className="bt-campo">
                <span>Plantilla aprobada</span>
                <Select size="sm" label="Plantilla" value={paso.plantilla || ''}
                    options={[{ value: '', label: 'Elegí una plantilla…' }, ...plantillas.map((p) => ({ value: p.name, label: p.name }))]}
                    onChange={(v) => {
                        const p = plantillas.find((x) => x.name === v);
                        cambiar({ plantilla: v, idioma: p?.language || 'es', parametros: [] });
                    }} />
            </div>
            {plantilla && <Variables paso={paso} plantilla={plantilla} cambiar={cambiar} />}
            <div className="bt-campo">
                <span>A quién</span>
                <Segmented size="sm" label="A quién" value={paso.a_quien} options={A_QUIEN}
                    onChange={(a_quien) => cambiar({ a_quien, valor: '' })} />
                {paso.a_quien === 'tocaron' && (
                    <Select size="sm" label="Botón" value={paso.valor || ''}
                        options={[{ value: '', label: 'Elegí el botón…' }, ...botonesDelFlujo.map((b) => ({ value: b, label: b }))]}
                        onChange={(valor) => cambiar({ valor })} />
                )}
                {paso.a_quien === 'etiqueta' && (
                    <Input value={paso.valor || ''} placeholder="WS 26/11 · va" aria-label="Etiqueta" onChange={(e) => cambiar({ valor: e.target.value })} />
                )}
            </div>
            <label className="bt-campo">
                <span>Excluir a los que tengan estas etiquetas</span>
                <Input value={(paso.excluir || []).join(', ')} placeholder="WS 26/11 · no va"
                    onChange={(e) => cambiar({ excluir: e.target.value.split(',').map((x) => x.trimStart()) })} />
                <small className="bt-s">Separadas por coma.</small>
            </label>
            {plantilla && botones.length > 0 && (
                <div className="bt-campo">
                    <span>Ramas · qué pasa al tocar cada botón</span>
                    <small className="bt-s">Vale para todos los envíos de {plantilla.name}. Poné una etiqueta para filtrar los pasos siguientes.</small>
                    <Respuestas key={plantilla.name} nombre={plantilla.name} botones={botones} datos={wa} />
                </div>
            )}
        </div>
    );
}
