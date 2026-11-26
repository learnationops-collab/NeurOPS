// Una fila de «Seguir» de triage (ADR-W241): quién es, qué pasó y cómo se resuelve ahí mismo.
import { useState } from 'react';
import {
    Ban, Calendar, CalendarOff, CheckCircle2, ChevronDown, ChevronUp, Clock, Hourglass, MessageCircle,
    PhoneMissed, Tag, Target, UserX, XCircle,
} from 'lucide-react';
import { Avatar, Button, Chip, Input } from '../../../../components/standard';
import { datetimeLocalToUtcIso } from '../../../../utils/datetime';

const SITUACION = {
    pensar: { label: 'Lo va a pensar', Icono: Hourglass, tono: 'warn' },
    low_ticket: { label: 'Low ticket en seguimiento', Icono: Tag, tono: 'warn' },
    no_asistio: { label: 'No asistió', Icono: UserX, tono: 'err' },
    cancelo: { label: 'Canceló', Icono: XCircle, tono: 'err' },
    sin_fecha: { label: 'Reprogramó sin fecha', Icono: CalendarOff, tono: 'vio' },
};
const CONTACTO = { no_resp: 'No respondió', contesto: 'Contestó', agendo: 'Agendó', cerro: 'Cerró' };
const SALIDAS = [
    { clave: 'agendo', label: 'Agendó', sub: 'Día y hora: vuelve a Confirmar', Icono: Calendar },
    { clave: 'closing', label: 'Pasa a closing', sub: 'Se reporta como Califica', Icono: Target },
    { clave: 'low_ticket', label: 'Low ticket', sub: 'Se reporta como No califica', Icono: Tag },
    { clave: 'mas_adelante', label: 'Más adelante', sub: 'Otra fecha o «me avisa»', Icono: Clock },
    { clave: 'no_interesa', label: 'No le interesa', sub: 'Se cierra el seguimiento', Icono: XCircle },
];

const diasDesde = (iso) => (iso ? Math.floor((Date.now() - new Date(`${iso}T12:00:00`)) / 86400000) : null);

function Chips({ fila, modo, diasSinNoticias }) {
    const s = SITUACION[fila.situacion];
    const llego = fila.situacion === 'sin_fecha' && modo === 'hoy';
    const esperando = modo === 'esperan' ? diasDesde(fila.esperando_desde) : null;
    return (
        <div className="st-chips">
            {s && (
                <span className={`st-chip st-${llego ? 'vio' : s.tono}`}>
                    <s.Icono size={12} />{llego ? 'Llegó su fecha' : s.label}
                </span>
            )}
            {modo === 'hoy' && fila.dias_retraso > 0 && <span className="st-chip st-err">{fila.dias_retraso} {fila.dias_retraso === 1 ? 'día' : 'días'} tarde</span>}
            {modo === 'esperan' && fila.fecha && <span className="st-chip">Dijo: cerca del {fila.fecha.split('-').reverse().slice(0, 2).join('/')}</span>}
            {esperando > diasSinNoticias && <span className="st-chip st-err">Hace {esperando} días sin noticias</span>}
            {modo !== 'esperan' && (
                <span className="st-chip">Contacto {fila.intento} de {fila.de}{fila.intento >= fila.de && modo === 'hoy' ? ' · último' : ''}</span>
            )}
            {modo === 'hechos' && CONTACTO[fila.resultado_contacto] && (
                <span className="st-chip st-ok"><CheckCircle2 size={12} />{CONTACTO[fila.resultado_contacto]}</span>
            )}
        </div>
    );
}

