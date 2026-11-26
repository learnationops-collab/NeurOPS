// Tus números, al pie de la columna del lead (Mario, 26/11/2026, ADR-W246): cuánto tardás en responder estando activo
// e inactivo (mediana de las últimas 24 h), las agendas que cargaste hoy y tu promedio diario de los últimos 30 días.
// Se piden al abrir y cada minuto. Los números entran contando.
import { useEffect, useState } from 'react';
import { CalendarPlus, Moon, TrendingUp, Zap } from 'lucide-react';
import { inboxApi } from '../api';

function Contar({ valor, decimales = 0 }) {
    const [visto, setVisto] = useState(0);
    useEffect(() => {
        if (valor == null) return undefined;
        let cuadro;
        const ini = performance.now();
        const paso = (t) => {
            const k = Math.min(1, (t - ini) / 700);
            setVisto(valor * (1 - (1 - k) ** 3));
            if (k < 1) cuadro = requestAnimationFrame(paso);
        };
        cuadro = requestAnimationFrame(paso);
        return () => cancelAnimationFrame(cuadro);
    }, [valor]);
    if (valor == null) return '—';
    return visto.toFixed(decimales).replace('.', ',');
}

function Dato({ icono: Icono, color, valor, unidad, decimales, rotulo, tip }) {
    return (
        <div className="cv-mis-dato" style={{ '--c': color }} data-tip={tip}>
            <span className="cv-mis-ico"><Icono size={13} aria-hidden="true" /></span>
            <b><Contar valor={valor} decimales={decimales} />{valor != null && unidad && <small>{unidad}</small>}</b>
            <span>{rotulo}</span>
        </div>
    );
}

export default function MisStats() {
    const [s, setS] = useState(null);
    useEffect(() => {
        let vivo = true;
        const pedir = () => inboxApi.misStats().then((d) => { if (vivo) setS(d); }, () => {});
        pedir();
        const t = setInterval(pedir, 60000);
        return () => { vivo = false; clearInterval(t); };
    }, []);
    if (!s) return null;
    const resp = (x) => (x ? `Mediana sobre ${x.respuestas} ${x.respuestas === 1 ? 'respuesta' : 'respuestas'}, últimas 24 h` : 'Sin respuestas así en las últimas 24 h');
    return (
        <section className="cv-mis" aria-label="Tus números">
            <span className="cv-mis-tit">Tus números</span>
            <div className="cv-mis-grid">
                <Dato icono={Zap} color="var(--success)" valor={s.activo?.mediana} unidad="min" rotulo="Respuesta activo" tip={`Respondiendo activo|${resp(s.activo)}`} />
                <Dato icono={Moon} color="var(--warning)" valor={s.inactivo?.mediana} unidad="min" rotulo="Respuesta inactivo" tip={`Respondiendo inactivo|${resp(s.inactivo)}`} />
                <Dato icono={CalendarPlus} color="var(--brand-secondary)" valor={s.agendas_hoy} rotulo="Agendas hoy" tip="Agendas hoy|Las que cargaste hoy como setter" />
                <Dato icono={TrendingUp} color="var(--info)" valor={s.agendas_promedio} decimales={1} rotulo="Promedio diario"
                    tip={`Promedio diario|Agendas por día en los últimos ${s.dias} días`} />
            </div>
        </section>
    );
}
