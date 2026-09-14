import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        card: { DEFAULT: "hsl(var(--card) / <alpha-value>)", foreground: "hsl(var(--card-foreground) / <alpha-value>)" },
        popover: { DEFAULT: "hsl(var(--popover) / <alpha-value>)", foreground: "hsl(var(--popover-foreground) / <alpha-value>)" },
        primary: { DEFAULT: "hsl(var(--primary) / <alpha-value>)", foreground: "hsl(var(--primary-foreground) / <alpha-value>)" },
        secondary: { DEFAULT: "hsl(var(--secondary) / <alpha-value>)", foreground: "hsl(var(--secondary-foreground) / <alpha-value>)" },
        muted: { DEFAULT: "hsl(var(--muted) / <alpha-value>)", foreground: "hsl(var(--muted-foreground) / <alpha-value>)" },
        destructive: { DEFAULT: "hsl(var(--destructive) / <alpha-value>)", foreground: "hsl(var(--destructive-foreground) / <alpha-value>)" },
        sidebar: { "DEFAULT": "hsl(var(--sidebar-background) / <alpha-value>)", "foreground": "hsl(var(--sidebar-foreground) / <alpha-value>)", "primary": "hsl(var(--sidebar-primary) / <alpha-value>)", "primary-foreground": "hsl(var(--sidebar-primary-foreground) / <alpha-value>)", "accent": "hsl(var(--sidebar-accent) / <alpha-value>)", "accent-foreground": "hsl(var(--sidebar-accent-foreground) / <alpha-value>)", "border": "hsl(var(--sidebar-border) / <alpha-value>)", "ring": "hsl(var(--sidebar-ring) / <alpha-value>)" },
        ink: { 50: "#f7f7f8", 100: "#eeeef0", 200: "#d9d9de", 300: "#b8b8c1", 400: "#8e8e9a", 500: "#6b6b78", 600: "#55555f", 700: "#45454d", 800: "#3b3b42", 900: "#121214", 950: "#0a0a0b" },
        accent: { DEFAULT: "hsl(var(--accent) / <alpha-value>)", foreground: "hsl(var(--accent-foreground) / <alpha-value>)", soft: "#eef0ff", hover: "#4a4ac4" },
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
