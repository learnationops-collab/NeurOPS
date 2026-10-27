// Tarjeta de una campaña: estado por su vigencia, embudo y tipo, sus palabras clave, a qué flujo lleva y
// cómo le fue en el período (entradas, calificados, agendas y costo por agenda si tiene gasto de Meta).
import { Copy, Eye, Megaphone, Pencil, Users, Workflow } from 'lucide-react';
import { Button, Card, Chip, Status } from '../../../components/standard';
import { EMBUDOS, ESTADOS, TIPOS, estadoDe, fechasLegibles, repartoLegible } from './campana';

const rotulo = (lista, valor) => lista.find((x) => x.value === valor)?.label || valor;
// «$65,21», sin el «US$» largo de la moneda en es: la cifra tiene que entrar en su celda.
const dinero = (n) => (n == null ? '–' : `$${n.toLocaleString('es', { minimumFractionDigits: n >= 100 ? 0 : 2, maximumFractionDigits: n >= 100 ? 0 : 2 })}`);
const porciento = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : null);

export default function TarjetaCampana({ c, setters = [], puedeEditar, onAbrir, onClonar }) {
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
            <p className="cp-flujo t-cap mut"><Users size={13} aria-hidden="true" /> {repartoLegible(c, setters)}</p>
            <div className="datos">
                <div className="dato"><b>{m.entradas ?? '–'}</b><span>Entradas</span></div>
                <div className="dato" data-tip={`Calificados|${m.descalificados || 0} no calificaron`}>
                    <b>{m.calificados ?? '–'}{pctCalificados && <small className="dato-pct">{pctCalificados}</small>}</b>
                    <span>Calificados</span>
                </div>
                <div className="dato"><b>{m.agendas ?? '–'}</b><span>Agendas</span></div>
            </div>
            {m.gasto > 0 ? (
                <div className="datos datos--costos">
                    <div className="dato" data-tip="Gasto de Meta|Lo gastado en el período">
                        <b>{dinero(m.gasto)}</b><span>Gasto</span>
                    </div>
                    <div className="dato dato--acento" data-tip="Por agenda|Gasto ÷ agendas del período">
                        <b>{m.costo_agenda != null ? dinero(m.costo_agenda) : '–'}</b><span>Por agenda</span>
                    </div>
                </div>
            ) : c.tipo === 'pago' && <p className="cp-flujo t-cap mut">Sin gasto de Meta en el período</p>}
            <div className="fcard-pie">
                <div className="der">
                    {puedeEditar && <Button icon={<Copy />} onClick={() => onClonar(c)}>Clonar</Button>}
                    <Button icon={puedeEditar ? <Pencil /> : <Eye />} onClick={() => onAbrir(c)}>{puedeEditar ? 'Editar' : 'Ver'}</Button>
                </div>
            </div>
        </Card>
    );
}
