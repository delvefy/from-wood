# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Readable stack traces in Play Console (mapping file is uploaded with the AAB).
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Capacitor bridges JS -> native through @JavascriptInterface methods.
# Plugin classes themselves are kept by capacitor-android's consumer rules.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
