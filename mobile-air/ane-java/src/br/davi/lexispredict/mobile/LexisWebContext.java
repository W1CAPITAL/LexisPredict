package br.davi.lexispredict.mobile;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;

import com.adobe.fre.FREContext;
import com.adobe.fre.FREFunction;
import com.adobe.fre.FREObject;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

public class LexisWebContext extends FREContext {
    private static final String APP_HOST = "lexispredict.vercel.app";
    private static final String DEFAULT_URL =
            "https://lexispredict.vercel.app/login?source=android-air";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView webView;
    private FrameLayout container;
    private ProgressBar progress;
    private volatile String state = "native-context-ready";

    @Override
    public Map<String, FREFunction> getFunctions() {
        Map<String, FREFunction> functions = new HashMap<>();
        functions.put("ping", new PingFunction());
        functions.put("status", new StatusFunction());
        functions.put("open", new OpenFunction());
        functions.put("reload", new ReloadFunction());
        functions.put("canGoBack", new CanGoBackFunction());
        functions.put("goBack", new GoBackFunction());
        functions.put("show", new ShowFunction());
        functions.put("hide", new HideFunction());
        functions.put("close", new CloseFunction());
        return functions;
    }

    @Override
    public void dispose() {
        destroyWebView();
    }

    private FREObject stringObject(String value) {
        try { return FREObject.newObject(value == null ? "" : value); }
        catch (Throwable ignored) { return null; }
    }

    private FREObject boolObject(boolean value) {
        try { return FREObject.newObject(value); }
        catch (Throwable ignored) { return null; }
    }

    private void send(String code, String level) {
        try {
            dispatchStatusEventAsync(
                    code == null ? "state" : code,
                    level == null ? "" : level
            );
        } catch (Throwable ignored) { }
    }

    private void setState(String value) {
        state = value == null ? "" : value;
        send("state", state);
    }

