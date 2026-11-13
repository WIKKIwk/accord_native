import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ScrollView } from 'react-native';
import type { RawSplitRoll } from './rawSplitModel';

// UIKit scrolling supplies the V2 issue-form reveal on iOS 16 as well as newer phones.
export function useRawSplitIssueScroll(source: RawSplitRoll | null, issueVisible: boolean, issueRevision: number) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null), handledIssue = useRef(0);
  const contentOrigin = useRef<number | null>(null), issueOrigin = useRef<{ source: RawSplitRoll; y: number } | null>(null);
  const [issueLayout, setIssueLayout] = useState<{ source: RawSplitRoll; y: number } | null>(null);
  const measureIssue = () => {
    if (!issueVisible || issueRevision <= handledIssue.current) return;
    const issue = issueOrigin.current, content = contentOrigin.current;
    if (!issue || content === null) return;
    const y = Math.max(0, issue.y - content);
    setIssueLayout(previous => previous?.source === issue.source && previous.y === y ? previous : { source: issue.source, y });
  };
  const measureContent = (geometry: { y: number }) => { contentOrigin.current = geometry.y; measureIssue(); };
  const measureIssueOrigin = (geometry: { y: number }) => {
    if (source) { issueOrigin.current = { source, y: geometry.y }; measureIssue(); }
  };
  const issueY = issueLayout?.source === source ? issueLayout.y : null;
  useEffect(() => {
    if (!issueVisible || issueY === null || issueRevision <= handledIssue.current) return;
    const frame = requestAnimationFrame(() => {
      if (!scroll.current) return;
      handledIssue.current = issueRevision; scroll.current.scrollTo({ y: issueY, animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [issueRevision, issueY, issueVisible]);
  return { scroll, measureContent, measureIssueOrigin };
}
