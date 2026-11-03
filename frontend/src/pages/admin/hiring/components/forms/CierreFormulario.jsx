import React from 'react';
import { Timer } from 'lucide-react';
import { Input, Segmented } from '../../../../../components/standard';
import './cierreFormulario.css';

// La cuenta regresiva de la página de la vacante de este formulario. «Fecha fija»
// cierra para todos a la misma hora; «Por visita» le da a cada persona N horas desde
// que entra por primera vez; «Sin cuenta» no muestra reloj. Se guarda con el
// autoguardado del editor.

const MODOS = [
    { value: 'fecha', label: 'Fecha fija' },
    { value: 'visita', label: 'Por visita' },
    { value: '', label: 'Sin cuenta' },
];

const pad = (n) => String(n).padStart(2, '0');

// ISO en UTC -> valor de <input type="datetime-local"> en la hora de esta computadora.
const aLocal = (iso) => {
    const d = iso ? new Date(iso) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Por defecto, dentro de tres días a las 23:59.
const fechaPorDefecto = () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    d.setHours(23, 59, 0, 0);
    return d.toISOString();
};

const CierreFormulario = ({ cierre, onCambio }) => {
    const c = cierre || {};
    const modo = c.modo || '';
    const fecha = c.en ? new Date(c.en) : null;
    const vencida = modo === 'fecha' && fecha && fecha.getTime() < Date.now();

    const elegir = (m) => {
        if (m === 'fecha') onCambio({ ...c, modo: 'fecha', en: c.en || fechaPorDefecto() });
        else if (m === 'visita') onCambio({ ...c, modo: 'visita', horas: c.horas || 96 });
        else onCambio({ ...c, modo: null });
    };

    let detalle = 'La página no muestra cuenta regresiva.';
    if (modo === 'fecha' && fecha) {
        detalle = vencida
            ? 'Esa fecha ya pasó: la página muestra la postulación cerrada.'
            : `Cierra para todos el ${fecha.toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} (hora de tu computadora).`;
    }
    if (modo === 'visita') {
        const h = c.horas || 96;
        detalle = `Cada persona tiene ${h % 24 === 0 ? `${h / 24} ${h / 24 === 1 ? 'día' : 'días'}` : `${h} horas`} desde su primera visita.`;
    }

    return (
        <div className="tl-cierre">
            <span className="tl-cierre-etq"><Timer size={14} aria-hidden="true" /> Cierre</span>
            <Segmented size="sm" label="Cuenta regresiva" value={modo} options={MODOS} onChange={elegir} />
            {modo === 'fecha' && (
                <Input type="datetime-local" variant="date" aria-label="Fecha y hora de cierre" value={aLocal(c.en)}
                    onChange={(e) => e.target.value && onCambio({ ...c, en: new Date(e.target.value).toISOString() })} />
            )}
            {modo === 'visita' && (
                <span className="tl-cierre-horas">
                    <Input variant="number" inputMode="numeric" aria-label="Horas desde la primera visita" value={c.horas ?? ''}
                        onChange={(e) => {
                            const n = Number(e.target.value.replace(/\D/g, ''));
                            if (n >= 1 && n <= 720) onCambio({ ...c, horas: n });
                        }} />
                    horas
                </span>
            )}
            <small className={`tl-cierre-det${vencida ? ' is-vencida' : ''}`}>{detalle}</small>
        </div>
    );
};

export default CierreFormulario;
