// Las secciones del Filtro (ADR-W254). A la izquierda, su nombre con lo elegido debajo; a la derecha, la sección
// abierta. Dentro de una sección, las opciones de un mismo grupo se suman; entre secciones, se cumplen todas.
// Cada opción dice cuántas conversaciones quedarían con ella puesta, contando lo demás que ya está.
import { Segmented } from '../../../components/standard';
import { COLAS, asignados, contar, esWhatsapp } from './colas';
import { faseDe, corto } from './fasesSetting';
import { EtiquetasFiltro, Fases, Opciones, Rango } from './piezasFiltro';
import VistasFiltro from './VistasFiltro';

export const SECCIONES = [
    { key: 'rapidos', label: 'Rápidos y guardados' },
    { key: 'estado', label: 'Estado' },
    { key: 'etapa', label: 'Etapa del setting' },
    { key: 'seguimientos', label: 'Seguimientos' },
    { key: 'personas', label: 'Quién y de dónde' },
    { key: 'fechas', label: 'Fechas' },
    { key: 'etiquetas', label: 'Etiquetas' },
];
const CANTIDADES = [[1, '1'], [2, '2'], [3, '3'], ['4+', '4 o más']];

function Grupo({ titulo, ayuda, children }) {
    return (
        <div className="cv-filtro-grupo-op">
            <span className="t-rotulo">{titulo}</span>
            {ayuda && <p className="t-cap mut">{ayuda}</p>}
            {children}
        </div>
    );
}

function Seguimientos({ filtro, cambiar, cuenta }) {
    const etapas = (filtro.fases || []).map((f) => corto(faseDe(f))).join(', ');
    const conAlguno = filtro.fuCant != null && filtro.fuCant !== 0;
    return (
        <>
            <p className="cv-filtro-nota">
                {etapas ? <>Cuenta los seguimientos que le hicieron mientras estaba en <b>{etapas}</b> (lo elegido en Etapa del setting).</>
                    : <>Sin etapa elegida, cuenta todos los seguimientos. Para una etapa, elegila en <b>Etapa del setting</b>.</>}
            </p>
            <Grupo titulo="Seguimientos" ayuda="Un seguimiento es un mensaje del equipo después de 12 h sin respuesta, o el que marcaste como seguimiento.">
                <Opciones valor={conAlguno ? 'alguno' : filtro.fuCant} onElegir={(v) => cambiar({ fuCant: v, fuCuando: null })}
                    opciones={[[0, 'Ninguno', cuenta({ fuCant: 0, fuCuando: null })], ['alguno', 'Al menos uno', cuenta({ fuCant: 'alguno' })]]} />
            </Grupo>
            {conAlguno && (
                <>
                    <Grupo titulo="¿Cuántos?" ayuda="Sin elegir: cualquier cantidad.">
                        <Opciones valor={filtro.fuCant} onElegir={(v) => cambiar({ fuCant: v ?? 'alguno' })}
                            opciones={CANTIDADES.map(([v, l]) => [v, l, cuenta({ fuCant: v })])} />
                    </Grupo>
                    <Grupo titulo="El último fue">
                        <Rango clave="fuCuando" filtro={filtro} cambiar={cambiar} conRango={false} cuenta={cuenta} />
                    </Grupo>
                </>
            )}
            <Grupo titulo="¿Contestó el último?">
                <Opciones valor={filtro.fuResp} onElegir={(fuResp) => cambiar({ fuResp })} opciones={[
                    ['si', 'Contestó', cuenta({ fuResp: 'si' }), 'var(--success)'], ['no', 'No contestó', cuenta({ fuResp: 'no' }), 'var(--error)']]} />
            </Grupo>
            <Grupo titulo="Cadencia">
                <Opciones valor={filtro.toca} onElegir={(v) => cambiar({ toca: Boolean(v) })}
                    opciones={[[true, 'Toca seguimiento ahora', cuenta({ toca: true }), 'var(--warning)']]} />
            </Grupo>
        </>
    );
}

