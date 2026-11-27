// Lo que salió en cada paso del taller: enviados, entregados, leídos, respondieron y fallaron; tocando uno, sus
// números con lo que pasó con cada uno (y el chat si respondió).
import { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button, Chip, EmptyState, toast } from '../../../components/standard';
import { embudo, ESTADOS } from '../broadcastWa/useBroadcast';
import { cuandoEnPalabras, fechaCorta, mensajeDe } from './useBroadcastTaller';

function Numeros({ paso, datos, onVolver }) {
    const [filas, setFilas] = useState(null);
    useEffect(() => {
        datos.numeros(paso.id).then(setFilas).catch((e) => { toast(mensajeDe(e, 'No se pudieron traer'), 'error'); setFilas([]); });
    }, [paso.id]); // eslint-disable-line react-hooks/exhaustive-deps
    return (
        <div className="bt-col">
            <div className="bt-fila"><Button variant="ghost" icon={<ChevronLeft />} onClick={onVolver}>Pasos</Button>
                <b>{paso.nombre || paso.plantilla}</b><span className="bt-s">{fechaCorta(paso.lanzado_en)}</span></div>
            {filas === null ? <EmptyState title="Trayendo los números…" /> : (
                <div className="bt-tabla">
                    <table>
                        <thead><tr><th>Número</th><th>Estado</th><th>Respuesta</th><th>Setter</th></tr></thead>
                        <tbody>
                            {filas.map((f) => {
                                const e = ESTADOS[f.estado] || ESTADOS.enviado;
                                return (
                                    <tr key={f.telefono}>
                                        <td><span className="bt-tel">+{f.telefono}</span>{f.nombre && <small className="bt-s"> {f.nombre}</small>}</td>
                                        <td><Chip subtle color={e.color}>{e.label}</Chip>{f.error && <small className="bt-s" title={f.error}> {f.error.slice(0, 40)}</small>}</td>
                                        <td>{f.contacto_id ? <a className="bt-link" href={`/inbox?c=${f.contacto_id}`}>{f.respuesta || 'Ver chat'}</a> : '—'}</td>
                                        <td>{f.setter || '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default function Historial({ datos }) {
    const [abierto, setAbierto] = useState(null);
    const salieron = datos.plan.pasos.filter((p) => p.lote || p.estado === 'vencido');
    if (abierto) return <Numeros paso={abierto} datos={datos} onVolver={() => setAbierto(null)} />;
    if (!salieron.length) return <EmptyState title="Todavía no salió nada">Cuando un paso programado llegue a su hora, aparece acá.</EmptyState>;
    return (
        <div className="bt-tabla">
            <table>
                <thead><tr><th>Paso</th><th>Salió</th><th className="bt-n">Enviados</th><th className="bt-n">Entregados</th>
                    <th className="bt-n">Leídos</th><th className="bt-n">Respondieron</th><th className="bt-n">Pendientes</th><th className="bt-n">Fallaron</th></tr></thead>
                <tbody>
                    {salieron.map((p) => {
                        const e = embudo(p.por_estado);
                        return (
                            <tr key={p.id} className="bt-clic" onClick={() => p.lote && setAbierto(p)}>
                                <td><b>{p.nombre || p.plantilla}</b><small className="bt-s"> {cuandoEnPalabras(p)}</small></td>
                                <td>{p.estado === 'vencido' ? 'Venció sin salir' : fechaCorta(p.lanzado_en)}</td>
                                <td className="bt-n">{e.enviados}</td><td className="bt-n">{e.entregados}</td><td className="bt-n">{e.leidos}</td>
                                <td className="bt-n">{e.respondieron}</td><td className="bt-n">{e.pendientes}</td><td className="bt-n">{e.fallaron}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
