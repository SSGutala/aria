import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        chai: {
          bg: "#0a0a0a",
          surface: "#0d0d0d",
          panel: "#111111",
          border: "#1e1e1e",
          "border-subtle": "#2a2a2a",
          text: "#e5e5e5",
          muted: "#737373",
          subtle: "#a3a3a3",
          pink: "#f43f7e",
          "pink-soft": "#fb7185",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
