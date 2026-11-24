// Detalle de un número: valor, cómo se calcula y los registros que lo componen (GET /api/reporte/detalle).
import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Button, Modal, ModalHeader, Skeleton, SkeletonRow, SkeletonText } from '../../components/standard';
import { Cuenta } from './animar';
import { nomDia } from './formato';

const MAX = 12;

export default function DetalleNumero({ dato, userId, hoy, onClose, onCorregir }) {
    const [det, setDet] = useState(null);
    const [error, setError] = useState(null);
    const [todos, setTodos] = useState(false);
    useEffect(() => {
        let vivo = true;
        const params = { fecha: dato.fecha, clave: dato.clave, ...(dato.periodo ? { periodo: dato.periodo } : {}), ...(userId ? { user_id: userId } : {}) };
        api.get('/reporte/detalle', { params })
            .then((res) => { if (vivo) setDet(res.data || {}); })
            .catch((e) => { if (vivo) { console.error(`Error al cargar el detalle: ${e}`); setError(e.response?.data?.error || 'No se pudo cargar el detalle.'); } });
        return () => { vivo = false; };
    }, [dato, userId]);

    const titulo = det?.l || dato.l;
    const v = det && 'v' in det ? det.v : dato.v;
    const f = det?.f || dato.f || 'n';
    const mano = det?.mano ?? dato.mano;
    const filas = det?.filas || [];
    const visibles = todos ? filas : filas.slice(0, MAX);
    const ctx = dato.ctx || `Tus números · ${!dato.fecha || dato.fecha === hoy ? 'hoy' : nomDia(dato.fecha)}`;

    return (
        <Modal onClose={onClose} className="rp-ex" labelledBy="rp-ex-t">
            <ModalHeader flush title={titulo} subtitle={ctx} titleId="rp-ex-t" onClose={onClose} />
            <div className="rp-ex__cuerpo">
                <div className="rp-ex__val"><Cuenta v={v} f={f} />{mano && <em className="rp-tag-m">a mano</em>}</div>
                {error && <p className="rp-ex__mas">{error}</p>}
                {!det && !error && (
                    <Skeleton label="Cargando el detalle…">
                        <SkeletonText lines={2} height={10} lineHeight={20} />
                        {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} cells={['40%', '20%', '20%', '20%']} height={38} step={i} />)}
                    </Skeleton>
                )}
                {det && (
                    <>
                        {det.como && <div className="rp-ex__como"><b>Cómo se calcula</b><p>{det.como}</p></div>}
                        {filas.length > 0 ? (
                            <>
                                <div className="rp-ex__caja">
                                    <table className="rp-ex__tabla">
                                        <thead><tr>{(det.cols || []).map((c) => <th key={c}>{c}</th>)}</tr></thead>
                                        <tbody>
                                            {visibles.map((fila, k) => (
                                                <tr key={k} style={{ animationDelay: `${120 + Math.min(k, MAX) * 35}ms` }}>
                                                    {fila.map((c, j) => <td key={j}>{c == null ? '—' : String(c)}</td>)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {!todos && filas.length > MAX && (
                                    <p className="rp-ex__mas">y {filas.length - MAX} más · <button className="rp-otra" type="button" onClick={() => setTodos(true)}>Ver todos</button></p>
                                )}
                            </>
                        ) : (
                            <p className="rp-ex__mas">{mano && v == null ? 'Todavía no lo cargaste.' : 'No hubo registros.'}</p>
                        )}
                    </>
                )}
            </div>
            <footer className="rp-ex__pie">
                <span>{det?.fuente ? `Fuente: ${det.fuente}` : ''}</span>
                {dato.corr && onCorregir && <Button onClick={() => { onCorregir(dato.bloque); onClose(); }}>Corregir el número</Button>}
            </footer>
        </Modal>
    );
}
