import { defineConfig } from "i18next-cli";

export default defineConfig({
  locales: ["id", "en"],
  extract: {
    input: ["src/components/front/**/*.{ts,tsx,js,jsx}", "src/components/customer/**/*.{ts,tsx,js,jsx}"],
    output: "src/i18n/locales/{{language}}/{{namespace}}.json",
    useTranslationNames: [
      {
        name: "useTranslations",
        nsArg: 0,
      },
    ],
    functions: ["i18next.t"],
    defaultNS: "common",
    primaryLanguage: "id",
    secondaryLanguages: ["en"],
    defaultValue: (key, namespace, language, value) => {
      if (language !== "en") {
        return "";
      }

      return typeof value === "string" ? value : "";
    },
  },
  lint: {
    ignore: [
      "src/**/*.test.*",
      "src/**/*.spec.*",
      "src/components/admin/**",
      "src/pages/admin/**",
    ],
  },
});
