// Confirmar con vistas (ADR-W201): la fila de vistas y controles, y la vista activa (tablero, lista o
// semana) sobre las agendas del pool. El tablero lo sigue dibujando la página (`renderTablero`), con las
// tarjetas de siempre; acá se filtra, ordena y agrupa.
import { useMemo, useState } from 'react';
import { localToday, localDateFromNow } from '../../../utils/datetime';
import BarraVistas from './BarraVistas';
import { agrupacionesDe } from './PopoverVista';
import { aplicarVista, agrupar, catalogoDePropiedades } from './propiedades';
import { useVistasConfirmar } from './vistasConfirmar';
import VistaLista from './VistaLista';
import VistaSemana, { semanaDe } from './VistaSemana';
import './confirmar.css';

export default function ConfirmarVistas({ agendas, user, esTriage, ahora, fechaBase, seleccionada, onAbrir, onMover, renderTablero }) {
    const { vistas, actualizar, crear, borrar, restablecer, puedeCrear } = useVistasConfirmar(user, esTriage);
    // Siempre se entra a la primera (el tablero por etapa): la novedad se explora, no se impone.
    const [activaId, setActivaId] = useState(null);
    const [offsetSemana, setOffsetSemana] = useState(0);
    const vista = vistas.find(v => v.id === activaId) || vistas[0];

    const nombreCloser = (a) => (a.closer_id && a.closer_id === user?.id ? `${a.closer_name || 'Vos'} (vos)` : a.closer_name || 'Sin closer');
    const catalogo = useMemo(() => catalogoDePropiedades(agendas, esTriage), [agendas, esTriage]);
    const closers = useMemo(() => {
        const m = new Map();
        agendas.forEach(a => { if (!a.closer_id) return; const k = String(a.closer_id); m.set(k, { valor: k, titulo: nombreCloser(a), cuenta: (m.get(k)?.cuenta || 0) + 1 }); });
        return [...m.values()].sort((x, y) => x.titulo.localeCompare(y.titulo));
    }, [agendas]); // eslint-disable-line react-hooks/exhaustive-deps
    const segmentos = useMemo(() => {
        const m = new Map();
        agendas.forEach(a => { const k = a.segmento || 'sin'; m.set(k, { valor: k, titulo: a.segmento ? `Segmento ${a.segmento}` : 'Sin segmento', cuenta: (m.get(k)?.cuenta || 0) + 1 }); });
        return [...m.values()].sort((x, y) => x.valor.localeCompare(y.valor));
    }, [agendas]);

    const filtradas = useMemo(() => aplicarVista(agendas, vista), [agendas, vista]);
    const hoy = localToday();
    const agrupacion = agrupacionesDe(vista, esTriage).some(a => a.valor === vista.agrupar) ? vista.agrupar : 'etapa';
    const grupos = useMemo(
        () => agrupar(filtradas, agrupacion, { hoy, manana: localDateFromNow(1), ahora, nombreCloser }),
        [filtradas, agrupacion, hoy, ahora], // eslint-disable-line react-hooks/exhaustive-deps
    );
    const semana = semanaDe(fechaBase || hoy, offsetSemana);

    const elegir = (id) => setActivaId(id);
    const nueva = (tipo) => { const id = crear(tipo); if (id) setActivaId(id); };
    const quitar = (id) => { borrar(id); if (id === vista.id) setActivaId(null); };

    return (
        <div className="cv">
            <BarraVistas titulo="Confirmar" vistas={vistas} vista={vista} onElegir={elegir} onCambio={actualizar} onCrear={nueva} onBorrar={quitar}
                onRestablecer={() => { restablecer(); setActivaId(null); }} puedeCrear={puedeCrear}
                catalogo={catalogo} closers={esTriage ? closers : []} segmentos={segmentos} esTriage={esTriage}
                semana={{ rotulo: semana.rotulo, desplazada: offsetSemana !== 0, mover: (d) => setOffsetSemana(o => (d === 0 ? 0 : o + d)) }} />
            {vista.tipo === 'tablero' && renderTablero({ grupos, agrupacion, props: new Set(vista.props) })}
            {vista.tipo === 'lista' && (
                <VistaLista vista={{ ...vista, agrupar: agrupacion }} grupos={grupos} catalogo={catalogo} ahora={ahora} nombreCloser={nombreCloser}
                    seleccionada={seleccionada} onAbrir={onAbrir} onMover={onMover} primario={esTriage} />
            )}
            {vista.tipo === 'semana' && (
                <VistaSemana vista={vista} agendas={filtradas} semana={semana} hoy={hoy} ahora={ahora} nombreCloser={nombreCloser}
                    seleccionada={seleccionada} onAbrir={onAbrir} />
            )}
        </div>
    );
}
