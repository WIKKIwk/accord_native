import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Flutter InkWell calls Feedback.forLongPress before invoking the callback. */
export function workerLongPressFeedback(): void {
  const feedback = Platform.OS === 'ios' ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    : Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press) : null;
  void feedback?.catch(() => {});
}
