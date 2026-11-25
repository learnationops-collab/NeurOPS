// La vista de mandar (ADR-W229): el CSV, la plantilla como le llega a la persona y cuántos mandar ahora.
import { useRef, useState } from 'react';
import { FileSpreadsheet, Send } from 'lucide-react';
import { Button, Chip, EmptyState, LinkButton, Select, Stepper, toast } from '../../../components/standard';
import { embudo, partesDe } from './useBroadcast';

function Lista({ archivo, revision, onArchivo }) {
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
                </div>
            )}
        </div>
    );
}

function Vista({ plantilla }) {
    const { cuerpo, botones } = partesDe(plantilla);
    const [antes, despues] = cuerpo.split('{{1}}');
    return (
        <div className="bw-chat">
            <div className="bw-burbuja">{antes}{despues != null && <><b>Laura</b>{despues}</>}</div>
            {botones.length > 0 && <div className="bw-botones">{botones.map((b) => <span key={b}>{b}</span>)}</div>}
        </div>
    );
}

export default function Mandar({ datos }) {
    const { plantillas, historial, mandando } = datos;
    const [csv, setCsv] = useState(null);
    const [archivo, setArchivo] = useState(null);
    const [revision, setRevision] = useState(null);
    const [elegida, setElegida] = useState('');
    const [cantidad, setCantidad] = useState(33);
    const [enviando, setEnviando] = useState(false);

    const hoy = historial?.hoy || { usados: 0, tope: 100 };
    const libres = Math.max(0, hoy.tope - hoy.usados);
    const plantilla = (plantillas || []).find((p) => `${p.name}|${p.language}` === elegida) || plantillas?.[0];
    const maximo = Math.min(libres, revision?.para_mandar ?? 0);
    const n = Math.min(cantidad, maximo);

    const leer = (file) => {
        if (!file) return;
        file.text().then((texto) => datos.revisar(texto).then((r) => { setCsv(texto); setArchivo(file.name); setRevision(r); }))
            .catch((e) => toast(datos.mensaje(e, 'No se pudo leer el CSV'), 'error'));
    };
    const enviar = async () => {
        setEnviando(true);
        try {
            const r = await datos.enviar({ csv, plantilla: plantilla.name, idioma: plantilla.language, cantidad: n });
            toast(`Saliendo ${r.cantidad} mensajes con ${plantilla.name}`);
            setRevision(await datos.revisar(csv));
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
            <Lista archivo={archivo} revision={revision} onArchivo={leer} />
            <div>
                <span className="bw-rotulo">Plantilla</span>
                <div className="bw-fila">
                    <Select size="sm" label="Plantilla" value={plantilla ? `${plantilla.name}|${plantilla.language}` : ''}
                        options={(plantillas || []).map((p) => ({ value: `${p.name}|${p.language}`, label: p.name }))} onChange={setElegida} />
                    {plantilla && <Chip subtle color="var(--ln-success, #1f9d6b)">Aprobada</Chip>}
                </div>
                {plantilla && <Vista plantilla={plantilla} />}
            </div>
            <div className="bw-envio">
                <Stepper label="Cuántos mandar" value={n} min={maximo ? 1 : 0} max={maximo} onChange={setCantidad} disabled={!maximo} />
                <Button variant="primary" icon={<Send />} disabled={!csv || !plantilla || !n || enviando} onClick={enviar}>
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
                    <span>Mandando <b>{mandando.plantilla}</b>: {mandando.total - curso.pendientes} de {mandando.total}</span>
                    <span className="bw-prog"><i style={{ width: `${((mandando.total - curso.pendientes) / mandando.total) * 100}%` }} /></span>
                    <Button size="sm" onClick={() => datos.frenar(mandando.lote).then(() => toast('Frenado: lo que no salió queda para la próxima'))}>Frenar</Button>
                </div>
            )}
        </div>
    );
}
