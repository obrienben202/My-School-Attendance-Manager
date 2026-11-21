import { readFileSync } from "node:fs";
import { join } from "node:path";
import { project } from "./build.mjs";

// A deliberately small emulator of only this project's trusted HTML scriptlets.
export function renderFixtureHtml(serviceUrl) {
  const html = readFileSync(join(project, "src/Index.html"), "utf8")
    .replace(/<\?!=\s*include_\(['"](Styles|Client)['"]\)\s*;?\s*\?>/g, (_, name) => readFileSync(join(project, `src/${name}.html`), "utf8"))
    .replace(/<\?!=\s*JSON\.stringify\(serviceUrl\)\s*;?\s*\?>/g, JSON.stringify(serviceUrl));
  if (html.includes("<?")) throw new Error("An Apps Script template expression was not rendered in the synthetic fixture.");
  return html;
}
