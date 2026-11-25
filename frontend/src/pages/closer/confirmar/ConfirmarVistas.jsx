// Confirmar con vistas (ADR-W201): la fila de vistas y controles, y la vista activa (tablero, lista o
// semana) sobre las agendas del pool. El tablero lo sigue dibujando la página (`renderTablero`), con las
// tarjetas de siempre; acá se filtra, ordena y agrupa.
import { useEffect, useMemo, useState } from 'react';
import { useTelefono } from './useTelefono';
import { localToday, localDateFromNow } from '../../../utils/datetime';
import BarraVistas from './BarraVistas';
import { agrupacionesDe } from './PopoverVista';
import { aplicarVista, agrupar, catalogoDePropiedades, tipoDe } from './propiedades';
import { useVistasConfirmar } from './vistasConfirmar';
import VistaLista from './VistaLista';
import VistaCalendario, { periodoDe } from './VistaCalendario';
import './confirmar.css';

export default function ConfirmarVistas({ agendas, user, esTriage, ahora, fechaBase, seleccionada, onAbrir, onMover, renderTablero }) {
    const { vistas, actualizar, crear, borrar, restablecer, puedeCrear } = useVistasConfirmar(user, esTriage);
    // Siempre se entra a la primera (el tablero por etapa): la novedad se explora, no se impone.
    const [activaId, setActivaId] = useState(null);
    const [offset, setOffset] = useState(0);
    const vista = vistas.find(v => v.id === activaId) || vistas[0];

    const nombreCloser = (a) => (a.closer_id && a.closer_id === user?.id ? `${a.closer_name || 'Vos'} (vos)` : a.closer_name || 'Sin closer');
    const catalogo = useMemo(() => catalogoDePropiedades(agendas, esTriage), [agendas, esTriage]);
    const closers = useMemo(() => {
        const m = new Map();
        agendas.forEach(a => {
            if (!a.closer_id) return;
            const k = String(a.closer_id);
            const rol = tipoDe(a, { userId: user?.id, esTriage }).clave === 'triage' ? 'triage' : 'closer';
            m.set(k, { valor: k, titulo: nombreCloser(a), rol, cuenta: (m.get(k)?.cuenta || 0) + 1 });
        });
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
    // En el teléfono el calendario guarda sus propios días (3 de entrada): la semana de la compu no entra.
    const telefono = useTelefono();
    const campoDias = telefono ? 'diasTel' : 'dias';
    const dias = vista[campoDias] || (telefono ? 3 : 7);
    const periodo = periodoDe(fechaBase || hoy, offset, dias);

    // En el calendario: las teclas 1 a 9 eligen cuántos días ver; ← y → se mueven; T vuelve a hoy. No con el foco
    // en un campo ni con una ventana abierta (la ficha).
    const esCalendario = vista.tipo === 'semana';
    useEffect(() => {
        if (!esCalendario) return undefined;
        const tecla = (e) => {
            if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
            const t = e.target;
            if (t?.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"], .ui-modal')) return;
            if (document.querySelector('[aria-modal="true"]')) return;
            const dias = /^[1-9]$/.test(e.key) ? Number(e.key) : 0;
            if (dias) { e.preventDefault(); setOffset(0); actualizar(vista.id, { [campoDias]: dias }); return; }
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setOffset(o => o + (e.key === 'ArrowLeft' ? -1 : 1)); return; }
            if (e.key === 't' || e.key === 'T') setOffset(0);
        };
        window.addEventListener('keydown', tecla);
        return () => window.removeEventListener('keydown', tecla);
    }, [esCalendario, vista.id, actualizar, campoDias]);

    const elegir = (id) => { setActivaId(id); setOffset(0); };
    const nueva = (tipo) => { const id = crear(tipo); if (id) setActivaId(id); };
    const quitar = (id) => { borrar(id); if (id === vista.id) setActivaId(null); };

    return (
        <div className="cv">
            <BarraVistas vistas={vistas} vista={vista} onElegir={elegir} onCambio={actualizar} onCrear={nueva} onBorrar={quitar}
                onRestablecer={() => { restablecer(); setActivaId(null); }} puedeCrear={puedeCrear}
                catalogo={catalogo} closers={esTriage ? closers : []} segmentos={segmentos} esTriage={esTriage}
                calendario={{
                    rotulo: periodo.rotulo, desplazado: offset !== 0, dias, alto: vista.alto || 104,
                    mover: (d) => setOffset(o => (d === 0 ? 0 : o + d)),
                    cambiar: ({ dias: d, ...resto }) => {
                        if (d) setOffset(0);
                        actualizar(vista.id, d ? { ...resto, [campoDias]: d } : resto);
                    },
                }} />
            {vista.tipo === 'tablero' && renderTablero({ grupos, agrupacion, props: new Set(vista.props) })}
            {vista.tipo === 'lista' && (
                <VistaLista vista={{ ...vista, agrupar: agrupacion }} grupos={grupos} catalogo={catalogo} ahora={ahora} nombreCloser={nombreCloser}
                    seleccionada={seleccionada} onAbrir={onAbrir} onMover={onMover} primario={esTriage} />
            )}
            {vista.tipo === 'semana' && (
                <VistaCalendario vista={vista} agendas={filtradas} periodo={periodo} hoy={hoy} ahora={ahora} nombreCloser={nombreCloser}
                    catalogo={catalogo} userId={user?.id} esTriage={esTriage} seleccionada={seleccionada} onAbrir={onAbrir} />
            )}
        </div>
    );
}
