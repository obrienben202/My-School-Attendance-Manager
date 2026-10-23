(function () {
  var btn = document.getElementById("menu-btn"), nav = document.getElementById("guide-nav");
  if (btn && nav) btn.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.querySelectorAll("[data-print]").forEach(function (b) { b.addEventListener("click", function () { window.print(); }); });
  var q = document.getElementById("q");
  if (!q) return;
  var items = [].slice.call(document.querySelectorAll("[data-item]"));
  var groups = [].slice.call(document.querySelectorAll("[data-group]"));
  var none = document.getElementById("no-results"), status = document.getElementById("q-status");
  function run() {
    var words = q.value.toLowerCase().split(/\s+/).filter(Boolean), shown = 0;
    items.forEach(function (li) {
      var hay = li.getAttribute("data-search");
      var ok = words.every(function (w) { return hay.indexOf(w) !== -1; });
      li.hidden = !ok; if (ok) shown++;
    });
    groups.forEach(function (g) { g.hidden = !g.querySelector("[data-item]:not([hidden])"); });
    none.hidden = shown !== 0;
    status.textContent = words.length ? shown + (shown === 1 ? " topic found" : " topics found") : "";
  }
  function reset() { q.value = ""; run(); q.focus(); }
  q.addEventListener("input", run);
  document.getElementById("q-reset").addEventListener("click", reset);
  document.getElementById("q-reset2").addEventListener("click", reset);
})();
