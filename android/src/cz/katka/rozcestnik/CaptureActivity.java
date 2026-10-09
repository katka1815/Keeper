package cz.katka.rozcestnik;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.text.TextUtils;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Okýnko „Uložit do Rozcestníku". Otevře se ze sdílení v jiné appce (odkaz, text, obrázky),
 * z widgetu a ze zkratky u ikonky. Všechno posílá do Ke zpracování přes /api/capture.
 */
public class CaptureActivity extends Activity {
    private static final Pattern URL = Pattern.compile("https?://\\S+");
    private String sharedText = "", subject = "";
    private final ArrayList<Uri> images = new ArrayList<>();
    private EditText note;
    private TextView msg;
    private Button save;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Api.base(this).isEmpty()) {
            Toast.makeText(this, R.string.cap_nobase, Toast.LENGTH_LONG).show();
            startActivity(new Intent(this, MainActivity.class));
            finish();
            return;
        }
        readIntent(getIntent());
        build();
    }

    private void readIntent(Intent i) {
        String action = i.getAction();
        if (Intent.ACTION_SEND.equals(action)) {
            CharSequence t = i.getCharSequenceExtra(Intent.EXTRA_TEXT);
            if (t != null) sharedText = t.toString().trim();
            Uri u = i.getParcelableExtra(Intent.EXTRA_STREAM);
            if (u != null) images.add(u);
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            ArrayList<Uri> list = i.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (list != null) for (Uri u : list) if (u != null) images.add(u);
        }
        String s = i.getStringExtra(Intent.EXTRA_SUBJECT);
        if (s != null) subject = s.trim();
    }

    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }

    private void build() {
        boolean quick = sharedText.isEmpty() && images.isEmpty();
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(20), dp(20), dp(20), dp(12));

        TextView title = new TextView(this);
        title.setText(R.string.cap_title);
        title.setTextColor(0xff252525);
        title.setTextSize(16);
        box.addView(title);

        if (!quick) {
            TextView what = new TextView(this);
            what.setTextColor(0xff666666);
            what.setTextSize(13);
            what.setMaxLines(4);
            what.setEllipsize(TextUtils.TruncateAt.END);
            what.setPadding(0, dp(8), 0, dp(8));
            String line = images.size() > 1 ? getString(R.string.cap_images, images.size())
                    : !subject.isEmpty() && !sharedText.isEmpty() ? subject + "\n" + sharedText
                    : !sharedText.isEmpty() ? sharedText : subject;
            if (!line.isEmpty()) { what.setText(line); box.addView(what); }
            if (images.size() == 1) {
                Bitmap thumb = load(images.get(0), 480);
                if (thumb != null) {
                    ImageView iv = new ImageView(this);
                    iv.setImageBitmap(thumb);
                    iv.setAdjustViewBounds(true);
                    iv.setMaxHeight(dp(160));
                    iv.setPadding(0, dp(8), 0, dp(8));
                    box.addView(iv);
                }
            }
        }

        note = new EditText(this);
        note.setHint(quick ? R.string.cap_quick : R.string.cap_note);
        note.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        note.setMinLines(quick ? 2 : 1);
        note.setMaxLines(6);
        note.setTextSize(15);
        box.addView(note);

        msg = new TextView(this);
        msg.setTextColor(0xff7a2e2e);
        msg.setTextSize(13);
        box.addView(msg);

        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.END);
        Button cancel = new Button(this, null, android.R.attr.borderlessButtonStyle);
        cancel.setText(R.string.cap_cancel);
        cancel.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { finish(); } });
        row.addView(cancel);
        save = new Button(this, null, android.R.attr.borderlessButtonStyle);
        save.setText(R.string.cap_save);
        save.setTextColor(0xff252525);
        save.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { send(); } });
        row.addView(save);
        box.addView(row);

        setContentView(box);
        note.requestFocus();
    }

    private void send() {
        final String typed = note.getText().toString().trim();
        if (typed.isEmpty() && sharedText.isEmpty() && images.isEmpty()) { msg.setText(R.string.cap_empty); return; }
        save.setEnabled(false);
        msg.setTextColor(0xff666666);
        msg.setText(R.string.cap_working);
        new Thread(new Runnable() {
            public void run() {
                String err = null;
                try {
                    if (images.isEmpty()) err = Api.capture(CaptureActivity.this, textPayload(sharedText.isEmpty() ? typed : sharedText, subject, sharedText.isEmpty() ? "" : typed));
                    else for (Uri u : images) {
                        String data = encode(u);
                        if (data == null) { err = getString(R.string.cap_noimg); break; }
                        JSONObject p = new JSONObject().put("image", data).put("text", subject);
                        Matcher m = URL.matcher(sharedText);
                        if (m.find()) p.put("url", m.group());
                        String n = join(m.reset().replaceAll("").trim(), typed);
                        if (!n.isEmpty()) p.put("note", n);
                        err = Api.capture(CaptureActivity.this, p);
                        if (err != null) break;
                    }
                } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                final String problem = err;
                runOnUiThread(new Runnable() {
                    public void run() {
                        if (problem == null) {
                            Api.setDirty(CaptureActivity.this, true);
                            Toast.makeText(CaptureActivity.this, R.string.cap_saved, Toast.LENGTH_SHORT).show();
                            finish();
                        } else {
                            msg.setTextColor(0xff7a2e2e);
                            msg.setText(problem);
                            save.setEnabled(true);
                        }
                    }
                });
            }
        }).start();
    }

    private static String join(String a, String b) {
        return a.isEmpty() ? b : b.isEmpty() ? a : a + "\n" + b;
    }

    /**
     * Text ze sdílení → položka. Prohlížeče posílají adresu v textu a název v předmětu; jiné appky
     * „nějaký text https://adresa". S adresou je to odkaz, bez ní poznámka.
     */
    static JSONObject textPayload(String text, String subject, String note) throws Exception {
        JSONObject p = new JSONObject();
        Matcher m = URL.matcher(text);
        if (m.find()) {
            String url = m.group(), rest = (text.substring(0, m.start()) + " " + text.substring(m.end())).trim();
            String title = !subject.isEmpty() ? subject : rest;
            if (!subject.isEmpty() && !rest.isEmpty() && !rest.equals(subject)) note = join(rest, note);
            p.put("type", "link").put("url", url).put("text", title);
        } else {
            p.put("type", "point").put("text", text);
            if (!subject.isEmpty() && !subject.equals(text)) note = join(subject, note);
        }
        if (!note.isEmpty()) p.put("note", note);
        return p;
    }

    /** Načte obrázek zmenšený tak, aby delší strana měla nejvýš max bodů, a srovná ho podle EXIFu. */
    private Bitmap load(Uri u, int max) {
        try {
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            try (InputStream in = getContentResolver().openInputStream(u)) { BitmapFactory.decodeStream(in, null, o); }
            int big = Math.max(o.outWidth, o.outHeight);
            if (big <= 0) return null;
            o = new BitmapFactory.Options();
            o.inSampleSize = 1;
            while (big / (o.inSampleSize * 2) >= max) o.inSampleSize *= 2;
            Bitmap bmp;
            try (InputStream in = getContentResolver().openInputStream(u)) { bmp = BitmapFactory.decodeStream(in, null, o); }
            if (bmp == null) return null;
            int turn = 0;
            try (InputStream in = getContentResolver().openInputStream(u)) {
                int or = new ExifInterface(in).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
                turn = or == ExifInterface.ORIENTATION_ROTATE_90 ? 90 : or == ExifInterface.ORIENTATION_ROTATE_180 ? 180
                        : or == ExifInterface.ORIENTATION_ROTATE_270 ? 270 : 0;
            } catch (Exception e) { /* bez EXIFu se neotáčí */ }
            float k = Math.min(1f, (float) max / Math.max(bmp.getWidth(), bmp.getHeight()));
            if (k < 1f || turn != 0) {
                Matrix mx = new Matrix();
                mx.postScale(k, k);
                mx.postRotate(turn);
                bmp = Bitmap.createBitmap(bmp, 0, 0, bmp.getWidth(), bmp.getHeight(), mx, true);
            }
            return bmp;
        } catch (Exception e) {
            return null;
        }
    }

    /** Obrázek → data URL v JPEG, cíl do ~300 kB (stejně jako shrink v rozšíření do prohlížeče). */
    private String encode(Uri u) {
        Bitmap bmp = load(u, 1600);
        if (bmp == null) return null;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (int q : new int[]{82, 70, 55, 40}) {
            out.reset();
            bmp.compress(Bitmap.CompressFormat.JPEG, q, out);
            if (out.size() < 300 * 1024) break;
        }
        return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }
}
