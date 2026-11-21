import http from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { project } from "./build.mjs";
import { createHarness } from "../tests/harness.mjs";
import { renderFixtureHtml } from "./render-fixture.mjs";

// Local synthetic browser wiring only; never shipped in the Google deployment.
const h = createHarness(), port = Number(process.env.GOOGLE_PREVIEW_PORT || 8766);
const bridge = `<script>
window.google={script:{run:(function(){
  function runner(ok,bad){return {withSuccessHandler:function(fn){return runner(fn,bad)},withFailureHandler:function(fn){return runner(ok,fn)},portalRpc:function(request){fetch('/__synthetic_rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)}).then(function(r){return r.json()}).then(ok).catch(bad)}}}
  return runner(function(){},function(){});
})()}};
</script>`;
const server = http.createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "POST" && req.url === "/__synthetic_rpc") {
    let body = ""; for await (const chunk of req) { body += chunk; if (body.length > 2900000) { res.writeHead(413); res.end(); return; } }
    try { const request = JSON.parse(body); res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(h.context.portalRpc(request))); }
    catch { res.writeHead(400); res.end("{}"); }
    return;
  }
  if (req.url?.startsWith("/?view=help")) { res.setHeader("Content-Type", "text/html"); res.end(readFileSync(join(project, "src/Help.html"))); return; }
  if (req.url !== "/" && !req.url?.startsWith("/?")) { res.writeHead(404); res.end(); return; }
  const html = renderFixtureHtml(`http://127.0.0.1:${port}/`)
    .replace("</head>", bridge + "</head>")
    .replace("<body>", '<body><div style="background:#fff0c5;color:#503900;padding:8px;text-align:center;font:13px system-ui">Synthetic offline fixture — not a Google deployment or school data.</div>');
  res.setHeader("Content-Type", "text/html"); res.end(html);
});
server.listen(port, "127.0.0.1", () => console.log(`Synthetic browser fixture http://127.0.0.1:${port}/ (no Google/network/database access)`));
