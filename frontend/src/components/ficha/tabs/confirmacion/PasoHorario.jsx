import React, { useEffect, useState } from 'react';
import { Segmented, Select } from '../../../standard';
import { ANTICIPACIONES, FRANJAS, diasDelLead, enPuntoOMedia, franjaDe, horaEn, rotuloDia } from './reprogramar';

/**
 * Paso 2: día y hora. Todo se lee en la hora del lead (la que se le va a decir); debajo de cada hora va
 * la tuya. Se eligen día y hora tocando, sin desplegables. De a 30 minutos por defecto. «Con al menos»
 * fija la anticipación: no se ofrece nada antes de esa ventana (1 h por defecto).
 */
const PasoHorario = ({ mapa, tzLead, onTzLead, zonas, zonaLeadTz, miZona, nombres, cuando, onCuando, anticipacion, onAnticipacion }) => {
    const dias = diasDelLead(mapa, tzLead);
    const [dia, setDia] = useState(null);
    const [cada15, setCada15] = useState(false);

    // Al cambiar de zona o de persona, el día elegido puede no existir: se va al del horario elegido o al primero.
    useEffect(() => {
        const conCuando = cuando && dias.find((d) => d.isos.includes(cuando));
        if (conCuando) setDia(conCuando.dia);
        else if (!dias.some((d) => d.dia === dia)) setDia(dias[0]?.dia || null);
    }, [tzLead, mapa]); // eslint-disable-line react-hooks/exhaustive-deps

    const otraZona = miZona !== tzLead;
    const delDia = dias.find((d) => d.dia === dia)?.isos || [];
    const redondos = delDia.filter((iso) => cada15 || enPuntoOMedia(iso, tzLead) || iso === cuando);
    // Un día que solo tiene :15 o :45 los muestra igual.
    const isos = redondos.length ? redondos : delDia;
    const opcionesZona = [
        ...(zonas.some((z) => z.tz === tzLead) ? [] : [{ value: tzLead, label: tzLead }]),
        ...zonas.map((z) => ({ value: z.tz, label: `${z.nombre}${z.tz === zonaLeadTz ? ' · la del lead' : ''}` })),
    ];

    const anticipar = (
        <div className="rp-fila">
            <small className="t-rotulo">Con al menos</small>
            <Segmented size="sm" radio label="Anticipación mínima" value={anticipacion} onChange={onAnticipacion}
                options={ANTICIPACIONES} />
            <small className="t-cap mut">de anticipación</small>
        </div>
    );

    if (dias.length === 0) {
        return (
            <div className="rp-paso">
                {anticipar}
                <small className="t-cap mut">No hay horarios libres en los próximos 14 días con esa anticipación: bajala, o volvé y probá con otra persona o con «Cualquiera».</small>
            </div>
        );
    }

    return (
        <div className="rp-paso">
            {anticipar}
            <div className="rp-fila">
                <small className="t-rotulo">Horas del lead en</small>
                <div style={{ minWidth: 200 }}>
                    <Select size="sm" label="Zona del lead" value={tzLead} onChange={onTzLead} options={opcionesZona} />
                </div>
                {otraZona && <small className="t-cap mut">{`Debajo de cada hora, la tuya (${miZona.split('/').pop().replace('_', ' ')}).`}</small>}
            </div>

            <div className="rp-dias" role="radiogroup" aria-label="Día">
                {dias.map((d) => (
                    <button key={d.dia} type="button" role="radio" aria-checked={d.dia === dia} className="rp-dia"
                        onClick={() => setDia(d.dia)}>
                        <b>{rotuloDia(d.dia, tzLead)}</b>
                        <small>{d.isos.length}</small>
                    </button>
                ))}
            </div>

            {FRANJAS.map((f) => {
                const deFranja = isos.filter((iso) => franjaDe(iso, tzLead) === f.clave);
                if (!deFranja.length) return null;
                return (
                    <div key={f.clave} className="rp-franja">
                        <small className="t-rotulo">{f.label}</small>
                        <div className="rp-horas" role="radiogroup" aria-label={`Horas de la ${f.label.toLowerCase()}`}>
                            {deFranja.map((iso) => (
                                <button key={iso} type="button" role="radio" aria-checked={iso === cuando} className="rp-hora"
                                    title={nombres ? `Libre: ${(mapa[iso] || []).map(nombres).join(', ')}` : undefined}
                                    onClick={() => onCuando(iso)}>
                                    <b>{horaEn(iso, tzLead)}</b>
                                    {otraZona && <small>{`${horaEn(iso, miZona)} tuya`}</small>}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            })}

            <button type="button" className="rp-link" onClick={() => setCada15((v) => !v)}>
                {cada15 ? 'Ver solo en punto y media' : 'Ver también :15 y :45'}
            </button>
        </div>
    );
};

export default PasoHorario;
