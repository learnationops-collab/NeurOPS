// Tarjeta de una campaña: estado por su vigencia, embudo y tipo, sus palabras clave, a qué flujo lleva y
// cómo le fue en el período (entradas, calificados, agendas y costo por agenda si tiene gasto de Meta).
import { Eye, Megaphone, Pencil, Workflow } from 'lucide-react';
import { Button, Card, Chip, Status } from '../../../components/standard';
import { EMBUDOS, ESTADOS, TIPOS, estadoDe, fechasLegibles } from './campana';

const rotulo = (lista, valor) => lista.find((x) => x.value === valor)?.label || valor;
const dinero = (n) => (n == null ? '–' : n.toLocaleString('es', { style: 'currency', currency: 'USD', maximumFractionDigits: n >= 100 ? 0 : 2 }));
const porciento = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : null);

export default function TarjetaCampana({ c, puedeEditar, onAbrir }) {
    const est = ESTADOS[estadoDe(c)];
    const m = c.metricas || {};
    const pctCalificados = porciento(m.calificados || 0, m.entradas || 0);
    return (
        <Card as="article" className="fcard fl-card cp-card">
            <div className="fcard-cab">
                <span className="icono-m"><Megaphone /></span>
                <div className="fl-titulo">
                    <button type="button" className="fcard-nom" onClick={() => onAbrir(c)}>{c.nombre}</button>
                    <span className="t-cap mut">{rotulo(EMBUDOS, c.embudo)} · {rotulo(TIPOS, c.tipo)} · {fechasLegibles(c)}</span>
                </div>
                <div className="fl-estado"><Status color={est.color}>{est.texto}</Status></div>
            </div>
            <div className="cp-chips">
                {c.palabras.map((p) => <Chip key={p} subtle>#{p}</Chip>)}
            </div>
            <p className={`cp-flujo t-cap ${c.flujo ? 'mut' : 'fl-sin-palabra'}`}>
                <Workflow size={13} aria-hidden="true" /> {c.flujo || 'Sin flujo: sus palabras no disparan nada'}
            </p>
            <div className="datos">
                <div className="dato"><b>{m.entradas ?? '–'}</b><span>Entradas</span></div>
                <div className="dato" data-tip={`Calificados|${m.descalificados || 0} no calificaron`}>
                    <b>{m.calificados ?? '–'}</b><span>Calificados{pctCalificados ? ` · ${pctCalificados}` : ''}</span>
                </div>
                <div className="dato"><b>{m.agendas ?? '–'}</b><span>Agendas</span></div>
                <div className="dato" data-tip={`Gasto de Meta|${dinero(m.gasto)} en el período`}>
                    <b>{m.costo_agenda != null ? dinero(m.costo_agenda) : dinero(m.gasto || null)}</b>
                    <span>{m.costo_agenda != null ? 'Por agenda' : 'Gasto'}</span>
                </div>
            </div>
            <div className="fcard-pie">
                <div className="der">
                    <Button icon={puedeEditar ? <Pencil /> : <Eye />} onClick={() => onAbrir(c)}>{puedeEditar ? 'Editar' : 'Ver'}</Button>
                </div>
            </div>
        </Card>
    );
}
