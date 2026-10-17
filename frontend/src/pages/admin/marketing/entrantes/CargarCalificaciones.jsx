import { useMemo, useState } from 'react';
import { Upload } from 'lucide-react';
import api from '../../../../services/api';
import toast from 'react-hot-toast';
import { Button, FieldError, Modal, ModalHeader, TextArea } from '../../../../components/standard';

/**
 * Cargar calificaciones en lote (16/10/2026): una persona por renglón, «quién, calificación». Quién es el
 * manychat_id o el @ de Instagram; la calificación, lo que guarda ManyChat en «Cualificado» (yes/no, 1/0).
 * Primero muestra qué va a pasar y recién después aplica.
 */

/** «ana.gomez, no» · «12345;yes» · «@beto<TAB>1» → [{quien, calificacion}]. */
export const leerRenglones = (texto) => texto.split(/\r?\n/)
    .map((l) => l.trim()).filter(Boolean)
    .map((l) => l.split(/[,;\t]/).map((x) => x.trim()))
    .filter(([quien]) => quien && !/^(quien|id|ig|instagram|manychat_id)$/i.test(quien))
    .map(([quien, calificacion = '']) => ({ quien, calificacion }));

const CargarCalificaciones = ({ onCerrar, onAplicado }) => {
    const [texto, setTexto] = useState('');
    const [previa, setPrevia] = useState(null);
    const [error, setError] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const filas = useMemo(() => leerRenglones(texto), [texto]);

    const enviar = async (aplicar) => {
        setOcupado(true);
        setError(null);
        try {
            const { data } = await api.post('/manychat-webhook/calificaciones', { filas, aplicar });
            if (aplicar) {
                toast.success(`${data.cambios.toLocaleString('en-US')} calificaciones corregidas`);
                onAplicado();
                onCerrar();
            } else {
                setPrevia(data);
            }
        } catch (e) {
            setError(e.response?.data?.error || 'No se pudo cargar la lista.');
        } finally {
            setOcupado(false);
        }
    };

    return (
        <Modal onClose={onCerrar} labelledBy="en-cargar-titulo" className="en-cargar">
            <ModalHeader titleId="en-cargar-titulo" title="Cargar calificaciones" icon={<Upload size={18} aria-hidden="true" />}
                subtitle="Una persona por renglón: @instagram o id de ManyChat, y yes / no." onClose={onCerrar} />
            <div className="en-cargar-cuerpo">
                <TextArea value={texto} onChange={(e) => { setTexto(e.target.value); setPrevia(null); }}
                    placeholder={'ana.gomez, no\n@beto_md, yes\n1382291280, 0'} aria-label="Lista de calificaciones" />
                <p className="t-cap mut40">{filas.length.toLocaleString('en-US')} renglones</p>
                {error && <FieldError>{error}</FieldError>}
                {previa && (
                    <div className="en-cargar-previa" role="status">
                        <p><b>{previa.encontrados.toLocaleString('en-US')}</b> encontradas: {previa.por_estado.calificado} calificadas · {previa.por_estado.descalificado} descalificadas{previa.por_estado.sin_dato ? ` · ${previa.por_estado.sin_dato} sin dato` : ''}</p>
                        {previa.cantidad_no_encontrados > 0 && (
                            <p className="mut40">{previa.cantidad_no_encontrados} no están en el sistema: {previa.no_encontrados.slice(0, 8).join(', ')}{previa.cantidad_no_encontrados > 8 ? '…' : ''}</p>
                        )}
                        {previa.invalidas > 0 && <p className="mut40">{previa.invalidas} renglones sin yes / no válido</p>}
                    </div>
                )}
            </div>
            <div className="en-cargar-pie">
                <Button onClick={onCerrar}>Cancelar</Button>
                {previa && previa.encontrados > 0
                    ? <Button variant="primary" disabled={ocupado} onClick={() => enviar(true)}>Aplicar a {previa.encontrados.toLocaleString('en-US')}</Button>
                    : <Button variant="primary" disabled={ocupado || !filas.length} onClick={() => enviar(false)}>Revisar</Button>}
            </div>
        </Modal>
    );
};

export default CargarCalificaciones;
