import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
vi.mock('react-router-dom', async (original) => ({ ...(await original()), useNavigate: () => vi.fn() }));

import TablaAnuncios from './TablaAnuncios';

const fila = (extra) => ({
    clave: 'A', nombre: 'A', archivado: false, meta: { anuncios: 2, activos: 1, nombres: [] },
    entrantes: 100, calificados: 60, descalificados: 10, en_conversacion: 20, sin_respuesta: 10,
    pct_calificados: 60, gasto: 200, cpl: 2, cpl_calificado: 3.33, agendas: 10, costo_agenda: 20, ventas: 2,
    costo_venta: 100, cobrado: 800, roas: 4, dias: {}, campana: 'C1', conjunto: 'J1', agrupacion: 'meta',
    gasto_por_grupo: [['C1', 'J1', 200]], ...extra,
});

const DATOS = {
    desde: '2026-10-01', hasta: '2026-10-23', moneda: 'USD',
    filas: [
        fila({ clave: 'ACTIVA', nombre: 'ACTIVA' }),
        fila({ clave: 'PAUSADA', nombre: 'PAUSADA', meta: { anuncios: 1, activos: 0, nombres: [] }, campana: 'C2',
            gasto_por_grupo: [['C2', 'J1', 200]] }),
        fila({ clave: 'SINGASTO', nombre: 'SINGASTO', gasto: 0, cpl: null, cpl_calificado: null, costo_agenda: null,
            costo_venta: null, roas: null, gasto_por_grupo: [], meta: { anuncios: 1, activos: 1, nombres: [] } }),
    ],
    totales: {}, sin_atribuir: {}, agrupaciones: [],
    meta: { conectado: true, ultima_sincronizacion: '2026-10-23T11:00:00' },
};

const abrir = (props = {}) => render(
    <MemoryRouter>
        <TablaAnuncios datos={DATOS} onArchivar={vi.fn()} onAgrupar={vi.fn()} irAMeta={vi.fn()} {...props} />
    </MemoryRouter>,
);
const nombres = () => ['ACTIVA', 'PAUSADA', 'SINGASTO'].filter((n) => screen.queryByText(n, { selector: '.mk-nombre-kw' }));

