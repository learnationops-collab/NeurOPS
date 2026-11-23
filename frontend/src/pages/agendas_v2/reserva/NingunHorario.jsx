// «Ningún horario me sirve» (Marlon 19/11/2026, ADR-W199): ya con la sesión agendada, el lead avisa que el
// horario no le sirve y qué le quedaría bien. La agenda sigue en pie y el triage la reagenda.
import { useState } from 'react';
import { Icono } from '../ui/base';

export default function NingunHorario({ enviar }) {
    const [abierto, setAbierto] = useState(false);
    const [texto, setTexto] = useState('');
    const [estado, setEstado] = useState('');  // '' | 'enviando' | 'ok' | 'error'
    if (!enviar) return null;
    if (estado === 'ok') {
        return (
            <p className="rv-sinh rv-sinh--ok" role="status"><Icono n="check" s={16} />
                <span>Listo, te escribimos para buscar otro horario. Mientras tanto tu sesión sigue agendada.</span>
            </p>
        );
    }
    if (!abierto) {
        return (
            <button type="button" className="rv-sinh-abrir rv-link" onClick={() => setAbierto(true)}>
                Ningún horario me sirve
            </button>
        );
    }
    const mandar = () => {
        if (!texto.trim() || estado === 'enviando') return;
        setEstado('enviando');
        enviar(texto.trim()).then(() => setEstado('ok'), () => setEstado('error'));
    };
    return (
        <div className="rv-sinh">
            <label className="rv-sinh-lbl" htmlFor="rv-sinh-txt">¿Qué días y horarios te quedan bien?</label>
            <textarea id="rv-sinh-txt" className="rv-sinh-txt" rows={3} maxLength={500} autoFocus value={texto}
                placeholder="Por ejemplo: martes o jueves después de las 18 h" onChange={e => setTexto(e.target.value)} />
            <p className="rv-sinh-ayuda">Tu sesión sigue agendada hasta que acordemos otro horario.</p>
            {estado === 'error' && <p className="rv-sinh-error" role="alert">No se pudo enviar. Probá de nuevo.</p>}
            <div className="rv-sinh-acc">
                <button type="button" className="rv-seguir" disabled={!texto.trim() || estado === 'enviando'} onClick={mandar}>
                    {estado === 'enviando' ? 'Enviando…' : 'Enviar'}
                </button>
                <button type="button" className="rv-link" onClick={() => setAbierto(false)}>Cancelar</button>
            </div>
        </div>
    );
}
