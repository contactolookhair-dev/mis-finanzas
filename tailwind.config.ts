import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#f3efe7",
        foreground: "#171717",
        card: "#fffdf8",
        border: "#d9d0c3",
        muted: "#f3ece0",
        primary: "#0f3d3e",
        secondary: "#d8c3a5",
        accent: "#e7f2ef",
        success: "#0f766e",
        warning: "#b45309",
        danger: "#b42318"
      },
      fontFamily: {
        sans: ["SF Pro Display", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        card: "0 18px 42px rgba(15, 61, 62, 0.08)",
        soft: "0 8px 20px rgba(23, 23, 23, 0.08)"
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(circle at top left, rgba(231,242,239,0.95), transparent 36%), radial-gradient(circle at top right, rgba(216,195,165,0.45), transparent 28%), linear-gradient(180deg, #f8f4ec 0%, #efe8dd 100%)"
      }
    }
  },
  plugins: []
};

export default config;
