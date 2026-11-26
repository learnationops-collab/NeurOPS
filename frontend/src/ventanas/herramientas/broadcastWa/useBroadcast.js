// Los datos de «Broadcast de WhatsApp» (ADR-W229, /api/whatsapp): plantillas aprobadas, el historial con el tope
// del día y el envío. Mientras un envío tiene pendientes, el historial se vuelve a pedir cada pocos segundos.
import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';

const REFRESCO = 5000;

export const ESTADOS = {
    pendiente: { label: 'Pendiente', color: 'var(--ln-warning, #c98a14)' },
    enviado: { label: 'Enviado', color: 'var(--ln-text-faint, #8a8ea0)' },
    entregado: { label: 'Entregado', color: 'var(--ln-success, #1f9d6b)' },
    leido: { label: 'Leído', color: 'var(--ln-info, #3b7dd8)' },
    respondio: { label: 'Respondió', color: '#7D63E6' },
    fallo: { label: 'Falló', color: 'var(--ln-error, #c8433a)' },
};

/** Lo que llegó al menos a ese estado (un leído también fue entregado y enviado). */
export function embudo(porEstado = {}) {
    const n = (k) => porEstado[k] || 0;
    const respondieron = n('respondio');
    const leidos = n('leido') + respondieron;
    const entregados = n('entregado') + leidos;
    return { enviados: entregados + n('enviado'), entregados, leidos, respondieron, fallaron: n('fallo'), pendientes: n('pendiente') };
}

/** Texto y botones de una plantilla de Meta. */
export function partesDe(p) {
    const comps = p?.components || [];
    const cuerpo = comps.find((c) => c.type === 'BODY')?.text || '';
    const botones = (comps.find((c) => c.type === 'BUTTONS')?.buttons || []).map((b) => b.text);
    return { cuerpo, botones };
}

const mensaje = (e, fallback) => e?.response?.data?.message || fallback;

export function useBroadcast() {
    const [todas, setTodas] = useState(null);
    const [historial, setHistorial] = useState(null);
    const [error, setError] = useState(null);

    const pedirHistorial = useCallback(() => api.get('/whatsapp/envios')
        .then((r) => setHistorial(r.data))
        .catch((e) => setError(mensaje(e, 'No se pudo cargar el historial'))), []);

    const pedirPlantillas = useCallback(() => api.get('/whatsapp/plantillas')
        .then((r) => setTodas(r.data.plantillas || []))
        .catch((e) => { setTodas((t) => t || []); setError(mensaje(e, 'No se pudieron traer las plantillas de Meta')); }), []);

    useEffect(() => {
        pedirPlantillas();
        pedirHistorial();
    }, [pedirPlantillas, pedirHistorial]);
    const plantillas = useMemo(() => todas && todas.filter((p) => p.status === 'APPROVED'), [todas]);

    const mandando = (historial?.lotes || []).find((l) => l.por_estado?.pendiente > 0) || null;
    useEffect(() => {
        if (!mandando) return undefined;
        const cada = setInterval(pedirHistorial, REFRESCO);
        return () => clearInterval(cada);
    }, [mandando, pedirHistorial]);

    const revisar = (csv) => api.post('/whatsapp/envios/revisar', { csv }).then((r) => r.data);
    const enviar = (datos) => api.post('/whatsapp/envios', datos).then((r) => { pedirHistorial(); return r.data; });
    const frenar = (lote) => api.post(`/whatsapp/envios/${lote}/frenar`).then(() => pedirHistorial());
    const numeros = (lote) => api.get(`/whatsapp/envios/${lote}`).then((r) => r.data.numeros);

    const crearPlantilla = (datos) => api.post('/whatsapp/plantillas', datos).then((r) => { pedirPlantillas(); return r.data; });
    const borrarPlantilla = (nombre) => api.delete(`/whatsapp/plantillas/${encodeURIComponent(nombre)}`).then(() => pedirPlantillas());
    const respuestas = (nombre) => api.get(`/whatsapp/plantillas/${encodeURIComponent(nombre)}/respuestas`).then((r) => r.data);
    const guardarRespuesta = (nombre, boton, datos) => api
        .put(`/whatsapp/plantillas/${encodeURIComponent(nombre)}/respuestas/${encodeURIComponent(boton)}`, datos).then((r) => r.data);

    return {
        plantillas, todas, historial, error, mandando, revisar, enviar, frenar, numeros, recargar: pedirHistorial, mensaje,
        recargarPlantillas: pedirPlantillas, crearPlantilla, borrarPlantilla, respuestas, guardarRespuesta,
    };
}
