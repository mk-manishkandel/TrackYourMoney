import { normalizeSmsLink } from '@/lib/incoming-link';

/** Every link that opens the app passes through here before routing. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return normalizeSmsLink(path);
  } catch {
    return path;
  }
}
