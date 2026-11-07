import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { telefonoLegible } from '../../../../components/ficha/FichaHeader';
import { useEnPantalla } from '../../../../components/ui/useEnPantalla';
import { TONO_SEGMENTO, fmtPuntos } from '../../datosDelLead';

// Qué pasó en la llamada, en una palabra.
const LLAMADA = {
    'show up': { texto: 'Tomada', tono: 'var(--cl-info)' },
    'no show': { texto: 'No asistió', tono: 'var(--cl-warning)' },
    cancelado: { texto: 'Canceló', tono: 'var(--cl-warning)' },
    cancelada: { texto: 'Canceló', tono: 'var(--cl-warning)' },
    reagendado: { texto: 'Reagendó', tono: 'var(--cl-lila)' },
    reagendada: { texto: 'Reagendó', tono: 'var(--cl-lila)' },
    '2da call': { texto: '2ª llamada', tono: 'var(--cl-info)' },
    'lead perdido': { texto: 'Perdido', tono: 'var(--cl-magenta)' },
};

const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });

// La línea de cómo va: lo de hoy primero; si no, lo último que se hizo.
const comoVa = (f) => {
    if (f.estado === 'pago') return { texto: 'Pagó después de la llamada', tono: 'ok', icono: '$' };
    if (f.estado === 'descartado') return { texto: 'Descartado', tono: 'apagado', icono: '×' };
    if (f.estado === 'agendado') return { texto: `Llamada agendada · ${fechaCorta(f.proxima_llamada)}`, tono: 'info', icono: '◷' };
    if (f.hoy === 'respondio') return { texto: 'Seguido hoy · respondió', tono: 'ok', icono: '✓' };
    if (f.hoy === 'no_respondio') return { texto: 'Seguido hoy · no respondió', tono: 'ok', icono: '✓' };
    if (f.respondio) return { texto: 'Respondió antes · sin seguir hoy', tono: 'pend' };
    if (f.sin_respuesta) return { texto: `${f.sin_respuesta} sin respuesta · sin seguir hoy`, tono: 'pend' };
    return { texto: 'Sin seguimiento', tono: 'pend' };
};

const OPCIONES = [
    { clave: 'respondio', texto: 'Le escribí · respondió' },
    { clave: 'no_respondio', texto: 'Le escribí · no respondió' },
    { clave: 'venta', texto: 'Registrar pago o venta' },
    { clave: 'seg', texto: 'Agendar otra llamada' },
    { clave: 'seg', texto: 'Descartar', id: 'descartar' },
];

/** Una persona del embudo en una fila: quién es, qué pasó en la llamada, cómo va y «Registrar». */
const FilaEmbudo = ({ f, orden, abierto, ocupado, onMenu, onRegistrar, onFicha }) => {
    const llamada = LLAMADA[(f.closer_result || '').trim().toLowerCase()];
    const va = comoVa(f);
    const tel = (f.phone || '').trim();
    const menu = useEnPantalla();
    const caja = useRef(null);

    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => {
            if (caja.current?.contains(e.target)) return;
            onMenu(null);
        };
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, [abierto, onMenu]);

    const elegir = (o) => {
        onMenu(null);
        if (o.clave === 'respondio' || o.clave === 'no_respondio') onRegistrar(f, o.clave);
        else onFicha(f, o.clave);
    };

    const copiar = () => navigator.clipboard?.writeText(tel)
        .then(() => toast.success('Teléfono copiado')).catch(() => toast.error('No se pudo copiar'));

    return (
        <div className={`emb-fila emb-fila--${va.tono}`} style={{ '--i': orden }} ref={caja}>
            <div className="emb-l1">
                <button type="button" className="emb-nombre" title={`Abrir la ficha de ${f.lead_name}`} onClick={() => onFicha(f, 'seg')}>
                    {f.lead_name}
                </button>
                {f.segmento && (
                    <span className="ktag-v6" style={{ '--c': TONO_SEGMENTO[f.segmento] || 'var(--cl-info)' }}>
                        {f.segmento}{f.segmento_puntos != null ? ` ${fmtPuntos(f.segmento_puntos)}` : ''}
                    </span>
                )}
            </div>
            <div className="emb-meta">
                {llamada && <span className="emb-llamada" style={{ '--c': llamada.tono }}>{llamada.texto}</span>}
                {tel && (
                    <button type="button" className="emb-tel" title="Copiar teléfono" onClick={copiar}>{telefonoLegible(tel)}</button>
                )}
            </div>
            <div className="emb-l3">
                <span className={`emb-va emb-va--${va.tono}`}>{va.icono && <i aria-hidden="true">{va.icono}</i>}{va.texto}</span>
                <span className="emb-acc">
                    <button type="button" className="emb-reg" aria-haspopup="menu" aria-expanded={abierto}
                        disabled={ocupado} onClick={() => onMenu(abierto ? null : f.id)}>
                        Registrar ▾
                    </button>
                    {abierto && (
                        <div className="emb-menu" role="menu" ref={menu}>
                            {OPCIONES.map(o => (
                                <button key={o.id || o.clave} type="button" role="menuitem" onClick={() => elegir(o)}>{o.texto}</button>
                            ))}
                        </div>
                    )}
                </span>
            </div>
        </div>
    );
};

export default FilaEmbudo;
