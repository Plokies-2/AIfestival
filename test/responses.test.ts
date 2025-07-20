process.env.OPENAI_API_KEY="test";
import { generateFallbackPersonaResponse } from '../src/server/chat/responses';
import { describe, it, expect } from 'vitest';

describe('responses', () => {
  it('returns fallback greeting', () => {
    const r = generateFallbackPersonaResponse('hi', 'greeting');
    expect(typeof r).toBe('string');
  });
});
