import { classifyUserIntent } from '../src/server/chat/intent';
import { describe, it, expect } from 'vitest';

describe('intent', () => {
  it('detects greeting', async () => {
    const result = await classifyUserIntent('안녕하세요');
    expect(result.intent).toBe('greeting');
  });
});
