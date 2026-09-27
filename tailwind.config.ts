import type { Config } from "tailwindcss";

const config: Config = {
  // dark: 使用 class 策略，支持手动切换暗色模式
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 主色：靛蓝（专注学习风）
        primary: {
          50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc",
          400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca",
          800: "#3730a3", 900: "#312e81",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto",
          "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
