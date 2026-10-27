// «Mis tareas» en la cabecera: un botón con cuántas tengo abiertas (en rojo si alguna venció) que
// despliega la lista; tocar una abre su conversación. Se vuelve a pedir con la bandeja.
import { useEffect, useRef, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import useEnPantalla from '../../../components/ui/useEnPantalla';
import { Avatar, IconButton } from '../../../components/standard';
import { inboxApi } from '../api';
import { quien } from './colas';
import { momento } from './Feed';

export default function MisTareas({ onAbrir, marca }) {
    const [tareas, setTareas] = useState([]);
    const [abierto, setAbierto] = useState(false);
    const caja = useRef(null);
    const pop = useEnPantalla();

    // `marca` cambia con cada vuelta de la bandeja: ahí se vuelve a pedir.
    useEffect(() => {
        let vivo = true;
        inboxApi.misTareas().then((t) => { if (vivo) setTareas(t); })
            .catch(() => { /* sin cambios: se reintenta en la próxima vuelta */ });
        return () => { vivo = false; };
    }, [marca]);
    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, [abierto]);

    const ahora = new Date();
    const vencidas = tareas.filter((t) => t.vence && new Date(t.vence) < ahora).length;
    return (
        <div className="cv-macro" ref={caja}>
            <IconButton label="Mis tareas" data-tip="Mis tareas" pressed={abierto} onClick={() => setAbierto((a) => !a)}
                icon={<><CalendarCheck size={16} />{tareas.length > 0 && <span className={`cv-macro-n${vencidas ? ' cv-macro-n--alerta' : ''}`}>{tareas.length}</span>}</>} />
            {abierto && (
                <div className="cv-tareas-pop" ref={pop} role="dialog" aria-label="Mis tareas">
                    <span className="t-rotulo">Mis tareas</span>
                    {!tareas.length && <p className="t-cap mut">Nada pendiente.</p>}
                    {tareas.map((t) => {
                        const tarde = t.vence && new Date(t.vence) < ahora;
                        return (
                            <button key={t.id} type="button" className="cv-tareas-op" onClick={() => { setAbierto(false); onAbrir(t.contacto_id); }}>
                                <Avatar name={t.contacto?.username || t.contacto?.nombre || '?'} size="xs" />
                                <span><b>{quien(t.contacto || {})}</b><span className="mut">{t.titulo}</span></span>
                                {t.vence && <small className={tarde ? 'cv-vence--tarde' : ''}>{momento(t.vence)}</small>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
