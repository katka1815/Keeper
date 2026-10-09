package cz.katka.rozcestnik;

import android.content.Context;
import android.net.Uri;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Adresa Rozcestníku a posílání do Ke zpracování. Jiná adresa se z appky nikdy nevolá. */
final class Api {
    private static final String PREFS = "rozcestnik";

    static String base(Context c) {
        return c.getSharedPreferences(PREFS, 0).getString("base", "");
    }

    static void setBase(Context c, String base) {
        c.getSharedPreferences(PREFS, 0).edit().putString("base", base).apply();
    }

    /** Po uložení z okýnka si hlavní okno při návratu načte čerstvá data. */
    static void setDirty(Context c, boolean dirty) {
        c.getSharedPreferences(PREFS, 0).edit().putBoolean("dirty", dirty).apply();
    }

    static boolean dirty(Context c) {
        return c.getSharedPreferences(PREFS, 0).getBoolean("dirty", false);
    }

    /** Adresa appky → čistý origin (https://neco.workers.dev), nebo "" když to adresa není. */
    static String normBase(String s) {
        s = s == null ? "" : s.trim();
        if (s.isEmpty()) return "";
        if (!s.matches("(?i)^https?://.*")) s = "https://" + s;
        Uri u = Uri.parse(s);
        String host = u.getHost();
        if (host == null || host.indexOf('.') < 1 || host.contains(" ")) return "";
        // Jen https: nešifrované spojení má appka zakázané v manifestu.
        return "https://" + host.toLowerCase() + (u.getPort() > 0 ? ":" + u.getPort() : "");
    }

    /** Pošle položku do Ke zpracování. Vrátí null, když se to povedlo, jinak text chyby pro uživatele. */
    static String capture(Context c, JSONObject payload) {
        HttpURLConnection h = null;
        try {
            h = (HttpURLConnection) new URL(base(c) + "/api/capture").openConnection();
            h.setConnectTimeout(15000);
            h.setReadTimeout(30000);
            h.setRequestMethod("POST");
            h.setDoOutput(true);
            h.setRequestProperty("content-type", "application/json");
            byte[] body = payload.toString().getBytes("UTF-8");
            h.setFixedLengthStreamingMode(body.length);
            try (OutputStream o = h.getOutputStream()) { o.write(body); }
            int code = h.getResponseCode();
            InputStream in = code < 400 ? h.getInputStream() : h.getErrorStream();
            String text = in == null ? "" : read(in);
            JSONObject j;
            try { j = new JSONObject(text); } catch (Exception e) { j = new JSONObject(); }
            if (code < 400 && j.optBoolean("ok")) return null;
            return c.getString(R.string.err_server) + " (" + j.optString("error", String.valueOf(code)) + ")";
        } catch (Exception e) {
            return c.getString(R.string.err_network);
        } finally {
            if (h != null) h.disconnect();
        }
    }

    private static String read(InputStream in) throws Exception {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        for (int n; (n = in.read(buf)) > 0; ) b.write(buf, 0, n);
        in.close();
        return b.toString("UTF-8");
    }
}
