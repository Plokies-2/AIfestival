import { getLSTMDataForSymbol } from '../src/server/chat/lstm';
import { describe, it, expect } from 'vitest';

describe('lstm', () => {
  it('returns null when symbol invalid', async () => {
    const data = await getLSTMDataForSymbol('INVALID');
    expect(data).toBeNull();
  });
});