describe('TablaAnuncios › usabilidad (23/10/2026)', () => {
    beforeEach(() => window.localStorage.clear());

    it('«Solo con gasto» esconde las que no gastaron y «Solo activas» las que no tienen anuncios activos', async () => {
        const user = userEvent.setup();
        abrir();
        expect(nombres()).toEqual(['ACTIVA', 'PAUSADA', 'SINGASTO']);
        await user.click(screen.getByRole('button', { name: 'Solo con gasto' }));
        expect(nombres()).toEqual(['ACTIVA', 'PAUSADA']);
        await user.click(screen.getByRole('button', { name: 'Solo activas' }));
        expect(nombres()).toEqual(['ACTIVA']);
        await user.click(screen.getByRole('button', { name: 'Solo con gasto' }));
        expect(nombres()).toEqual(['ACTIVA', 'SINGASTO']);
    });

    it('los filtros también valen en Campañas: solo quedan las campañas con anuncios activos', async () => {
        const user = userEvent.setup();
        abrir();
        await user.click(screen.getByRole('tab', { name: /Campañas/ }));
        expect(screen.getByText('C2', { selector: '.mk-nombre-kw' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Solo activas' }));
        expect(screen.queryByText('C2', { selector: '.mk-nombre-kw' })).not.toBeInTheDocument();
        expect(screen.getByText('C1', { selector: '.mk-nombre-kw' })).toBeInTheDocument();
    });

    it('la pantalla completa cubre la ventana, se sale con el botón y con Escape', async () => {
        const user = userEvent.setup();
        abrir();
        const panel = document.querySelector('.mk-panel-tabla');
        expect(panel).not.toHaveClass('mk-pantalla');
        await user.click(screen.getByRole('button', { name: 'Pantalla completa' }));
        expect(panel).toHaveClass('mk-pantalla');
        expect(screen.getByTestId('caja-tabla')).toHaveClass('mk-tabla-caja--completa');
        await user.click(screen.getByRole('button', { name: 'Salir' }));
        expect(panel).not.toHaveClass('mk-pantalla');
        await user.click(screen.getByRole('button', { name: 'Pantalla completa' }));
        await user.keyboard('{Escape}');
        expect(panel).not.toHaveClass('mk-pantalla');
    });

    it('la tabla tiene la barra de desplazamiento de arriba y el encabezado y el nombre están en la caja fija', () => {
        abrir();
        expect(screen.getByTestId('scroll-arriba')).toBeInTheDocument();
        const caja = screen.getByTestId('caja-tabla');
        expect(caja).toHaveClass('mk-tabla-caja--alta');
        expect(within(caja).getByRole('columnheader', { name: /^Palabra clave/ })).toHaveClass('mk-col-nombre');
    });

    it('la barra de arriba y la de abajo se siguen', () => {
        abrir();
        const arriba = screen.getByTestId('scroll-arriba');
        const caja = screen.getByTestId('caja-tabla');
        caja.scrollLeft = 120;
        caja.dispatchEvent(new Event('scroll'));
        expect(arriba.scrollLeft).toBe(120);
        arriba.scrollLeft = 40;
        arriba.dispatchEvent(new Event('scroll'));
        expect(caja.scrollLeft).toBe(40);
    });

    it('el estado de Meta se ve con su hora y el botón lo actualiza', async () => {
        const actualizar = vi.fn();
        abrir({ estadoMeta: { activo: true, actualizando: false, fallo: null, actualizar } });
        expect(screen.getByRole('status')).toHaveTextContent(/Estado de Meta:/);
        await userEvent.click(screen.getByRole('button', { name: 'Actualizar el estado desde Meta' }));
        expect(actualizar).toHaveBeenCalledWith({ forzar: true });
    });

    it('el panel de columnas ordena, aplica «Embudo y costos», guarda vistas y las borra', async () => {
        const user = userEvent.setup();
        abrir();
        await user.click(screen.getByRole('button', { name: /^Columnas/ }));
        const cabeceras = () => within(screen.getByTestId('caja-tabla')).getAllByRole('columnheader').map((h) => h.textContent);

        await user.click(screen.getByRole('menuitemradio', { name: 'Embudo y costos' }));
        expect(cabeceras().join('|')).toMatch(/Calificados.*\|.*En conversación.*\|.*Sin respuesta.*\|.*Importe gastado/);
        expect(cabeceras().join('|')).not.toMatch(/Leads entrantes/);
        expect(cabeceras().join('|')).toMatch(/% de calificación/);

        await user.click(screen.getByRole('button', { name: 'Subir ROAS' }));
        expect(cabeceras().join('|')).toMatch(/ROAS.*[|].*Cobrado/);

        await user.type(screen.getByRole('textbox', { name: 'Nombre de la vista a guardar' }), 'Mi vista');
        await user.click(screen.getByRole('button', { name: 'Guardar' }));
        expect(screen.getByRole('menuitemradio', { name: 'Mi vista' })).toHaveAttribute('aria-checked', 'true');
        expect(JSON.parse(window.localStorage.getItem('mk_rendimiento_columnas')).vistas[0].nombre).toBe('Mi vista');

        await user.click(screen.getByRole('menuitemradio', { name: 'Todas' }));
        expect(cabeceras().join('|')).toMatch(/Leads entrantes/);
        await user.click(screen.getByRole('menuitemradio', { name: 'Mi vista' }));
        expect(cabeceras().join('|')).toMatch(/ROAS.*[|].*Cobrado/);

        await user.click(screen.getByRole('button', { name: 'Borrar la vista Mi vista' }));
        expect(screen.queryByRole('menuitemradio', { name: 'Mi vista' })).not.toBeInTheDocument();
    });
});
