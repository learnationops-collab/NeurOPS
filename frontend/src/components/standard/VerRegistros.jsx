// «Ver registros»: la lista que compone una cifra, en un panel lateral o en una ventana central, a
// elección de la persona (se recuerda). Solo dibuja el marco; la pantalla pasa el contenido (una
// `ListaConfigurable`, una tabla) y el título.
import { useCallback, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Modal, ModalHeader, Segmented } from './Controls';
import './standard.css';

export const MODOS_REGISTROS = ['lateral', 'central'];
const CLAVE_MODO = 'ui_registros_modo';

const leer = () => {
    try { return window.localStorage.getItem(CLAVE_MODO); } catch { return null; }
};
const escribir = (modo) => {
    try { window.localStorage.setItem(CLAVE_MODO, modo); } catch { /* sin almacenamiento: se olvida al recargar */ }
};

/** Panel lateral o ventana central, la última que usó la persona (por navegador). */
export function useModoRegistros(inicial = 'lateral') {
    const [modo, setModoCrudo] = useState(() => {
        const guardado = leer();
        return MODOS_REGISTROS.includes(guardado) ? guardado : inicial;
    });
    const setModo = useCallback((siguiente) => {
        if (!MODOS_REGISTROS.includes(siguiente)) return;
        setModoCrudo(siguiente);
        escribir(siguiente);
    }, []);
    return [modo, setModo];
}

const Lado = () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" />
    </svg>
);
const Centro = () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" /><rect x="7" y="8" width="10" height="8" rx="1" />
    </svg>
);

// Dentro de un `.dc-shell` (Revisar, Marketing) la lista usa sus clases: el marco se monta ahí.
const destino = () => document.querySelector('.dc-shell') || document.body;

/**
 * `titulo` y `subtitulo` dicen qué cifra se abrió y cuánto suma («Agendas · 158 en el período»).
 * `modo` (`lateral` · `central`) y `onModo` los trae `useModoRegistros`; `acciones` va antes del cierre.
 */
export function VerRegistros({ titulo, subtitulo, icono, modo = 'lateral', onModo, onClose, acciones, className, children }) {
    const id = useId();
    const lateral = modo === 'lateral';
    useEffect(() => {
        if (!lateral) return undefined; // la ventana central ya cierra con Escape (Modal)
        const esc = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onClose(); } };
        document.addEventListener('keydown', esc);
        return () => document.removeEventListener('keydown', esc);
    }, [lateral, onClose]);

    const cabecera = (
        <ModalHeader flush icon={icono} title={titulo} subtitle={subtitulo} titleId={id} onClose={onClose}
            actions={onModo && (
                <Segmented size="sm" label="Dónde ver los registros" value={modo} onChange={onModo}
                    options={[
                        { value: 'lateral', label: 'Lateral', icon: <Lado />, props: { title: 'Panel lateral' } },
                        { value: 'central', label: 'Central', icon: <Centro />, props: { title: 'Ventana central' } },
                    ]} />
            )} />
    );
    const cuerpo = <div className="ui-reg__cuerpo">{acciones}{children}</div>;

    return createPortal(lateral ? (
        <aside className={clsx('ui-reg', 'ui-reg--lateral', className)} role="dialog" aria-modal="false" aria-labelledby={id}>
            {cabecera}
            {cuerpo}
        </aside>
    ) : (
        <Modal onClose={onClose} labelledBy={id} className={clsx('ui-reg', 'ui-reg--central', className)}>
            {cabecera}
            {cuerpo}
        </Modal>
    ), destino());
}

/**
 * El estado de un «ver registros» de la pantalla: `abrir({ titulo, subtitulo, contenido })` y
 * `{panel}` va una vez en el JSX. Sin lógica de negocio: la pantalla arma el contenido.
 */
export function useVerRegistros() {
    const [spec, setSpec] = useState(null);
    const [modo, setModo] = useModoRegistros();
    const abrir = useCallback((siguiente) => setSpec(siguiente), []);
    const cerrar = useCallback(() => setSpec(null), []);
    const panel = spec ? (
        <VerRegistros titulo={spec.titulo} subtitulo={spec.subtitulo} icono={spec.icono} acciones={spec.acciones}
            modo={modo} onModo={setModo} onClose={cerrar}>
            {spec.contenido}
        </VerRegistros>
    ) : null;
    return { abrir, cerrar, abierto: spec !== null, panel };
}
