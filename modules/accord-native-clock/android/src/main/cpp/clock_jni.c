#include <jni.h>
#include "clock_core.h"

JNIEXPORT jlong JNICALL
Java_expo_modules_accordnativeclock_NativeClock_microsecondsSinceEpoch(JNIEnv *env, jobject receiver) {
  (void)receiver;
  int64_t result;
  if (accord_current_epoch_microseconds(&result) == 0) return (jlong)result;
  jclass error = (*env)->FindClass(env, "java/lang/IllegalStateException");
  if (error) (*env)->ThrowNew(env, error, "accord_clock_unavailable");
  return 0;
}
