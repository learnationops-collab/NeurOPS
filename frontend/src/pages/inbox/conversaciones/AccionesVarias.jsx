// La barra de «Elegir» (1426, ADR-W274): elegir todas las de la lista, y a las elegidas marcarlas leídas, sacarlas
// de «Esperan respuesta» (No requieren respuesta, como ADR-W235, hasta que el lead vuelva a escribir) o etiquetarlas.
import { useState } from 'react';
import { CheckCheck, CircleSlash, Tag } from 'lucide-react';
import { Button, toast } from '../../../components/standard';
import { inboxApi } from '../api';

export default function AccionesVarias({ visibles, marcadas, onMarcarTodas, onEtiquetar, onHecho }) {
    const [enviando, setEnviando] = useState(false);
    const n = marcadas.length;
    const todas = visibles.length > 0 && visibles.every((c) => marcadas.includes(c.id));
    const hacer = async (accion) => {
        setEnviando(true);
        try {
            const r = await inboxApi.cerrarVarias(marcadas, accion);
            toast(accion === 'leido' ? `${r.hechas} marcadas como leídas` : `${r.hechas} ya no esperan respuesta`);
            onHecho();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo', 'error');
        } finally {
            setEnviando(false);
        }
    };
    return (
        <div className="cv-masiva">
            <b>{n ? `${n} ${n === 1 ? 'elegida' : 'elegidas'}` : 'Tocá las que querés cerrar o etiquetar'}</b>
            <Button size="sm" variant="ghost" onClick={() => onMarcarTodas(todas ? [] : visibles.map((c) => c.id))}>
                {todas ? 'Ninguna' : `Todas (${visibles.length})`}
            </Button>
            <Button size="sm" icon={<CheckCheck />} disabled={!n || enviando} onClick={() => hacer('leido')}
                data-tip="Leídas|Dejan de contar como sin leer">Leídas</Button>
            <Button size="sm" icon={<CircleSlash />} disabled={!n || enviando} onClick={() => hacer('resuelta')}
                data-tip="No requieren respuesta|Salen de «Esperan respuesta» y quedan leídas, hasta que el lead vuelva a escribir">No requieren</Button>
            <Button size="sm" variant="primary" icon={<Tag />} disabled={!n || enviando} onClick={onEtiquetar}>Etiquetar</Button>
        </div>
    );
}
