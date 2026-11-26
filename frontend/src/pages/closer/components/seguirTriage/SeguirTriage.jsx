// «Seguir» de triage como bandeja que se vacía cada día (ADR-W241, mockup docs/mockups/seguimientos-triage/).
// Hoy: atrasados y los del día, con la cuenta hacia cero. Esperan fecha: los que dijeron «te aviso».
// Hechos hoy: lo que ya tuvo contacto. Cada fila se resuelve ahí mismo (FilaSeguir).
import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { EmptyState, Segmented } from '../../../../components/standard';
import FilaSeguir from './FilaSeguir';
import useSeguirTriage from './useSeguirTriage';
import './seguirTriage.css';

function Grupo({ titulo, filas, alerta, ...resto }) {
    if (!filas.length) return null;
    return (
        <>
            <div className={`st-grupo${alerta ? ' st-grupo--alerta' : ''}`}>
                {alerta && <AlertCircle size={13} />}{titulo} · {filas.length}
            </div>
            {filas.map((f) => <FilaSeguir key={f.id} fila={f} {...resto} />)}
        </>
    );
}

export default function SeguirTriage({ refreshKey, onOpenLead }) {
    const { datos, error, accion } = useSeguirTriage(refreshKey);
    const [vista, setVista] = useState('hoy');

    if (error) return <EmptyState title="No se pudo cargar Seguir">{error}</EmptyState>;
    if (!datos) return <p className="st-cargando">Trayendo tus seguimientos…</p>;

    const pendientes = datos.atrasados.length + datos.para_hoy.length;
    const hechos = datos.hechos.length;
    const total = pendientes + hechos;
    // Desde la fila se abre la ficha: en el contacto del seguimiento, o en Resultado para volver a
    // reportar la llamada cuando el lead decidió (pasa a closing o al low ticket).
    const abrir = (fila, clave) => onOpenLead({
        ...fila, fase: clave ? 'res' : 'seg', tipo: fila.seguimiento_tipo,
    });
    const comunes = { motivos: datos.motivos, diasSinNoticias: datos.dias_sin_noticias, onAccion: accion, onAbrir: abrir };

    return (
        <div className="st">
            <div className="st-barra">
                <Segmented value={vista} onChange={setVista} options={[
                    { value: 'hoy', label: 'Hoy', count: pendientes },
                    { value: 'esperan', label: 'Esperan fecha', count: datos.esperan.length },
                    { value: 'hechos', label: 'Hechos hoy', count: hechos },
                ]} />
            </div>
            {vista === 'hoy' && (
                <>
                    <div className="st-meta">
                        <span className="st-meta-num">{pendientes}</span>
                        <span className="st-meta-txt">
                            <b>{pendientes === 1 ? 'pendiente para hoy' : 'pendientes para hoy'}</b>
                            <br />{hechos} {hechos === 1 ? 'resuelto' : 'resueltos'} · la meta es dejarla en 0
                        </span>
                        <span className="st-meta-barra"><i style={{ width: `${total ? (hechos / total) * 100 : 100}%` }} /></span>
                    </div>
                    {pendientes === 0 ? (
                        <EmptyState title="Bandeja en cero">No queda nada para hoy.</EmptyState>
                    ) : (
                        <div className="st-lista">
                            <Grupo titulo="Atrasados" alerta filas={datos.atrasados} modo="hoy" {...comunes} />
                            <Grupo titulo="Para hoy" filas={datos.para_hoy} modo="hoy" {...comunes} />
                        </div>
                    )}
                </>
            )}
            {vista === 'esperan' && (
                datos.esperan.length ? (
                    <div className="st-lista">
                        <p className="st-ayuda">Dijeron «te aviso». No vencen ni traban el reporte; si dijeron un momento, ese día pasan a Hoy.</p>
                        {datos.esperan.map((f) => <FilaSeguir key={f.id} fila={f} modo="esperan" {...comunes} />)}
                    </div>
                ) : <EmptyState title="Nadie esperando fecha">Cuando un lead reprograma sin fecha, aparece acá.</EmptyState>
            )}
            {vista === 'hechos' && (
                hechos ? (
                    <div className="st-lista">
                        {datos.hechos.map((f) => <FilaSeguir key={f.id} fila={f} modo="hechos" {...comunes} />)}
                    </div>
                ) : <EmptyState title="Todavía nada hoy">Lo que resuelvas aparece acá.</EmptyState>
            )}
        </div>
    );
}
