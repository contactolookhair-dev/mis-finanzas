import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#f6f7fb",
        foreground: "#0f172a",
        card: "#ffffff",
        border: "#e2e8f0",
        muted: "#f1f5f9",
        primary: "#7c3aed",
        secondary: "#ec4899",
        accent: "#10b981",
        success: "#059669",
        warning: "#d97706",
        danger: "#dc2626"
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
          "radial-gradient(circle at top left, rgba(124,58,237,0.12), transparent 34%), radial-gradient(circle at top right, rgba(236,72,153,0.12), transparent 28%), linear-gradient(180deg, #f8faff 0%, #f4f6fb 100%)"
      }
    }
  },
  plugins: []
};

export default config;
