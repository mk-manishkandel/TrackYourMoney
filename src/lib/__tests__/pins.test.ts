import { orderByPins, togglePin } from '@/lib/categories';

const items = [1, 2, 3, 4, 5].map((id) => ({ id }));

describe('category pins', () => {
  it('keeps the original order with no pins', () => {
    expect(orderByPins(items, []).map((c) => c.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('puts pinned items first in pin order, the rest unchanged', () => {
    expect(orderByPins(items, [4, 2]).map((c) => c.id)).toEqual([4, 2, 1, 3, 5]);
  });

  it('ignores pins for items that are not in the list', () => {
    expect(orderByPins(items, [99, 3]).map((c) => c.id)).toEqual([3, 1, 2, 4, 5]);
  });

  it('toggles a pin on and off', () => {
    expect(togglePin([4], 2)).toEqual([4, 2]);
    expect(togglePin([4, 2], 4)).toEqual([2]);
  });
});