    private boolean isAppUrl(String value) {
        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme();
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
            if (!"https".equalsIgnoreCase(scheme)) return false;
            if (APP_HOST.equals(host)) return true;
            return host.endsWith(".vercel.app") &&
                    (host.contains("lexispredict") || host.contains("private-assecom"));
        } catch (Throwable ignored) {
            return false;
        }
    }

    private void openExternal(Activity activity, String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            activity.startActivity(intent);
        } catch (Throwable t) {
            setState("Nao foi possivel abrir o link externo.");
        }
    }

    private String offlineHtml(String failedUrl) {
        String safe = failedUrl == null ? DEFAULT_URL :
                failedUrl.replace("&", "&amp;")
                         .replace("<", "&lt;")
                         .replace(">", "&gt;")
                         .replace(String.valueOf((char) 34), "&quot;");

        return "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>" +
                "<style>body{margin:0;background:#070a12;color:#fff;font-family:sans-serif;display:flex;" +
                "min-height:100vh;align-items:center;justify-content:center;padding:28px;box-sizing:border-box}" +
                ".c{max-width:420px;text-align:center}.s{color:#9aa8c2;line-height:1.5}a{display:inline-block;" +
                "margin-top:20px;padding:13px 20px;border-radius:12px;background:#fff;color:#07101f;" +
                "text-decoration:none;font-weight:800}</style></head><body><div class='c'>" +
                "<h2>LexisPredict offline</h2><div class='s'>Nao foi possivel alcancar o servidor agora. " +
                "Sua sessao continua salva no aparelho.</div><a href='" + safe + "'>Tentar novamente</a>" +
                "</div></body></html>";
    }

    private void createAndOpen(final String requestedUrl) {
        final Activity activity = getActivity();
        if (activity == null) {
            setState("Activity Android indisponivel.");
            send("error", state);
            return;
        }

        final String url = isAppUrl(requestedUrl) ? requestedUrl : DEFAULT_URL;

        activity.runOnUiThread(() -> {
            try {
                if (webView != null) {
                    webView.setVisibility(View.VISIBLE);
                    webView.loadUrl(url);
                    return;
                }

                activity.getWindow().setStatusBarColor(Color.rgb(7, 10, 18));
                activity.getWindow().setNavigationBarColor(Color.rgb(7, 10, 18));

                container = new FrameLayout(activity);
                container.setBackgroundColor(Color.rgb(7, 10, 18));
                container.setClipToPadding(true);

                // Android 15+ (targetSdk 35) aplica edge-to-edge por padrão.
                // Sem consumir os insets, a barra inferior web fica atrás da
                // navegação por gestos e pode aparecer mas não receber toque.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    container.setOnApplyWindowInsetsListener((v, insets) -> {
                        android.graphics.Insets bars = insets.getInsets(
                                WindowInsets.Type.systemBars() |
                                WindowInsets.Type.displayCutout()
                        );
                        v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                        return insets;
                    });
                    container.requestApplyInsets();
                } else {
                    container.setFitsSystemWindows(true);
                }

                webView = new WebView(activity);
                webView.setBackgroundColor(Color.rgb(7, 10, 18));
                webView.setFocusable(true);
                webView.setFocusableInTouchMode(true);
                webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
                webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
                webView.setVerticalScrollBarEnabled(false);
                webView.setOnTouchListener((v, event) -> {
                    if (event.getActionMasked() == MotionEvent.ACTION_DOWN) {
                        v.requestFocus();
                    }
                    return false;
                });
                WebView.setWebContentsDebuggingEnabled(false);

                WebSettings settings = webView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setLoadsImagesAutomatically(true);
                settings.setUseWideViewPort(true);
                settings.setLoadWithOverviewMode(false);
                settings.setSupportZoom(false);
                settings.setBuiltInZoomControls(false);
                settings.setDisplayZoomControls(false);
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setAllowFileAccess(true);
                settings.setAllowContentAccess(true);
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
                settings.setUserAgentString(
                        settings.getUserAgentString() + " LexisPredictMobile/1.0 AIR"
                );

                CookieManager cookies = CookieManager.getInstance();
                cookies.setAcceptCookie(true);
                cookies.setAcceptThirdPartyCookies(webView, true);

                progress = new ProgressBar(
                        activity,
                        null,
                        android.R.attr.progressBarStyleHorizontal
                );
                progress.setMax(100);
                progress.setProgress(0);
                progress.setIndeterminate(false);

                FrameLayout.LayoutParams webParams = new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                );
                FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        Math.max(
                                6,
                                (int) (activity.getResources().getDisplayMetrics().density * 3)
                        )
                );

                container.addView(webView, webParams);
                container.addView(progress, progressParams);

                webView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onProgressChanged(WebView view, int newProgress) {
                        if (progress != null) {
                            progress.setProgress(newProgress);
                            progress.setVisibility(
                                    newProgress >= 100 ? View.GONE : View.VISIBLE
                            );
                        }
                        send("progress", String.valueOf(newProgress));
                    }
                });

                webView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(
                            WebView view,
                            WebResourceRequest request
                    ) {
                        return handleUrl(
                                activity,
                                view,
                                request.getUrl().toString()
                        );
                    }

                    @Override
                    public boolean shouldOverrideUrlLoading(
                            WebView view,
                            String target
                    ) {
                        return handleUrl(activity, view, target);
                    }

                    @Override
                    public void onPageStarted(
                            WebView view,
                            String pageUrl,
                            Bitmap favicon
                    ) {
                        super.onPageStarted(view, pageUrl, favicon);
                        if (progress != null) progress.setVisibility(View.VISIBLE);
                        setState("Carregando LexisPredict...");
                    }

                    @Override
                    public void onPageFinished(WebView view, String pageUrl) {
                        super.onPageFinished(view, pageUrl);
                        if (progress != null) progress.setVisibility(View.GONE);

                        String nativeScript =
                                "(function(){try{" +
                                "window.__LEXIS_ANDROID_AIR__=true;" +
                                "document.documentElement.classList.add('lexis-native-app');" +
                                "document.documentElement.style.setProperty('--lexis-native-app','1');" +
                                "var m=document.querySelector('meta[name=viewport]');" +
                                "if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}" +
                                "m.content='width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover';" +
                                "var n=document.querySelector('[data-lexis-mobile-bottom-nav]');" +
                                "if(n){n.style.pointerEvents='auto';n.style.touchAction='manipulation';}" +
                                "return 'ok';}catch(e){return String(e);}})();";
                        try {
                            view.evaluateJavascript(nativeScript, null);
                        } catch (Throwable ignored) { }

                        setState("LexisPredict pronto.");
                        send("ready", pageUrl == null ? "" : pageUrl);
                    }

                    @Override
                    public void onReceivedError(
                            WebView view,
                            WebResourceRequest request,
                            WebResourceError error
                    ) {
                        super.onReceivedError(view, request, error);
                        if (request != null && request.isForMainFrame()) {
                            send("offline", String.valueOf(error));
                            view.loadDataWithBaseURL(
                                    DEFAULT_URL,
                                    offlineHtml(request.getUrl().toString()),
                                    "text/html",
                                    "UTF-8",
                                    null
                            );
                        }
                    }
                });

                webView.setDownloadListener(new DownloadListener() {
                    @Override
                    public void onDownloadStart(
                            String downloadUrl,
                            String userAgent,
                            String contentDisposition,
                            String mimetype,
                            long contentLength
                    ) {
                        try {
                            DownloadManager.Request request =
                                    new DownloadManager.Request(Uri.parse(downloadUrl));
                            String cookie =
                                    CookieManager.getInstance().getCookie(downloadUrl);
                            if (cookie != null && !cookie.isEmpty()) {
                                request.addRequestHeader("Cookie", cookie);
                            }
                            if (userAgent != null) {
                                request.addRequestHeader("User-Agent", userAgent);
                            }
                            request.setNotificationVisibility(
                                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                            );
                            String filename = URLUtil.guessFileName(
                                    downloadUrl,
                                    contentDisposition,
                                    mimetype
                            );
                            request.setDestinationInExternalPublicDir(
                                    Environment.DIRECTORY_DOWNLOADS,
                                    filename
                            );
                            DownloadManager manager = (DownloadManager)
                                    activity.getSystemService(Context.DOWNLOAD_SERVICE);
                            manager.enqueue(request);
                            setState("Download iniciado: " + filename);
                        } catch (Throwable t) {
                            openExternal(activity, downloadUrl);
                        }
                    }
                });

                activity.addContentView(
                        container,
                        new FrameLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                        )
                );
                container.bringToFront();
                webView.requestFocus(View.FOCUS_DOWN);

                setState("Abrindo LexisPredict...");
                webView.loadUrl(url);
            } catch (Throwable t) {
                setState(
                        "Falha no WebView: " +
                        t.getClass().getSimpleName() +
                        " " +
                        String.valueOf(t.getMessage())
                );
                send("error", state);
            }
        });
    }

    private boolean handleUrl(Activity activity, WebView view, String target) {
        if (target == null || target.isEmpty()) return false;

        if (target.startsWith("https://") || target.startsWith("http://")) {
            if (isAppUrl(target)) return false;
            openExternal(activity, target);
            return true;
        }

        if (target.startsWith("tel:") ||
            target.startsWith("mailto:") ||
            target.startsWith("sms:") ||
            target.startsWith("whatsapp:") ||
            target.startsWith("intent:")) {
            openExternal(activity, target);
            return true;
        }

        return false;
    }

    private void setVisible(final boolean visible) {
        final Activity activity = getActivity();
        if (activity == null) return;

        activity.runOnUiThread(() -> {
            if (container != null) {
                container.setVisibility(
                        visible ? View.VISIBLE : View.GONE
                );
                if (visible) container.bringToFront();
            }
        });
    }

    private void destroyWebView() {
        final Activity activity = getActivity();
        if (activity == null) return;

        activity.runOnUiThread(() -> {
            try {
                if (webView != null) {
                    CookieManager.getInstance().flush();
                    webView.stopLoading();
                    webView.loadUrl("about:blank");

                    ViewGroup parent =
                            webView.getParent() instanceof ViewGroup
                                    ? (ViewGroup) webView.getParent()
                                    : null;
                    if (parent != null) parent.removeView(webView);

                    webView.removeAllViews();
                    webView.destroy();
                }

                if (container != null) {
                    ViewGroup parent =
                            container.getParent() instanceof ViewGroup
                                    ? (ViewGroup) container.getParent()
                                    : null;
                    if (parent != null) parent.removeView(container);
                    container.removeAllViews();
                }
            } catch (Throwable ignored) { }

            webView = null;
            container = null;
            progress = null;
        });
    }

    private class PingFunction implements FREFunction {
        @Override
        public FREObject call(FREContext context, FREObject[] args) {
            return stringObject("lexis-native-ok");
        }
    }

    private class StatusFunction implements FREFunction {
        @Override
        public FREObject call(FREContext context, FREObject[] args) {
            return stringObject(state);
        }
    }

    private class OpenFunction implements FREFunction {
        @Override
        public FREObject call(FREContext context, FREObject[] args) {
            String target = DEFAULT_URL;
            try {
                if (args != null && args.length > 0 && args[0] != null) {
                    target = args[0].getAsString();
                }
            } catch (Throwable ignored) { }
            createAndOpen(target);
            return stringObject("open-accepted");
        }
    }

    private class ReloadFunction implements FREFunction {
        @Override
        public FREObject call(FREContext context, FREObject[] args) {
            final Activity activity = getActivity();
            if (activity != null) {
                activity.runOnUiThread(() -> {
                    if (webView != null) webView.reload();
                });
            }
            return stringObject("reload-accepted");
        }
    }

    private class CanGoBackFunction implements FREFunction {
        @Override
        public FREObject call(FREContext context, FREObject[] args) {
            return boolObject(webView != null && webView.canGoBack());
        }
    }

    private class GoBackFunction implements FREFunction {
        @Override
        public FREObject call(FREContext context, FREObject[] args) {
            final Activity activity = getActivity();
            if (activity != null) {
                activity.runOnUiThread(() -> {
                    if (webView != null && webView.canGoBack()) {
                        webView.goBack();
                    }
                });
            }
            return stringObject("back-accepted");
        }
    }

    private class ShowFunction implements FREFunction {
        @Override
        public FREObject call(FREContext context, FREObject[] args) {
            setVisible(true);
            return stringObject("show-accepted");
        }
    }

    private class HideFunction implements FREFunction {
        @Override
        public FREObject call(FREContext context, FREObject[] args) {
            setVisible(false);
            return stringObject("hide-accepted");
        }
    }

    private class CloseFunction implements FREFunction {
        @Override
        public FREObject call(FREContext context, FREObject[] args) {
            destroyWebView();
            return stringObject("close-accepted");
        }
    }
}
