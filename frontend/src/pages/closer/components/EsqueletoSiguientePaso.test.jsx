import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import EsqueletoSiguientePaso from './EsqueletoSiguientePaso';

/**
 * "Tu siguiente paso" en hueso reemplaza, durante la primera carga, al "todo el día resuelto" que
 * salía de los contadores en cero. Tiene que anunciarse como carga y conservar lo que no depende
 * del servidor —el rótulo—, con el botón grande al pie como la tarjeta de verdad. jsdom no hace
 * layout: las medidas (212 px, igual que la tarjeta con lead) salen de index.css.
 */
describe('EsqueletoSiguientePaso', () => {
    it('se anuncia como carga, y lo de adentro es decorativo', () => {
        render(<EsqueletoSiguientePaso />);
        const estado = screen.getByRole('status', { name: 'Cargando tu siguiente paso…' });
        expect(estado.getAttribute('aria-busy')).toBe('true');
        expect(estado.classList.contains('tsp-v6')).toBe(true);
        expect(estado.querySelector('.tsp-top-v6').getAttribute('aria-hidden')).toBe('true');
    });

    it('no dice que no queda nada: el rótulo va escrito y el resto en hueso', () => {
        const { container } = render(<EsqueletoSiguientePaso />);
        expect(container.querySelector('.tsp-lbl-v6').textContent).toBe('Tu siguiente paso');
        expect(container.textContent).not.toMatch(/resuelto/);
        const huesos = [...container.querySelectorAll('.hueso')];
        expect(huesos.at(-1).style.height).toBe('54px');
        expect(huesos.at(-1).style.marginTop).toBe('auto');
    });
});
