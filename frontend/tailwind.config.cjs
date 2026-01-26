/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: 'var(--color-primary)',
                'primary-hover': 'var(--color-primary-hover)',
                secondary: 'var(--color-secondary)',
                'secondary-hover': 'var(--color-secondary-hover)',
                accent: 'var(--color-accent)',
                surface: 'var(--color-surface)',
                'surface-hover': 'var(--color-surface-hover)',
            },
            backgroundColor: {
                main: 'var(--color-bg)',
                glass: 'var(--glass-bg)',
            },
            textColor: {
                base: 'var(--color-text-base)',
                muted: 'var(--color-text-muted)',
            },
            borderRadius: {
                main: 'var(--radius-main)',
                round: 'var(--radius-round)',
                btn: 'var(--radius-button)',
            },
            fontFamily: {
                main: 'var(--font-main)',
            },
            borderColor: {
                base: 'var(--color-border)',
                'base-hover': 'var(--color-border-hover)',
                glass: 'var(--glass-border)',
            },
            backdropBlur: {
                glass: 'var(--glass-blur)',
            }
        },
    },
    plugins: [],
}
