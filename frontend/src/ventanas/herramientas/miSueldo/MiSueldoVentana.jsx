// La herramienta «Mi sueldo» (ADR-W223, pedido de Marlon): de qué se compone el sueldo de un mes. A la
// izquierda el total, los conceptos y los últimos meses; a la derecha los pagos que suman la comisión,
// filtrados por el concepto elegido. Setters y closers ven lo suyo; el director, cualquiera del equipo.
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState, IconButton, Select, Skeleton, SkeletonBlock, SkeletonPanel } from '../../../components/standard';
import { useMiSueldo } from './useMiSueldo';
import { nombreMes, sumarMes } from './reglas';
import ConceptosDelMes from './ConceptosDelMes';
import HistoriaMeses from './HistoriaMeses';
import PagosDelMes from './PagosDelMes';
import './miSueldo.css';

const Esqueleto = () => (
    <Skeleton label="Calculando el sueldo…" className="ms">
        <div className="ms-izq"><SkeletonBlock height={36} /><SkeletonBlock height={14} /><SkeletonPanel rows={5} rowHeight={52} /></div>
        <div className="ms-der"><SkeletonPanel rows={9} rowHeight={44} /></div>
    </Skeleton>
);

export default function MiSueldoVentana() {
    const sueldo = useMiSueldo();
    const { datos, error, cargando } = sueldo;
    const [filtro, setFiltro] = useState('');
    // Otro mes u otra persona: vuelven a verse todos los pagos.
    const irAMes = (m) => { setFiltro(''); sueldo.irAMes(m); };
    const elegirPersona = (c) => { setFiltro(''); sueldo.elegirPersona(c); };

    if (!datos && cargando) return <Esqueleto />;
    if (!datos) return <EmptyState title="Mi sueldo">{error}</EmptyState>;

    const mes = datos.historia[datos.historia.length - 1];
    const { persona } = datos;
    const opciones = (datos.personas || []).map(p => ({
        value: p.clave, label: `${p.clave === datos.propia ? 'Yo' : p.nombre} · ${p.rol}`,
    }));

    return (
        <div className={`ms${cargando ? ' ms--cargando' : ''}`} aria-busy={cargando}>
            <div className="ms-izq">
                <div className="ms-barra">
                    <div className="ms-mes">
                        <IconButton size="sm" label="Mes anterior" icon={<ChevronLeft size={16} />} onClick={() => irAMes(sumarMes(datos.mes, -1))} />
                        <b>{nombreMes(datos.mes)}</b>
                        <IconButton size="sm" label="Mes siguiente" icon={<ChevronRight size={16} />}
                            disabled={datos.mes >= datos.actual} onClick={() => irAMes(sumarMes(datos.mes, 1))} />
                    </div>
                    {opciones.length > 0 && (
                        <Select size="sm" label="Persona" value={persona.clave} options={opciones} onChange={elegirPersona} />
                    )}
                </div>
                {!persona.propia && <p className="ms-quien">Sueldo de {persona.nombre}</p>}
                <ConceptosDelMes mes={mes} rol={persona.rol} filtro={filtro} onFiltro={setFiltro} />
                <HistoriaMeses historia={datos.historia} elegido={datos.mes} onElegir={irAMes} />
            </div>
            <PagosDelMes pagos={datos.pagos} conceptos={mes.conceptos} filtro={filtro} onFiltro={setFiltro} />
        </div>
    );
}
