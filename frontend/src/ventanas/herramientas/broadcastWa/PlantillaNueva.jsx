// Una plantilla nueva para Meta: nombre, categoría, texto ({{1}} = primer nombre) y botones de respuesta rápida.
// Va a revisión; cuando la aprueban aparece en «Mandar». Con `base` (Duplicar) arranca con ese texto.
import { useState } from 'react';
import { Plus, Send, X } from 'lucide-react';
import { Button, FieldError, IconButton, Input, LinkButton, Segmented, TextArea, toast } from '../../../components/standard';
import { partesDe } from './useBroadcast';
import { Vista } from './Mandar';

const LARGO_BOTON = 25;
const MAX_BOTONES = 10;
const NOMBRE = /^[a-z0-9_]+$/;

export default function PlantillaNueva({ base, datos, onLista }) {
    const inicial = base ? partesDe(base) : { cuerpo: '', botones: [] };
    const [nombre, setNombre] = useState(base ? `${base.name}_2` : '');
    const [categoria, setCategoria] = useState(base?.category === 'UTILITY' ? 'UTILITY' : 'MARKETING');
    const [texto, setTexto] = useState(inicial.cuerpo);
    const [botones, setBotones] = useState(inicial.botones);
    const [mandando, setMandando] = useState(false);

    const nombreMal = nombre && !NOMBRE.test(nombre);
    const repetido = (datos.todas || []).some((p) => p.name === nombre);
    const listo = nombre && !nombreMal && !repetido && texto.trim() && botones.every((b) => b.trim());
    const previa = { components: [{ type: 'BODY', text: texto || '…' }, { type: 'BUTTONS', buttons: botones.filter((b) => b.trim()).map((b) => ({ text: b })) }] };

    const mandar = async () => {
        setMandando(true);
        try {
            await datos.crearPlantilla({ nombre, categoria, texto, botones: botones.map((b) => b.trim()) });
            toast(`${nombre} fue a revisión de Meta`);
            onLista();
        } catch (e) {
            toast(datos.mensaje(e, 'Meta no la aceptó'), 'error');
        } finally {
            setMandando(false);
        }
    };
    return (
        <div className="bw-cuerpo">
            <div className="bw-pl-dos">
                <label className="bw-campo">
                    <span>Nombre</span>
                    <Input value={nombre} onChange={(e) => setNombre(e.target.value.toLowerCase())} invalid={nombreMal || repetido} placeholder="referidos_marlon" />
                    {nombreMal ? <FieldError>Solo minúsculas, números y guiones bajos</FieldError>
                        : repetido ? <FieldError>Ya hay una plantilla con ese nombre</FieldError>
                            : <small className="bw-s">Minúsculas y guiones bajos</small>}
                </label>
                <div className="bw-campo">
                    <span>Categoría</span>
                    <Segmented size="sm" label="Categoría" value={categoria} onChange={setCategoria}
                        options={[{ value: 'MARKETING', label: 'Marketing' }, { value: 'UTILITY', label: 'Utilidad' }]} />
                </div>
            </div>
            <label className="bw-campo">
                <span>Texto</span>
                <TextArea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Hola {{1}}, ¿cómo estás?…" />
                <small className="bw-s">{'{{1}}'} es el primer nombre. En el broadcast de un taller podés sumar {'{{2}}'}, {'{{3}}'}… y elegir en cada paso qué va (hora, Meet, grupo).</small>
            </label>
            <div className="bw-campo">
                <span>Botones de respuesta rápida <small className="bw-s">(opcional, hasta {MAX_BOTONES})</small></span>
                {botones.map((b, i) => (
                    <div key={i} className="bw-fila">
                        <Input value={b} maxLength={LARGO_BOTON} aria-label="Texto del botón" invalid={!b.trim()}
                            onChange={(e) => setBotones(botones.map((x, j) => (j === i ? e.target.value : x)))} />
                        <small className="bw-s bw-cuenta">{b.length}/{LARGO_BOTON}</small>
                        <IconButton size="sm" icon={<X />} label="Quitar botón" onClick={() => setBotones(botones.filter((_, j) => j !== i))} />
                    </div>
                ))}
                {botones.length < MAX_BOTONES && <LinkButton icon={<Plus />} onClick={() => setBotones([...botones, ''])}>Botón</LinkButton>}
            </div>
            <div>
                <span className="bw-rotulo">Así le llega</span>
                <Vista plantilla={previa} />
            </div>
            <div className="bw-envio">
                <span className="bw-ayuda bw-pl-ayuda">Va a revisión de Meta. Cuando la aprueben aparece en «Mandar».</span>
                <Button variant="primary" icon={<Send />} disabled={!listo || mandando} onClick={mandar}>Mandar a aprobar</Button>
            </div>
        </div>
    );
}
