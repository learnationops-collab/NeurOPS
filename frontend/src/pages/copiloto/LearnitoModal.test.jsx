import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LearnitoProvider } from '../../sesion/LearnitoContext';
import LearnitoModal from './LearnitoModal';

vi.mock('../../services/api', () => ({ default: { post: vi.fn(), get: vi.fn(() => new Promise(() => {})) } }));
const apariencia = vi.hoisted(() => ({ valor: { tema: 'classic', modo: 'claro', modoGuardado: 'claro' } }));
vi.mock('../../context/AparienciaContext', () => ({ useApariencia: () => apariencia.valor }));

const renderModal = () => render(<LearnitoProvider><LearnitoModal onClose={() => {}} /></LearnitoProvider>);

describe('LearnitoModal', () => {
    it('se ve siempre con Learnation Modern, en el modo que eligió cada uno', () => {
        renderModal();

        const capa = screen.getByRole('dialog', { name: 'Learnito' }).closest('.learnito-capa');
        expect(capa.dataset.tema).toBe('modern');
        expect(capa.dataset.temaModo).toBe('claro');
        expect(capa.dataset.theme).toBe('light');
    });

    it('sin tema elegido, Modern oscuro', () => {
        apariencia.valor = { tema: null, modo: null, modoGuardado: 'oscuro' };
        renderModal();

        const capa = screen.getByRole('dialog', { name: 'Learnito' }).closest('.learnito-capa');
        expect(capa.dataset.temaModo).toBe('oscuro');
        expect(capa.dataset.theme).toBe('dark');
    });
});
