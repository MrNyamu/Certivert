/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream:            '#F5F0E8',
        'cream-soft':     '#EDE8DF',
        'cream-border':   '#D8D1C4',
        linen:            '#FAF7F2',
        ink:              '#1A1A18',
        'ink-soft':       '#2E2E2A',
        muted:            '#7A7468',
        faint:            '#B8B2A8',
        coral:            '#C85C3C',
        'coral-soft':     '#F2E4DC',
        verified:         '#1A6B47',
        'verified-bg':    '#EBF5EE',
        'verified-deep':  '#0E3D29',
        revoked:          '#8B1A1A',
        'revoked-bg':     '#F5EBEB',
        amber:            '#8B6914',
        'amber-bg':       '#F5F0E0',
      },
      fontFamily: {
        serif: ['"Libre Baskerville"', 'Georgia', 'serif'],
        sans:  ['"DM Sans"', 'sans-serif'],
        mono:  ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '3px',
        sm:      '2px',
        md:      '3px',
        lg:      '4px',
      },
      borderWidth: {
        DEFAULT: '0.5px',
      },
    },
  },
  plugins: [],
}