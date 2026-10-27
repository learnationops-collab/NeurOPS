// Sección Campañas: cada campaña junta palabras clave y las lleva a un flujo mientras está vigente
// (app/automatizaciones/campanas.py). La cabecera trae el filtro por estado, el período de las métricas
// y «Nueva campaña». Abrir una tarjeta abre el editor.
import { useCallback, useEffect, useState } from 'react';
import { Megaphone, Plus } from 'lucide-react';
import { BRAND_AURA, Button, EmptyState, Grid, HeaderActions, Segmented, toast } from '../../components/standard';
import EditorCampana from './campanas/EditorCampana';
import TarjetaCampana from './campanas/TarjetaCampana';
import { ESTADOS, copiaDe, estadoDe } from './campanas/campana';
import { inboxApi } from './api';

const FILTROS = [['todas', 'Todas'], ['vigente', 'Vigentes'], ['proxima', 'Próximas'], ['terminada', 'Terminadas']];
const PERIODOS = [{ value: 7, label: '7 d' }, { value: 30, label: '30 d' }, { value: 90, label: '90 d' }];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function periodo(dias) {
    const hasta = new Date();
    const desde = new Date(hasta);
    desde.setDate(desde.getDate() - (dias - 1));
    return [iso(desde), iso(hasta)];
}

export default function Campanas({ puedeEditar }) {
    const [campanas, setCampanas] = useState(null);
    const [error, setError] = useState(null);
    const [filtro, setFiltro] = useState('todas');
    const [dias, setDias] = useState(30);
    const [editando, setEditando] = useState(null); // null cerrado · 'nueva' · la campaña
    const [plantilla, setPlantilla] = useState(null); // formulario de una campaña clonada (con editando = 'nueva')
    const [flujos, setFlujos] = useState([]);
    const [campanasMeta, setCampanasMeta] = useState([]);
    const [setters, setSetters] = useState([]);

    const cargar = useCallback(() => {
        inboxApi.campanas(...periodo(dias)).then((r) => setCampanas(r.campanas)).catch(() => setError('No se pudieron cargar las campañas'));
    }, [dias]);
    useEffect(() => { cargar(); }, [cargar]);
    useEffect(() => {
        inboxApi.flujos().then(setFlujos).catch(() => setFlujos([]));
        inboxApi.campanasMeta().then(setCampanasMeta).catch(() => setCampanasMeta([]));
        inboxApi.setters().then(setSetters).catch(() => setSetters([]));
    }, []);

    const cerrar = () => { setEditando(null); setPlantilla(null); };
    const clonar = (c) => { setPlantilla(copiaDe(c)); setEditando('nueva'); };
    const cerrarCon = (mensaje) => { cerrar(); toast(mensaje); cargar(); };
    const cuenta = (id) => (campanas || []).filter((c) => id === 'todas' || estadoDe(c) === id).length;
    const visibles = (campanas || []).filter((c) => filtro === 'todas' || estadoDe(c) === filtro);

    let cuerpo;
    if (error) cuerpo = <EmptyState icon={<Megaphone size={22} />}>{error}</EmptyState>;
    else if (campanas === null) cuerpo = <EmptyState>Cargando…</EmptyState>;
    else if (!campanas.length) {
        cuerpo = (
            <EmptyState icon={<Megaphone size={22} />} title="Todavía no hay campañas" aura={BRAND_AURA}
                action={puedeEditar && <Button variant="primary" icon={<Plus />} onClick={() => setEditando('nueva')}>Nueva campaña</Button>}>
                Una campaña junta varias palabras clave y las lleva a un flujo mientras está vigente. La misma palabra
                puede volver a usarse en otra campaña más adelante.
            </EmptyState>
        );
    } else if (!visibles.length) {
        cuerpo = <EmptyState>No hay campañas en «{FILTROS.find((x) => x[0] === filtro)[1]}».</EmptyState>;
    } else {
        cuerpo = (
            <Grid variant="cards">
                {visibles.map((c) => <TarjetaCampana key={c.id} c={c} setters={setters} puedeEditar={puedeEditar}
                    onAbrir={setEditando} onClonar={clonar} />)}
            </Grid>
        );
    }

    return (
        <>
            <HeaderActions>
                <div className="barra">
                    {campanas?.length > 0 && (
                        <>
                            <Segmented size="sm" label="Filtrar por estado" value={filtro} onChange={setFiltro}
                                options={FILTROS.map(([value, label]) => ({
                                    value, label, count: cuenta(value),
                                    icon: value === 'todas' ? null : <i className="fl-punto" style={{ '--c': ESTADOS[value].color }} />,
                                }))} />
                            <Segmented size="sm" label="Período de las métricas" value={dias} onChange={setDias} options={PERIODOS} />
                        </>
                    )}
                    {puedeEditar && (
                        <div className="barra-der">
                            <Button variant="primary" icon={<Plus />} onClick={() => setEditando('nueva')}>Nueva campaña</Button>
                        </div>
                    )}
                </div>
            </HeaderActions>
            {cuerpo}
            {editando && (
                <EditorCampana campana={editando === 'nueva' ? null : editando} plantilla={plantilla} flujos={flujos}
                    campanasMeta={campanasMeta} setters={setters} lectura={!puedeEditar} onCerrar={cerrar}
                    onGuardada={(c) => cerrarCon(`${c.nombre} guardada`)} onBorrada={(c) => cerrarCon(`${c.nombre} eliminada`)} />
            )}
        </>
    );
}
