// El broadcast de WhatsApp de cada taller en Próximos talleres (ADR-W259): cuántos contactos tiene y cuántos
// pasos programó. Se vuelve a pedir al cerrar o minimizar la ventana del broadcast.
import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import api from '../../../../services/api';
import { Chip } from '../../../../components/standard';
import { useVentanas } from '../../../../ventanas/ventanasStore';

export function useResumenBroadcast(ids) {
    const [datos, setDatos] = useState(null);
    const abierta = useVentanas().some((v) => v.key === 'broadcast-taller' && v.estado === 'abierta');
    const clave = ids.join(',');
    useEffect(() => {
        if (!clave || abierta) return;
        // Sin el resumen la fila sigue igual: un fallo solo deja el chip afuera.
        Promise.resolve().then(() => api.get('/whatsapp/talleres', { params: { ids: clave } }))
            .then((r) => setDatos(r.data)).catch(() => setDatos(null));
    }, [clave, abierta]);
    return datos;
}

export default function ChipBroadcast({ resumen, estandar }) {
    if (!resumen) {
        return estandar
            ? <Chip subtle color="var(--idle)" icon={<Megaphone aria-hidden="true" />} data-tip="Broadcast|Sin audiencia. Arranca con el flujo estándar">WA · sin audiencia</Chip>
            : null;
    }
    const color = resumen.programados ? 'var(--success)' : 'var(--idle)';
    return (
        <Chip subtle color={color} icon={<Megaphone aria-hidden="true" />}
            data-tip="Broadcast|Contactos con la etiqueta y pasos programados de su flujo">
            WA · {resumen.contactos} · {resumen.programados + resumen.lanzados} de {resumen.pasos} pasos
        </Chip>
    );
}
