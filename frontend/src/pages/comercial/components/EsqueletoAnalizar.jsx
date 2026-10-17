import React from 'react';
import { Skeleton, SkeletonBlock, SkeletonCircle, SkeletonPanel, SkeletonText } from '../../../components/standard';

/**
 * El tablero de Analizar mientras llega el resumen: la MISMA grilla que el de closers o el de
 * setters, con cada panel del alto que tiene con datos (medido a 1330 px), así al llegar los números
 * no salta nada. El resumen es un solo pedido (`/comercial/resumen`), por eso es un solo esqueleto.
 */

/** Un tile de KPI (`Tile` de PiezasAnalizar): rótulo, cifra, detalle y los dos botones de abajo. */
const KpiHueso = ({ paso = 0, acciones = 2, alto }) => (
    <section className="kpi caja" aria-hidden="true" style={alto ? { minHeight: alto } : undefined}>
        {/* 24 = la cabecera con la pastilla del delta; 36 = `.kpi-n`; 17 = `.kpi-sub`. */}
        <SkeletonText width="46%" height={10} lineHeight={24} step={paso} />
        <div className="kpi-cifra">
            <SkeletonBlock width="58%" height={36} radius={8} step={paso + 1} />
            <SkeletonText width="64%" height={9} lineHeight={17} step={paso + 2} />
        </div>
        {acciones > 0 && (
            <div className="kpi-acciones">
                {Array.from({ length: acciones }, (_, i) => <SkeletonCircle key={i} size={30} step={paso + 3} />)}
            </div>
        )}
    </section>
);

/** Un panel con su título y renglones, del alto que tiene con datos (a lo sumo (alto − 78) / 36
 *  filas: más, y el esqueleto mediría más que el panel real). */
const PanelHueso = ({ alto, filas = 5, paso = 0 }) => (
    <SkeletonPanel className="panel" rows={filas} rowHeight={26} step={paso} titleWidth={150}
        style={{ minHeight: alto }} />
);

const Par = ({ alto, filas, paso }) => (
    <div className="grid-2" aria-hidden="true">
        <PanelHueso alto={alto} filas={filas} paso={paso} />
        <PanelHueso alto={alto} filas={filas} paso={paso + 1} />
    </div>
);

const Closers = () => (
    <>
        <div className="grid grid--4" aria-hidden="true">
            {[0, 1, 2, 3].map(i => <KpiHueso key={i} paso={i} alto={184} />)}
        </div>
        <Par alto={328} filas={6} paso={4} />
        <Par alto={601} filas={14} paso={5} />
        <Par alto={438} filas={9} paso={6} />
        <Par alto={236} filas={4} paso={7} />
    </>
);

const Setters = () => (
    <>
        <div className="ds-tiles-caja" aria-hidden="true"><div className="ds-tiles">
            {[0, 1, 2, 3, 4, 5].map(i => <KpiHueso key={i} paso={i} acciones={1} />)}
        </div></div>
        <Par alto={342} filas={7} paso={6} />
        <PanelHueso alto={263} filas={5} paso={7} />
        <Par alto={468} filas={10} paso={8} />
        <PanelHueso alto={553} filas={13} paso={9} />
        <PanelHueso alto={257} filas={4} paso={10} />
    </>
);

/** `rol`: 'closers' | 'setters'. `antes`: lo que no depende del dato (las pestañas de canal). */
const EsqueletoAnalizar = ({ rol, antes = null }) => (
    <>
        {antes}
        <Skeleton label="Cargando el tablero…" className="analizar-huesos">
            {rol === 'setters' ? <Setters /> : <Closers />}
        </Skeleton>
    </>
);

export default EsqueletoAnalizar;
