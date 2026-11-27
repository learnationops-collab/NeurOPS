// La vista de mandar (ADR-W229): el CSV, la plantilla como le llega a la persona y cuántos mandar ahora.
import { useRef, useState } from 'react';
import { FileSpreadsheet, Send } from 'lucide-react';
import { Button, Chip, EmptyState, LinkButton, Segmented, Select, Stepper, toast } from '../../../components/standard';
import { embudo, partesDe } from './useBroadcast';

function Lista({ archivo, revision, onArchivo, sin, onAlternar }) {
    const input = useRef(null);
    return (
        <div>
            <span className="bw-rotulo">Lista</span>
            <div className="bw-drop">
                <span className="bw-drop-ic"><FileSpreadsheet size={18} /></span>
                <span className="bw-drop-t">
                    <b>{archivo || 'Elegí un CSV'}</b>
                    <small>Columnas: telefono y nombre (con código de país)</small>
                </span>
                <LinkButton onClick={() => input.current?.click()}>{archivo ? 'Cambiar' : 'Elegir archivo'}</LinkButton>
                <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => { onArchivo(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            {revision && (
                <div className="bw-lectura">
                    <span><b>{revision.total}</b> números</span>
                    <span><b>{revision.para_mandar}</b> para mandar</span>
                    {revision.ya_recibieron > 0 && <span className="bw-aviso"><b>{revision.ya_recibieron}</b> ya recibieron uno (se saltean)</span>}
                    {revision.repetidos > 0 && <span className="bw-aviso"><b>{revision.repetidos}</b> repetidos</span>}
                    {revision.invalidos > 0 && <span className="bw-aviso"><b>{revision.invalidos}</b> inválidos</span>}
                    {revision.alumnos > 0 && (
                        <span className="bw-aviso">
                            <b>{revision.alumnos}</b> son alumnos activos ({sin.sin_alumnos ? 'se saltean' : 'van'})
                            <LinkButton onClick={() => onAlternar('sin_alumnos')}>{sin.sin_alumnos ? 'Incluirlos' : 'Sacarlos'}</LinkButton>
                        </span>
                    )}
                    {revision.agendados > 0 && (
                        <span className="bw-aviso" data-tip="Agendaron o son clientes|Agendaron alguna vez, compraran o no: ya los contactó un closer">
                            <b>{revision.agendados}</b> agendaron o son clientes ({sin.sin_agendados ? 'se saltean' : 'van'})
                            <LinkButton onClick={() => onAlternar('sin_agendados')}>{sin.sin_agendados ? 'Incluirlos' : 'Sacarlos'}</LinkButton>
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

export function Vista({ plantilla }) {
    const { cuerpo, botones } = partesDe(plantilla);
    const [antes, despues] = cuerpo.split('{{1}}');
    return (
        <div className="bw-chat">
            <div className="bw-burbuja">{antes}{despues != null && <><b>Laura</b>{despues}</>}</div>
            {botones.length > 0 && <div className="bw-botones">{botones.map((b) => <span key={b}>{b}</span>)}</div>}
        </div>
    );
}

const AZAR = '*';
const clave = (p) => `${p.name}|${p.language}`;

// Con «Al azar», cada número recibe una de las marcadas (en partes iguales); la vista previa muestra una por vez.
function Plantillas({ plantillas, elegida, onElegir, marcadas, onMarcar }) {
    const azar = elegida === AZAR;
    const enJuego = azar ? plantillas.filter((p) => marcadas.includes(clave(p))) : plantillas.filter((p) => clave(p) === elegida);
    const [vista, setVista] = useState(null);
    const previa = enJuego.find((p) => clave(p) === vista) || enJuego[0];
    const opciones = [...(plantillas.length > 1 ? [{ value: AZAR, label: `Al azar entre ${marcadas.length}` }] : []),
        ...plantillas.map((p) => ({ value: clave(p), label: p.name }))];
    return (
        <div>
            <span className="bw-rotulo">Plantilla</span>
            <div className="bw-fila">
                <Select size="sm" label="Plantilla" value={elegida} options={opciones} onChange={onElegir} />
                <Chip subtle color="var(--ln-success, #1f9d6b)">Aprobada{azar ? 's' : ''}</Chip>
            </div>
            {azar && (
                <div className="bw-fila bw-marcas">
                    {plantillas.map((p) => (
                        <Chip key={clave(p)} as="button" aria-pressed={marcadas.includes(clave(p))} subtle={!marcadas.includes(clave(p))}
                            color="var(--ln-info, #3b7dd8)" onClick={() => onMarcar(clave(p))}>{p.name}</Chip>
                    ))}
                    <span className="bw-s">Cada número recibe una al azar, en partes iguales</span>
                </div>
            )}
            {enJuego.length > 1 && (
                <Segmented size="sm" label="Ver plantilla" value={clave(previa)} onChange={setVista}
                    options={enJuego.map((p) => ({ value: clave(p), label: p.name.replace(/^.*_/, '').toUpperCase() }))} />
            )}
            {previa && <Vista plantilla={previa} />}
        </div>
    );
}

export default function Mandar({ datos }) {
    const { plantillas, historial, mandando } = datos;
    const [csv, setCsv] = useState(null);
    const [archivo, setArchivo] = useState(null);
    const [revision, setRevision] = useState(null);
    const [elegida, setElegida] = useState(null);
    const [marcadas, setMarcadas] = useState(null);
    const [cantidad, setCantidad] = useState(33);
    const [enviando, setEnviando] = useState(false);
    // Por defecto se saltean los alumnos vigentes y los que agendaron o son clientes (ADR-W279): un broadcast de
    // captación no le llega a quien ya compró ni a quien ya habló con un closer. El de no cerrados los incluye a mano.
    const [sin, setSin] = useState({ sin_alumnos: true, sin_agendados: true });

    const hoy = historial?.hoy || { usados: 0, tope: 100 };
    const libres = Math.max(0, hoy.tope - hoy.usados);
    const todas = plantillas || [];
    const marcadasYa = marcadas ?? todas.map(clave);
    const eleccion = elegida ?? (todas.length > 1 ? AZAR : todas[0] && clave(todas[0]));
    const elegidas = todas.filter((p) => (eleccion === AZAR ? marcadasYa.includes(clave(p)) : clave(p) === eleccion));
    const marcar = (k) => setMarcadas(marcadasYa.includes(k) ? marcadasYa.filter((x) => x !== k) : [...marcadasYa, k]);
    const maximo = Math.min(libres, revision?.para_mandar ?? 0);
    const n = Math.min(cantidad, maximo);

    const leer = (file) => {
        if (!file) return;
        file.text().then((texto) => datos.revisar(texto, sin).then((r) => { setCsv(texto); setArchivo(file.name); setRevision(r); }))
            .catch((e) => toast(datos.mensaje(e, 'No se pudo leer el CSV'), 'error'));
    };
    const alternar = (k) => {
        const nuevo = { ...sin, [k]: !sin[k] };
        setSin(nuevo);
        datos.revisar(csv, nuevo).then(setRevision).catch((e) => toast(datos.mensaje(e, 'No se pudo revisar la lista'), 'error'));
    };
    const enviar = async () => {
        setEnviando(true);
        try {
            const r = await datos.enviar({ csv, ...sin, cantidad: n, plantillas: elegidas.map((p) => ({ nombre: p.name, idioma: p.language })) });
            toast(`Saliendo ${r.cantidad} mensajes${elegidas.length > 1 ? `, al azar entre ${elegidas.length} plantillas` : ` con ${elegidas[0].name}`}`);
            setRevision(await datos.revisar(csv, sin));
        } catch (e) {
            toast(datos.mensaje(e, 'No se pudo mandar'), 'error');
        } finally {
            setEnviando(false);
        }
    };

    if (plantillas && !plantillas.length) return <EmptyState title="Sin plantillas aprobadas">{datos.error || 'Meta todavía no aprobó ninguna plantilla.'}</EmptyState>;
    const curso = mandando && embudo(mandando.por_estado);
    return (
        <div className="bw-cuerpo">
            <Lista archivo={archivo} revision={revision} onArchivo={leer} sin={sin} onAlternar={alternar} />
            {plantillas && <Plantillas plantillas={todas} elegida={eleccion} onElegir={setElegida} marcadas={marcadasYa} onMarcar={marcar} />}
            <div className="bw-envio">
                <Stepper label="Cuántos mandar" value={n} min={maximo ? 1 : 0} max={maximo} onChange={setCantidad} disabled={!maximo} />
                <Button variant="primary" icon={<Send />} disabled={!csv || !elegidas.length || !n || enviando} onClick={enviar}>
                    {n ? `Enviar a ${n}` : 'Enviar'}
                </Button>
                <span className="bw-cupo" data-tip="Tope del día|Es del número, sumando todas las plantillas (hora de Argentina)">
                    Hoy <b>{hoy.usados} / {hoy.tope}</b><span className="bw-medidor"><i style={{ width: `${Math.min(100, (hoy.usados / hoy.tope) * 100)}%` }} /></span>
                </span>
                <span className="bw-ayuda">
                    {libres ? `Salen los próximos de la lista, de a 10 por minuto. Quedan ${libres} para hoy.` : 'Ya se usó el tope de hoy: mañana se puede seguir.'}
                </span>
            </div>
            {curso && (
                <div className="bw-curso">
                    <span>Mandando: <b>{mandando.total - curso.pendientes} de {mandando.total}</b></span>
                    <span className="bw-prog"><i style={{ width: `${((mandando.total - curso.pendientes) / mandando.total) * 100}%` }} /></span>
                    <Button size="sm" onClick={() => datos.frenar(mandando.lote).then(() => toast('Frenado: lo que no salió queda para la próxima'))}>Frenar</Button>
                </div>
            )}
        </div>
    );
}
