import { useState } from 'react';
import { PieChart, Rows } from 'lucide-react';
import CierreComercial from './CierreComercial';
import RepartoEstados from './RepartoEstados';
import TiraDescalificadas from './TiraDescalificadas';
import ModalNoCerradas from './ModalNoCerradas';
import CierrePorLlamada from './llamadas/CierrePorLlamada';
import useRegistrosLlamadas from './llamadas/useRegistrosLlamadas';
import { DESTINOS_CIERRES } from './destinos';
import { fmt } from './Shared';
import { Panel, PanelCab, Tabs, Vacio } from './PiezasAnalizar';

/**
 * Los dos paneles de Analizar › Closers que miran las LLAMADAS: qué destino tuvo cada agenda y cómo
 * cerraron. Vivían en `Analizar.jsx`; salieron al sumar el corte por primera y segunda llamada (ADR-W144).
 *
 * `filtros`: los del tablero. Con ellos cada cifra abre la lista de las agendas que la suman
 * (`useRegistrosLlamadas`); sin ellos va a Revisar por `irA`, como antes.
 */

const TABS_VISTA = [['grafico', 'Gráfico', PieChart], ['tabla', 'Tabla', Rows]];
// Primera o segunda por ORDEN: a cuántas llamadas ya asistió ese lead (`comercial_llamadas`).
const TABS_LLAMADA = [['todas', 'Todas'], ['primera', '1ª llamada'], ['segunda', '2ª o más']];
const ROTULO_LLAMADA = { primera: '1ª llamada', segunda: '2ª llamada o más' };

/**
 * El destino de cada agenda del período: se presentó, no show, canceló, reprogramó o sin reportar, sobre
 * la misma base que la tarjeta Show up; lo que no cuenta va en una tira aparte (`RepartoEstados`).
 */
export const PanelEstados = ({ bloque, irA, filtros = null }) => {
    const [vista, setVista] = useState('grafico');
    const [llamada, setLlamada] = useState('todas');
    const registros = useRegistrosLlamadas(filtros);
    const porLlamada = bloque.estados_por_llamada;
    const elegida = llamada !== 'todas' && porLlamada?.[llamada];
    const total = elegida ? elegida.agendas : bloque.agendas;
    const estados = elegida ? elegida.estados : bloque.estados;
    const onVer = registros.abrir ? (clave, rotulo) => registros.abrir(clave,
        `${rotulo}${elegida ? ` · ${ROTULO_LLAMADA[llamada]}` : ''}`, { llamada: elegida ? llamada : null }) : null;
    return (
        <Panel id="p-estados" cab={
            <PanelCab titulo="Destino de las agendas"
                ayuda={`Qué pasó con las ${total} agendas. El show up cuenta las que ya pasaron.`}>
                {porLlamada && <Tabs valor={llamada} onChange={setLlamada} ops={TABS_LLAMADA} aria="Tipo de llamada" />}
                <Tabs valor={vista} onChange={setVista} ops={TABS_VISTA} aria="Vista de estados" />
                <small className="est-total num">
                    <b>{fmt.num(total)}</b> {total === 1 ? 'agenda' : 'agendas'}
                </small>
            </PanelCab>
        }>
            {total === 0
                ? <Vacio texto={llamada === 'segunda' ? 'Sin segundas llamadas en el período.' : 'Sin agendas en el período.'} />
                : <RepartoEstados key={llamada} estados={estados} vista={vista} irA={irA} onVer={onVer} />}
            {/* Los que el formulario corta no son agendas: pueden ser lo único del período. */}
            {(total > 0 || bloque.descalificadas?.formulario > 0)
                && <TiraDescalificadas datos={bloque.descalificadas} irA={irA} />}
            {registros.panel}
        </Panel>
    );
};

/**
 * El cierre en sus cuatro lecturas: ventas (pago completo + split pay, el close rate de verdad) y
 * señas, cada una por llamada y por presentación; abajo, por canal y por primera o segunda llamada.
 *
 * «No cerradas» abre un modal con cada lead y su objeción (`ModalNoCerradas`), que pide su lista
 * con `cargarNoCerradas` y desde el que se va a Revisar. Tocar un lead cierra el modal y abre su
 * ficha (`onAbrirFila`, la misma de Revisar); al cerrar la ficha se vuelve a la lista, que se pide
 * de nuevo por si en la ficha se cargó una objeción. Sin `cargarNoCerradas` el número va directo a
 * Revisar, como el resto de la tarjeta.
 */
export const PanelCierre = ({ bloque, previo, vsLabel, irA, cargarNoCerradas, onAbrirFila, filtros = null }) => {
    const [verNoCerradas, setVerNoCerradas] = useState(false);
    const registros = useRegistrosLlamadas(filtros);
    const c = bloque.cierres;
    // Sin llamadas de este período pero con cierres de llamadas anteriores, el panel se muestra igual.
    const vacio = !c || (bloque.asistieron === 0 && !c.reales?.base);
    const abrirLead = onAbrirFila ? (fila) => {
        setVerNoCerradas(false);
        onAbrirFila(fila, { alCerrar: () => setVerNoCerradas(true) });
    } : null;
    return (
        <Panel id="p-cierre" cab={
            <PanelCab titulo="Cierre"
                ayuda={'El close rate cuenta solo pagos completos y split pay, una venta por lead. El '
                    + 'anillo azul son las ventas y el rosa las señas, sobre las agendas, sobre las llamadas con show up y '
                    + 'sobre las presentaciones. Arriba, el camino de la agenda a la venta. Abajo, el mismo close rate de las agendas directas y de '
                    + 'las que vienen del triage. Debajo de cada cifra, la del período comparado y cuánto cambió.'}>
                {previo && <span className="cc-vs-cab"><small>vs</small>{vsLabel || 'Período comparado'}</span>}
            </PanelCab>
        }>
            {vacio
                ? <Vacio texto="Ninguna llamada del período tiene todavía un show up cargado." />
                : (
                    <CierreComercial cierres={c} previo={previo?.cierres} previoCanal={previo?.cierres_canal} vsLabel={vsLabel}
                        porCanal={bloque.cierres_canal} irA={irA} destinos={DESTINOS_CIERRES}
                        agendas={bloque.agendas ?? null} previoAgendas={previo?.agendas ?? null} sinResultado={bloque.sin_resultado}
                        onVerNoCerradas={cargarNoCerradas ? () => setVerNoCerradas(true) : undefined}>
                        <CierrePorLlamada porLlamada={bloque.cierres_llamada} previo={previo?.cierres_llamada}
                            vsLabel={vsLabel} onVer={registros.abrir} />
                    </CierreComercial>
                )}
            {verNoCerradas && cargarNoCerradas && (
                <ModalNoCerradas cargar={cargarNoCerradas} total={c?.no_cerradas?.num ?? null}
                    irA={irA} destino={DESTINOS_CIERRES.no_cerradas} onAbrir={abrirLead}
                    onCerrar={() => setVerNoCerradas(false)} />
            )}
            {registros.panel}
        </Panel>
    );
};
