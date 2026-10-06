package app.suvoz;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.content.Context;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.InputMethodManager;
import android.webkit.WebView;




import org.json.JSONObject;
import org.json.JSONTokener;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;


/** Opt-in release integration test. Never runs on a personal physical device. */
public class NavAuditInstrumentation extends Instrumentation {
    private final Instrumentation inst = this;
    private android.os.Bundle arguments;
    @Override public void onCreate(android.os.Bundle args) { super.onCreate(args); arguments=args; start(); }
    @Override public void onStart() {
        android.os.Bundle result = new android.os.Bundle();
        try { releaseNavigationAndUpgrade(); result.putString("stream", "SuVoz Android navigation QA: PASS\n"); finish(-1,result); }
        catch (Throwable error) { result.putString("stream",android.util.Log.getStackTraceString(error)); finish(1,result); }
    }
    private static void fail(String message) { throw new AssertionError(message); }
    private static void assertTrue(String message, boolean value) { if (!value) fail(message); }
    private static void assertNotNull(Object value) { assertTrue("Expected non-null",value!=null); }
    private static void assertEquals(Object expected,Object actual) { assertEquals("Equality",expected,actual); }
    private static void assertEquals(String message,Object expected,Object actual) { if (!expected.equals(actual)) fail(message+": expected "+expected+", got "+actual); }
    private static void assertEquals(String message,double expected,double actual,double tolerance) { if(Math.abs(expected-actual)>tolerance) fail(message+": expected "+expected+", got "+actual); }
    private WebView web;
    private Activity activity;
    @Override public void callActivityOnResume(Activity resumed) {
        super.callActivityOnResume(resumed);
        if (resumed.getClass().getName().equals("app.suvoz.MainActivity")) {
            activity = resumed;
            web = findWeb(resumed.getWindow().getDecorView());
        }
    }

