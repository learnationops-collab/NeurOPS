// La última tarjeta de la grilla: el lugar donde arranca el próximo flujo.
import { Plus } from 'lucide-react';
import { Button, Card } from '../../../components/standard';
import { PLANTILLAS } from './estructuras';

export default function Plantillas({ onElegir }) {
    return (
        <Card as="section" className="fcard fl-plantillas" aria-labelledby="fl-plantillas-t">
            <div>
                <h3 id="fl-plantillas-t" className="t-h3">Empezar desde plantilla</h3>
                <p className="t-cap mut">Estructuras listas para cambiarles el texto.</p>
            </div>
            <ul className="fl-plantillas-lista">
                {PLANTILLAS.map((p) => (
                    <li key={p.id}>
                        <button type="button" className="fl-plantilla" onClick={() => onElegir(p.id)}>
                            <strong>{p.nombre}</strong>
                            <span className="t-cap mut">{p.grafo.nodos.filter((n) => n.tipo !== 'fin').length} pasos · {p.detalle}</span>
                        </button>
                    </li>
                ))}
            </ul>
            <Button variant="primary" icon={<Plus />} onClick={() => onElegir('')}>Crear desde cero</Button>
        </Card>
    );
}
