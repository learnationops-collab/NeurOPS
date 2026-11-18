// «Lo que pedí»: lo que le pasaste a otros (desde acá, Cowork o una quick tuya que hace otra persona), con su
// estado. Tocar una fila deja pedirle un update o abrirla en Leadership.
import { useState } from 'react';
import { Bell, ExternalLink } from 'lucide-react';
import { Avatar, Button, Chip, EmptyState, LinkButton } from '../../../components/standard';
import { ESTADOS, fechaCorta } from './formato';
import { RChip } from './piezas';

export default function ListaPedi({ pedi, acciones }) {
    const [abierta, setAbierta] = useState(null);
    if (!pedi.length) {
        return <EmptyState title="No le pediste nada a nadie todavía">Escribí arriba y elegí quién la hace.</EmptyState>;
    }

    return (
        <>
            <p className="lr-sec">Lo que le pasaste a otros</p>
            {pedi.map(it => {
                const clave = `${it.tipo}${it.id}`;
                const estado = ESTADOS[it.estado] || ESTADOS.pendiente;
                return (
                    <div key={clave} className={`lr-fila${abierta === clave ? ' is-abierta' : ''}`}>
                        <div className="lr-fila__top" role="button" tabIndex={0}
                            onClick={() => setAbierta(a => (a === clave ? null : clave))}
                            onKeyDown={e => { if (e.key === 'Enter') setAbierta(a => (a === clave ? null : clave)); }}>
                            <Avatar name={it.persona?.nombre} photo={it.persona?.foto} size="sm" />
                            <div className="lr-fila__info">
                                <div className="lr-fila__t">{it.titulo}</div>
                                <div className="lr-fila__m">
                                    {it.persona?.nombre}{fechaCorta(it.fecha) && ` · ${fechaCorta(it.fecha)}`}
                                    {it.r && <> · <RChip r={it.r} /></>}
                                </div>
                            </div>
                            <Chip color={estado.color} subtle>{estado.label}</Chip>
                        </div>
                        {abierta === clave && (
                            <div className="lr-fila__mas lr-fila__acc">
                                {it.tipo === 'inbox' ? (
                                    <span className="lr-ayuda">Todavía no la abrió: le llegó a su Inbox.</span>
                                ) : it.estado !== 'hecha' && (
                                    <Button icon={<Bell size={14} />} onClick={() => acciones.pedirUpdate(it)}>Pedir un update</Button>
                                )}
                                {it.abrir && (
                                    <LinkButton icon={<ExternalLink size={13} />} onClick={() => acciones.abrir(it.abrir)}>Abrir en Leadership</LinkButton>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </>
    );
}
