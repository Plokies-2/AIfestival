export type Stage = 'START' | 'SHOW_INDUSTRY' | 'ASK_CHART';

export interface SessionState {
  stage: Stage;
  selectedIndustry: string | null;
  industryCompanies: string[];
  selectedTicker: string | null;
  conversationHistory: Array<{
    user: string;
    ai: string;
    intent: string;
    timestamp: number;
  }>;
  lastActivity: number;
}

export const SESSIONS = new Map<string, SessionState>();

const THIRTY_MINUTES = 30 * 60 * 1000;

export function cleanupOldSessions() {
  const now = Date.now();
  for (const [id, session] of SESSIONS.entries()) {
    if (now - session.lastActivity > THIRTY_MINUTES) {
      SESSIONS.delete(id);
    }
  }
}

setInterval(cleanupOldSessions, 5 * 60 * 1000);
