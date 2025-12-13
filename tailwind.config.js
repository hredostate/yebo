export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: { 50:"#F3F5FA",100:"#E6EBF4",500:"#1E3A8A",600:"#172B6E",700:"#0D1F5A" },
        blue: { 500:"#3B82F6", 600:"#2563EB", 700:"#1D4ED8" }
      },
      // Touch-friendly spacing scale
      spacing: {
        '18': '4.5rem',   // 72px - good for large touch targets
        '22': '5.5rem',   // 88px
      },
      // Minimum touch target sizes (iOS/Android guidelines: 44x44px minimum)
      minHeight: {
        'touch': '44px',
        'touch-lg': '48px',
      },
      minWidth: {
        'touch': '44px',
        'touch-lg': '48px',
      },
      // Safe area insets for notched devices
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
    },
  },
  plugins: [],
}