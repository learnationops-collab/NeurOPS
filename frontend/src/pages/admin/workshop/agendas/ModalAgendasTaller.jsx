import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../../../components/ui/Modal';
import FichaLeadModal from '../../../../components/ficha/FichaLeadModal';
import { useAuth } from '../../../../contexts/AuthContext';
import Revisar from '../../../comercial/components/Revisar';
import { useAgendasTaller } from './useAgendasTaller';
import '../../../comercial/comercial.css';
import './agendas.css';

/**
 * Las agendas detrás del número «N agendas» de un taller (o de varios, con `tallerIds`): la MISMA
 * lista de Revisar que usan Closing y la Dirección Comercial —estado, resultado, closer, si asistió,
 * si hubo venta—, para que quien analiza Marketing vea qué pasó con cada persona del número.
 *
 * Es de lectura: la ficha de una fila se abre en solo lectura y sin exportar, ni operar. La ficha la
 * ven los roles del backend (`ROLES_CON_ACCESO`); el director de marketing recibe un aviso.
 *
 * `esperado` es el número que se tocó: si la lista trae otra cuenta, se dice (no debería pasar).
 */

const ROLES_CON_FICHA = ['admin', 'operator'];
const SIN_FUNCION = () => {};

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

const Resumen = ({ datos, esperado }) => {
    const vivo = datos.talleres.reduce((a, t) => a + t.vivo, 0);
    const landing = datos.talleres.reduce((a, t) => a + t.landing, 0);
    const abierta = datos.talleres.some((t) => t.ventana?.abierta);
    const sinCita = datos.filas.filter((f) => f.sin_cita).length;
    const distinto = esperado != null && esperado !== datos.total;
    return (
        <div className="agm-resumen">
            <span className="chip" style={{ '--c': 'var(--brand-secondary)' }}>
                {plural(datos.total, 'persona agendada', 'personas agendadas')}
            </span>
            <span className="t-sm mut">
                {plural(vivo, 'del taller en vivo', 'del taller en vivo')} · {plural(landing, 'de la grabación', 'de la grabación')}
            </span>
            {sinCita > 0 && (
                <span className="t-cap mut40" title="Están en el libro de agendas pero ningún closer tiene su cita">
                    {plural(sinCita, 'persona sin cita con un closer', 'personas sin cita con un closer')}
                </span>
            )}
            {abierta && (
                <span className="t-cap mut40">La ventana del taller sigue abierta: puede sumar más agendas.</span>
            )}
            {distinto && (
                <span className="chip" style={{ '--c': 'var(--warning)' }}
                    title="El número guardado del taller es de la última vez que se actualizó">
                    El taller guarda {esperado}: actualizá los datos
                </span>
            )}
        </div>
    );
};

const ModalAgendasTaller = ({ tallerIds, titulo, subtitulo = null, esperado = null, onCerrar }) => {
    const { user } = useAuth();
    const { datos, fallo, recargar } = useAgendasTaller(tallerIds);
    const [fila, setFila] = useState(null);
    const conFicha = ROLES_CON_FICHA.includes(user?.role);

    const abrir = (f) => {
        if (f.sin_cita) {
            toast('Esta persona está en el libro de agendas, pero no tiene cita con un closer todavía.');
        } else if (!conFicha) {
            toast('Tu rol no abre la ficha del lead desde acá.');
        } else {
            setFila(f);
        }
    };

    return (
        <>
            {/* Con la ficha abierta este modal no se cierra: Escape y el fondo son de la ficha. */}
            <Modal titulo={titulo} subtitulo={subtitulo || 'Agendas del taller'} ancho="6xl" cerrable={!fila}
                icono={<CalendarCheck size={20} className="text-pink-400" />} onCerrar={onCerrar}>
                <div className="dc-shell dc-shell--embebido agm">
                    {datos && <Resumen datos={datos} esperado={esperado} />}
                    <Revisar tabla="agendas" setTabla={SIN_FUNCION} tablas={['agendas']} rol="closers"
                        datos={datos && { filas: datos.filas, dates: null }} cargando={false} fallo={fallo}
                        onRecargar={recargar} basis="meet" setBasis={null} alcance={titulo} conTodas
                        filtroInicial={null} onOlvidarFiltro={SIN_FUNCION} onAbrirFila={abrir} />
                </div>
            </Modal>
            {/* La ficha no tiene portal y su velo (z 90) quedaría debajo del modal (z 170): sale a `body`
                dentro de un contexto de apilado por encima del modal y por debajo del widget de bugs. */}
            {fila && createPortal(
                <div style={{ position: 'relative', zIndex: 175 }}>
                    <FichaLeadModal appointmentId={fila.id} soloLectura onCerrar={() => setFila(null)} />
                </div>,
                document.body,
            )}
        </>
    );
};

export default ModalAgendasTaller;
