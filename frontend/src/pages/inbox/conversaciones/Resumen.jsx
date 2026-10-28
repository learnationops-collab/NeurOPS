// Los filtros puestos, en palabras («Esperan respuesta · Asignadas a Elias · En etapa Agendó»), cada uno
// con su × para sacarlo. Va arriba de la lista y en el panel del filtro.
import { X } from 'lucide-react';
import { Chip } from '../../../components/standard';
import { COLAS, ETAPAS, asignados, claveEtiqueta, etiquetasDe } from './colas';
import { resumen } from './filtros';

export default function Resumen({ lista, filtro, onCambiar, yo }) {
    const setters = asignados(lista);
    const etiquetas = etiquetasDe(lista);
    const nombre = (id) => (id === yo ? 'vos' : setters.find((s) => s.id === id)?.username || 'otro setter');
    const etiqueta = (k) => {
        const e = etiquetas.find((x) => claveEtiqueta(x) === k);
        return e ? (e.group ? `${e.group}: ${e.name}` : e.name) : k.split(':').slice(1).join(':');
    };
    const partes = resumen(filtro, { colas: COLAS, etapas: ETAPAS, nombre, etiqueta });
    if (!partes.length) return null;
    return (
        <div className="cv-resumen" aria-label="Filtros puestos">
            {partes.map((p) => (
                <Chip key={p.texto} subtle as="button" color="var(--brand-secondary)" aria-label={`Sacar «${p.texto}»`}
                    onClick={() => onCambiar({ ...filtro, ...p.quitar })}>
                    {p.texto}<X size={12} />
                </Chip>
            ))}
        </div>
    );
}
