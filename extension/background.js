// Pravé tlačítko myši, klávesová zkratka a odezva na ikonce.

B.runtime.onInstalled.addListener(async () => {
  await B.contextMenus.removeAll();
  const add = (id, contexts) => B.contextMenus.create({ id, title: t("menu_" + id), contexts });
  add("page", ["page"]);
  add("shot", ["page"]);
  add("selection", ["selection"]);
  add("link", ["link"]);
  add("image", ["image"]);
  if (!(await getBase())) B.runtime.openOptionsPage();
});

// ✓ nebo ! na ikonce na dvě vteřiny; chyba jde přečíst v titulku ikonky.
function flash(ok, msg) {
  B.action.setBadgeBackgroundColor({ color: ok ? "#252525" : "#7a2e2e" });
  B.action.setBadgeText({ text: ok ? "✓" : "!" });
  B.action.setTitle({ title: ok ? t("saved") : msg });
  setTimeout(() => { B.action.setBadgeText({ text: "" }); B.action.setTitle({ title: t("saveTitle") }); }, ok ? 2000 : 6000);
}

async function run(fn) {
  try { await fn(); flash(true); } catch (e) { flash(false, String(e.message || e)); }
}

const savePage = (tab) => send({ type: "link", text: tab.title || "", url: tab.url });

// Obrázek zkusí stáhnout a uložit jako obrázek; když to web nedovolí, uloží aspoň odkaz na něj.
async function saveImage(info, tab) {
  try {
    const r = await fetch(info.srcUrl);
    if (!r.ok) throw 0;
    const image = await shrink(await r.blob());
    await send({ image, text: tab.title || "", url: tab.url });
  } catch (e) {
    await send({ type: "link", text: t("imageFrom") + " " + (tab.title || ""), url: info.srcUrl, src: tab.url });
  }
}

B.contextMenus.onClicked.addListener((info, tab) => run(async () => {
  if (info.menuItemId === "page") return savePage(tab);
  if (info.menuItemId === "shot") return send({ image: await captureTab(tab.windowId), text: tab.title || "", url: tab.url });
  if (info.menuItemId === "selection") return send({ type: "point", text: info.selectionText, src: tab.url, note: tab.title || "" });
  if (info.menuItemId === "link") return send({ type: "link", text: info.linkText || "", url: info.linkUrl, src: tab.url });
  if (info.menuItemId === "image") return saveImage(info, tab);
}));

B.commands.onCommand.addListener((cmd) => {
  if (cmd !== "save-page") return;
  run(async () => { const [tab] = await B.tabs.query({ active: true, currentWindow: true }); await savePage(tab); });
});
