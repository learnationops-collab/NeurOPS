// «Activo / Inactivo» en la barra de arriba (ADR-W245): el setter lo prende cuando está atendiendo y lo apaga al
// dejar. Las Stats separan su demora activo de inactivo y cuánto estuvo activo. Se apaga solo a las 12 h.
import { useEffect, useState } from 'react';
import { toast } from '../../../components/standard';
import { inboxApi } from '../api';

function duracion(seg) {
    const min = Math.round(seg / 60);
    return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ''}`.trim();
}

export default function Actividad() {
    const [estado, setEstado] = useState(null);
    const [enviando, setEnviando] = useState(false);
    useEffect(() => {
        let vivo = true;
        inboxApi.actividad().then((e) => { if (vivo) setEstado(e); }, () => {});
        return () => { vivo = false; };
    }, []);
    if (!estado) return null;
    const cambiar = async () => {
        const antes = estado;
        setEstado({ ...estado, activo: !estado.activo }); // se ve al toque; si falla, vuelve
        setEnviando(true);
        try {
            setEstado(await inboxApi.cambiarActividad(!antes.activo));
        } catch (e) {
            setEstado(antes);
            toast(e.response?.data?.message || 'No se pudo cambiar', 'error');
        } finally {
            setEnviando(false);
        }
    };
    const desde = estado.desde ? new Date(estado.desde).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : null;
    const tip = estado.activo
        ? `Estás activo${desde ? ` desde las ${desde}` : ''}|${duracion(estado.segundos_24h)} activo en las últimas 24 h. Apagalo al dejar de atender`
        : 'Estás inactivo|Prendelo mientras atendés: las Stats separan tu demora activo e inactivo';
    return (
        <button type="button" className={`cv-activo${estado.activo ? ' cv-activo--on' : ''}`} role="switch" aria-checked={estado.activo}
            disabled={enviando} onClick={cambiar} data-tip={tip}>
            <span className="cv-activo-punto" aria-hidden="true" />
            {estado.activo ? 'Activo' : 'Inactivo'}
        </button>
    );
}
