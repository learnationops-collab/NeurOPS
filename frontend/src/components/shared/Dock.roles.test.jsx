import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 3, role: 'operator', roles: ['operator', 'closer', 'admin', 'hiring'], email: 'mario@thelearnation.com' },
        logout: vi.fn(),
    }),
}));
vi.mock('../../hooks/useDockNavigation', () => ({
    default: () => ({ pages: [], activePageIndex: 0, sections: [], activeSectionIndex: 0, onPageChange: vi.fn(), onSectionChange: vi.fn() }),
}));
vi.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }) }));
vi.mock('../../contexts/PlaybookContext', () => ({ usePlaybook: () => ({ pendingCount: 0, openPlaybook: vi.fn() }) }));
vi.mock('../../services/api', () => ({ default: { post: vi.fn() } }));

import Dock from './Dock';

describe('Dock: cambio de rol', () => {
    it('ofrece pasar a cada uno de los otros roles de la cuenta', () => {
        render(<Dock />);

        expect(screen.getByText('Pasar a Closer')).toBeInTheDocument();
        expect(screen.getByText('Pasar a Administrador')).toBeInTheDocument();
        expect(screen.getByText('Pasar a Hiring')).toBeInTheDocument();
        expect(screen.queryByText('Pasar a Operador')).not.toBeInTheDocument();
    });
});
