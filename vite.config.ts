import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import icons from "unplugin-icons/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      adapter: adapter(),
      paths: { base: (process.env.BASE_PATH ?? "") as `/${string}` | "" },
    }),
    icons({ compiler: "svelte" }),
  ],
  worker: { format: "es" },
});
