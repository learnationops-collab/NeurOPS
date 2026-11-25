// Lo que el setter manda aparece en el chat al instante, antes de que conteste el servidor: «enviando…» y, si
// Instagram no lo acepta, «no salió» con el motivo y Reintentar. Cuando el chat se vuelve a pedir y ya trae el
// mensaje real, el provisorio se va. Varios mensajes juntos (los de la Guía) salen de a uno, con ESPERA entre
// cada uno: menos carga para Instagram y más natural para el lead (pedido de los setters, 25/11).
const ESPERA = 5000;
const dormir = (ms) => new Promise((r) => { setTimeout(r, ms); });
const nuevo = (cuerpo, rotulo, estado) => ({ id: `p${Date.now()}${Math.random()}`, cuerpo, rotulo, estado, en: new Date().toISOString() });
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
        const p = nuevo(cuerpo, rotulo, 'enviando');
        setPendientes((l) => [...l, p]);
        return mandar(p);
    };
    // `items`: [[cuerpo, rotulo], …]. Si uno no sale, los que siguen quedan con Reintentar para mandarlos en orden.
    const enviarVarios = async (items) => {
        const lista = items.map(([cuerpo, rotulo], i) => nuevo(cuerpo, rotulo, i ? 'cola' : 'enviando'));
        setPendientes((l) => [...l, ...lista]);
        for (let i = 0; i < lista.length; i += 1) {
            if (i) {
                await dormir(ESPERA);
                cambiar(lista[i].id, { estado: 'enviando' });
            }
            if (!(await mandar(lista[i]))) {
                lista.slice(i + 1).forEach((p) => cambiar(p.id, { estado: 'error', motivo: 'no salió el anterior; mandalos en orden' }));
                return false;
            }
        }
        return true;
    };
    const reintentar = (p) => {
        cambiar(p.id, { estado: 'enviando', motivo: null });
        return mandar(p);
    };
    const descartar = (id) => setPendientes((l) => l.filter((x) => x.id !== id));

    return { pendientes, enviar, enviarVarios, reintentar, descartar };
}
