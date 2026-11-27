// «Transferir» (Mario, 26/11/2026; antes la pastilla «Vos» que delegaba): pasa la conversación a otra persona. Un
// setter solo ve a los otros setters (Paula → Eli, no a Dari); triage, a triage. La dirección ve a todos y «Sin asignar».
import { ArrowLeftRight, Check } from 'lucide-react';
import useEnPantalla from '../../../components/ui/useEnPantalla';
import { Avatar, toast } from '../../../components/standard';
import { useAuth } from '../../../contexts/AuthContext';
import { inboxApi } from '../api';
import useDesplegable from './useDesplegable';
import useEquipo from './useEquipo';

const DE_EQUIPO = ['setter', 'triage'];

export default function Transferir({ contacto, asignado, yo, onCambio }) {
    const { user } = useAuth() || {};
    const equipo = useEquipo();
    const d = useDesplegable();
    const pop = useEnPantalla();
    const deEquipo = DE_EQUIPO.includes(user?.role);
    const opciones = equipo.filter((s) => s.id !== asignado?.id && (deEquipo ? s.rol === user.role && s.id !== yo : true));
    const elegir = async (id) => {
        d.setAbierto(false);
        try {
            await inboxApi.asignar(contacto.id, id);
            const quienEs = equipo.find((s) => s.id === id);
            toast(id == null ? 'Quedó sin asignar' : id === yo ? 'Volvió a vos' : `Transferida a ${quienEs?.nombre || 'otro setter'}`, 'success');
            onCambio();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo transferir', 'error');
        }
    };
    const de = asignado ? (asignado.id === yo ? 'vos' : asignado.username) : null;
    return (
        <div className="cv-tarjeta-pop-caja cv-accion-caja" ref={d.caja}>
            <button type="button" className="cv-accion cv-accion--transferir" aria-expanded={d.abierto} disabled={!opciones.length && !!asignado}
                data-tip={`Transferir|${de ? `Asignada a ${de}. ` : 'Sin asignar. '}Pasala a ${deEquipo ? 'otro setter' : 'otra persona'}`}
                onClick={() => d.setAbierto((a) => !a)}>
                <ArrowLeftRight size={13} aria-hidden="true" />Transferir
            </button>
            {d.abierto && (
                <div className="cv-tarjeta-pop" ref={pop} role="menu" aria-label="Transferir a">
                    <span className="t-rotulo">Transferir a</span>
                    {opciones.map((s) => (
                        <button key={s.id} type="button" className="cv-tarjeta-op" role="menuitem" onClick={() => elegir(s.id)}>
                            <Avatar name={s.nombre} size="xs" />{s.id === yo ? 'Vos' : s.nombre}
                        </button>
                    ))}
                    {!opciones.length && <span className="t-cap mut">No hay a quién</span>}
                    {!deEquipo && asignado && <button type="button" className="cv-tarjeta-op" onClick={() => elegir(null)}>Sin asignar</button>}
                    {asignado && <span className="cv-tarjeta-op cv-tarjeta-op--actual"><Check size={13} />Ahora: {de}</span>}
                </div>
            )}
        </div>
    );
}
