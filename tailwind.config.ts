import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 50: "#f7f7f8", 100: "#eeeef0", 200: "#d9d9de", 300: "#b8b8c1", 400: "#8e8e9a", 500: "#6b6b78", 600: "#55555f", 700: "#45454d", 800: "#3b3b42", 900: "#121214", 950: "#0a0a0b" },
        accent: { DEFAULT: "#5b5bd6", soft: "#eef0ff", hover: "#4a4ac4" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Inter", "sans-serif"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
