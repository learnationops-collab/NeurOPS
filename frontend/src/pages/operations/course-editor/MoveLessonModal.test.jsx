import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MoveLessonModal from './MoveLessonModal';

const MODULOS = [
    { moduleId: 1, moduleName: 'Reporte de closers', areaName: 'Skills' },
    { moduleId: 2, moduleName: 'Objeciones', areaName: 'Skills' },
];

describe('MoveLessonModal', () => {
    it('sale por portal a body dentro de un .ce-shell (su CSS le sigue aplicando) y Escape lo cierra', async () => {
        const onClose = vi.fn();
        const { container } = render(
            <div className="ce-shell">
                <MoveLessonModal lesson={{ id: 9, title: 'Cómo confirmar', module_id: 1 }}
                    flatModules={MODULOS} onClose={onClose} onConfirm={vi.fn()} />
            </div>,
        );
        const dialogo = screen.getByRole('dialog', { name: 'Cómo confirmar' });
        expect(container).not.toContainElement(dialogo);
        expect(dialogo.closest('.ce-shell.ce-shell--portal').parentElement).toBe(document.body);
        expect(dialogo).toContainElement(screen.getByRole('button', { name: /Mover lección/ }));

        await userEvent.setup().keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
