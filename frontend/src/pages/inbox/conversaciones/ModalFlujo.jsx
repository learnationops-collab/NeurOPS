// Mover a la persona dentro de su flujo: continuar desde un paso (viene elegido el que se cortó),
// reiniciar, mandarla a otro flujo o iniciar uno. Avisa si la ventana de 24 h de Instagram está
// abierta (sale ahora) o cerrada (queda pendiente hasta que el lead escriba).
import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Play } from 'lucide-react';
import { Button, Chip, EmptyState, Modal, ModalHeader, Select, toast } from '../../../components/standard';
import { inboxApi } from '../api';
import { quien, textoEspera } from './colas';

const TITULOS = {
    continuar: ['Continuar desde un paso', 'Continuar'],
    reiniciar: ['Reiniciar flujo', 'Reiniciar'],
    cambiar: ['Cambiar de flujo', 'Cambiar'],
    iniciar: ['Iniciar flujo', 'Iniciar'],
};
const VENTANA_MIN = 24 * 60;

function Pasos({ datos, elegido, onElegir, cortada }) {
    if (!datos) return <EmptyState>Cargando los pasos…</EmptyState>;
    if (!datos.pasos.length) return <EmptyState>Este flujo no tiene mensajes.</EmptyState>;
    const actual = datos.pasos.find((p) => p.id === datos.actual);
    // La cabecera de la etapa va antes del primer paso de cada etapa.
    const empiezaEtapa = datos.pasos.map((p, i) => Boolean(p.etapa) && p.etapa !== datos.pasos[i - 1]?.etapa);
    return (
        <div className="cv-pasos" role="radiogroup" aria-label="Paso">
            {datos.pasos.map((p, i) => {
                const cabecera = empiezaEtapa[i] ? <p className="cv-etapa">Etapa · {p.etapa}</p> : null;
                const aca = p.id === datos.actual;
                const paso = actual && p.numero < actual.numero;
                return (
                    <div key={p.id} className="cv-paso-fila">
                        {cabecera}
                        <label className={`cv-paso${paso ? ' cv-paso--pasado' : ''}`}>
                            <input type="radio" name="paso" checked={elegido === p.id} onChange={() => onElegir(p.id)} />
                            <span className="cv-paso-txt"><b>Paso {p.numero}{p.nombre ? ` · ${p.nombre}` : ''}</b><small>{p.texto}</small></span>
                            {aca && <Chip subtle color={cortada ? 'var(--error)' : 'var(--info)'}>{datos.estado === 'terminada' ? 'Terminó acá' : cortada ? 'Se cortó acá' : 'Está acá'}</Chip>}
                            {paso && <Chip subtle color="var(--idle)">Ya pasó</Chip>}
                        </label>
                    </div>
                );
            })}
        </div>
    );
}

export default function ModalFlujo({ accion, contacto, ejecucion, cortada, onCerrar, onHecho }) {
    const [titulo, ok] = TITULOS[accion];
    const [pasos, setPasos] = useState(null);
    const [elegido, setElegido] = useState(null);
    const [flujos, setFlujos] = useState(null);
    const [flujo, setFlujo] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [abiertoEn] = useState(() => Date.now());

    useEffect(() => {
        if (accion === 'continuar') {
            inboxApi.pasos(contacto.id).then((d) => {
                setPasos(d);
                if (d.estado !== 'terminada') setElegido(d.actual);
            }).catch(() => setPasos({ pasos: [] }));
        }
        if (accion === 'cambiar' || accion === 'iniciar') {
            inboxApi.flujos().then((l) => setFlujos(l.filter((f) => f.estado === 'activo' && f.version && f.nombre !== ejecucion?.flujo)))
                .catch(() => setFlujos([]));
        }
    }, [accion, contacto.id, ejecucion?.flujo]);

    const minutos = contacto.ultimo_entrante_en ? Math.floor((abiertoEn - new Date(contacto.ultimo_entrante_en)) / 60000) : null;
    const abierta = minutos != null && minutos < VENTANA_MIN;
    const cierra = abierta && new Date(new Date(contacto.ultimo_entrante_en).getTime() + VENTANA_MIN * 60000)
        .toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    const listo = accion === 'continuar' ? Boolean(elegido) : accion === 'reiniciar' || Boolean(flujo);

    const confirmar = async () => {
        setEnviando(true);
        try {
            const cuerpo = { accion, ...(accion === 'continuar' ? { nodo_id: elegido } : {}), ...(flujo ? { flujo_id: Number(flujo) } : {}) };
            const r = await inboxApi.moverEnFlujo(contacto.id, cuerpo);
            toast(r.resultado === 'pendiente' ? 'Queda listo: arranca cuando el lead escriba' : `${ok}: listo`);
            onHecho();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo mover', 'error');
            setEnviando(false);
        }
    };

    return (
        <Modal onClose={onCerrar} className="cv-modal-flujo" labelledBy="cv-flujo-t">
            <ModalHeader icon={<Play size={18} />} title={titulo} titleId="cv-flujo-t"
                subtitle={`${quien(contacto)}${ejecucion?.flujo && accion !== 'iniciar' ? ` · ${ejecucion.flujo}` : ''}`} onClose={onCerrar} />
            <div className="cv-modal-cuerpo">
                {accion === 'continuar' && (
                    <>
                        <p className="t-cap mut">Le llega el mensaje del paso que elijas y el flujo sigue desde ahí.</p>
                        <Pasos datos={pasos} elegido={elegido} onElegir={setElegido} cortada={cortada} />
                    </>
                )}
                {accion === 'reiniciar' && (
                    <p className="t-sm">Arranca <b>{ejecucion?.flujo}</b> desde el paso 1: le vuelven a llegar las preguntas que ya contestó.
                        Para saltearlas, usá «Continuar desde…».</p>
                )}
                {(accion === 'cambiar' || accion === 'iniciar') && (
                    flujos && !flujos.length ? <p className="t-cap mut">No hay otro flujo activo.</p> : (
                        <Select label="Flujo" value={flujo} onChange={setFlujo}
                            options={[{ value: '', label: flujos ? 'Elegí un flujo' : 'Cargando…' }, ...(flujos || []).map((f) => ({ value: String(f.id), label: f.nombre }))]} />
                    )
                )}
                <p className={`cv-ventana cv-ventana--${abierta ? 'abierta' : 'cerrada'}`}>
                    {abierta ? <Clock size={15} aria-hidden="true" /> : <AlertTriangle size={15} aria-hidden="true" />}
                    <span>{abierta
                        ? `La ventana de 24 h está abierta hasta las ${cierra}: el mensaje sale ahora.`
                        : `${minutos == null ? 'El lead nunca escribió por DM' : `El lead escribió hace ${textoEspera(minutos)}`}. Instagram no deja escribirle fuera de las 24 h: queda listo y arranca cuando vuelva a escribir.`}</span>
                </p>
                {contacto.bot_pausado_hasta && new Date(contacto.bot_pausado_hasta) > new Date() && (
                    <p className="t-cap mut">El bot está en pausa para esta persona: esto lo saca de la pausa.</p>
                )}
            </div>
            <div className="cv-modal-pie">
                <Button onClick={onCerrar}>Cancelar</Button>
                <Button variant="primary" icon={<Play />} disabled={!listo || enviando} onClick={confirmar}>{abierta ? ok : 'Dejar listo'}</Button>
            </div>
        </Modal>
    );
}
