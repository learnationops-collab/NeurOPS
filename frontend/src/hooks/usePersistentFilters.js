import { useState, useEffect } from 'react';

/**
 * Hook to manage filter state and persist it to localStorage
 * @param {string} storageKey - Unique key for localStorage (e.g., 'filters_closer_agendas')
 * @param {object} initialFilters - Default filter values
 */
const usePersistentFilters = (storageKey, initialFilters) => {
    const [filters, setFilters] = useState(() => {
        try {
            const stored = localStorage.getItem(storageKey);
            return stored ? JSON.parse(stored) : initialFilters;
        } catch (e) {
            console.error("Error reading filters from storage", e);
            return initialFilters;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(filters));
        } catch (e) {
            console.error("Error saving filters to storage", e);
        }
    }, [filters, storageKey]);

    const updateFilter = (arg1, arg2) => {
        setFilters(prev => {
            if (typeof arg1 === 'string') {
                return { ...prev, [arg1]: arg2 };
            }
            if (typeof arg1 === 'function') {
                const updated = arg1(prev);
                return { ...prev, ...updated };
            }
            return { ...prev, ...arg1 };
        });
    };


    const resetFilters = () => setFilters(initialFilters);

    return { filters, updateFilter, resetFilters };
};

export default usePersistentFilters;
