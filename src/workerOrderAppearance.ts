export type OrderCardTone = 'neutral' | 'print_preflight' | 'print_preflight_passed' | 'in_progress' |
  'waiting_next_stage' | 'paused' | 'frozen' | 'issue' | 'completed' | 'history_partial' | 'history_completed';

const queueTones = new Set<string>(['print_preflight', 'print_preflight_passed', 'in_progress', 'waiting_next_stage', 'paused', 'frozen', 'issue', 'completed']);

export function workerOrderTone(displayState: string, queueState: string, orderControl: string): OrderCardTone {
  const display = displayState.trim().toLowerCase();
  const queue = queueState.trim().toLowerCase();
  if (display) {
    const state = display === 'in_progress' && queue === 'paused' ? 'paused' : display;
    return queueTones.has(state) ? state as OrderCardTone : 'neutral';
  }
  if (orderControl && orderControl.trim().toLowerCase() !== 'active') return 'frozen';
  return queueTones.has(queue) ? queue as OrderCardTone : 'neutral';
}

export function completedOrderTone(state: string): OrderCardTone {
  return state.trim().toLowerCase() === 'in_progress' ? 'history_partial' : 'history_completed';
}

const accents: Partial<Record<OrderCardTone, string>> = {
  in_progress: '#2E7D32', completed: '#2E7D32', waiting_next_stage: '#1565C0',
  paused: '#F9A825', frozen: '#C62828', issue: '#C62828',
};

function blend(base: string, accent: string, opacity: number): string {
  const background = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(base) ? base : '#FFFFFF';
  const alpha = Math.round(opacity * 255) / 255;
  const channel = (offset: number) => Math.round(parseInt(background.slice(offset, offset + 2), 16) * (1 - alpha) +
    parseInt(accent.slice(offset, offset + 2), 16) * alpha).toString(16).padStart(2, '0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

export function orderCardAppearance(tone: OrderCardTone, surface: string, dark: boolean) {
  if (tone === 'print_preflight') return {
    gradient: 'linear-gradient(to bottom right, #7E86A8 0%, #E5BFC4 52%, #F4FAFC 100%)',
    gradientColors: ['#7E86A8', '#E5BFC4', '#F4FAFC'],
    text: dark ? '#1D1B20' : undefined, secondary: dark ? '#49454F' : undefined,
  };
  if (tone === 'print_preflight_passed') return {
    gradient: 'linear-gradient(to bottom right, #4B8F2F 0%, #9BD34B 38%, #D9F294 70%, #FFFFFF 100%)',
    gradientColors: ['#4B8F2F', '#9BD34B', '#D9F294', '#FFFFFF'], text: '#102A0B', secondary: '#102A0B',
  };
  if (tone === 'history_partial') return { color: '#FFECB3', text: '#6D4C00', secondary: '#8A6A00' };
  if (tone === 'history_completed') return { color: '#C8E6C9', text: '#18361B', secondary: '#3F6042' };
  const accent = accents[tone];
  return accent ? { color: blend(surface, accent, dark ? 0.30 : 0.16) } : {};
}
