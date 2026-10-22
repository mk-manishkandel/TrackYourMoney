export type TxnType = 'expense' | 'income' | 'transfer';

/** Restrained chart palette from the design system; colors live in theme tokens. */
export type CategoryGroup = 'essentials' | 'lifestyle' | 'transport' | 'subscriptions' | 'other' | 'income';

export type DefaultCategory = {
  key: string;
  kind: 'expense' | 'income';
  /** Id from ICONS in lib/icons. */
  icon: string;
  group: CategoryGroup;
  /** Lowercase English, Romanized Nepali and Devanagari words that suggest this category. */
  keywords: string[];
};

/** Seeded on first launch; the key stays stable while the display name is localized. */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    key: 'food',
    kind: 'expense',
    icon: 'food',
    group: 'lifestyle',
    keywords: [
      'khana', 'khaja', 'khaana', 'nasta', 'lunch', 'dinner', 'breakfast', 'food', 'momo', 'chiya',
      'chia', 'tea', 'coffee', 'restaurant', 'cafe', 'pizza', 'burger', 'chowmein', 'sekuwa', 'foodmandu',
      'खाना', 'खाजा', 'नास्ता', 'मम', 'चिया',
    ],
  },
  {
    key: 'groceries',
    kind: 'expense',
    icon: 'cart',
    group: 'essentials',
    keywords: [
      'tarkari', 'sabji', 'vegetable', 'vegetables', 'grocery', 'groceries', 'kirana', 'chamal', 'rice',
      'daal', 'dal', 'dudh', 'milk', 'fruit', 'fruits', 'phalphul', 'masu', 'meat', 'bhatbhateni', 'bigmart',
      'तरकारी', 'किराना', 'चामल', 'दाल', 'दुध', 'फलफूल', 'मासु',
    ],
  },
  {
    key: 'transport',
    kind: 'expense',
    icon: 'bus',
    group: 'transport',
    keywords: [
      'bus', 'taxi', 'pathao', 'indrive', 'tootle', 'micro', 'tempo', 'petrol', 'diesel', 'fuel', 'parking',
      'bhada-gadi', 'yatayat', 'flight', 'ticket', 'बस', 'ट्याक्सी', 'पेट्रोल', 'भाडा-गाडी',
    ],
  },
  {
    key: 'rent',
    kind: 'expense',
    icon: 'house',
    group: 'essentials',
    keywords: ['bhada', 'rent', 'kotha', 'flat', 'भाडा', 'कोठा'],
  },
  {
    key: 'utilities',
    kind: 'expense',
    icon: 'bolt',
    group: 'essentials',
    keywords: [
      'bijuli', 'electricity', 'nea', 'khanepani', 'water', 'gas', 'gyas', 'cylinder', 'fohor', 'garbage',
      'बिजुली', 'खानेपानी', 'ग्यास',
    ],
  },
  {
    key: 'internet_mobile',
    kind: 'expense',
    icon: 'wifi',
    group: 'subscriptions',
    keywords: [
      'internet', 'wifi', 'worldlink', 'vianet', 'classictech', 'subisu', 'recharge', 'topup', 'ntc',
      'ncell', 'data', 'रिचार्ज', 'इन्टरनेट',
    ],
  },
  {
    key: 'education',
    kind: 'expense',
    icon: 'school',
    group: 'essentials',
    keywords: ['school', 'college', 'fee', 'fees', 'tuition', 'kitab', 'book', 'books', 'exam', 'स्कुल', 'शुल्क', 'किताब'],
  },
  {
    key: 'health',
    kind: 'expense',
    icon: 'health',
    group: 'essentials',
    keywords: [
      'medicine', 'aushadhi', 'ausadhi', 'hospital', 'doctor', 'clinic', 'pharmacy', 'checkup', 'dentist',
      'औषधि', 'अस्पताल', 'डाक्टर',
    ],
  },
  {
    key: 'shopping',
    kind: 'expense',
    icon: 'bag',
    group: 'lifestyle',
    keywords: ['kapada', 'clothes', 'shoes', 'jutta', 'daraz', 'shopping', 'mobile', 'phone', 'कपडा', 'जुत्ता'],
  },
  {
    key: 'entertainment',
    kind: 'expense',
    icon: 'film',
    group: 'lifestyle',
    keywords: ['movie', 'cinema', 'netflix', 'party', 'picnic', 'game', 'trip', 'ghumna', 'घुम्न', 'पिकनिक'],
  },
  {
    key: 'festivals_gifts',
    kind: 'expense',
    icon: 'gift',
    group: 'lifestyle',
    keywords: [
      'dashain', 'tihar', 'teej', 'chhath', 'holi', 'gift', 'upahar', 'tika', 'dakshina', 'bihe', 'wedding',
      'दशैं', 'तिहार', 'तीज', 'उपहार', 'दक्षिणा', 'बिहे',
    ],
  },
  {
    key: 'family',
    kind: 'expense',
    icon: 'family',
    group: 'essentials',
    keywords: ['ghar', 'family', 'parivar', 'aama', 'buwa', 'घर', 'परिवार'],
  },
  {
    key: 'loan_savings',
    kind: 'expense',
    icon: 'bank',
    group: 'subscriptions',
    keywords: ['emi', 'loan', 'rin', 'kista', 'sahakari', 'dhukuti', 'saving', 'insurance', 'bima', 'ऋण', 'किस्ता', 'सहकारी', 'ढुकुटी', 'बिमा'],
  },
  { key: 'other_expense', kind: 'expense', icon: 'grid', group: 'other', keywords: [] },
  {
    key: 'salary',
    kind: 'income',
    icon: 'briefcase',
    group: 'income',
    keywords: ['salary', 'talab', 'payroll', 'तलब'],
  },
  {
    key: 'remittance',
    kind: 'income',
    icon: 'plane',
    group: 'income',
    keywords: ['remittance', 'remit', 'bidesh', 'videsh', 'विदेश', 'रेमिट्यान्स'],
  },
  {
    key: 'business',
    kind: 'income',
    icon: 'store',
    group: 'income',
    keywords: ['business', 'pasal', 'sales', 'byapar', 'commission', 'पसल', 'व्यापार'],
  },
  { key: 'other_income', kind: 'income', icon: 'cash', group: 'income', keywords: ['bonus', 'refund', 'interest', 'byaj', 'gift-received'] },
];

/** Only Cash is created up front; people add their own wallets and banks. */
export const DEFAULT_ACCOUNTS = [{ name: 'Cash', kind: 'cash' }] as const;

/** Pinned categories first, in the order they were pinned; the rest keep their order. */
export function orderByPins<T extends { id: number }>(items: T[], pinned: number[]): T[] {
  const rank = new Map(pinned.map((id, i) => [id, i]));
  return [...items].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
}

/** Adds `id` to the end of the pin list, or removes it if already pinned. */
export function togglePin(pinned: number[], id: number): number[] {
  return pinned.includes(id) ? pinned.filter((p) => p !== id) : [...pinned, id];
}