export default function SeccionFiltro({ sec, lista, filtro, cambiar, onCambiar, ahora, yo }) {
    const cuenta = (parte) => contar(lista, { ...filtro, ...parte, ahora });
    const setters = asignados(lista);
    const nombre = (s) => (s.id === yo ? 'Vos' : s.username);
    if (sec === 'rapidos') {
        return (
            <>
                <Grupo titulo="Rápidos" ayuda="Un toque y queda puesto. Después lo podés ajustar en las otras secciones.">
                    <VistasFiltro cuales="rapidos" lista={lista} filtro={filtro} onCambiar={onCambiar} ahora={ahora} yo={yo} />
                </Grupo>
                <Grupo titulo="Guardados">
                    <VistasFiltro cuales="guardados" lista={lista} filtro={filtro} onCambiar={onCambiar} ahora={ahora} yo={yo}
                        vacio="Todavía no guardaste ninguno: armá un filtro y guardalo con un nombre abajo." />
                </Grupo>
            </>
        );
    }
    if (sec === 'estado') {
        return (
            <Grupo titulo="Cola" ayuda="Una a la vez.">
                <Segmented orientation="vertical" label="Cola" value={filtro.cola} onChange={(cola) => cambiar({ cola })}
                    options={COLAS.map((c) => ({ value: c.value, label: c.label, count: cuenta({ cola: c.value }) }))} />
            </Grupo>
        );
    }
    if (sec === 'etapa') {
        return (
            <Grupo titulo="Fase" ayuda="Podés elegir varias: muestra las que estén en cualquiera de ellas.">
                <Fases elegidas={filtro.fases || []} onCambiar={(fases) => cambiar({ fases })} cuenta={(id) => cuenta({ fases: [id] })} />
            </Grupo>
        );
    }
    if (sec === 'seguimientos') return <Seguimientos filtro={filtro} cambiar={cambiar} cuenta={cuenta} />;
    if (sec === 'personas') {
        return (
            <>
                <Grupo titulo="Asignado a">
                    <Opciones valor={filtro.asignado} onElegir={(asignado) => cambiar({ asignado })} opciones={[
                        ...setters.map((s) => [s.id, nombre(s), cuenta({ asignado: s.id })]),
                        ['ninguno', 'Sin asignar', cuenta({ asignado: 'ninguno' }), 'var(--warning)']]} />
                </Grupo>
                <Grupo titulo="Último mensaje de">
                    <Opciones valor={filtro.envioPor} onElegir={(envioPor) => cambiar({ envioPor })} opciones={[
                        ['lead', 'El lead', cuenta({ envioPor: 'lead' }), 'var(--brand-secondary)'],
                        ...setters.map((s) => [s.id, nombre(s), cuenta({ envioPor: s.id })]), ['bot', 'El bot', cuenta({ envioPor: 'bot' })]]} />
                </Grupo>
                <Grupo titulo="Origen">
                    <Opciones valor={filtro.origen} onElegir={(origen) => cambiar({ origen })}
                        opciones={[['anuncios', 'Anuncios'], ['inbound', 'Inbound'], ['bienvenida', 'Bienvenida']].map(([v, l]) => [v, l, cuenta({ origen: v })])} />
                </Grupo>
                <Grupo titulo="Canal">
                    <Opciones valor={filtro.canal} onElegir={(canal) => cambiar({ canal })} opciones={[
                        ['ig', 'Instagram', lista.filter((c) => !esWhatsapp(c)).length], ['wa', 'WhatsApp', lista.filter(esWhatsapp).length, 'var(--success)']]} />
                </Grupo>
                <Grupo titulo="Calificación">
                    <Opciones valor={filtro.califica} onElegir={(califica) => cambiar({ califica })} opciones={[
                        ['si', 'Califica', cuenta({ califica: 'si' }), 'var(--success)'], ['no', 'No califica', cuenta({ califica: 'no' }), 'var(--error)']]} />
                </Grupo>
            </>
        );
    }
    if (sec === 'fechas') {
        return (
            <>
                <Grupo titulo="Empezó la última conversación"><Rango clave="inicio" filtro={filtro} cambiar={cambiar} cuenta={cuenta} /></Grupo>
                <Grupo titulo="Último mensaje enviado"><Rango clave="envio" filtro={filtro} cambiar={cambiar} cuenta={cuenta} /></Grupo>
            </>
        );
    }
    return (
        <Grupo titulo="Con cualquiera de estas">
            <EtiquetasFiltro lista={lista} elegidas={filtro.etiquetas || []} onCambiar={(etiquetas) => cambiar({ etiquetas })} />
        </Grupo>
    );
}
