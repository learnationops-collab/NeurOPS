import { AlarmClock, BarChart3, Check, Repeat, Send, SlidersHorizontal } from 'lucide-react';
import { useCuenta } from '../../closer/novedades/Mocks';
import './escenas.css';

// Las escenas del recorrido de seguimientos del Inbox (ADR-W255), con el mismo lenguaje que las del Workspace
// (`closer/novedades/Mocks.jsx`): chiquitas, en bucle, con datos de ejemplo.

const Casilla = () => (
    <div className="nv-m tr-casilla">
        <div className="tr-burbuja tr-burbuja--yo">¿Pudiste ver el link?<small>Vos · ayer 12:40</small></div>
        <span className="tr-silencio">14 h sin respuesta</span>
        <div className="tr-fila">
            <span className="tr-check"><i><Check aria-hidden="true" /></i>Seguimiento 2</span>
            <span className="tr-enviar"><Send aria-hidden="true" />Enviar</span>
        </div>
    </div>
);

const Mensaje = () => (
    <div className="nv-m tr-mensaje">
        <div className="tr-burbuja tr-burbuja--yo tr-burbuja--grande">
            Te guardé un lugar para la llamada de hoy
            <small>Vos · 10:05<span className="tr-marcar"><Repeat aria-hidden="true" /></span><b className="tr-tag"><Repeat aria-hidden="true" />Seguimiento 1</b></small>
        </div>
        <span className="tr-puntero" aria-hidden="true" />
    </div>
);

const Programar = () => (
    <div className="nv-m tr-programar">
        <span className="tr-reloj"><AlarmClock aria-hidden="true" /></span>
        <div className="tr-horas">{['1 h', '3 h', '24 h', '2 días'].map((h, k) => <span key={h} className={k === 2 ? 'is-on' : ''}>{h}</span>)}</div>
        <em>Sale solo si no responde. Si escribe antes, se cancela.</em>
    </div>
);

const Toca = () => (
    <div className="nv-m tr-toca">
        {[{ n: 'Christian R.', f: 'Propuesta', t: 'Toca seguimiento 2' }, { n: 'Lucía M.', f: 'Conexión', t: 'Toca seguimiento 1' }].map((x, k) => (
            <div key={x.n} className="tr-row" style={{ '--k': k }}>
                <i>{x.n[0]}</i><span><b>{x.n}</b><small>{x.f}</small></span><em><AlarmClock aria-hidden="true" />{x.t}</em>
            </div>
        ))}
    </div>
);

const Filtro = () => (
    <div className="nv-m tr-filtro">
        <span className="tr-filtro-t"><SlidersHorizontal aria-hidden="true" />Filtro · Seguimientos</span>
        <div className="tr-chips">{['Ninguno', '1', '2', '3', '4 o más'].map((c, k) => <span key={c} style={{ '--k': k }}>{c}</span>)}</div>
        <em>Con la etapa: «Dolor con 2 seguimientos»</em>
    </div>
);

const Reporte = () => {
    const n = useCuenta(8, 1200, 500);
    return (
        <div className="nv-m tr-reporte">
            <BarChart3 aria-hidden="true" />
            <b>{n}</b>
            <em>follow-ups hoy, contando lo que marcaste</em>
        </div>
    );
};

const ESCENAS = { casilla: Casilla, mensaje: Mensaje, programar: Programar, toca: Toca, filtro: Filtro, reporte: Reporte };

export default function Escena({ tipo }) {
    const Componente = ESCENAS[tipo];
    return Componente ? <Componente /> : null;
}
