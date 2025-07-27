/**
 * Simplified Session Management Module
 *
 * Single-user application with simplified state management:
 * - Single global session state
 * - No session cleanup needed
 * - Simplified conversation history
 * - No complex session ID management
 */

import { SessionState, Stage } from './types';

// ============================================================================
// Single Global Session State
// ============================================================================

/**
 * Single global session state for single-user application
 * No need for complex session ID management
 */
let GLOBAL_SESSION_STATE: SessionState = {
  stage: 'START',
  selectedIndustry: null,
  industryCompanies: [],
  selectedTicker: null,
  conversationHistory: [],
  lastActivity: Date.now()
};

// 더보기 기능 제거됨 - 산업군 캐시 불필요

console.log('🚀 Simplified session manager initialized with global state');

// ============================================================================
// Session Management Functions
// ============================================================================

/**
 * Creates/resets the global session state
 */
export function createNewSession(): SessionState {
  GLOBAL_SESSION_STATE = {
    stage: 'START',
    selectedIndustry: null,
    industryCompanies: [],
    selectedTicker: null,
    conversationHistory: [],
    lastActivity: Date.now()
  };

  console.log(`✅ Reset global session state`);
  return GLOBAL_SESSION_STATE;
}

/**
 * Generates a dummy session ID for compatibility
 */
export function generateSessionId(): string {
  return 'global-session';
}

/**
 * Retrieves the global session state
 */
export function getSession(_sessionId?: string): SessionState {
  // Update last activity
  GLOBAL_SESSION_STATE.lastActivity = Date.now();

  console.log(`🔍 [세션 상태] 현재:`, {
    stage: GLOBAL_SESSION_STATE.stage,
    industry: GLOBAL_SESSION_STATE.selectedIndustry,
    companies: GLOBAL_SESSION_STATE.industryCompanies.length
  });

  return GLOBAL_SESSION_STATE;
}

/**
 * Updates the global session state
 */
export function updateSession(_sessionId: string, newState: Partial<SessionState>): SessionState {
  const previousState = { ...GLOBAL_SESSION_STATE };

  GLOBAL_SESSION_STATE = {
    ...GLOBAL_SESSION_STATE,
    ...newState,
    lastActivity: Date.now()
  };

  console.log(`🔄 [세션 업데이트]`, {
    stage: `${previousState.stage} → ${GLOBAL_SESSION_STATE.stage}`,
    industry: `${previousState.selectedIndustry} → ${GLOBAL_SESSION_STATE.selectedIndustry}`,
    companies: `${previousState.industryCompanies.length} → ${GLOBAL_SESSION_STATE.industryCompanies.length}`
  });

  return GLOBAL_SESSION_STATE;
}

/**
 * Compatibility function - no-op for single session
 */
export function deleteSession(_sessionId: string): boolean {
  return true;
}

/**
 * Resets the global session state
 */
export function resetSession(_sessionId: string, preserveHistory: boolean = true): SessionState {
  const conversationHistory = preserveHistory ? GLOBAL_SESSION_STATE.conversationHistory : [];

  GLOBAL_SESSION_STATE = {
    stage: 'START',
    selectedIndustry: null,
    industryCompanies: [],
    selectedTicker: null,
    conversationHistory,
    lastActivity: Date.now()
  };

  // 더보기 기능 제거됨 - 산업군 캐시 초기화 불필요
  console.log(`🔄 Reset global session state (preserve history: ${preserveHistory})`);
  return GLOBAL_SESSION_STATE;
}

/**
 * Compatibility function - always true for single session
 */
export function sessionExists(_sessionId: string): boolean {
  return true;
}

/**
 * Always returns 1 for single session
 */
export function getActiveSessionCount(): number {
  return 1;
}

// ============================================================================
// Conversation History Management
// ============================================================================

/**
 * Adds a conversation entry to the global session history
 */
export function addConversationEntry(
  sessionId: string,
  userInput: string,
  aiResponse: string,
  intent: string
): void {
  GLOBAL_SESSION_STATE.conversationHistory.push({
    user: userInput,
    ai: aiResponse,
    intent,
    timestamp: Date.now()
  });

  // Limit history size to prevent memory bloat (keep last 10 entries)
  if (GLOBAL_SESSION_STATE.conversationHistory.length > 10) {
    GLOBAL_SESSION_STATE.conversationHistory = GLOBAL_SESSION_STATE.conversationHistory.slice(-10);
  }

  GLOBAL_SESSION_STATE.lastActivity = Date.now();
}

/**
 * Gets recent conversation history for context generation
 */
