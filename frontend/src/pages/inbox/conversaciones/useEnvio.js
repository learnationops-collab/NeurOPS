// Lo que el setter manda aparece en el chat al instante, antes de que conteste el servidor: «enviando…» y, si
// Instagram no lo acepta, «no salió» con el motivo y Reintentar. Cuando el chat se vuelve a pedir y ya trae el
// mensaje real, el provisorio se va.
import { useCallback, useState } from 'react';
import { inboxApi } from '../api';

export default function useEnvio(contactoId, onCambio) {
    const [pendientes, setPendientes] = useState([]);
    const cambiar = (id, x) => setPendientes((l) => l.map((p) => (p.id === id ? { ...p, ...x } : p)));

    const mandar = useCallback(async (p) => {
        try {
            await inboxApi.escribir(contactoId, p.cuerpo);
        } catch (e) {
            cambiar(p.id, { estado: 'error', motivo: e.response?.data?.message || 'No se pudo enviar' });
            Promise.resolve(onCambio()).catch(() => {}); // si salió igual, el chat lo trae y el «no salió» se va (Detalle)
            return false;
        }
        try {
            await onCambio();
        } finally {
            setPendientes((l) => l.filter((x) => x.id !== p.id));
        }
        return true;
    }, [contactoId, onCambio]);

    // `rotulo`: cómo se ve en el chat mientras sale (el texto, o «🎤 nombre» para un audio).
    const enviar = (cuerpo, rotulo) => {
        const p = { id: `p${Date.now()}${Math.random()}`, cuerpo, rotulo, estado: 'enviando', en: new Date().toISOString() };
        setPendientes((l) => [...l, p]);
        return mandar(p);
    };
    const reintentar = (p) => {
        cambiar(p.id, { estado: 'enviando', motivo: null });
        return mandar(p);
    };
    const descartar = (id) => setPendientes((l) => l.filter((x) => x.id !== id));

    return { pendientes, enviar, reintentar, descartar };
}
