import { SESSIONS, cleanupOldSessions, SessionState } from '../src/server/chat/session';
import { describe, it, expect, beforeAll } from 'vitest';

describe('session utilities', () => {
  beforeAll(() => {
    const old: SessionState = { stage: 'START', selectedIndustry: null, industryCompanies: [], selectedTicker: null, conversationHistory: [], lastActivity: Date.now() - 31 * 60 * 1000 };
    SESSIONS.set('old', old);
  });

  it('cleans up old sessions', () => {
    cleanupOldSessions();
    expect(SESSIONS.has('old')).toBe(false);
  });
});
