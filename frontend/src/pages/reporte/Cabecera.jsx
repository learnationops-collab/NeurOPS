// Fila del título: «Reporte» con su estado, la tira de los últimos 7 días, Hoy/Historial y «Hoy no trabajé».
import clsx from 'clsx';
import { Button, Chip, Segmented } from '../../components/standard';
import { CLASE_ESTADO, COLOR_ESTADO, NDIA, TEXTO_ESTADO, aFecha, fechaLarga, nomDia } from './formato';

// «hasta mañana 10:00» a partir de `cierra_en` (ISO con zona del usuario).
function hastaCuando(dia) {
    const c = String(dia.cierra_en || '');
    const hora = c.length >= 16 ? c.slice(11, 16) : '10:00';
    const fc = c.slice(0, 10);
    const manana = fc && Math.round((aFecha(fc) - aFecha(dia.fecha)) / 86400000) === 1;
    return `hasta ${manana || !fc ? 'mañana' : nomDia(fc)} ${hora}`;
}

function Semana({ semana, hoy, sel, tab, onDia }) {
    return (
        <div className="rp-semana" aria-label="Tu semana">
            {[...semana].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((d) => {
                const f = aFecha(d.fecha);
                return (
                    <button key={d.fecha} type="button" title={`${nomDia(d.fecha)} · ${TEXTO_ESTADO[d.estado] || ''}`}
                        className={clsx('rp-sd', CLASE_ESTADO[d.estado], tab === 'hoy' && d.fecha === sel && 'sel')}
                        aria-pressed={tab === 'hoy' && d.fecha === sel} onClick={() => onDia(d.fecha === hoy ? null : d.fecha)}>
                        {NDIA[f.getDay()]}<b>{f.getDate()}</b><i />
                    </button>
                );
            })}
        </div>
    );
}

export default function Cabecera({ dia, estado, faltan, tab, onTab, onDia, onNoLaborable }) {
    const pasado = dia && dia.fecha !== dia.hoy;
    return (
        <header className="rp-cab">
            <div className="rp-cab__t">
                <h1>Reporte</h1>
                {dia && (
                    <p>
                        {fechaLarga(dia.fecha)} · <Chip subtle color={COLOR_ESTADO[estado]}>{TEXTO_ESTADO[estado]}</Chip>
                        {estado === 'en_curso' && <span>{hastaCuando(dia)}</span>}
                        {estado !== 'no_laborable' && faltan.length > 0 && <span>· falta {faltan.join(', ')}</span>}
                        {pasado && <>· <button type="button" className="rp-otra" onClick={() => onDia(null)}>Volver a hoy</button></>}
                    </p>
                )}
            </div>
            {dia?.semana?.length > 0 && <Semana semana={dia.semana} hoy={dia.hoy} sel={dia.fecha} tab={tab} onDia={onDia} />}
            <div className="rp-cab__acc">
                <Segmented size="sm" value={tab} onChange={onTab} label="Vistas del reporte"
                    options={[{ value: 'hoy', label: pasado ? nomDia(dia.fecha) : 'Hoy' }, { value: 'hist', label: 'Historial' }]} />
                {dia && tab === 'hoy' && !dia.no_laborable && (
                    <Button onClick={onNoLaborable}>{pasado ? 'No trabajé ese día' : 'Hoy no trabajé'}</Button>
                )}
            </div>
        </header>
    );
}
