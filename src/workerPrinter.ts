export async function connectedPrinter(address: string): Promise<{ driver_url: string; printer: string; print_mode: string }> {
  let url: URL;
  try { url = new URL(address.trim()); } catch { throw new Error('Printer serverining to‘liq manzilini kiriting.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Printer serverining to‘g‘ri HTTP manzilini kiriting.');
  const driverUrl = url.toString().replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${driverUrl}/v1/mobile/monitor/state`, { signal: controller.signal });
    if (!response.ok) throw new Error('Printer serveriga ulanib bo‘lmadi.');
    const state = await response.json();
    const printer = state.printer ?? state.state?.printer;
    const connected = (value: unknown) => value === true || value === 1 || ['true', '1', 'yes'].includes(String(value).toLowerCase());
    if (!printer || (!connected(printer.connected) && !connected(printer.ok))) throw new Error('Printer ulanmagan.');
    const kind = String(printer.kind || 'printer');
    return { driver_url: driverUrl, printer: kind, print_mode: kind.trim().toLowerCase() === 'godex' ? 'label' : 'rfid' };
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError' && error.message !== 'Network request failed') throw error;
    throw new Error('Printer serveriga ulanib bo‘lmadi.');
  } finally { clearTimeout(timer); }
}
