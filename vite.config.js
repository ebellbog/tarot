import { defineConfig } from "vite";

// Relative base so the build works from any subpath (e.g. GitHub Pages
// project sites at /<repo>/). The dev server is unaffected: it still
// serves from the root.
export default defineConfig({
  base: "./",
});
