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
                js("document.getElementById('bible-search-input').focus()");
                JSONObject inputRect = data("(()=>{const r=document.getElementById('bible-search-input').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
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
                save("keyboard-diagnostic",data("({state:window.KeyboardViewportManager?.getState(),innerHeight,visibleHeight:visualViewport.height,focus:document.activeElement?.id,classes:document.body.className})"));
                awaitJs("document.body.classList.contains('keyboard-open')");
                assertEquals("true",js("document.querySelector('.bottom-nav').inert"));
                inst.runOnMainSync(() -> ((InputMethodManager)activity.getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(web.getWindowToken(), 0));
                js("document.activeElement.blur()");
                awaitJs("!document.body.classList.contains('keyboard-open')");
                save("mode-"+mode, new JSONObject().put("rows",rows));
                modes.put(new JSONObject().put("mode",mode).put("rows",rows).put("keyboardOpenClose",true));
            }
            save(phase, new JSONObject().put("passed",true).put("phase",phase).put("orientation",orientation).put("modes",modes));
        } finally {
            shell("cmd overlay enable-exclusive --category com.android.internal.systemui.navbar."+(originalMode.equals("0") ? "threebutton" : "gestural"));
            shell(originalHandwriting.equals("null") ? "settings delete secure stylus_handwriting_enabled" : "settings put secure stylus_handwriting_enabled "+originalHandwriting);
            shell(originalHardwareIme.equals("null") ? "settings delete secure show_ime_with_hard_keyboard" : "settings put secure show_ime_with_hard_keyboard "+originalHardwareIme);
        }
    }
}