function PanelSalida({ fila, motivos, salida, onElegir, onGuardar, onAbrir, onCerrar }) {
    const [valor, setValor] = useState({});
    const cambiar = (c) => setValor((v) => ({ ...v, ...c }));
    const pie = (puede, texto, cuerpo, peligro = false) => (
        <div className="st-pie">
            <Button variant="ghost" onClick={onCerrar}>Cancelar</Button>
            <Button variant={peligro ? 'dangerSolid' : 'primary'} disabled={!puede} icon={peligro ? <Ban size={14} /> : null}
                onClick={() => onGuardar(cuerpo())}>{texto}</Button>
        </div>
    );
    return (
        <div className="st-detalle">
            {salida !== 'ya_dio_fecha' && (
                <>
                    <small className="st-pregunta">¿Qué pasó?</small>
                    <div className="st-salidas">
                        {SALIDAS.map((o) => (
                            <button key={o.clave} type="button" className={`st-salida${salida === o.clave ? ' on' : ''}${o.clave === 'no_interesa' ? ' st-salida--cierra' : ''}`}
                                onClick={() => (['closing', 'low_ticket'].includes(o.clave) ? onAbrir(o.clave) : onElegir(o.clave))}>
                                <o.Icono size={16} /><b>{o.label}</b><small>{o.sub}</small>
                            </button>
                        ))}
                    </div>
                </>
            )}
            {(salida === 'agendo' || salida === 'ya_dio_fecha') && (
                <>
                    <small className="st-pregunta">¿Para cuándo?</small>
                    <Input type="datetime-local" variant="date" style={{ maxWidth: 260 }} value={valor.cuando || ''}
                        onChange={(e) => cambiar({ cuando: e.target.value })} />
                    {pie(!!valor.cuando, 'Agendar', () => ({ accion: 'agendo', fecha: datetimeLocalToUtcIso(valor.cuando) }))}
                </>
            )}
            {salida === 'mas_adelante' && (
                <>
                    <small className="st-pregunta">¿Cuándo le volvés a escribir?</small>
                    <div className="st-fila-campos">
                        <Input type="date" variant="date" style={{ maxWidth: 200 }} value={valor.fecha || ''}
                            onChange={(e) => cambiar({ fecha: e.target.value })} />
                        <Chip as="button" type="button" aria-pressed={!valor.fecha} subtle={!!valor.fecha}
                            onClick={() => cambiar({ fecha: '' })}>Me avisa</Chip>
                    </div>
                    <Input placeholder="Nota (opcional)" value={valor.nota || ''} onChange={(e) => cambiar({ nota: e.target.value })} />
                    {pie(true, 'Guardar', () => ({ accion: 'mas_adelante', fecha: valor.fecha || null, nota: valor.nota || '' }))}
                </>
            )}
            {salida === 'no_interesa' && (
                <>
                    <small className="st-pregunta">¿Por qué?</small>
                    <div className="st-fila-campos">
                        {Object.entries(motivos || {}).map(([clave, label]) => (
                            <Chip key={clave} as="button" type="button" aria-pressed={valor.motivo === clave}
                                subtle={valor.motivo !== clave} onClick={() => cambiar({ motivo: clave })}>{label}</Chip>
                        ))}
                    </div>
                    <Input placeholder="Nota (opcional)" value={valor.nota || ''} onChange={(e) => cambiar({ nota: e.target.value })} />
                    {pie(!!valor.motivo, 'Cerrar seguimiento', () => ({ accion: 'no_interesa', motivo: valor.motivo, nota: valor.nota || '' }), true)}
                </>
            )}
            {!salida && <div className="st-pie"><Button variant="ghost" onClick={onCerrar}>Cancelar</Button></div>}
        </div>
    );
}

export default function FilaSeguir({ fila, modo, motivos, diasSinNoticias, onAccion, onAbrir }) {
    const [abierta, setAbierta] = useState(false);
    const [salida, setSalida] = useState(null);
    const [confirmaCierre, setConfirmaCierre] = useState(false);
    const ultimo = fila.intento >= fila.de;
    const cerrar = () => { setAbierta(false); setSalida(null); setConfirmaCierre(false); };
    const guardar = async (cuerpo) => { if (await onAccion(fila, cuerpo)) cerrar(); };
    const noRespondio = () => (ultimo ? setConfirmaCierre(true) : guardar({ accion: 'no_respondio' }));
    const abrirFicha = (clave) => onAbrir(fila, clave);

    return (
        <div className={`st-fila${abierta || confirmaCierre ? ' sel' : ''}${modo === 'hechos' ? ' hecha' : ''}`}>
            <Avatar size="sm" name={fila.lead_name} />
            <div className="st-quien">
                <button type="button" className="st-nombre" onClick={() => abrirFicha(null)}>{fila.lead_name}</button>
                <Chips fila={fila} modo={modo} diasSinNoticias={diasSinNoticias} />
                {fila.nota && <small className="st-nota">{fila.nota}</small>}
            </div>
            {modo === 'hoy' && (
                <div className="st-acciones">
                    <Button icon={<PhoneMissed size={14} />} onClick={noRespondio}>No respondió</Button>
                    <Button variant="primary" icon={<MessageCircle size={14} />} onClick={() => (abierta ? cerrar() : setAbierta(true))}>
                        Contestó {abierta ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </Button>
                </div>
            )}
            {modo === 'esperan' && (
                <div className="st-acciones">
                    <Button icon={<Calendar size={14} />} onClick={() => { setAbierta(true); setSalida('ya_dio_fecha'); }}>Ya dio fecha</Button>
                    <Button variant="ghost" icon={<XCircle size={14} />} onClick={() => { setAbierta(true); setSalida('no_interesa'); }}>No le interesa</Button>
                </div>
            )}
            {confirmaCierre && (
                <div className="st-detalle">
                    <small className="st-pregunta">Era el último contacto ({fila.de} de {fila.de}): el seguimiento se cierra sin respuesta.</small>
                    <div className="st-pie">
                        <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
                        <Button variant="dangerSolid" icon={<Ban size={14} />} onClick={() => guardar({ accion: 'no_respondio', cerrar: true })}>Cerrar seguimiento</Button>
                    </div>
                </div>
            )}
            {abierta && (
                <PanelSalida fila={fila} motivos={motivos} salida={salida} onElegir={setSalida} onGuardar={guardar}
                    onAbrir={abrirFicha} onCerrar={cerrar} />
            )}
        </div>
    );
}
