import { createContext, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { SkeletonBlock } from '../../../../components/standard';
import { Isotipo, Segmented } from '../../../comercial/components/Shared';
import TallerEnVivo from './TallerEnVivo';

/**
 * La cabecera de Workshop: arriba el título compacto con la cuenta regresiva y, en UNA línea, las
 * pestañas, los filtros de la pestaña abierta y las acciones (17/10/2026).
 *
 * El título va en su propio renglón chico porque en la línea no entra: a 1330 px pestañas (≈460),
 * filtros del Resumen (≈430) y acciones (≈220) ya ocupan casi todo. El nombre de la pestaña ya no
 * se repite como título grande: lo dice la pestaña elegida.
 *
 * Los filtros los pone cada pestaña con <EnCabecera>, así solo aparecen en la que los usa. En
 * anchos chicos la grilla pasa a dos o tres renglones enteros (ver workshop-shell.css), nunca un
 * elemento suelto abajo.
 */

const Slot = createContext(undefined);

/** Lleva sus hijos a la línea de la cabecera. Sin cabecera (tests, otra pantalla) los deja acá. */
export const EnCabecera = ({ children }) => {
    const destino = useContext(Slot);
    if (destino === undefined) return children;
    return destino ? createPortal(children, destino) : null;
};

const CabeceraWorkshop = ({
    pestanas, activa, onPestana, eventos, onIrAProximos, recargando, onRecargar, onRegistrar, alcance = null, children,
}) => {
    const [destino, setDestino] = useState(null);
    return (
        <Slot.Provider value={destino}>
            <div className="dc-shell dc-shell--embebido ws-cabeza">
                <header className="ws-cab">
                    <div className="ws-cab-id">
                        <Isotipo idGrad="lnGradWorkshop" />
                        <h1 className="ws-cab-titulo">Workshop</h1>
                        {eventos ? <TallerEnVivo eventos={eventos} onIrAProximos={onIrAProximos} />
                            : <SkeletonBlock width={176} height={26} radius={999} />}
                    </div>
                    <div className="ws-cab-tabs">
                        <Segmented opciones={pestanas} valor={activa} ariaLabel="Secciones de Workshop" onChange={onPestana} />
                    </div>
                    <div className="ws-cab-filtros" ref={setDestino} />
                    <div className="ws-cab-acc">
                        {onRecargar && (
                            <button type="button" className="ibtn" onClick={onRecargar} disabled={recargando}
                                title="Volver a cargar" aria-label="Volver a cargar">
                                <RefreshCw className={recargando ? 'ws-gira' : ''} aria-hidden="true" />
                            </button>
                        )}
                        <button type="button" className="btn btn--cta btn--sm ws-cab-registrar" onClick={onRegistrar}
                            title="Registrar taller" aria-label="Registrar taller">
                            <Plus size={15} aria-hidden="true" /> <span>Registrar taller</span>
                        </button>
                    </div>
                </header>
                {/* De qué talleres o de qué período habla la pestaña (`alcanceWorkshop.js`). */}
                {alcance && <p className="t-cap ws-cab-alcance" role="note"><b>Habla de:</b> {alcance}</p>}
            </div>
            {children}
        </Slot.Provider>
    );
};

export default CabeceraWorkshop;
