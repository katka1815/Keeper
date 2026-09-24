const $ = (id) => document.getElementById(id);
document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
function say(text, err) { $("msg").textContent = text || ""; $("msg").className = "msg" + (err ? " err" : ""); }

getBase().then((b) => { $("base").value = b; });

$("save").onclick = () => {
  const base = normBase($("base").value);
  if (!base) return say(t("optBad"), true);
  // Oprávnění se musí vyžádat hned v obsluze kliknutí, před prvním await, jinak ho prohlížeč odmítne.
  B.permissions.request({ origins: [base + "/*"] }).then(async (granted) => {
    if (!granted) return say(t("optDenied"), true);
    await B.storage.local.set({ base });
    $("base").value = base;
    say(t("working"));
    try {
      const r = await fetch(base + "/api/fx");
      if (r.status === 404) throw 0;
      say(t("optOk"));
    } catch (e) { say(t("optUnreachable"), true); }
  });
};
