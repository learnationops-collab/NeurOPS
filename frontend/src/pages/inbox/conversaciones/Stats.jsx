// Stats de la bandeja: la mediana de respuesta (la propia y la del equipo), lo que espera y lo cortado.
// La respuesta se le cuenta al setter asignado a la conversación: Meta no dice quién contestó.
import { BarChart3 } from 'lucide-react';
import { Bars, Grid, Kpi, Modal, ModalHeader } from '../../../components/standard';
import { esperaMin, flujoCortado } from './colas';

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
            {setters.length > 0 && (
                <>
                    <span className="t-rotulo">Respuesta por setter</span>
                    <Bars variant="rows" label="Mediana de respuesta por setter" items={setters.map((s) => ({
                        key: String(s.id), value: s.mediana, label: s.id === yo ? 'Vos' : s.username, display: `${s.mediana} min`,
                        detail: `${s.respuestas} resp.`, color: s.id === yo ? 'var(--brand-secondary)' : 'var(--info)',
                        tip: `${s.username}|Mediana sobre ${s.respuestas} respuestas`,
                    }))} scale={max > 60 ? 'sqrt' : 'linear'} />
                </>
            )}
        </Modal>
    );
}
