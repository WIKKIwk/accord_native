/** @v2 calculateOrderImageUrl */
export function calculateOrderImageUrl(baseUrl: string, imageUrl: string): string {
  const value = imageUrl.trim();
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return value.startsWith('/') ? `${baseUrl}${value}` : value;
}

/** @v2 adminProductionMapOrderImageUrl */
export function adminProductionMapOrderImageUrl(baseUrl: string, orderId: string, imageId = ''): string {
  const query = new URLSearchParams({ order_id: orderId.trim() });
  if (imageId.trim()) query.set('image_id', imageId.trim());
  return new URL(`/v1/mobile/admin/production-maps/order-image/view?${query}`, baseUrl).toString();
}

/** @v2 orderImageRequestUri */
export function orderImageRequestUri(baseUrl: string, imageUrl: string, thumbnail = false): URL {
  const url = new URL(calculateOrderImageUrl(baseUrl, imageUrl));
  if (url.origin !== new URL(baseUrl).origin || !(url.pathname.endsWith('/calculate/orders/image/view') ||
      url.pathname.endsWith('/production-maps/order-image/view'))) return url;
  const query = new Map(url.searchParams.entries());
  query.delete('variant');
  if (thumbnail) query.set('variant', 'thumb-v1');
  url.search = '';
  for (const [key, value] of query) url.searchParams.set(key, value);
  return url;
}
