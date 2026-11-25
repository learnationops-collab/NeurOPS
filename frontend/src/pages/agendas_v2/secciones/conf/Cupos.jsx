// Cupos libres de los próximos 7 días (POST /auth/me/disponibilidad/cupos, app/agendas_v2/cupos.py): los mismos
// inicios que el motor le ofrece a un lead, con lo ocupado en Google y sus agendas descontado. Va en
// Disponibilidad (con el horario sin guardar) y en Google Calendar (se recalcula al cambiar un calendario).
// Al cambiar, muestra cuánto subió o bajó.

import { useEffect, useRef, useState } from 'react';
import api from '../../../../services/api';
import { DIAS } from '../../core/catalogos';
import { Aura, BRAND_AURA } from '../../../../components/standard';

const LETRA = Object.fromEntries(DIAS.map(x => [x.d, x]));

// El número cuenta hasta el valor nuevo (desde 0 la primera vez).
function useContar(valor) {
    const [n, setN] = useState(0);
    const desde = useRef(0);
    useEffect(() => {
        if (valor == null) return undefined;
        const a = desde.current, t0 = performance.now();
        let raf;
        const paso = (t) => {
            const k = Math.min(1, (t - t0) / 700);
            desde.current = Math.round(a + (valor - a) * (1 - Math.pow(1 - k, 3)));
            setN(desde.current);
            if (k < 1) raf = requestAnimationFrame(paso);
        };
        raf = requestAnimationFrame(paso);
        return () => cancelAnimationFrame(raf);
    }, [valor]);
    return n;
}

/** `borrador`: {horario, tz} sin guardar (o null: lo guardado). `version`: al cambiar, vuelve a leer Google. */
export default function Cupos({ borrador = null, version = 0 }) {
    const [datos, setDatos] = useState(null);
    const [delta, setDelta] = useState(0);
    const [cargando, setCargando] = useState(false);
    const previo = useRef(null);
    const clave = JSON.stringify(borrador || {});
    const versionLeida = useRef(version);

    useEffect(() => {
        let vivo = true;
        const fresco = versionLeida.current !== version;
        versionLeida.current = version;
        const t = setTimeout(() => {
            setCargando(true);
            api.post('/auth/me/disponibilidad/cupos', { ...JSON.parse(clave), fresco })
                .then((r) => {
                    if (!vivo || !r?.data?.en_team) return;
                    if (previo.current != null) setDelta(r.data.libres - previo.current);
                    previo.current = r.data.libres;
                    setDatos(r.data);
                })
                .catch(() => {})
                .finally(() => { if (vivo) setCargando(false); });
        }, previo.current == null ? 0 : 450);
        return () => { vivo = false; clearTimeout(t); };
    }, [clave, version]);

    const contado = useContar(datos?.libres);
    useEffect(() => {
        if (!delta) return undefined;
        const t = setTimeout(() => setDelta(0), 4000);
        return () => clearTimeout(t);
    }, [delta, datos]);

    if (!datos) return null;
    const max = Math.max(1, ...datos.dias.map(d => d.total));
    return (
        <section className={'cupos' + (cargando ? ' cupos--cargando' : '')} aria-live="polite" aria-label="Cupos libres de los próximos 7 días">
            <Aura colors={BRAND_AURA} size="card" soft />
            <div className="cupos-num">
                <b>{contado}</b>
                <span>cupos libres<small>próximos 7 días · de {datos.total} en tu horario</small></span>
                {delta !== 0 && <em key={delta + '-' + datos.libres} className={delta > 0 ? 'sube' : 'baja'}>{delta > 0 ? '+' : '−'}{Math.abs(delta)}</em>}
            </div>
            <div className="cupos-dias">
                {datos.dias.map((d, i) => {
                    const dia = LETRA[d.dow];
                    const fecha = d.clave.slice(8) + '/' + d.clave.slice(5, 7);
                    return (
                        <div key={d.clave} className={'cupos-dia' + (d.total ? '' : ' cupos-dia--off')}
                            data-tip={`${dia.n} ${fecha}|${d.libres} libres de ${d.total}`} style={{ '--i': i }}>
                            <div className="cupos-barra" aria-hidden="true">
                                <i className="cupos-tot" style={{ height: (d.total / max) * 100 + '%' }} />
                                <i className="cupos-lib" style={{ height: (d.libres / max) * 100 + '%' }} />
                            </div>
                            <b>{d.libres}</b>
                            <span>{i === 0 ? 'Hoy' : dia.c}</span>
                        </div>
                    );
                })}
            </div>
            {datos.google === 'sin_google' && <p className="cupos-nota">Sin Google Calendar no se descuenta lo ocupado.</p>}
            {datos.google === 'error' && <p className="cupos-nota">Google no respondió: no se descontó lo ocupado.</p>}
        </section>
    );
}
