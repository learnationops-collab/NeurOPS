// Los filtros guardados, arriba de la lista (ADR-W184): tocar uno lo aplica (también su orden); la × lo borra.
import { Star, X } from 'lucide-react';
import { Chip } from '../../../components/standard';
import { filtrar } from './colas';
import { igual } from './filtros';
import { useGuardados } from './guardados';

export default function ChipsGuardados({ lista, filtro, onCambiar, ahora }) {
    const guardados = useGuardados();
    if (!guardados.lista.length) return null;
    return (
        <div className="cv-chips-guardados" aria-label="Mis filtros">
            {guardados.lista.map((g) => (
                <Chip key={g.id} as="button" type="button" subtle aria-pressed={igual(g.filtro, filtro)}
                    color={igual(g.filtro, filtro) ? 'var(--brand-secondary)' : undefined} icon={<Star />}
                    onClick={() => onCambiar({ ...g.filtro })}>
                    {g.label}<span className="cv-cuenta">{filtrar(lista, { ...g.filtro, ahora }).length}</span>
                    <span role="button" tabIndex={0} className="cv-chip-x" aria-label={`Borrar «${g.label}»`}
                        onClick={(e) => { e.stopPropagation(); guardados.borrar(g.id); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); guardados.borrar(g.id); } }}><X size={11} /></span>
                </Chip>
            ))}
        </div>
    );
}
