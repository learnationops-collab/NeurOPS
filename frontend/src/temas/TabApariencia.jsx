// Pestaña Apariencia de Configuración: la lista de temas, cada uno con su vista previa pintada con sus
// propios colores (el `data-tema` de cada tarjeta), y el que está puesto marcado.

import { useApariencia } from '../context/AparienciaContext';

export default function TabApariencia() {
    const { tema, setTema, temas } = useApariencia();
    return (
        <section className="panel cu-tarjeta">
            <p className="t-eyebrow">Tema</p>
            <div className="ap-temas" role="radiogroup" aria-label="Tema">
                {temas.map(t => (
                    <button key={t.id} type="button" role="radio" aria-label={`${t.nombre} ${t.modo}`} aria-checked={tema === t.id} data-tema={t.id} className="ap-tema"
                        onClick={() => setTema(t.id)}>
                        <span className="ap-muestra" aria-hidden="true">
                            <span className="ap-muestra-linea ap-muestra-linea--corta" />
                            <span className="ap-muestra-fila"><span className="ap-muestra-tarjeta" /><span className="ap-muestra-btn" /></span>
                            <span className="ap-muestra-linea" />
                        </span>
                        <span className="ap-nombre">{t.nombre}<span className="ap-modo">{t.modo === 'claro' ? 'Claro' : 'Oscuro'}</span></span>
                    </button>
                ))}
            </div>
        </section>
    );
}
