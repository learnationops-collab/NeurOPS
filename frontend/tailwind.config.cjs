/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: 'var(--color-primary)',
                    foreground: 'var(--primary-foreground)',
                },
                'primary-hover': 'var(--color-primary-hover)',
                secondary: {
                    DEFAULT: 'var(--color-secondary)',
                    foreground: 'var(--secondary-foreground)',
                },
                'secondary-hover': 'var(--color-secondary-hover)',
                accent: 'var(--color-accent)',
                surface: 'var(--color-surface)',
                'surface-hover': 'var(--color-surface-hover)',
                /* --- shadcn/rare-ui semantic tokens ---
                   Bridged onto the existing theme vars above (not new brand colors) so
                   components from the rare-ui registry inherit the app's live theme/dark
                   mode automatically. See src/index.css for the --background/--card/etc
                   definitions. */
                background: 'var(--background)',
                foreground: 'var(--foreground)',
                card: {
                    DEFAULT: 'var(--card)',
                    foreground: 'var(--card-foreground)',
                },
                popover: {
                    DEFAULT: 'var(--popover)',
                    foreground: 'var(--popover-foreground)',
                },
                muted: {
                    DEFAULT: 'var(--muted)',
                    foreground: 'var(--muted-foreground)',
                },
                destructive: {
                    DEFAULT: 'var(--destructive)',
                    foreground: 'var(--destructive-foreground)',
                },
                border: 'var(--color-border)',
                input: 'var(--color-border)',
                ring: 'var(--color-primary)',
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
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },
            fontFamily: {
                main: 'var(--font-body)',
                header: 'var(--font-header)',
            },
            borderColor: {
                base: 'var(--color-border)',
                'base-hover': 'var(--color-border-hover)',
                glass: 'var(--glass-border)',
            },
            backdropBlur: {
                glass: 'var(--glass-blur)',
            },
            boxShadow: {
                'glass': '0 4px 30px rgba(0, 0, 0, 0.5)',
                'glow': '0 0 20px rgba(157, 78, 221, 0.5)', /* Purple glow */
            },
            backgroundImage: {
                'gradient-primary': 'linear-gradient(to right, #a855f7, #d946ef)',
                'gradient-glow': 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)',
            },
            keyframes: {
                'accordion-down': {
                    from: { height: '0' },
                    to: { height: 'var(--radix-accordion-content-height)' },
                },
                'accordion-up': {
                    from: { height: 'var(--radix-accordion-content-height)' },
                    to: { height: '0' },
                },
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
            },
        },
    },
    plugins: [],
}
