import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import FichaLeadModal from '../../../../components/ficha/FichaLeadModal';
import { useAuth } from '../../../../contexts/AuthContext';
import Revisar from '../../../comercial/components/Revisar';
import { useAgendasTaller } from './useAgendasTaller';
import '../../../comercial/comercial.css';
import './agendas.css';

/**
 * Lo que va dentro de la ventana de las agendas de un taller (o de varios): el resumen de lo que dice el número y la
 * MISMA lista de Revisar que usan Closing y la Dirección Comercial. Lo usan la ventana (`ModalAgendasTaller`) y el
 * panel «ver registros» del Resumen. `onFicha(abierta)` avisa si hay una ficha abierta (la ventana no se cierra
 * con Escape mientras tanto).
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

const CuerpoAgendasTaller = ({ tallerIds, titulo, esperado = null, onFicha = null }) => {
    const { user } = useAuth();
    const { datos, fallo, recargar } = useAgendasTaller(tallerIds);
    const [fila, setFila] = useState(null);
    const conFicha = ROLES_CON_FICHA.includes(user?.role);
    useEffect(() => { onFicha?.(Boolean(fila)); }, [fila, onFicha]);

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
            <div className="dc-shell dc-shell--embebido agm">
                {datos && <Resumen datos={datos} esperado={esperado} />}
                <Revisar tabla="agendas" setTabla={SIN_FUNCION} tablas={['agendas']} rol="closers"
                    datos={datos && { filas: datos.filas, dates: null }} cargando={false} fallo={fallo}
                    onRecargar={recargar} basis="meet" setBasis={null} alcance={titulo} conTodas
                    filtroInicial={null} onOlvidarFiltro={SIN_FUNCION} onAbrirFila={abrir} />
            </div>
            {/* La ficha no tiene portal y su velo (z 90) quedaría debajo de la ventana (z 170) o del panel: sale a `body`
                dentro de un contexto de apilado por encima de ambos y por debajo del widget de bugs. */}
            {fila && createPortal(
                <div style={{ position: 'relative', zIndex: 175 }}>
                    <FichaLeadModal appointmentId={fila.id} soloLectura onCerrar={() => setFila(null)} />
                </div>,
                document.body,
            )}
        </>
    );
};

export default CuerpoAgendasTaller;
