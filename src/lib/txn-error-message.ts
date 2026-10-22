import type { StringKey } from '@/i18n/strings';
import type { TxnError } from '@/lib/validation';

/** User-facing text for a failed transaction check. */
export function txnErrorMessage(
  error: TxnError,
  t: (key: StringKey) => string,
  money: (paisa: number) => string
): string {
  switch (error.code) {
    case 'insufficient':
    case 'overLimit':
      return t(error.code === 'insufficient' ? 'add.insufficient' : 'add.overLimit')
        .replace('{account}', error.accountName)
        .replace('{amount}', money(error.available));
    case 'needTwoAccounts':
    case 'sameAccount':
      return t(`add.${error.code}`);
    default:
      return t('add.noAmount');
  }
}
