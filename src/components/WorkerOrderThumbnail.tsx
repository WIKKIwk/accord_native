import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { activeSessionToken, type Session } from '../auth';
import { isThumbnailMissing, retryThumbnail, scheduleThumbnail, thumbnailSource } from '../orderThumbnail';

type Props = { session: Session; orderId: string; imageId: string; active: boolean; backgroundColor: string; iconColor: string };

export const WorkerOrderThumbnail = memo(function WorkerOrderThumbnail({ session, orderId, imageId, active, backgroundColor, iconColor }: Props) {
  const [laidOut, setLaidOut] = useState(false);
  const source = active && laidOut ? thumbnailSource(session, orderId, imageId) : null;
  return <View accessible={false} pointerEvents="none" onLayout={laidOut ? undefined : () => setLaidOut(true)} style={[styles.thumbnail, { backgroundColor }]}>
    <SymbolView name={{ ios: 'photo', android: 'image', web: 'image' }} size={20} tintColor={iconColor} />
    {active && source && !isThumbnailMissing(session, orderId, imageId)
      ? <ThumbnailRequest key={source.cacheKey} session={session} orderId={orderId} imageId={imageId} source={source} /> : null}
  </View>;
});

function ThumbnailRequest({ session, orderId, imageId, source }: {
  session: Session; orderId: string; imageId: string; source: { uri: string; cacheKey: string };
}) {
  const [token, setToken] = useState(() => activeSessionToken(session));
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(false);
  const finish = useRef<(() => void) | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!token || failed) return;
    let cancel: (() => void) | undefined;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        cancel = scheduleThumbnail(release => { finish.current = release; setStarted(true); });
      });
    });
    return () => { cancelAnimationFrame(frame); cancel?.(); finish.current = null; };
  }, [token, failed, attempt]);

  const endRequest = () => { finish.current?.(); finish.current = null; };
  const onError = () => {
    endRequest();
    setStarted(false);
    setFailed(true);
    if (!token || attempt >= 1) return;
    void retryThumbnail(session, orderId, imageId, token).then(retry => {
      const refreshed = activeSessionToken(session);
      if (!mounted.current || !retry || !refreshed) return;
      setToken(refreshed);
      setAttempt(value => value + 1);
      setFailed(false);
    });
  };
  return started && token && !failed ? <Image key={`${source.cacheKey}:${attempt}`}
    source={{ ...source, headers: { Authorization: `Bearer ${token}` } }}
    recyclingKey={source.cacheKey} style={StyleSheet.absoluteFill} contentFit="cover"
    cachePolicy="memory-disk" onLoad={endRequest} onError={onError} /> : null;
}

const styles = StyleSheet.create({
  thumbnail: { width: 40, height: 40, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
