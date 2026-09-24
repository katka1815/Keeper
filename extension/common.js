// Společné pro pozadí, okýnko i nastavení.
const B = globalThis.browser || globalThis.chrome;
const t = (k) => B.i18n.getMessage(k) || k;

async function getBase() {
  const { base } = await B.storage.local.get("base");
  return base || "";
}

// Adresa appky → čistý origin (https://neco.workers.dev), nebo "" když to adresa není.
function normBase(s) {
  s = (s || "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try { return new URL(s).origin; } catch (e) { return ""; }
}

// Pošle položku do Ke zpracování. Shodí výjimku s textem pro uživatele.
async function send(payload) {
  const base = await getBase();
  if (!base) throw new Error(t("errNoBase"));
  let r;
  try {
    r = await fetch(base + "/api/capture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  } catch (e) { throw new Error(t("errNetwork")); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(t("errServer") + " (" + (j.error || r.status) + ")");
  return j;
}

// Zmenší obrázek a převede ho do WebP (JPEG tam, kde WebP kódovat nejde). Cíl do ~300 kB.
async function shrink(src, max = 1600) {
  const blob = src instanceof Blob ? src : await (await fetch(src)).blob();
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = new OffscreenCanvas(w, h);
  c.getContext("2d").drawImage(bmp, 0, 0, w, h);
  let out;
  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    out = await c.convertToBlob({ type: "image/webp", quality: q });
    if (out.type !== "image/webp") out = await c.convertToBlob({ type: "image/jpeg", quality: q });
    if (out.size < 300 * 1024) break;
  }
  return await new Promise((ok, bad) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = bad; fr.readAsDataURL(out); });
}

// Vyfotí viditelnou část aktivní záložky.
async function captureTab(windowId) {
  const raw = await B.tabs.captureVisibleTab(windowId, { format: "png" });
  return shrink(raw);
}
