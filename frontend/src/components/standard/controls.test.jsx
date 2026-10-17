import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Avatar, Modal, Segmented, Select, Stepper, Switch, initials } from './index';

const OPS = [{ value: '', label: 'Todos' }, { value: 'a', label: 'Diagnóstico' }, { value: 'b', label: 'Workshop' }];

function SelectControlado(props) {
    const [v, setV] = useState('');
    return <Select value={v} onChange={setV} options={OPS} label="Evento" {...props} />;
}

describe('Select', () => {
    it('se abre con la flecha, salta escribiendo y elige con Enter', async () => {
        const u = userEvent.setup();
        render(<SelectControlado />);
        const btn = screen.getByRole('button', { name: 'Evento' });
        btn.focus();
        await u.keyboard('{ArrowDown}');
        expect(screen.getByRole('listbox')).toBeTruthy();
        await u.keyboard('w{Enter}');
        expect(screen.queryByRole('listbox')).toBeNull();
        expect(btn.textContent).toContain('Workshop');
        expect(document.activeElement).toBe(btn);
    });

    it('la opción vacía se marca como vacía y Escape cierra sin elegir', async () => {
        const u = userEvent.setup();
        render(<SelectControlado />);
        const btn = screen.getByRole('button', { name: 'Evento' });
        expect(btn.querySelector('.ui-select__value--empty')).toBeTruthy();
        await u.click(btn);
        await u.keyboard('{Escape}');
        expect(screen.queryByRole('listbox')).toBeNull();
        expect(btn.textContent).toContain('Todos');
    });

    it('data-nav del botón llega a las opciones (siguen activas en solo lectura)', async () => {
        render(<SelectControlado data-nav="" />);
        await userEvent.click(screen.getByRole('button', { name: 'Evento' }));
        screen.getAllByRole('option').forEach(o => expect(o.hasAttribute('data-nav')).toBe(true));
    });
});

describe('Segmented, Switch y Stepper', () => {
    it('Segmented marca la opción elegida y pasa itemProps a cada botón', async () => {
        const onChange = vi.fn();
        render(<Segmented value="a" onChange={onChange} label="Vista" itemProps={{ 'data-nav': '' }}
            options={[{ value: 'a', label: 'Semana' }, { value: 'b', label: 'Día' }]} />);
        expect(screen.getByRole('button', { name: 'Semana' }).getAttribute('aria-pressed')).toBe('true');
        expect(screen.getByRole('button', { name: 'Día' }).hasAttribute('data-nav')).toBe(true);
        await userEvent.click(screen.getByRole('button', { name: 'Día' }));
        expect(onChange).toHaveBeenCalledWith('b');
    });

    it('Segmented muestra la cuenta de cada opción y se apila en vertical', () => {
        render(<Segmented value="a" onChange={vi.fn()} label="Colas" orientation="vertical"
            options={[{ value: 'a', label: 'Esperan', count: 13 }, { value: 'b', label: 'Todas', count: 0 }]} />);
        const grupo = screen.getByRole('group', { name: 'Colas' });
        expect(grupo.classList.contains('ui-seg--vertical')).toBe(true);
        expect(grupo.getAttribute('aria-orientation')).toBe('vertical');
        expect(screen.getByRole('button', { name: 'Esperan 13' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Todas 0' })).toBeTruthy();
    });

    it('Switch alterna', async () => {
        const onChange = vi.fn();
        render(<Switch checked={false} onChange={onChange} label="Obligatoria" />);
        await userEvent.click(screen.getByRole('switch', { name: 'Obligatoria' }));
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('Stepper respeta los límites y muestra el texto propio', () => {
        render(<Stepper value={5} min={1} max={5} onChange={() => {}} display="30 min" label="Duración" />);
        expect(screen.getByRole('button', { name: 'Más' }).disabled).toBe(true);
        expect(screen.getByRole('button', { name: 'Menos' }).disabled).toBe(false);
        expect(screen.getByRole('group', { name: 'Duración' }).textContent).toContain('30 min');
    });
});

describe('Modal y Avatar', () => {
    it('Modal enfoca el primer campo, cierra con Escape y libera el scroll', async () => {
        const onClose = vi.fn();
        const { unmount } = render(<Modal onClose={onClose}><input aria-label="Nombre" /></Modal>);
        expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Nombre' }));
        expect(document.body.style.overflow).toBe('hidden');
        await userEvent.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledOnce();
        unmount();
        expect(document.body.style.overflow).toBe('');
    });

    it('Avatar muestra iniciales o la foto', () => {
        expect(initials('Ana María Pérez')).toBe('AM');
        const { container, rerender } = render(<Avatar name="Ana Pérez" color="red" size="sm" />);
        expect(container.firstChild.textContent).toBe('AP');
        expect(container.firstChild.className).toBe('ui-avatar ui-avatar--sm');
        rerender(<Avatar name="Ana Pérez" photo="x.jpg" />);
        expect(container.querySelector('img').getAttribute('src')).toBe('x.jpg');
    });
});
