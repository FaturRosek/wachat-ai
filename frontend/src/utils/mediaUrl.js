export function getMediaUrl(url) {
  if (!url) return '';
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return url;
  }
  const apiBase = (import.meta.env.VITE_API_URL || '')
    .replace(/\/api\/?$/, '')
    .replace(/\/+$/, '');
  if (!apiBase) return url;
  return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
}
