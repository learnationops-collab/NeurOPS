// Stats de la bandeja: la mediana de respuesta (la propia y la del equipo), lo que espera y lo cortado. Desde ADR-W245,
// la propia separada en activo e inactivo (el botón de arriba) y cuánto estuvo activo.
// La respuesta se le cuenta al setter asignado a la conversación: Meta no dice quién contestó.
import { BarChart3 } from 'lucide-react';
import { Bars, Grid, Kpi, Modal, ModalHeader } from '../../../components/standard';
import { esperaMin, esperaSeguimiento, flujoCortado, seguimientosDe } from './colas';

// «2 h 15 min», «40 min».
const horas = (seg) => {
    const min = Math.round((seg || 0) / 60);
    return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;
};

// Seguimientos de tus conversaciones (Mario, 27/11/2026): las que no contestaron, cuántas sin seguimiento, el promedio
// desde su última respuesta y en toda la conversación, y cuántas van en 0, 1, 2 o 3 o más.
function Seguimientos({ mias }) {
    const esperando = mias.filter(esperaSeguimiento);
    const totales = mias.map((c) => seguimientosDe(c).n).filter((n) => n > 0);
    const promedio = (xs) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1).replace('.', ',') : '—');
    const tramos = [[0, 'Sin seguimiento', 'var(--error)'], [1, '1', '#7D63E6'], [2, '2', '#7D63E6'], [3, '3 o más', 'var(--brand-secondary)']]
        .map(([n, label, color]) => ({ key: String(n), label, color, value: esperando.filter((c) => (n === 3 ? c.racha.n >= 3 : c.racha.n === n)).length }));
    return (
        <>
            <span className="t-rotulo">Seguimientos · tus conversaciones cargadas</span>
            <Grid variant="kpis" className="cv-stats-kpis">
                <Kpi label="No contestaron" value={esperando.length}><small>lo último es tuyo</small></Kpi>
                <Kpi label="Sin seguimiento" value={tramos[0].value}><small>no les volviste a escribir</small></Kpi>
                <Kpi label="Seguimientos por lead" value={promedio(esperando.map((c) => c.racha.n))}><small>desde su última respuesta</small></Kpi>
                <Kpi label="En toda la conversación" value={promedio(totales)}><small>promedio de {totales.length} con alguno</small></Kpi>
            </Grid>
            {esperando.length > 0 && (
                <Bars variant="rows" label="No contestaron, por cantidad de seguimientos" items={tramos.map((t) => ({ ...t, display: String(t.value),
                    tip: `${t.label}|${t.value} de ${esperando.length} que no contestaron` }))} />
            )}
        </>
    );
}

export default function Stats({ lista, mediana, setters, yo, ahora, onCerrar }) {
    const mias = lista.filter((c) => c.asignado?.id === yo);
    const propia = setters.find((s) => s.id === yo);
    const max = Math.max(1, ...setters.map((s) => s.mediana));
    return (
        <Modal onClose={onCerrar} className="cv-stats" labelledBy="cv-stats-t">
            <ModalHeader icon={<BarChart3 size={18} />} title="Stats del Inbox" titleId="cv-stats-t"
                subtitle="Últimas 24 h · el bot no cuenta en los tiempos" onClose={onCerrar} />
            <Grid variant="kpis" className="cv-stats-kpis">
                <Kpi label="Tu mediana de respuesta" value={propia ? `${propia.mediana} min` : '—'}><small>{propia ? `${propia.respuestas} respuestas` : 'Sin respuestas'}</small></Kpi>
                <Kpi label="Mediana del equipo" value={mediana == null ? '—' : `${mediana} min`} />
                <Kpi label="Tuyas esperando" value={mias.filter((c) => esperaMin(c, ahora) != null).length}><small>{mias.length} asignadas a vos</small></Kpi>
                <Kpi label="Flujos cortados" value={lista.filter(flujoCortado).length}><small>{lista.filter((c) => !c.asignado).length} sin asignar</small></Kpi>
            </Grid>
            <span className="t-rotulo">Activo e inactivo · lo que marcás arriba</span>
            <Grid variant="kpis" className="cv-stats-kpis">
                <Kpi label="Respondiendo activo" value={propia?.activo ? `${propia.activo.mediana} min` : '—'}><small>{propia?.activo ? `${propia.activo.respuestas} respuestas` : 'Sin respuestas activo'}</small></Kpi>
                <Kpi label="Respondiendo inactivo" value={propia?.inactivo ? `${propia.inactivo.mediana} min` : '—'}><small>{propia?.inactivo ? `${propia.inactivo.respuestas} respuestas` : 'Sin respuestas inactivo'}</small></Kpi>
                <Kpi label="Tiempo activo" value={propia ? horas(propia.segundos_activo) : '—'}><small>últimas 24 h</small></Kpi>
            </Grid>
            <Seguimientos mias={mias} />
            {setters.length > 0 && (
                <>
                    <span className="t-rotulo">Respuesta por setter</span>
                    <Bars variant="rows" label="Mediana de respuesta por setter" items={setters.map((s) => ({
                        key: String(s.id), value: s.mediana, label: s.id === yo ? 'Vos' : s.username, display: `${s.mediana} min`,
                        detail: `${s.respuestas} resp.${s.activo ? ` · activo ${s.activo.mediana} min` : ''}`, color: s.id === yo ? 'var(--brand-secondary)' : 'var(--info)',
                        tip: `${s.username}|Mediana sobre ${s.respuestas} respuestas`,
                    }))} scale={max > 60 ? 'sqrt' : 'linear'} />
                </>
            )}
        </Modal>
    );
}
