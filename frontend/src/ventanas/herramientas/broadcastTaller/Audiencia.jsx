// La audiencia del broadcast de un taller: de dónde salen los números (CSV, agendaron y no cerraron, otra
// etiqueta), qué grupos se descartan y a cuántos se les puede mandar, contra el tope de 24 h del número.
import { useEffect, useRef, useState } from 'react';
import { CalendarX, FileUp, Tag } from 'lucide-react';
import api from '../../../services/api';
import { Button, Input, Select, Switch, toast } from '../../../components/standard';
import { mensajeDe } from './useBroadcastTaller';

const DESCARTES = [
    { key: 'agendados', label: 'Ya agendaron llamada', ayuda: 'Tienen una agenda o una cita, abierta o pasada' },
    { key: 'clientes', label: 'Ya cerraron (clientes)', ayuda: 'Compraron alguna vez' },
    { key: 'alumnos', label: 'Alumnos activos', ayuda: 'Con una suscripción vigente' },
];

function Fuente({ icono, titulo, ayuda, children }) {
    return (
        <div className="bt-fuente">
            <span className="bt-fuente-ic">{icono}</span>
            <span className="bt-fuente-t"><b>{titulo}</b><small>{ayuda}</small></span>
            <span className="bt-fuente-acc">{children}</span>
        </div>
    );
}

function Carga({ carga }) {
    if (!carga) return null;
    const partes = [`${carga.sumados} sumados`];
    if (carga.ya_estaban) partes.push(`${carga.ya_estaban} ya estaban`);
    if (carga.repetidos) partes.push(`${carga.repetidos} repetidos`);
    if (carga.invalidos) partes.push(`${carga.invalidos} inválidos`);
    return <p className="bt-s" role="status">Última carga: {partes.join(' · ')}</p>;
}

function Fuentes({ datos, tallerId }) {
    const archivo = useRef(null);
    const [talleres, setTalleres] = useState([]);
    const [taller, setTaller] = useState('');
    const [etiqueta, setEtiqueta] = useState('');
    const [carga, setCarga] = useState(null);
    const [ocupado, setOcupado] = useState(false);

    useEffect(() => {
        api.get('workshop/events').then((r) => {
            const pasados = (r.data || []).filter((e) => e.id !== tallerId && new Date(e.date) <= new Date()).slice(0, 12);
            setTalleres(pasados);
            if (pasados[0]) setTaller(String(pasados[0].id));
        }).catch(() => setTalleres([]));
    }, [tallerId]);

    const sumar = (cuerpo) => {
        setOcupado(true);
        return datos.sumar(cuerpo)
            .then((r) => { setCarga(r.carga); toast(`${r.carga.sumados} sumados a «${r.etiqueta}»`); })
            .catch((e) => toast(mensajeDe(e, 'No se pudieron sumar'), 'error'))
            .finally(() => setOcupado(false));
    };
    const leer = (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (f) f.text().then((csv) => sumar({ csv }));
    };
    return (
        <div className="bt-caja">
            <span className="bt-rotulo">Sumar a la audiencia</span>
            <Fuente icono={<FileUp />} titulo="Un CSV" ayuda="Columna teléfono y, si querés, nombre. Los repetidos e inválidos quedan fuera.">
                <input ref={archivo} type="file" accept=".csv,text/csv,text/plain" hidden onChange={leer} />
                <Button disabled={ocupado} onClick={() => archivo.current?.click()}>Subir CSV</Button>
            </Fuente>
            <Fuente icono={<CalendarX />} titulo="Agendaron y no cerraron" ayuda="Los que agendaron en ese taller y no compraron ni dejaron seña">
                <Select size="sm" label="Taller" value={taller} onChange={setTaller}
                    options={talleres.map((t) => ({ value: String(t.id), label: t.name }))} />
                <Button disabled={ocupado || !taller} onClick={() => sumar({ no_cerraron: [Number(taller)] })}>Sumar</Button>
            </Fuente>
            <Fuente icono={<Tag />} titulo="Los de otra etiqueta" ayuda="Por ejemplo, los que tocaron «Sí, voy» en otro taller">
                <Input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder="WS 19/11 · va" aria-label="Etiqueta" />
                <Button disabled={ocupado || !etiqueta.trim()} onClick={() => sumar({ etiqueta: etiqueta.trim() })}>Sumar</Button>
            </Fuente>
            <Carga carga={carga} />
        </div>
    );
}

