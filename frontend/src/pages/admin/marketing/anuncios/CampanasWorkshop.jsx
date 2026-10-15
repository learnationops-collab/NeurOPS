import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { formatear } from './metricas';
import { marcarCampanaWorkshop, mensajeDeError } from './marketingApi';

/**
 * Qué campañas de Meta llevan a las landings del workshop. Se marcan a mano (no se adivina por el
 * nombre): su gasto, impresiones y clics pasan a ser la inversión, el CPM, el CPC y los clics de cada
 * taller en Workshop Intelligence (ver `app/services/workshop_meta_service.py`).
 */
const CampanasWorkshop = ({ campanas, onCambio }) => {
    const [guardando, setGuardando] = useState(null);
    const [lista, setLista] = useState(campanas);
    useEffect(() => setLista(campanas), [campanas]);
    const [verTodas, setVerTodas] = useState(false);

    const marcar = async (campana) => {
        setGuardando(campana.campana_id);
        try {
            await marcarCampanaWorkshop(campana.campana_id, !campana.workshop);
            setLista((l) => l.map((c) => (c.campana_id === campana.campana_id ? { ...c, workshop: !c.workshop } : c)));
            onCambio?.();
        } catch (e) {
            toast.error(mensajeDeError(e, 'No se pudo guardar la campaña.'));
        } finally {
            setGuardando(null);
        }
    };

    const marcadas = lista.filter((c) => c.workshop);
    const visibles = verTodas ? lista : lista.slice(0, Math.max(8, marcadas.length));
    const gastoWorkshop = marcadas.reduce((s, c) => s + c.gasto, 0);

    return (
        <section className="panel mk-panel-tabla">
            <div className="panel-cab mk-tabla-barra">
                <div className="mk-cab-txt">
                    <h2 className="t-h3">Campañas de workshop</h2>
                    <p className="t-cap mut40">
                        Las que llevan a las landings del taller. Su gasto es la inversión de cada workshop
                        {marcadas.length > 0 && <> · {marcadas.length} marcadas, {formatear(gastoWorkshop, 'money')} en el período</>}.
                    </p>
                </div>
            </div>
            {!lista.length ? (
                <p className="t-cap mut mk-vacio">No hay campañas con gasto en el período.</p>
            ) : (
                <div className="mk-tabla-caja">
                    <table className="mk-tabla mk-tabla--meta">
                        <thead>
                            <tr>
                                <th scope="col" className="mk-col-nombre">Campaña</th>
                                <th scope="col" className="mk-num">Anuncios</th>
                                <th scope="col" className="mk-num">Gastado en el período</th>
                                <th scope="col" className="mk-col-ws">Es de workshop</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibles.map((c) => (
                                <tr key={c.campana_id}>
                                    <td className="mk-col-nombre"><span className="trunc" title={c.nombre}>{c.nombre}</span></td>
                                    <td className="mk-num num">{c.anuncios}</td>
                                    <td className="mk-num num">{formatear(c.gasto, 'money')}</td>
                                    <td className="mk-col-ws">
                                        <input type="checkbox" checked={c.workshop} disabled={guardando === c.campana_id}
                                            onChange={() => marcar(c)} aria-label={`${c.nombre} es de workshop`} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {lista.length > visibles.length && (
                <button type="button" className="pastilla pastilla--sm mk-ver-mas" onClick={() => setVerTodas(true)}>
                    Ver las {lista.length} campañas
                </button>
            )}
        </section>
    );
};

export default CampanasWorkshop;
