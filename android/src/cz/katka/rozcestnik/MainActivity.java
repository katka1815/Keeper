package cz.katka.rozcestnik;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Rozcestník v okně appky. Odkazy ven se otevírají v prohlížeči, uvnitř zůstává jen Rozcestník. */
public class MainActivity extends Activity {
    private static final String SETUP = "cz.katka.rozcestnik.SETUP";
    private static final int PICK = 7;
    private WebView web;
    private ValueCallback<Uri[]> picking;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        if (SETUP.equals(getIntent().getAction()) || Api.base(this).isEmpty()) showSetup(null);
        else showWeb();
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        if (SETUP.equals(i.getAction())) showSetup(null);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null && Api.dirty(this)) { Api.setDirty(this, false); web.reload(); }
    }

    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }

    /** Obrazovka s adresou: při prvním spuštění, ze zkratky „Adresa appky" a když se stránka nenačte. */
    private void showSetup(String problem) {
        web = null;
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER_VERTICAL);
        box.setBackgroundColor(Color.WHITE);
        box.setPadding(dp(24), dp(24), dp(24), dp(24));

        TextView title = new TextView(this);
        title.setText(R.string.setup_title);
        title.setTextColor(0xff252525);
        title.setTextSize(18);
        box.addView(title);

        TextView hint = new TextView(this);
        hint.setText(R.string.setup_hint);
        hint.setTextColor(0xff666666);
        hint.setTextSize(14);
        hint.setPadding(0, dp(8), 0, dp(16));
        box.addView(hint);

        final EditText field = new EditText(this);
        field.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        field.setImeOptions(EditorInfo.IME_ACTION_GO);
        field.setSingleLine(true);
        field.setHint("https://");
        field.setText(Api.base(this));
        box.addView(field);

        final TextView msg = new TextView(this);
        msg.setTextColor(0xff7a2e2e);
        msg.setTextSize(14);
        msg.setPadding(0, dp(8), 0, dp(8));
        if (problem != null) msg.setText(problem);
        box.addView(msg);

        Button go = new Button(this);
        go.setText(R.string.setup_go);
        box.addView(go);

        final Runnable save = new Runnable() {
            public void run() {
                String base = Api.normBase(field.getText().toString());
                if (base.isEmpty()) { msg.setText(R.string.setup_bad); return; }
                Api.setBase(MainActivity.this, base);
                showWeb();
            }
        };
        go.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { save.run(); } });
        field.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            public boolean onEditorAction(TextView v, int action, android.view.KeyEvent e) { save.run(); return true; }
        });
        setContentView(box);
    }

    private void showWeb() {
        final String base = Api.base(this);
        final String host = Uri.parse(base).getHost();
        web = new WebView(this);
        web.setLayoutParams(new ViewGroup.LayoutParams(-1, -1));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setUserAgentString(s.getUserAgentString() + " RozcestnikApp");

        web.setWebViewClient(new WebViewClient() {
            // Cokoli mimo Rozcestník (odkazy z oblastí, přihlášení ke Googlu, mailto:) patří do prohlížeče.
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String scheme = u.getScheme() == null ? "" : u.getScheme();
                if (scheme.startsWith("http") && host != null && host.equalsIgnoreCase(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { /* není čím otevřít */ }
                return true;
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame() && v == web) showSetup(getString(R.string.load_err));
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (picking != null) picking.onReceiveValue(null);
                picking = cb;
                try { startActivityForResult(p.createIntent(), PICK); }
                catch (Exception e) { picking = null; cb.onReceiveValue(null); }
                return true;
            }
        });

        web.setDownloadListener(new android.webkit.DownloadListener() {
            public void onDownloadStart(String url, String ua, String disp, String mime, long len) {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception e) { /* nic */ }
            }
        });

        setContentView(web);
        Api.setDirty(this, false);
        web.loadUrl(base + "/");
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req != PICK || picking == null) return;
        picking.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
        picking = null;
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
