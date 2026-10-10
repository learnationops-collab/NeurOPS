// Pestaña Apariencia de Configuración, como en academy: el tema, con su vista previa pintada con sus
// propios colores en el modo elegido, y debajo el modo, claro u oscuro.

import { useApariencia } from '../context/AparienciaContext';

export default function TabApariencia() {
    const { tema, setTema, temas, modos, setModo, modoGuardado, modo } = useApariencia();
    const modoVista = modo ?? modoGuardado ?? 'oscuro';
    return (
        <section className="panel cu-tarjeta">
            <p className="t-eyebrow">Tema</p>
            <div className="ap-temas" role="radiogroup" aria-label="Tema">
                {temas.map(t => (
                    <button key={t.id} type="button" role="radio" aria-label={t.nombre} aria-checked={tema === t.id}
                        data-tema={t.id} data-tema-modo={modoVista} className="ap-tema" onClick={() => setTema(t.id)}>
                        <span className="ap-muestra" aria-hidden="true">
                            <span className="ap-muestra-linea ap-muestra-linea--corta" />
                            <span className="ap-muestra-fila"><span className="ap-muestra-tarjeta" /><span className="ap-muestra-btn" /></span>
                            <span className="ap-muestra-linea" />
                        </span>
                        <span className="ap-nombre">{t.nombre}</span>
                        <span className="ap-modo">{t.descripcion}</span>
                    </button>
                ))}
            </div>
            <p className="t-eyebrow">Modo</p>
            <div className="apariencia ap-modos" role="radiogroup" aria-label="Modo">
                {modos.map(m => (
                    <button key={m.id} type="button" role="radio" aria-checked={modo === m.id} onClick={() => setModo(m.id)}>
                        {m.nombre}
                    </button>
                ))}
            </div>
        </section>
    );
}
