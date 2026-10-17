import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CabeceraWorkshop, { EnCabecera } from './CabeceraWorkshop';

const PESTANAS = [{ key: 'resumen', label: 'Resumen' }, { key: 'trafico', label: 'Tráfico landings' }];

const montar = (props = {}, contenido = null) => render(
    <CabeceraWorkshop pestanas={PESTANAS} activa="resumen" onPestana={vi.fn()} eventos={[]}
        onIrAProximos={vi.fn()} recargando={false} onRecargar={vi.fn()} onRegistrar={vi.fn()} {...props}>
        <main>{contenido}</main>
    </CabeceraWorkshop>,
);

describe('Workshop › cabecera en una línea', () => {
    it('los filtros que manda la pestaña van a la línea de la cabecera, no al contenido', async () => {
        montar({}, <EnCabecera><button type="button">Todos los talleres</button></EnCabecera>);
        const filtro = await screen.findByRole('button', { name: 'Todos los talleres' });
        expect(filtro.closest('.ws-cab-filtros')).not.toBeNull();
        expect(filtro.closest('main')).toBeNull();
    });

    it('pestañas, recargar y registrar están en la cabecera y responden', async () => {
        const onPestana = vi.fn();
        const onRecargar = vi.fn();
        const onRegistrar = vi.fn();
        montar({ onPestana, onRecargar, onRegistrar });
        await userEvent.click(screen.getByRole('tab', { name: 'Tráfico landings' }));
        await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
        await userEvent.click(screen.getByRole('button', { name: 'Registrar taller' }));
        expect(onPestana).toHaveBeenCalledWith('trafico');
        expect(onRecargar).toHaveBeenCalled();
        expect(onRegistrar).toHaveBeenCalled();
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Workshop');
    });

    it('sin talleres todavía la cuenta regresiva es un esqueleto; sin onRecargar no hay recargar', () => {
        montar({ eventos: null, onRecargar: null });
        expect(screen.queryByRole('button', { name: /Sin taller programado/ })).toBeNull();
        expect(document.querySelector('.ws-cab-id .ui-skel-bone')).not.toBeNull();
        expect(screen.queryByRole('button', { name: 'Volver a cargar' })).toBeNull();
    });

    it('fuera de la cabecera (tests, otra pantalla) EnCabecera deja sus hijos en el lugar', () => {
        render(<div data-testid="aca"><EnCabecera><span>Período</span></EnCabecera></div>);
        expect(screen.getByTestId('aca')).toHaveTextContent('Período');
    });
});
