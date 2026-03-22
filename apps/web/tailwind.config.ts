import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        glass: {
          bg: "rgba(255, 255, 255, 0.08)",
          border: "rgba(255, 255, 255, 0.15)",
          hover: "rgba(255, 255, 255, 0.2)",
        },
        flask: {
          orange: "#ff8a00",
          bg: "rgba(255, 138, 0, 0.15)",
          border: "rgba(255, 138, 0, 0.3)",
        },
        pact: {
          purple: "#7c3aed",
          blue: "#3b82f6",
          teal: "#14b8a6",
        },
      },
      backdropBlur: {
        glass: "20px",
      },
      animation: {
        "gradient-shift": "gradientShift 12s ease infinite",
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
      },
      keyframes: {
        gradientShift: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
