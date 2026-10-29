import React, { useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import CuerpoAgendasTaller from './CuerpoAgendasTaller';
import './agendas.css';

/**
 * Las agendas detrás del número «N agendas» de un taller (o de varios, con `tallerIds`): la MISMA
 * lista de Revisar que usan Closing y la Dirección Comercial —estado, resultado, closer, si asistió,
 * si hubo venta—, para que quien analiza Marketing vea qué pasó con cada persona del número.
 *
 * Es de lectura: la ficha de una fila se abre en solo lectura y sin exportar, ni operar (ver `CuerpoAgendasTaller`).
 * `esperado` es el número que se tocó: si la lista trae otra cuenta, se dice (no debería pasar).
 */
const ModalAgendasTaller = ({ tallerIds, titulo, subtitulo = null, esperado = null, onCerrar }) => {
    const [conFicha, setConFicha] = useState(false);
    return (
        // Con la ficha abierta esta ventana no se cierra: Escape y el fondo son de la ficha.
        <Modal titulo={titulo} subtitulo={subtitulo || 'Agendas del taller'} ancho="6xl" cerrable={!conFicha}
            icono={<CalendarCheck size={20} className="text-pink-400" />} onCerrar={onCerrar}>
            <CuerpoAgendasTaller tallerIds={tallerIds} titulo={titulo} esperado={esperado} onFicha={setConFicha} />
        </Modal>
    );
};

export default ModalAgendasTaller;
