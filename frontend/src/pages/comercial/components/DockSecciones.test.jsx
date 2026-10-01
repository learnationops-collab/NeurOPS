import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BarChart3, ClipboardList, Layers } from 'lucide-react';
import DockSecciones from './DockSecciones';

/**
 * El dock lo comparten el dashboard comercial, el espacio del setter y el mazo del closer. Las
 * insignias son lo que cambia entre ellos: el "✓" del reporte, la cuenta "hecho/total" de las
 * pestañas del closer y el punto del día de ayer sin reportar. Lo que se ve va oculto al lector de
 * pantalla, así que lo que importa es que también se lea en el nombre del botón.
 */
const renderDock = (secciones, onElegir = () => {}) => render(
    <DockSecciones secciones={secciones} activa="a" onElegir={onElegir} ariaLabel="Secciones" />,
);

describe('DockSecciones', () => {
    it('una marca suelta sigue siendo el ✓ de siempre', () => {
        renderDock([{ id: 'a', label: 'Reporte', Icono: ClipboardList, marca: { texto: '✓', titulo: 'reporte de hoy enviado' } }]);
        const boton = screen.getByRole('button', { name: 'Reporte, reporte de hoy enviado' });
        const marca = boton.querySelector('.dock-marca');
        expect(marca.textContent).toBe('✓');
        expect(marca.className).toBe('dock-marca');
        expect(marca.getAttribute('aria-hidden')).toBe('true');
    });

    it('la cuenta va en pastilla, apagada cuando no queda nada, y se lee en el nombre', () => {
        renderDock([
            { id: 'a', label: 'Confirmar', Icono: Layers, marca: { tipo: 'cuenta', texto: '2/5', titulo: '2 de 5 confirmadas' } },
            { id: 'b', label: 'Reportar', Icono: Layers, marca: { tipo: 'cuenta', texto: '3/3', titulo: '3 de 3 reportadas', apagada: true } },
        ]);
        const confirmar = screen.getByRole('button', { name: 'Confirmar, 2 de 5 confirmadas' });
        expect(confirmar.querySelector('.dock-marca').className).toBe('dock-marca dock-marca--cuenta');
        const reportar = screen.getByRole('button', { name: 'Reportar, 3 de 3 reportadas' });
        expect(reportar.querySelector('.dock-marca').className).toBe('dock-marca dock-marca--cuenta dock-marca--apagada');
    });

    it('con varias marcas se ven todas y se leen todas', () => {
        renderDock([{
            id: 'a', label: 'Cerrar el día', Icono: ClipboardList, marcas: [
                { tipo: 'aviso', texto: '', titulo: 'ayer quedó sin reportar' },
                { texto: '✓', titulo: 'reporte de hoy enviado' },
            ],
        }]);
        const boton = screen.getByRole('button', { name: 'Cerrar el día, ayer quedó sin reportar, reporte de hoy enviado' });
        const marcas = [...boton.querySelectorAll('.dock-marca')];
        expect(marcas.map(m => m.className)).toEqual(['dock-marca dock-marca--aviso', 'dock-marca']);
    });

    it('sin marcas el nombre es la sección, y elegir avisa cuál', () => {
        const onElegir = vi.fn();
        renderDock([
            { id: 'a', label: 'Mis datos', Icono: BarChart3 },
            { id: 'b', label: 'Mi cartera', Icono: BarChart3 },
        ], onElegir);
        expect(screen.getByRole('button', { name: 'Mis datos' }).getAttribute('aria-current')).toBe('page');
        fireEvent.click(screen.getByRole('button', { name: 'Mi cartera' }));
        expect(onElegir).toHaveBeenCalledWith('b');
    });
});
