import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, username: 'ana', role: 'closer' } }) }));
const playbook = vi.hoisted(() => ({ openPlaybook: vi.fn(), pendingCount: 2 }));
vi.mock('../../contexts/PlaybookContext', () => ({ usePlaybook: () => playbook }));

import CortexPage from './CortexPage';

describe('Cortex', () => {
    beforeEach(() => vi.clearAllMocks());

    it('tiene el Playbook (con lo pendiente) y Learnito, que llega pronto', () => {
        render(<MemoryRouter><CortexPage /></MemoryRouter>);
        expect(screen.getByRole('heading', { name: 'Cortex' })).toBeTruthy();
        const pb = screen.getByRole('button', { name: /Formación/ });
        expect(pb.textContent).toContain('2 videos pendientes');
        fireEvent.click(pb);
        expect(playbook.openPlaybook).toHaveBeenCalledWith('pending');
        expect(screen.getByRole('button', { name: /Learnito/ }).disabled).toBe(true);
    });
});
