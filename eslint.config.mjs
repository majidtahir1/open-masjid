import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // The flat-config migration enforces these stricter than the prior
      // `next lint` defaults. Match prior project enforcement to keep this
      // upgrade scoped — clean these up in a follow-up if desired.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
    },
  },
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/out/**",
      "**/build/**",
      "**/.claude/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
