import React, { useState } from 'react';
import { HardDrive } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../services/api';
import { Button, Chip, FieldError, Modal, ModalHeader, Switch, TextArea } from '../../../../components/standard';
import { diaMes } from './formato';

/**
 * Pegar el CSV de grabaciones que arma Claude in Chrome desde Drive: primero la vista previa (el
 * backend simula), después se guarda. Un taller que ya tenía otra grabación no se pisa sin el switch.
 */

export const ESTADOS_CARGA = {
    nueva: { texto: 'Se carga', color: 'var(--success)' },
    reemplaza: { texto: 'Reemplaza', color: 'var(--warning)' },
    ya_tenia: { texto: 'Ya tenía otra', color: 'var(--warning)' },
    igual: { texto: 'Ya estaba', color: undefined },
    sin_link: { texto: 'Sin link', color: undefined },
    error: { texto: 'Error', color: 'var(--error)' },
};

const EJEMPLO = 'event_id,fecha,nombre,link_drive\n15,2026-10-12,Clase grupal para médicos,https://drive.google.com/file/d/…/view';

const enviar = (csv, opciones) => api.post('workshop/events/grabaciones', { csv, ...opciones }).then((r) => r.data);

const Fila = ({ f }) => {
    const estado = ESTADOS_CARGA[f.estado] || ESTADOS_CARGA.error;
    return (
        <li className="wt-carga-fila">
            <span className="num t-cap mut">{f.fecha ? diaMes(f.fecha) : `Fila ${f.fila}`}</span>
            <span className="wt-carga-nombre">
                <span className="trunc" title={f.nombre || ''}>{f.nombre || '—'}</span>
                {f.motivo && <small className="t-cap mut">{f.motivo}</small>}
                {f.estado === 'ya_tenia' && <small className="t-cap mut trunc" title={f.anterior}>Tiene: {f.anterior}</small>}
            </span>
            <Chip color={estado.color} subtle>{estado.texto}</Chip>
        </li>
    );
};

const CargarGrabaciones = ({ onCerrar, onGuardado }) => {
    const [csv, setCsv] = useState('');
    const [previa, setPrevia] = useState(null);
    const [sobrescribir, setSobrescribir] = useState(false);
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState(null);

    const revisar = async (sobre = sobrescribir) => {
        setOcupado(true);
        setError(null);
        try {
            setPrevia(await enviar(csv, { simular: true, sobrescribir: sobre }));
        } catch (err) {
            setPrevia(null);
            setError(err.response?.data?.error || 'No se pudo leer el CSV');
        } finally {
            setOcupado(false);
        }
    };

    const cambiarSobrescribir = (valor) => {
        setSobrescribir(valor);
        if (previa) revisar(valor);
    };

    const guardar = async () => {
        setOcupado(true);
        try {
            const r = await enviar(csv, { simular: false, sobrescribir });
            const n = (r.resumen.nueva || 0) + (r.resumen.reemplaza || 0);
            toast.success(`${n} ${n === 1 ? 'grabación cargada' : 'grabaciones cargadas'}`);
            onGuardado();
            onCerrar();
        } catch (err) {
            setError(err.response?.data?.error || 'No se pudo guardar');
            setOcupado(false);
        }
    };

    const r = previa?.resumen || {};
    const aCargar = (r.nueva || 0) + (r.reemplaza || 0);

    return (
        <Modal onClose={onCerrar} labelledBy="wt-carga-titulo" className="wt-carga">
            <ModalHeader titleId="wt-carga-titulo" icon={<HardDrive size={18} aria-hidden="true" />}
                title="Cargar grabaciones de Drive" subtitle="Pegá el CSV de Claude in Chrome: primero ves qué cambia." onClose={onCerrar} />
            <div className="wt-carga-cuerpo">
                <TextArea value={csv} placeholder={EJEMPLO} aria-label="CSV de grabaciones" spellCheck={false}
                    onChange={(e) => { setCsv(e.target.value); setPrevia(null); }} />
                {error && <FieldError>{error}</FieldError>}
                {previa && (
                    <>
                        <p className="t-cap mut num">
                            {aCargar} para cargar · {r.igual || 0} ya estaban · {r.ya_tenia || 0} con otra · {(r.sin_link || 0) + (r.error || 0)} sin cargar
                        </p>
                        <ul className="wt-carga-lista" aria-label="Vista previa">
                            {previa.filas.map((f) => <Fila key={f.fila} f={f} />)}
                        </ul>
                    </>
                )}
                <div className="wt-carga-switch">
                    <Switch checked={sobrescribir} onChange={cambiarSobrescribir} label="Reemplazar las que ya tenían otra" />
                    <span className="t-cap">Reemplazar las que ya tenían otra</span>
                </div>
            </div>
            <div className="wt-carga-pie">
                <Button onClick={onCerrar}>Cancelar</Button>
                {previa ? (
                    <Button variant="primary" disabled={ocupado || aCargar === 0} onClick={guardar}>
                        Guardar {aCargar}
                    </Button>
                ) : (
                    <Button variant="primary" disabled={ocupado || !csv.trim()} onClick={() => revisar()}>Revisar</Button>
                )}
            </div>
        </Modal>
    );
};

export default CargarGrabaciones;
