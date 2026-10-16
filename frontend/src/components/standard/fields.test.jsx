import { act, createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FieldError, Input, InputGroup, ModalHeader, Segmented, TextArea, Toaster, toast } from './index';

describe('Input', () => {
    it('variante, estado de error, ref y textarea', () => {
        const ref = createRef();
        const { rerender } = render(<Input ref={ref} variant="number" invalid aria-label="Duración" />);
        expect(ref.current.className).toBe('ui-input ui-input--number is-invalid');
        rerender(<Input as="textarea" aria-label="Texto" />);
        expect(screen.getByRole('textbox', { name: 'Texto' }).tagName).toBe('TEXTAREA');
    });
});

describe('InputGroup', () => {
    it('dibuja el prefijo adelante y, como formulario, envía con Enter', async () => {
        const onSubmit = vi.fn(e => e.preventDefault());
        render(
            <InputGroup as="form" prefix="/agenda/" invalid onSubmit={onSubmit}>
                <input aria-label="Link" />
            </InputGroup>,
        );
        const campo = screen.getByRole('textbox', { name: 'Link' });
        const grupo = campo.parentElement;
        expect(grupo.className).toBe('ui-entry is-invalid');
        expect(grupo.firstChild.textContent).toBe('/agenda/');
        await userEvent.type(campo, 'workshop{Enter}');
        expect(onSubmit).toHaveBeenCalledOnce();
    });
});

describe('FieldError', () => {
    it('se anuncia como alerta, o como nota y sin ícono', () => {
        const { rerender, container } = render(<FieldError>Escribí un nombre.</FieldError>);
        expect(screen.getByRole('alert').textContent).toBe('Escribí un nombre.');
        expect(container.querySelector('svg')).toBeTruthy();
        rerender(<FieldError role="note" icon={false}>Nunca se cumple.</FieldError>);
        expect(screen.getByRole('note')).toBeTruthy();
        expect(container.querySelector('svg')).toBeNull();
    });
});

describe('Segmented: prefix, radio y props por opción', () => {
    it('radio anuncia el grupo como radio y cada opción con aria-checked', () => {
        render(<Segmented radio label="Cómo reparte" value="a" onChange={() => {}} prefix={<span>Agrupar</span>}
            options={[{ value: 'a', label: 'Llenar' }, { value: 'b', label: 'Repartir', props: { title: 'Parejo' } }]} />);
        expect(screen.getByRole('radiogroup', { name: 'Cómo reparte' }).firstChild.textContent).toBe('Agrupar');
        expect(screen.getByRole('radio', { name: 'Llenar' }).getAttribute('aria-checked')).toBe('true');
        expect(screen.getByRole('radio', { name: 'Repartir' }).getAttribute('title')).toBe('Parejo');
    });
});

describe('TextArea, ModalHeader y Toaster', () => {
    it('TextArea con estilo de campo o sin él (bare)', () => {
        const { rerender } = render(<TextArea aria-label="Pregunta" value="Hola" onChange={() => {}} />);
        expect(screen.getByRole('textbox', { name: 'Pregunta' }).className).toBe('ui-textarea');
        rerender(<TextArea bare className="rv-input" aria-label="Pregunta" value="Hola" onChange={() => {}} />);
        expect(screen.getByRole('textbox', { name: 'Pregunta' }).className).toBe('rv-input');
    });

    it('ModalHeader: el título nombra al modal y cerrar llama a onClose', async () => {
        const onClose = vi.fn();
        render(<ModalHeader title="Importar preguntas" titleId="t" size="lg" onClose={onClose} closeProps={{ 'data-nav': '' }} />);
        expect(screen.getByRole('heading', { name: 'Importar preguntas' }).id).toBe('t');
        const cerrar = screen.getByRole('button', { name: 'Cerrar' });
        expect(cerrar.hasAttribute('data-nav')).toBe(true);
        await userEvent.click(cerrar);
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('toast muestra el aviso con su acción, y la acción lo cierra', async () => {
        const deshacer = vi.fn();
        render(<Toaster />);
        act(() => toast('Evento eliminado', 'success', { label: 'Deshacer', onClick: deshacer }));
        expect(screen.getByRole('status').textContent).toContain('Evento eliminado');
        await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
        expect(deshacer).toHaveBeenCalledOnce();
        expect(screen.queryByRole('status')).toBeNull();
    });
});