export function getRecentConversationContext(sessionId: string): string | undefined {
  const recentHistory = GLOBAL_SESSION_STATE.conversationHistory.slice(-5);

  if (recentHistory.length === 0) {
    return undefined;
  }

  return recentHistory
    .map(entry => `사용자: ${entry.user} → AI: ${entry.ai}`)
    .join('\n');
}

/**
 * Clears conversation history for the global session
 */
export function clearConversationHistory(sessionId: string): void {
  GLOBAL_SESSION_STATE.conversationHistory = [];
  GLOBAL_SESSION_STATE.lastActivity = Date.now();
  console.log('🧹 Cleared conversation history');
}

// ============================================================================
// Simplified Session Management (No Cleanup Needed)
// ============================================================================

/**
 * No-op cleanup function for compatibility
 * Single session doesn't need cleanup
 */
export function cleanupOldSessions(): number {
  console.log('ℹ️ No session cleanup needed for single-user application');
  return 0;
}

/**
 * No-op cleanup trigger for compatibility
 */
export function triggerSessionCleanup(reason: 'page_refresh' | 'logo_click' | 'manual'): number {
  console.log(`ℹ️ Session cleanup not needed for single-user app (reason: ${reason})`);
  return 0;
}

/**
 * Compatibility function - no-op
 */
export function startSessionCleanup(): NodeJS.Timeout {
  return setTimeout(() => {}, 0);
}

/**
 * Compatibility function - no-op
 */
export function stopSessionCleanup(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId);
}

/**
 * Resets the global session state
 */
export function clearAllSessions(): number {
  GLOBAL_SESSION_STATE = {
    stage: 'START',
    selectedIndustry: null,
    industryCompanies: [],
    selectedTicker: null,
    conversationHistory: [],
    lastActivity: Date.now()
  };
  console.log('🗑️ Reset global session state');
  return 1;
}

// ============================================================================
// Session State Utilities
// ============================================================================

/**
 * Updates the stage of the global session
 */
export function updateSessionStage(sessionId: string, stage: Stage): void {
  GLOBAL_SESSION_STATE.stage = stage;
  GLOBAL_SESSION_STATE.lastActivity = Date.now();
}

/**
 * Updates the selected industry for the global session
 */
export function updateSelectedIndustry(sessionId: string, industry: string | null): void {
  GLOBAL_SESSION_STATE.selectedIndustry = industry;
  GLOBAL_SESSION_STATE.lastActivity = Date.now();

  // 더보기 기능 제거됨 - 산업군 캐시 업데이트 불필요
}

/**
 * Updates the industry companies list for the global session
 */
export function updateIndustryCompanies(sessionId: string, companies: string[]): void {
  GLOBAL_SESSION_STATE.industryCompanies = companies;
  GLOBAL_SESSION_STATE.lastActivity = Date.now();
}

/**
 * Updates the selected ticker for the global session
 */
export function updateSelectedTicker(sessionId: string, ticker: string | null): void {
  GLOBAL_SESSION_STATE.selectedTicker = ticker;
  GLOBAL_SESSION_STATE.lastActivity = Date.now();
}

/**
 * Gets session statistics for monitoring (simplified for single session)
 */
export function getSessionStats(): {
  totalSessions: number;
  sessionsByStage: Record<Stage, number>;
  averageHistoryLength: number;
  oldestSessionAge: number;
} {
  const now = Date.now();
  const sessionsByStage: Record<Stage, number> = {
    'START': 0,
    'SHOW_INDUSTRY': 0,
    'ASK_CHART': 0
  };

  sessionsByStage[GLOBAL_SESSION_STATE.stage] = 1;

  return {
    totalSessions: 1,
    sessionsByStage,
    averageHistoryLength: GLOBAL_SESSION_STATE.conversationHistory.length,
    oldestSessionAge: now - GLOBAL_SESSION_STATE.lastActivity
  };
}

// ============================================================================
// Simplified Session Initialization
// ============================================================================

/**
 * Initializes the simplified session manager
 */
export function initializeSessionManager(): void {
  console.log('🚀 Simplified session manager initialized (single global session)');
}

/**
 * Shuts down the session manager
 */
export function shutdownSessionManager(): void {
  console.log('🛑 Session manager shutdown');
  clearAllSessions();
}

/**
 * Resets session to START state (for logo clicks and page refresh)
 */
export function resetSessionToStart(sessionId: string): SessionState {
  console.log(`🔄 Resetting global session to START state`);
  // 더보기 기능 제거됨 - 산업군 캐시 초기화 불필요
  return resetSession(sessionId, true); // Preserve conversation history
}

// 더보기 기능 완전 제거됨 - 산업군 캐시 관련 모든 함수 제거

// Auto-initialize when module is imported
initializeSessionManager();
