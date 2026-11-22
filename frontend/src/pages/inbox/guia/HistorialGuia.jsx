// Historial de la Guía (versiones publicadas) y propuestas. La dirección comercial vuelve a una versión y
// responde las propuestas; el setter ve las suyas y en qué quedaron.
import { useEffect, useState } from 'react';
import { Button, Chip, EmptyState, Modal, ModalHeader, Segmented, TextArea, toast } from '../../../components/standard';
import { inboxApi } from '../api';
import { faseDe } from '../conversaciones/fasesSetting';

const cuando = (iso) => (iso ? new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const ESTADO = { pendiente: ['Pendiente', 'var(--warning)'], aprobada: ['Aprobada', 'var(--success)'], rechazada: ['Rechazada', 'var(--error)'] };

export function Proponer({ etapa, onCerrar }) {
    const [texto, setTexto] = useState('');
    const mandar = async () => {
        try {
            await inboxApi.proponerGuia(texto.trim(), etapa);
            toast('Propuesta enviada a la dirección comercial');
            onCerrar();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo enviar', 'error');
        }
    };
    return (
        <Modal onClose={onCerrar} className="gu-modal" labelledBy="gu-prop-t">
            <ModalHeader title="Proponer un cambio" titleId="gu-prop-t" onClose={onCerrar}
                subtitle="Lo aprueba la dirección comercial. Mientras tanto sigue lo de ahora." />
            <div className="gu-modal-cuerpo">
                <TextArea value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus aria-label="Propuesta"
                    placeholder={etapa ? `Qué querés cambiar de ${faseDe(etapa).label} y por qué` : 'Qué querés cambiar y por qué'} />
                <div className="gu-modal-pie">
                    <Button onClick={onCerrar}>Cancelar</Button>
                    <Button variant="primary" disabled={!texto.trim()} onClick={mandar}>Mandar</Button>
                </div>
            </div>
        </Modal>
    );
}

function Propuesta({ p, puede, onCambio }) {
    const [respuesta, setRespuesta] = useState('');
    const [e, color] = ESTADO[p.estado] || ESTADO.pendiente;
    const responder = async (estado) => {
        try {
            await inboxApi.responderPropuestaGuia(p.id, estado, respuesta.trim());
            onCambio();
        } catch (err) {
            toast(err.response?.data?.message || 'No se pudo responder', 'error');
        }
    };
    return (
        <div className="gu-prop">
            <div className="gu-prop-cab">
                <Chip subtle color={color}>{e}</Chip>
                {p.etapa && <b>{faseDe(p.etapa).label}</b>}
                <span className="t-cap mut">{p.por} · {cuando(p.en)}</span>
            </div>
            <p>{p.texto}</p>
            {p.respuesta && <p className="t-cap mut">{p.revisor}: {p.respuesta}</p>}
            {puede && p.estado === 'pendiente' && (
                <>
                    <TextArea value={respuesta} onChange={(ev) => setRespuesta(ev.target.value)} placeholder="Respuesta (para rechazar, obligatoria)" aria-label="Respuesta" />
                    <div className="gu-modal-pie">
                        <Button onClick={() => responder('rechazada')} disabled={!respuesta.trim()}>Rechazar</Button>
                        <Button variant="primary" onClick={() => responder('aprobada')}>Aprobar</Button>
                    </div>
                </>
            )}
        </div>
    );
}

export default function HistorialGuia({ puede, inicial = 'versiones', onRestaurada, onCerrar }) {
    const [vista, setVista] = useState(inicial);
    const [versiones, setVersiones] = useState(null);
    const [propuestas, setPropuestas] = useState(null);
    const pedirPropuestas = () => inboxApi.propuestasGuia().then(setPropuestas, () => setPropuestas([]));
    useEffect(() => {
        inboxApi.historialGuia().then(setVersiones, () => setVersiones([]));
        pedirPropuestas();
    }, []);
    const restaurar = async (v) => {
        try {
            onRestaurada(await inboxApi.restaurarGuia(v.id));
            toast('Guía restaurada');
            onCerrar();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo restaurar', 'error');
        }
    };
    return (
        <Modal onClose={onCerrar} className="gu-modal gu-modal--ancho" labelledBy="gu-hist-t">
            <ModalHeader title="Historial de la guía" titleId="gu-hist-t" onClose={onCerrar}>
                <Segmented size="sm" value={vista} onChange={setVista}
                    options={[{ value: 'versiones', label: 'Versiones' }, { value: 'propuestas', label: 'Propuestas', count: propuestas?.filter((p) => p.estado === 'pendiente').length || undefined }]} />
            </ModalHeader>
            <div className="gu-modal-cuerpo">
                {vista === 'versiones' && (versiones === null ? <EmptyState>Cargando…</EmptyState> : versiones.length === 0
                    ? <EmptyState>Todavía nadie publicó cambios: rige la estructura del documento de setting.</EmptyState>
                    : versiones.map((v, i) => (
                        <div key={v.id} className="gu-version">
                            <span><b>{cuando(v.en)}</b> · {v.por || 'Sin autor'}{v.nota ? ` · ${v.nota}` : ''}</span>
                            {i === 0 ? <Chip subtle color="var(--success)">Vigente</Chip> : puede && <Button size="sm" onClick={() => restaurar(v)}>Volver a esta</Button>}
                        </div>
                    )))}
                {vista === 'propuestas' && (propuestas === null ? <EmptyState>Cargando…</EmptyState> : propuestas.length === 0
                    ? <EmptyState>No hay propuestas.</EmptyState>
                    : propuestas.map((p) => <Propuesta key={p.id} p={p} puede={puede} onCambio={pedirPropuestas} />))}
            </div>
        </Modal>
    );
}
