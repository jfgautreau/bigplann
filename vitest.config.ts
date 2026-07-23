import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Sans cette configuration, Vitest ne resout pas l'alias `@/` de tsconfig.json :
// seuls les modules « feuilles » (week, rotation, habilitations…) etaient
// testables, et tout le socle — permissions en tete — restait hors de portee.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
