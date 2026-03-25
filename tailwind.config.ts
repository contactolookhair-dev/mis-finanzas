import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--brand-background) / <alpha-value>)",
        foreground: "rgb(var(--brand-foreground) / <alpha-value>)",
        card: "rgb(var(--brand-card) / <alpha-value>)",
        border: "rgb(var(--brand-border) / <alpha-value>)",
        muted: "rgb(var(--brand-muted) / <alpha-value>)",
        primary: "rgb(var(--brand-primary) / <alpha-value>)",
        secondary: "rgb(var(--brand-secondary) / <alpha-value>)",
        accent: "rgb(var(--brand-accent) / <alpha-value>)",
        success: "rgb(var(--brand-success) / <alpha-value>)",
        warning: "rgb(var(--brand-warning) / <alpha-value>)",
        danger: "rgb(var(--brand-danger) / <alpha-value>)"
      },
      fontFamily: {
        sans: ["SF Pro Display", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        card: "0 18px 42px rgba(15, 23, 42, 0.08)",
        soft: "0 8px 20px rgba(23, 23, 23, 0.08)"
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(circle at top left, rgb(var(--brand-primary) / 0.12), transparent 34%), radial-gradient(circle at top right, rgb(var(--brand-secondary) / 0.1), transparent 28%), radial-gradient(circle at bottom right, rgb(var(--brand-accent) / 0.08), transparent 26%), linear-gradient(180deg, rgb(249 250 255) 0%, rgb(244 247 252) 100%)"
      }
    }
  },
  plugins: []
};

export default config;
