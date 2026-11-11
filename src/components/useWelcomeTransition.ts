import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

export type WelcomeCopy = {
  headline: string;
  languageLabel: string;
  languageValue: string;
  themeLabel: string;
  themeValue: string;
  startLabel: string;
};

export function useWelcomeTransition({ headline, languageLabel, languageValue, themeLabel, themeValue, startLabel }: WelcomeCopy) {
  const next = useMemo(() => ({ headline, languageLabel, languageValue, themeLabel, themeValue, startLabel }),
    [headline, languageLabel, languageValue, themeLabel, themeValue, startLabel]);
  const [copy, setCopy] = useState(next);
  const shown = useRef(next);
  const [opacity] = useState(() => new Animated.Value(1));
  const [translateX] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); }, () => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (reduceMotion || shown.current === next) {
      shown.current = next;
      setCopy(next);
      opacity.setValue(1);
      translateX.setValue(0);
      return;
    }
    let active = true;
    let enter: Animated.CompositeAnimation | undefined;
    const timing = (value: Animated.Value, toValue: number, duration: number) => Animated.timing(value,
      { toValue, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false });
    const exit = Animated.parallel([timing(opacity, 0, 300), timing(translateX, 24, 300)]);
    exit.start(({ finished }) => {
      if (!active || !finished) return;
      shown.current = next;
      setCopy(next);
      translateX.setValue(-24);
      enter = Animated.sequence([Animated.delay(70), Animated.parallel([timing(opacity, 1, 420), timing(translateX, 0, 420)])]);
      enter.start();
    });
    return () => { active = false; exit.stop(); enter?.stop(); };
  }, [next, opacity, translateX, reduceMotion]);

  return { copy, opacity, translateX };
}
