import React, { useState } from 'react';
import { FlaskConical, X } from 'lucide-react';
import { closerPorId, FUNNELS, PREGUNTAS } from '../shared/mockData';

const nombre = (id) => closerPorId(id)?.nombre || id;

export const PERFILES = {
    alto: { examen: 'Residencia 2027', formacion: 'Médico/a recibido/a', empleo: 'No, me dedico a estudiar', puntaje: 'Entre 10 y 20', inversion: 'Sí, puedo invertir ahora', apoyo: 'Yo', interes: 'Quiero un método para llegar a la residencia 2027.' },
    medio: { examen: 'Residencia 2028 o después', formacion: 'Internado', empleo: 'Sí, medio tiempo', puntaje: 'Menos de 10', inversion: 'Sí, en 1 a 3 meses', apoyo: 'Lo decido con mi familia o pareja', interes: 'Ordenar el estudio con el internado.' },
    descalificado: { examen: 'Todavía no lo decidí', formacion: 'Primeros años de la carrera', empleo: 'Sí, tiempo completo', puntaje: 'Todavía no rendí', inversion: 'No puedo invertir ahora', apoyo: 'Otra persona', interes: 'Ver de qué se trata.' },
};

// Solo existe en el laboratorio: muestra lo que el lead nunca ve, cómo decidió el motor.
export default function PanelLab({ funnelId, onFunnel, decision, reserva, onPerfil }) {
    const [abierto, setAbierto] = useState(false);
    const s = {
        panel: { position: 'fixed', left: 16, bottom: 16, zIndex: 20, width: 'min(360px, calc(100vw - 32px))', maxHeight: '70vh', overflowY: 'auto', background: 'rgba(10,14,61,.97)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 14, padding: 16, fontSize: 12, color: '#A9B0CC', boxShadow: '0 20px 50px rgba(0,0,0,.5)' },
        h: { fontSize: 10, fontWeight: 700, letterSpacing: '.22em', textTransform: 'uppercase', color: '#6E779B', margin: '14px 0 6px' },
        big: { fontSize: 22, fontWeight: 900, color: '#fff' },
        chip: { padding: '5px 9px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', fontSize: 11, fontWeight: 700 },
        row: { display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0' },
    };

    if (!abierto) {
        return (
            <button type="button" onClick={() => setAbierto(true)} style={{ ...s.chip, position: 'fixed', left: 16, bottom: 16, zIndex: 20, background: 'rgba(10,14,61,.97)', color: '#fff', display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px' }}>
                <FlaskConical size={14} /> Cómo decide el sistema
            </button>
        );
    }

    return (
        <aside style={s.panel} aria-label="Laboratorio">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: '#fff', fontWeight: 800, display: 'flex', gap: 8, alignItems: 'center' }}><FlaskConical size={14} /> Laboratorio</strong>
                <button type="button" aria-label="Cerrar" onClick={() => setAbierto(false)}><X size={16} /></button>
            </div>

            <p style={s.h}>Embudo</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {FUNNELS.map(f => (
                    <button key={f.id} type="button" onClick={() => onFunnel(f.id)}
                        style={{ ...s.chip, ...(f.id === funnelId ? { background: '#FF3FA4', borderColor: '#FF3FA4', color: '#020617' } : {}) }}>{f.nombre}</button>
                ))}
            </div>

            <p style={s.h}>Completar con un lead de ejemplo</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.keys(PERFILES).map(k => <button key={k} type="button" style={s.chip} onClick={() => onPerfil(PERFILES[k])}>{k}</button>)}
            </div>

            <p style={s.h}>Puntaje</p>
            <div style={s.big}>{decision.puntaje.score}<span style={{ fontSize: 12, color: '#6E779B' }}> / 100 · {decision.segmento}</span></div>
            {decision.puntaje.descalificador && <div style={{ color: '#FF8AC6', marginTop: 4 }}>Descalificador: “{decision.puntaje.descalificador.opcion}”</div>}
            <div style={{ marginTop: 6 }}>
                {decision.puntaje.detalle.map(d => (
                    <div key={d.preguntaId} style={s.row}>
                        <span>{PREGUNTAS.find(p => p.id === d.preguntaId)?.id}</span>
                        <span style={{ color: d.respuesta ? '#fff' : '#6E779B' }}>{d.respuesta ? `${d.puntos}/${d.mejor} ×${d.peso}` : 'sin responder'}</span>
                    </div>
                ))}
            </div>

            <p style={s.h}>Cola {decision.ranking.segmentoFinal}{decision.ranking.desbordes.length ? ` (desbordó desde ${decision.ranking.desbordes.join(' → ')})` : ''} · {decision.ranking.modo}</p>
            {decision.ranking.candidatos.map((c, i) => (
                <div key={c.closer} style={s.row}>
                    <span style={{ color: decision.oferta.incluidos.includes(c.closer) ? '#fff' : '#6E779B' }}>{i + 1}. {nombre(c.closer)}</span>
                    <span>{c.motivo}</span>
                </div>
            ))}
            {!!decision.ranking.llenos?.length && <div style={{ marginTop: 4 }}>En su tope: {decision.ranking.llenos.map(nombre).join(', ')}</div>}
            <div style={{ marginTop: 6 }}>Se ofrecen horarios de {decision.oferta.incluidos.length} de {decision.oferta.enCola} closers · {decision.oferta.horarios.length} horarios</div>

            {reserva && (
                <>
                    <p style={s.h}>Asignación</p>
                    <div style={{ color: '#fff', fontWeight: 800 }}>{nombre(reserva.closer)}</div>
                    <div>{reserva.motivo}{reserva.alternativas?.length ? ` · también libres: ${reserva.alternativas.map(nombre).join(', ')}` : ''}</div>
                </>
            )}
        </aside>
    );
}
