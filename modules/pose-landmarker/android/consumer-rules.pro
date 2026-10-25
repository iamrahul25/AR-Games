# MediaPipe Tasks ships no keep rules of its own, but its native code calls back into
# its Java classes over JNI, protobuf-lite reads message fields by name via reflection
# (e.g. "Field platform_ for ... not found" when obfuscated), and Flogger loads its
# backend by class name. R8 must leave all of these intact in minified release builds.
-keep class com.google.mediapipe.** { *; }
-keep class * extends com.google.protobuf.GeneratedMessageLite { *; }
-keep class com.google.common.flogger.** { *; }

-dontwarn com.google.mediapipe.**
-dontwarn com.google.common.flogger.**
-dontwarn com.google.auto.value.**
-dontwarn javax.annotation.**
