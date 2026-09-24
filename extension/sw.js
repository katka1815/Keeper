// Chrome spouští pozadí jako service worker a bere jen jeden soubor.
// Firefox tenhle soubor ignoruje a načte common.js + background.js přímo (viz manifest).
importScripts("common.js", "background.js");
