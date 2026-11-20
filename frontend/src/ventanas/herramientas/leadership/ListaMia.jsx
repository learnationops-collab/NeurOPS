// «Lo mío»: lo que te pasaron para definir, los rituals de hoy y lo que sigue, en el orden de tu Momentum.
// Tocar una fila deja cambiar la fecha, ajustarla, pasársela a otro o abrirla en Leadership.
import { useState } from 'react';
import { ExternalLink, Repeat, Send, SlidersHorizontal } from 'lucide-react';
import { Avatar, Button, EmptyState, Input, LinkButton, Segmented, Select } from '../../../components/standard';
import { atajosDeFecha, duracion, fechaCorta } from './formato';
import { Casilla, RChip } from './piezas';

function Entregar({ pide, onEntregar, onCancelar }) {
    const [valor, setValor] = useState('');
    const formato = pide.formatos?.[0];
    return (
        <form className="lr-entregar" onSubmit={e => { e.preventDefault(); if (valor.trim()) onEntregar(valor.trim()); }}>
            <p><b>{pide.para?.nombre || 'Te'} pidió</b>{pide.nota ? ` ${pide.nota}` : ' una entrega'}.</p>
            <Input value={valor} autoFocus onChange={e => setValor(e.target.value)}
                placeholder={formato === 'link' || formato === 'video' ? 'Pegá el link' : 'Escribí lo que entregás o pegá un link'} />
            <div className="lr-entregar__acc">
                <Button variant="ghost" onClick={onCancelar}>Después</Button>
                <Button variant="primary" type="submit" icon={<Send size={14} />} disabled={!valor.trim()}>Entregar</Button>
            </div>
        </form>
    );
}

function Fila({ el, abierta, onAbrirFila, entrega, acciones, personas }) {
    const [pasando, setPasando] = useState(false);
    const hecha = el.estado === 'hecha';
    const meta = [
        el.r && <RChip key="r" r={el.r} />,
        el.arquetipo?.nombre,
        el.pasos ? `${el.pasos.hechos}/${el.pasos.total} pasos` : duracion(el.minutos),
        fechaCorta(el.fecha) && <span key="f" className={fechaCorta(el.fecha) === 'Hoy' || fechaCorta(el.fecha) === 'Vencida' ? 'lr-vence' : ''}>{fechaCorta(el.fecha)}</span>,
        el.de && `de ${el.de.nombre}`,
        (el.pide_entrega || el.sigue?.pide_entrega) && <span key="e" className="lr-pide">se entrega</span>,
        el.entregado && <span key="en" className="lr-pide">entregada, en revisión</span>,
    ].filter(Boolean);
    const fechas = atajosDeFecha();

    return (
        <div className={`lr-fila${abierta ? ' is-abierta' : ''}${hecha ? ' is-hecha' : ''}`}>
            <div className="lr-fila__top" role="button" tabIndex={0} onClick={onAbrirFila}
                onKeyDown={e => { if (e.key === 'Enter') onAbrirFila(); }}>
                <span onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} role="presentation">
                    <Casilla hecha={hecha || el.entregado} disabled={el.entregado}
                        label={el.sigue ? `Completar «${el.sigue.titulo}»` : 'Completar'} onClick={() => acciones.completar(el)} />
                </span>
                <div className="lr-fila__info">
                    <div className="lr-fila__t">{el.titulo}</div>
                    {el.sigue && <div className="lr-fila__m">Sigue: <b>{el.sigue.titulo}</b></div>}
                    <div className="lr-fila__m">{meta.map((m, i) => <span key={i}>{i > 0 && ' · '}{m}</span>)}</div>
                </div>
            </div>

            {entrega && <Entregar pide={entrega.pide} onCancelar={acciones.cancelarEntrega} onEntregar={v => acciones.entregar(entrega.id, v)} />}

            {abierta && (
                <div className="lr-fila__mas">
                    <Segmented size="sm" label="Fecha" value={el.fecha || ''} options={fechas} onChange={v => acciones.fecha(el, v)} />
                    <div className="lr-fila__acc">
                        {el.clase !== 'tarea' && el.tipo !== 'habit' && (
                            <Button icon={<SlidersHorizontal size={14} />} onClick={() => acciones.ajustar(el)}>Ajustar</Button>
                        )}
                        {!el.de && el.tipo !== 'habit' && (pasando && personas ? (
                            <Select size="sm" value="" label="Pasársela a"
                                options={[{ value: '', label: 'Pasársela a…' }, ...personas.map(p => ({ value: p.email, label: p.nombre }))]}
                                onChange={v => { if (v) { setPasando(false); acciones.pasar(el, v); } }} />
                        ) : (
                            <Button onClick={() => { acciones.pedirPersonas(); setPasando(true); }}>Pasársela a…</Button>
                        ))}
                        <LinkButton icon={<ExternalLink size={13} />} onClick={() => acciones.abrir(el.abrir)}>Abrir en Leadership</LinkButton>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ListaMia({ panel, acciones, entrega, personas }) {
    const [abierta, setAbierta] = useState(null);
    const rituals = panel.mio.filter(e => e.tipo === 'habit');
    const resto = panel.mio.filter(e => e.tipo !== 'habit');

    return (
        <>
            {panel.te_pasaron.length > 0 && (
                <>
                    <p className="lr-sec">Te pasaron · para definir</p>
                    {panel.te_pasaron.map(b => (
                        <div className="lr-nueva" key={b.id}>
                            <Avatar name={b.de?.nombre} photo={b.de?.foto} size="sm" />
                            <div className="lr-fila__info">
                                <div className="lr-fila__t">{b.titulo}</div>
                                <div className="lr-fila__m">{b.de?.nombre} te la pasó{b.entrega ? ' · pide una entrega' : ''}</div>
                            </div>
                            <Button variant="primary" onClick={() => acciones.definir(b)}>Definir</Button>
                        </div>
                    ))}
                </>
            )}

            {rituals.length > 0 && (
                <>
                    <p className="lr-sec">Rituals de hoy</p>
                    {rituals.map(h => (
                        <div className={`lr-fila${h.hecho_hoy ? ' is-hecha' : ''}`} key={`h${h.id}`}>
                            <div className="lr-fila__top">
                                <Casilla cuadrada hecha={h.hecho_hoy} label={h.hecho_hoy ? 'Reabrir' : 'Hecho por hoy'} onClick={() => acciones.ritual(h)} />
                                <div className="lr-fila__info">
                                    <div className="lr-fila__t">{h.titulo}</div>
                                    <div className="lr-fila__m"><Repeat size={12} aria-hidden="true" /> {h.hora || 'Sin horario'}
                                        {h.rutinas?.total > 0 && ` · ${h.rutinas.hechas}/${h.rutinas.total} hechas`}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </>
            )}

            <p className="lr-sec">Para hacer <span>{resto.length}</span></p>
            {resto.length === 0 ? (
                <EmptyState title="Nada pendiente">Escribí arriba lo que surja y queda en tu Momentum.</EmptyState>
            ) : resto.map(el => {
                const clave = `${el.tipo}${el.id}`;
                const idEntrega = entrega?.fila === clave ? entrega : null;
                return (
                    <Fila key={clave} el={el} abierta={abierta === clave} entrega={idEntrega} acciones={acciones} personas={personas}
                        onAbrirFila={() => setAbierta(a => (a === clave ? null : clave))} />
                );
            })}
        </>
    );
}

