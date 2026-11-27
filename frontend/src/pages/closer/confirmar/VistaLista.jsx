// Vista Lista de Confirmar (ADR-W201): una tabla con una columna por propiedad elegida, agrupada. Tocar
// la fila abre la ficha; el botón de la derecha pasa la agenda a la etapa siguiente.
import { useState } from 'react';
import { Check, ChevronDown, MessageCircle } from 'lucide-react';
import { Button, EmptyState } from '../../../components/standard';
import Celda, { Etiqueta, urgenciaDe } from './Celda';
import { siguienteEtapa } from './etapas';

const BOTON = { contactado: 'Contactado', confirmado: 'Confirmar' };
const whatsapp = (tel) => `https://wa.me/${String(tel || '').replace(/\D/g, '')}`;

export default function VistaLista({ vista, grupos, catalogo, ahora, nombreCloser, seleccionada, onAbrir, onMover, primario }) {
    const [abiertos, setAbiertos] = useState({}); // clave de grupo → true/false (sin tocar: lo que diga el grupo)
    const props = vista.props.map(k => catalogo.find(p => p.clave === k)).filter(Boolean);
    const columnas = ['minmax(var(--cv-col1, 200px),1.3fr)', ...props.map(p => p.ancho), '170px'].join(' ');
    const conGrupos = vista.agrupar !== 'ninguno';
    if (!grupos.some(g => g.items.length)) {
        return <EmptyState title="Nada con estos filtros">Probá sacar algún filtro o cambiar de vista.</EmptyState>;
    }
    return (
        <div className="cv-lista">
            {grupos.filter(g => g.items.length).map(g => {
                const id = `${vista.id}:${g.clave}`;
                const abierto = abiertos[id] ?? !g.plegado;
                return (
                    <section key={g.clave}>
                        {conGrupos && (
                            <button type="button" className={`cv-grupo${abierto ? '' : ' cv-grupo--plegado'}`} aria-expanded={abierto}
                                onClick={() => setAbiertos(prev => ({ ...prev, [id]: !abierto }))}>
                                <ChevronDown className="cv-grupo__car" aria-hidden="true" />
                                {g.urgente && <i className="cv-pulso" aria-hidden="true" />}
                                <Etiqueta color={g.color || 'var(--ui-brand)'}>{g.titulo}</Etiqueta>
                                <span className="cv-mute">{g.items.length}</span>
                            </button>
                        )}
                        {abierto && (
                            <div className="cv-tabla" role="table" style={{ '--cols': columnas }}>
                                <div className="cv-tr cv-tr--cab" role="row">
                                    <div role="columnheader">Nombre</div>
                                    {props.map(p => <div key={p.clave} role="columnheader" title={p.titulo}>{p.titulo}</div>)}
                                    <div role="columnheader" />
                                </div>
                                {g.items.map(a => {
                                    const destino = siguienteEtapa(a);
                                    return (
                                        <div key={a.id} role="row" className={`cv-tr cv-tr--fila${seleccionada === a.id ? ' cv-tr--sel' : ''}${destino ? '' : ' cv-tr--hecha'}`}
                                            onClick={() => onAbrir(a)}>
                                            <div role="cell">
                                                <i className="cv-urg" style={{ '--t': urgenciaDe(a, ahora).color }} aria-hidden="true" />
                                                <span className="cv-nombre" title={a.lead_name}>{a.lead_name || 'Sin nombre'}</span>
                                                {a.unread_comment && <span className="kc-nuevo">Nuevo</span>}
                                            </div>
                                            {props.map(p => <div key={p.clave} role="cell"><Celda agenda={a} clave={p.clave} ahora={ahora} nombreCloser={nombreCloser} /></div>)}
                                            <div role="cell" className="cv-acc" onClick={(e) => e.stopPropagation()}>
                                                {a.phone && (
                                                    <a className="cv-wa" href={whatsapp(a.phone)} target="_blank" rel="noreferrer" aria-label={`WhatsApp de ${a.lead_name}`} title="Abrir WhatsApp">
                                                        <MessageCircle aria-hidden="true" />
                                                    </a>
                                                )}
                                                {destino && a.id > 0
                                                    ? <Button variant={primario && destino === 'confirmado' ? 'primary' : 'secondary'} onClick={() => onMover(a.id, destino)}>{BOTON[destino]}</Button>
                                                    : !destino && <span className="cv-listo"><Check aria-hidden="true" />Listo</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                );
            })}
        </div>
    );
}
