/**
 * Shortcuts are built by hand, so tolerate a missing "sms" path: any link that
 * carries ?text= is treated as a forwarded SMS.
 */
export function normalizeSmsLink(path: string): string {
  const query = path.indexOf('?');
  if (query === -1) return path;
  const route = path.slice(0, query);
  const params = new URLSearchParams(path.slice(query + 1));
  if (!params.has('text') || /\/sms\/?$/.test(route)) return path;
  return `/sms${path.slice(query)}`;
}