    private String shell(String command) throws Exception {
        try (ParcelFileDescriptor fd = inst.getUiAutomation().executeShellCommand(command);
             java.io.FileInputStream input = new java.io.FileInputStream(fd.getFileDescriptor())) {
            return new String(input.readAllBytes(), StandardCharsets.UTF_8).trim();
        }
    }
    private WebView findWeb(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i=0;i<group.getChildCount();i++) {
                WebView found = findWeb(group.getChildAt(i));
                if (found != null) return found;
            }
        }
        return null;
    }
    private String js(String script) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        inst.runOnMainSync(() -> web.evaluateJavascript(script, value -> { result.set(value); latch.countDown(); }));
        assertTrue("WebView callback", latch.await(10, TimeUnit.SECONDS));
        return result.get();
    }
    private JSONObject data(String expression) throws Exception {
        String encoded = js("JSON.stringify(" + expression + ")");
        return new JSONObject((String) new JSONTokener(encoded).nextValue());
    }
    private void awaitJs(String expression) throws Exception {
        for (int i=0;i<100;i++) {
            if ("true".equals(js("Boolean(" + expression + ")"))) return;
            SystemClock.sleep(100);
        }
        fail("Timed out: " + expression);
    }
    private void save(String name, JSONObject object) throws Exception {
        File dir = new File(inst.getTargetContext().getExternalFilesDir(null), "nav-qa");
        dir.mkdirs();
        try (FileOutputStream out = new FileOutputStream(new File(dir, name+".json"))) {
            out.write(object.toString(2).getBytes(StandardCharsets.UTF_8));
        }
        android.util.Log.i("SuVozNavQA", name+": "+object);
    }
    private void snapshot(String name) throws Exception {
        File dir = new File(inst.getTargetContext().getExternalFilesDir(null), "nav-qa");
        dir.mkdirs();
        android.graphics.Bitmap bitmap = inst.getUiAutomation().takeScreenshot();
        assertNotNull(bitmap);
        try (FileOutputStream out = new FileOutputStream(new File(dir, name+".png"))) {
            bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, out);
        } finally { bitmap.recycle(); }
    }

    public void releaseNavigationAndUpgrade() throws Exception {
        assertEquals("Only disposable emulator", "1", shell("getprop ro.kernel.qemu"));
        Intent intent = new Intent().setClassName("app.suvoz", "app.suvoz.MainActivity");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity = inst.startActivitySync(intent);
        String orientation = arguments.getString("orientation", "portrait");
        inst.runOnMainSync(() -> activity.setRequestedOrientation(orientation.equals("landscape")
            ? android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            : android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
        for (int i=0;i<100 && web==null;i++) {
            inst.runOnMainSync(() -> web = findWeb(activity.getWindow().getDecorView()));
            SystemClock.sleep(100);
        }
        assertNotNull(web);
        awaitJs("document.querySelector('#nav-home') && document.querySelector('#app-content')?.textContent.length > 100");
        SystemClock.sleep(1500);
        String phase = arguments.getString("phase", "candidate");
        if (phase.equals("backup44")) {
            assertEquals("Network isolated before install", "1", shell("settings get global airplane_mode_on"));
            nativeBackupRoundTrip();
            return;
        }
        if (phase.equals("seed36")) {
            js("localStorage.setItem('suvoz-nav-qa-upgrade','version36-preserved'); localStorage.setItem('reading-size','1.2');");
            save("baseline36", data("({marker:localStorage.getItem('suvoz-nav-qa-upgrade'),readingSize:localStorage.getItem('reading-size')})"));
            SystemClock.sleep(3000);
            inst.runOnMainSync(() -> activity.finish());
            SystemClock.sleep(1500);
            return;
        }
        if (phase.equals("upgrade37") || phase.equals("verify36")) {
            assertEquals("\"version36-preserved\"", js("localStorage.getItem('suvoz-nav-qa-upgrade')"));
            assertEquals("\"1.2\"", js("localStorage.getItem('reading-size')"));
        }
        if (phase.equals("verify36")) return;
        String originalMode = shell("settings get secure navigation_mode");
        String originalHandwriting = shell("settings get secure stylus_handwriting_enabled");
        shell("settings put secure stylus_handwriting_enabled 0");
        String originalHardwareIme = shell("settings get secure show_ime_with_hard_keyboard");
        shell("settings put secure show_ime_with_hard_keyboard 1");
        org.json.JSONArray modes = new org.json.JSONArray();
        try {
            String onlyMode = arguments.getString("onlyMode", "");
            for (String mode : onlyMode.isEmpty() ? new String[]{"gestural", "threebutton"} : new String[]{onlyMode}) {
                String overlay = "com.android.internal.systemui.navbar."+mode;
                shell("cmd overlay enable-exclusive --category " + overlay);
                SystemClock.sleep(1500);
                String actual = shell("settings get secure navigation_mode");
                assertEquals("Native navigation mode", mode.equals("gestural") ? "2" : "0", actual);
                org.json.JSONArray rows = new org.json.JSONArray();
                Double top = null;
                for (String route : new String[]{"home", "bible", "calendar", "community", "stats"}) {
                    awaitJs("!document.getElementById('splash-screen') && document.getElementById('nav-home')");
                    js("document.getElementById('nav-"+route+"').click()");
                    SystemClock.sleep(1300);
                    JSONObject row = data("(()=>{const n=document.querySelector('.bottom-nav'),r=n.getBoundingClientRect(),a=n.querySelector('.active'),s=getComputedStyle(n);return {route:location.hash,active:a?.id,top:r.top,bottom:r.bottom,height:innerHeight,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,safeBottom:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom'))||0,visible:s.visibility==='visible'&&s.opacity==='1'}})()");
                    assertEquals("Correct tab", "nav-"+route, row.getString("active"));
                    assertEquals("No horizontal overflow", 0, row.getInt("overflow"));
                    assertTrue("Visible nav", row.getBoolean("visible"));
                    assertEquals("Bottom clearance", 8+row.getDouble("safeBottom"), row.getDouble("height")-row.getDouble("bottom"), 1.0);
                    // Older WebViews are inset by native padding; newer versions
                    // receive CSS insets. Verify the resulting physical clearance.
                    double cssBottom = row.getDouble("bottom");
                    AtomicReference<JSONObject> nativeMetrics = new AtomicReference<>();
                    inst.runOnMainSync(() -> {
                        try {
                            int[] location = new int[2]; web.getLocationOnScreen(location);
                            View decor = activity.getWindow().getDecorView();
                            int[] decorLocation = new int[2]; decor.getLocationOnScreen(decorLocation);
                            int inset = decor.getRootWindowInsets().getInsets(android.view.WindowInsets.Type.systemBars()).bottom;
                            float density = activity.getResources().getDisplayMetrics().density;
                            double physicalGap = decorLocation[1]+decor.getHeight()-location[1]-cssBottom*density;
                            nativeMetrics.set(new JSONObject().put("systemBottomPx",inset).put("physicalGapPx",physicalGap).put("density",density));
                        } catch(Exception e) { throw new RuntimeException(e); }
                    });
                    JSONObject nativeRow = nativeMetrics.get();
                    row.put("native",nativeRow);
                    assertEquals("Native controls clearance", nativeRow.getDouble("systemBottomPx")+8*nativeRow.getDouble("density"),nativeRow.getDouble("physicalGapPx"),3.0);
                    if (top != null) assertEquals("Stable nav edge", top, row.getDouble("top"), 1.0);
                    top = row.getDouble("top"); rows.put(row);
                    snapshot(phase+"-"+mode+"-"+route);
                }
                // Focus the actual Bible search field and request the real Android IME.
                js("location.hash='bible-search'; window.dispatchEvent(new PopStateEvent('popstate'))");
                awaitJs("document.getElementById('bible-search-input')");
                js("document.getElementById('bible-search-input').scrollIntoView({block:'center',behavior:'instant'})");
                SystemClock.sleep(1200);
                JSONObject inputRect = data("(()=>{const e=document.getElementById('bible-search-input'),r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,hit:document.elementFromPoint(x,y)?.id}})()");
                assertEquals("Visible field receives the trusted touch", "bible-search-input", inputRect.getString("hit"));
                int[] webLocation = new int[2];
                inst.runOnMainSync(() -> web.getLocationOnScreen(webLocation));
                float density = activity.getResources().getDisplayMetrics().density;
                float touchX = webLocation[0] + (float)inputRect.getDouble("x")*density;
                float touchY = webLocation[1] + (float)inputRect.getDouble("y")*density;
                long eventTime = SystemClock.uptimeMillis();
                inst.sendPointerSync(android.view.MotionEvent.obtain(eventTime,eventTime,android.view.MotionEvent.ACTION_DOWN,touchX,touchY,0));
                inst.sendPointerSync(android.view.MotionEvent.obtain(eventTime,eventTime+50,android.view.MotionEvent.ACTION_UP,touchX,touchY,0));
                inst.runOnMainSync(() -> {
                    web.requestFocus();
                    ((InputMethodManager)activity.getSystemService(Context.INPUT_METHOD_SERVICE)).showSoftInput(web, InputMethodManager.SHOW_IMPLICIT);
                });
                SystemClock.sleep(1500);
                snapshot(phase+"-"+mode+"-keyboard");
                JSONObject keyboard = data("(()=>{const e=document.getElementById('bible-search-input'),r=e.getBoundingClientRect(),v=visualViewport;return {state:window.KeyboardViewportManager?.getState(),innerHeight,visibleHeight:v.height,viewportTop:v.offsetTop,focus:document.activeElement?.id,classes:document.body.className,fieldTop:r.top,fieldBottom:r.bottom,fieldVisible:r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height}})()");
                save("keyboard-"+mode,keyboard);
                awaitJs("document.body.classList.contains('keyboard-open')");
                assertEquals("true",js("document.querySelector('.bottom-nav').inert"));
                assertEquals("Actual input retains focus", "bible-search-input", keyboard.getString("focus"));
                assertTrue("Focused input is visible above the real IME", keyboard.getBoolean("fieldVisible"));
                inst.runOnMainSync(() -> ((InputMethodManager)activity.getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(web.getWindowToken(), 0));
                js("document.activeElement.blur()");
                awaitJs("!document.body.classList.contains('keyboard-open')");
                save("mode-"+mode, new JSONObject().put("rows",rows));
                modes.put(new JSONObject().put("mode",mode).put("rows",rows).put("keyboard",keyboard).put("keyboardOpenClose",true));
            }
            save(phase, new JSONObject().put("passed",true).put("phase",phase).put("orientation",orientation).put("modes",modes));
        } finally {
            shell("cmd overlay enable-exclusive --category com.android.internal.systemui.navbar."+(originalMode.equals("0") ? "threebutton" : "gestural"));
            shell(originalHandwriting.equals("null") ? "settings delete secure stylus_handwriting_enabled" : "settings put secure stylus_handwriting_enabled "+originalHandwriting);
            shell(originalHardwareIme.equals("null") ? "settings delete secure show_ime_with_hard_keyboard" : "settings put secure show_ime_with_hard_keyboard "+originalHardwareIme);
        }
    }

    private void openBackupSettings() throws Exception {
        awaitJs("window.App?._pushRouteReady===true");
        for (int i=0; i<250 && !"true".equals(js("!document.getElementById('splash-screen')")); i++) SystemClock.sleep(100);
        assertEquals("Splash no longer intercepts touches", "true", js("!document.getElementById('splash-screen')"));
        js("if(window.App.currentView!=='settings') document.getElementById('header-settings-btn').click()");
        awaitJs("document.getElementById('import-file') && window.App && window.ShareService");
        js("window.__qaAlerts=[]; window.__qaConfirmCalls=0; window.alert=m=>window.__qaAlerts.push(m); window.confirm=()=>{window.__qaConfirmCalls++;return true;}");
    }

    private void chooseFixture(File file, boolean canceled) throws Exception {
        android.net.Uri uri = androidx.core.content.FileProvider.getUriForFile(inst.getTargetContext(), "app.suvoz.fileprovider", file);
        java.util.concurrent.atomic.AtomicInteger calls = new java.util.concurrent.atomic.AtomicInteger();
        java.util.List<String> actions = new java.util.ArrayList<>();
        ActivityMonitor monitor = new ActivityMonitor() {
            @Override public ActivityResult onStartActivity(Intent intent) {
                String action = intent.getAction();
                actions.add(String.valueOf(action));
                if (Intent.ACTION_CHOOSER.equals(action) || Intent.ACTION_GET_CONTENT.equals(action) || Intent.ACTION_OPEN_DOCUMENT.equals(action)) {
                    calls.incrementAndGet();
                    Intent result = new Intent().setData(uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    return new ActivityResult(canceled ? Activity.RESULT_CANCELED : Activity.RESULT_OK, result);
                }
                return null;
            }
        };
        inst.addMonitor(monitor);
        try {
            js("document.getElementById('import-file').value=''; document.getElementById('import-data').scrollIntoView({block:'center',behavior:'instant'})");
            SystemClock.sleep(1200);
            js("window.__qaClicks=[]; document.addEventListener('click',e=>window.__qaClicks.push({id:e.target.id,trusted:e.isTrusted}),{once:true}); document.getElementById('import-file').addEventListener('click',()=>window.__qaClicks.push({id:'input-handler'}),{once:true})");
            JSONObject rect = data("(()=>{const r=document.getElementById('import-data').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML}})()");
            int[] location = new int[2];
            inst.runOnMainSync(() -> web.getLocationOnScreen(location));
            float density = activity.getResources().getDisplayMetrics().density;
            float x = location[0]+(float)rect.getDouble("x")*density;
            float y = location[1]+(float)rect.getDouble("y")*density;
            long when = SystemClock.uptimeMillis();
            android.view.MotionEvent down = android.view.MotionEvent.obtain(when,when,android.view.MotionEvent.ACTION_DOWN,x,y,0);
            android.view.MotionEvent up = android.view.MotionEvent.obtain(when,when+50,android.view.MotionEvent.ACTION_UP,x,y,0);
            try { inst.sendPointerSync(down); inst.sendPointerSync(up); }
            finally { down.recycle(); up.recycle(); }
            for (int i=0; i<100 && calls.get()==0; i++) SystemClock.sleep(100);
            if (calls.get()==0) {
                save("backup44-picker-diagnostic", new JSONObject().put("rect",rect).put("density",density).put("nativeX",x).put("nativeY",y).put("actions",new org.json.JSONArray(actions)).put("clicks",js("window.__qaClicks")).put("body",js("document.body.innerText")).put("focus",activity.hasWindowFocus()));
                snapshot("backup44-picker-diagnostic");
            }
            assertEquals("Native file chooser invoked exactly once", 1, calls.get());
        } finally { inst.removeMonitor(monitor); }
    }

    private File backupFixture(String name, String json) throws Exception {
        File directory = new File(inst.getTargetContext().getCacheDir(), "backups");
        assertTrue("QA backup directory", directory.isDirectory() || directory.mkdirs());
        File file = new File(directory, name);
        try (FileOutputStream output = new FileOutputStream(file)) { output.write(json.getBytes(StandardCharsets.UTF_8)); }
        return file;
    }

    private void nativeBackupRoundTrip() throws Exception {
        assertEquals("Native bridge", "true", js("window.Capacitor.isNativePlatform() && typeof window.Capacitor.Plugins.FirebaseAppCheck.initialize==='function'"));
        nativeBackupExportCancellation();
        js("localStorage.setItem('su-voz-note-2026-10-03',JSON.stringify({dios:'QA44 nota previa ficticia'})); localStorage.setItem('qa44-auth-marker','unchanged')");
        String note = new JSONObject().put("dios", "QA44 importacion ficticia").toString();
        String good = new JSONObject().put("notes", new JSONObject().put("2026-10-04", new JSONObject(note)))
            .put("readDates", new org.json.JSONArray().put("2026-10-04"))
            .put("settings", new JSONObject().put("fontSize", 1.2).put("notificationsEnabled", true)).toString();
        openBackupSettings();
        js("window.__qaReloadMarker=true");
        chooseFixture(backupFixture("qa44-good.json", good), false);
        awaitJs("JSON.parse(localStorage.getItem('su-voz-note-2026-10-04')||'{}').dios==='QA44 importacion ficticia'");
        assertEquals("Previous local note", "\"QA44 nota previa ficticia\"", js("JSON.parse(localStorage.getItem('su-voz-note-2026-10-03')).dios"));
        assertEquals("No identity import", "\"unchanged\"", js("localStorage.getItem('qa44-auth-marker')"));
        assertEquals("No notification consent import", "false", js("JSON.parse(localStorage.getItem('su-voz-settings')).notificationsEnabled"));
        awaitJs("window.__qaReloadMarker===undefined && window.App?._pushRouteReady===true");
        openBackupSettings();
        chooseFixture(backupFixture("qa44-cancel.json", good), true);
        SystemClock.sleep(500);
        assertEquals("Canceled picker does not request restore", "0", js("window.__qaConfirmCalls"));
        String invalid = new JSONObject(good).put("settings", new JSONObject().put("fontSize", "invalid")).toString();
        chooseFixture(backupFixture("qa44-invalid.json", invalid), false);
        awaitJs("window.__qaAlerts.length===1");
        assertEquals("Invalid preferences rejected before confirmation", "0", js("window.__qaConfirmCalls"));
        assertEquals("Imported note persisted across reload", "\"QA44 importacion ficticia\"", js("JSON.parse(localStorage.getItem('su-voz-note-2026-10-04')).dios"));
        int versionCode = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0).versionCode;
        JSONObject result = new JSONObject().put("versionCode",versionCode).put("offline",true)
            .put("nativeFilePickerResult",true).put("realFileReader",true).put("priorNotePreserved",true)
            .put("identityPreserved",true).put("notificationConsentPreserved",true)
            .put("cancelNoWrite",true).put("invalidPreferencesNoWrite",true).put("survivesReload",true)
            .put("nativeExportFileProvider",true).put("nativeExportCancellation",true)
            .put("syntheticDataOnly",true).put("pickerUiManuallyTested",false);
        save("backup44", result);
        snapshot("backup44-settings");
    }

    private void nativeBackupExportCancellation() throws Exception {
        java.util.concurrent.atomic.AtomicInteger calls = new java.util.concurrent.atomic.AtomicInteger();
        ActivityMonitor monitor = new ActivityMonitor() {
            @Override public ActivityResult onStartActivity(Intent intent) {
                if (!Intent.ACTION_CHOOSER.equals(intent.getAction())) return null;
                Intent send = intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class);
                assertNotNull(send);
                android.net.Uri uri = send.getParcelableExtra(Intent.EXTRA_STREAM, android.net.Uri.class);
                assertNotNull(uri);
                assertEquals("Private FileProvider", "app.suvoz.fileprovider", uri.getAuthority());
                assertTrue("Only backup cache shared", uri.getPath().startsWith("/shared_backups/"));
                assertTrue("Temporary read grant", (send.getFlags() & Intent.FLAG_GRANT_READ_URI_PERMISSION) != 0);
                calls.incrementAndGet();
                return new ActivityResult(Activity.RESULT_CANCELED, null);
            }
        };
        inst.addMonitor(monitor);
        try {
            js("window.__qaShareResult=null; window.ShareService.exportBackup(new Blob(['{\"qa\":\"fictional-only\"}'],{type:'application/json'}),'qa44-share.json').then(r=>window.__qaShareResult=r,e=>window.__qaShareResult={error:String(e)})");
            awaitJs("window.__qaShareResult!==null");
            assertEquals("Native export chooser invoked", 1, calls.get());
            assertEquals("Cancellation is not reported as shared", "true", js("window.__qaShareResult.canceled===true && !window.__qaShareResult.shared"));
            File directory = new File(inst.getTargetContext().getCacheDir(), "backups");
            File[] files = directory.listFiles((dir, name) -> name.endsWith("-qa44-share.json"));
            assertTrue("Filesystem wrote synthetic export", files != null && files.length > 0);
        } finally { inst.removeMonitor(monitor); }
    }
}
