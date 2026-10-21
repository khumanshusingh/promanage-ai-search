import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('tailwindcss').Config} */
export default {
  content: [path.join(here, 'index.html'), path.join(here, 'src/**/*.{ts,tsx}')],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        teal: { DEFAULT: 'var(--brand-teal)', ink: 'var(--teal-ink)', soft: 'var(--teal-soft)' },
        brand: { DEFAULT: 'var(--brand-blue)', hover: 'var(--brand-blue-hover)', soft: 'var(--blue-soft)', line: 'var(--blue-line)' },
        ink: 'var(--ink)',
        body: 'var(--body)',
        muted: 'var(--muted)',
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        line: 'var(--border)',
        subtle: 'var(--subtle)',
        success: { DEFAULT: 'var(--success)', soft: 'var(--success-soft)' },
        warning: { DEFAULT: 'var(--warning)', soft: 'var(--warning-soft)' },
        danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)' },
      },
      borderRadius: { xl: '12px', lg: '10px', md: '8px' },
      boxShadow: {
        card: '0 1px 2px rgba(22,36,58,0.04), 0 1px 1px rgba(22,36,58,0.02)',
        pop: '0 8px 24px -6px rgba(22,36,58,0.16), 0 2px 6px rgba(22,36,58,0.06)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'slide-in-right': { from: { transform: 'translateX(16px)', opacity: 0 }, to: { transform: 'translateX(0)', opacity: 1 } },
        'pop-in': { from: { transform: 'scale(.98)', opacity: 0 }, to: { transform: 'scale(1)', opacity: 1 } },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'slide-in-right': 'slide-in-right 200ms ease-out',
        'pop-in': 'pop-in 180ms ease-out',
      },
    },
  },
  plugins: [],
}
