import { normalizeSmsLink } from '@/lib/incoming-link';

describe('normalizeSmsLink', () => {
  it('leaves correct SMS links and other links alone', () => {
    expect(normalizeSmsLink('/sms?text=NPR%20500')).toBe('/sms?text=NPR%20500');
    expect(normalizeSmsLink('/--/sms?text=hi')).toBe('/--/sms?text=hi');
    expect(normalizeSmsLink('/settings')).toBe('/settings');
    expect(normalizeSmsLink('/inbox?x=1')).toBe('/inbox?x=1');
  });

  it('routes a link with text but no sms path to the SMS intake', () => {
    expect(normalizeSmsLink('/?text=NPR%20500')).toBe('/sms?text=NPR%20500');
    expect(normalizeSmsLink('?text=NPR%20500')).toBe('/sms?text=NPR%20500');
  });
});
