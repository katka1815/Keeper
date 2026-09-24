const $ = (id) => document.getElementById(id);
document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });

let tab = null, image = null;

function setImage(d) {
  image = d;
  $("shot").style.display = d ? "block" : "none";
  $("shotImg").src = d || "";
}
function say(text, err) { $("msg").textContent = text || ""; $("msg").className = "msg" + (err ? " err" : ""); }

(async () => {
  if (!(await getBase())) { $("setup").style.display = "block"; $("form").style.display = "none"; return; }
  [tab] = await B.tabs.query({ active: true, currentWindow: true });
  $("title").value = tab.title || "";
  $("url").textContent = tab.url || "";
  $("note").focus();
})();

$("openOpts").onclick = () => { B.runtime.openOptionsPage(); window.close(); };

$("snap").onclick = async () => {
  say(t("working"));
  try { setImage(await captureTab(tab.windowId)); say(""); } catch (e) { say(String(e.message || e), true); }
};
$("shotDel").onclick = () => setImage(null);

// Ctrl+V s obrázkem ve schránce (třeba po Win+Shift+S) ho přiloží.
document.addEventListener("paste", async (e) => {
  const item = [...(e.clipboardData ? e.clipboardData.items : [])].find((i) => i.type.startsWith("image/"));
  if (!item) return;
  e.preventDefault();
  say(t("working"));
  try { setImage(await shrink(item.getAsFile())); say(""); } catch (err) { say(String(err.message || err), true); }
});

async function save() {
  const text = $("title").value.trim(), note = $("note").value.trim(), url = tab ? tab.url : "";
  $("save").disabled = true; say(t("working"));
  try {
    await send(image ? { image, text, url, note } : { type: "link", text, url, note });
    say(t("saved"));
    setTimeout(() => window.close(), 700);
  } catch (e) { say(String(e.message || e), true); $("save").disabled = false; }
}
$("save").onclick = save;
// Enter v názvu nebo Ctrl+Enter kdekoli uloží.
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey || e.target.id === "title")) { e.preventDefault(); save(); }
});
