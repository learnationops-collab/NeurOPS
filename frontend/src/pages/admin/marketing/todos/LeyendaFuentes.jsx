import { Tip } from '../../../comercial/components/Shared';
import { SETTING, WORKSHOP } from './comparacion';

/** Quién es quién en Todos: Setting rosa, Workshop azul (los mismos colores de las cifras), con «de qué habla» en su tooltip. */
const LeyendaFuentes = () => (
    <div className="td-leyenda" aria-label="Quién es quién">
        <span><i style={{ background: SETTING.color }} />{SETTING.label}</span>
        <span><i style={{ background: WORKSHOP.color }} />{WORKSHOP.label}</span>
        <Tip titulo="De qué habla" texto="Anuncios de Meta de Setting y Workshop. No es por taller." />
    </div>
);

export default LeyendaFuentes;