function Cuenta({ plan, hoy }) {
    const a = plan.audiencia;
    const libres = Math.max(0, hoy.tope - hoy.usados);
    const pct = (n) => `${Math.min(100, (n / Math.max(hoy.tope, 1)) * 100)}%`;
    const filas = [
        ['Cargados', a.cargados, 'total'],
        ...DESCARTES.filter((d) => a.descartados[d.key]).map((d) => [d.label, -a.descartados[d.key]]),
        ...(a.descartados.bajas ? [['Se dieron de baja', -a.descartados.bajas]] : []),
    ];
    return (
        <div className="bt-caja">
            <span className="bt-rotulo">A cuántos se les puede mandar</span>
            <b className="bt-grande">{a.se_puede}</b>
            <span className="bt-s">personas distintas, de {a.cargados} con la etiqueta «{plan.etiqueta}»</span>
            <div className="bt-embudo">
                {filas.map(([t, n, tipo]) => (
                    <span key={t} className={`bt-eb${tipo ? ' bt-eb--total' : ''}`}>
                        <span>{t}</span>
                        <i><em style={{ width: `${a.cargados ? (Math.abs(n) / a.cargados) * 100 : 0}%` }} /></i>
                        <b>{n > 0 || tipo ? n : `−${-n}`}</b>
                    </span>
                ))}
                <span className="bt-eb bt-eb--fin"><span>Se puede enviar</span>
                    <i><em style={{ width: `${a.cargados ? (a.se_puede / a.cargados) * 100 : 0}%` }} /></i><b>{a.se_puede}</b></span>
            </div>
            <span className="bt-rotulo bt-rotulo--sep">Tope del número · 24 h</span>
            <div className="bt-tope" aria-hidden="true">
                <i style={{ width: pct(hoy.usados), background: 'var(--ln-text-faint, #8a8ea0)' }} />
                <i style={{ width: pct(Math.min(a.se_puede, libres)), background: '#25D366' }} />
            </div>
            <span className="bt-s"><b>{hoy.usados}</b> personas ya ocupan el tope · quedan <b>{libres}</b> de {hoy.tope}</span>
            {a.se_puede > libres && (
                <p className="bt-alerta" role="note">
                    Hoy no entran todos: a las personas nuevas que no entren las manda cuando se libere el tope, y un
                    recordatorio que vence sin salir no sale. El 2.º mensaje del día a la misma persona no suma.
                </p>
            )}
        </div>
    );
}

export default function Audiencia({ datos, tallerId }) {
    const { plan } = datos;
    const [etiqueta, setEtiqueta] = useState(plan.etiqueta || '');
    const descartar = (key, valor) => datos.guardar({ descartes: { ...plan.descartes, [key]: valor } })
        .catch((e) => toast(mensajeDe(e, 'No se pudo guardar'), 'error'));
    const renombrar = () => etiqueta.trim() && etiqueta.trim() !== plan.etiqueta && datos.guardar({ etiqueta: etiqueta.trim() })
        .then(() => toast('La audiencia ahora es otra etiqueta: los cargados con la anterior no se pasan solos'))
        .catch((e) => toast(mensajeDe(e, 'No se pudo cambiar'), 'error'));
    return (
        <div className="bt-dos">
            <div className="bt-col">
                <div className="bt-caja">
                    <span className="bt-rotulo">Etiqueta de la audiencia</span>
                    <div className="bt-fila">
                        <Input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} onBlur={renombrar} aria-label="Etiqueta" maxLength={60} />
                    </div>
                    <small className="bt-s">Cada número cargado lleva esta etiqueta: en el Inbox se filtra por ella y otro broadcast la puede usar.</small>
                </div>
                <Fuentes datos={datos} tallerId={tallerId} />
                <div className="bt-caja">
                    <span className="bt-rotulo">Descartar al mandar</span>
                    {DESCARTES.map((d) => (
                        <div key={d.key} className="bt-fuente">
                            <span className="bt-fuente-t"><b>{d.label}</b><small>{d.ayuda}</small></span>
                            <span className="bt-fuente-acc">
                                <b className="bt-n">−{plan.audiencia.posibles[d.key] || 0}</b>
                                <Switch checked={plan.descartes[d.key]} label={d.label} onChange={(v) => descartar(d.key, v)} />
                            </span>
                        </div>
                    ))}
                    <small className="bt-s">Las bajas (respondieron «baja» o «stop») quedan fuera siempre. «Ya recibieron» se cuenta en cada paso.</small>
                </div>
            </div>
            <Cuenta plan={plan} hoy={plan.hoy} />
        </div>
    );
}
