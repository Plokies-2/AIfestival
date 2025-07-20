/**
 * Session Management Module
 * 
 * This module handles all session-related functionality including:
 * - Session state storage and retrieval
 * - Session cleanup and memory management
 * - Conversation history management
 * - Session lifecycle operations
 */

import { v4 as uuid } from 'uuid';
import { SessionState, Stage } from './types';
import { SESSION_CONFIG } from './config';

// ============================================================================
// Session Storage
// ============================================================================

/**
 * In-memory session storage
 * In production, this could be replaced with Redis or another persistent store
 */
const SESSIONS = new Map<string, SessionState>();

// ============================================================================
// Session Management Functions
// ============================================================================

/**
 * Creates a new session with default state
 */
export function createNewSession(): SessionState {
  return {
    stage: 'START',
    selectedIndustry: null,
    industryCompanies: [],
    selectedTicker: null,
    conversationHistory: [],
    lastActivity: Date.now()
  };
}

/**
 * Generates a new unique session ID
 */
export function generateSessionId(): string {
  return uuid();
}

/**
 * Retrieves session state by session ID
 * Creates a new session if none exists
 */
export function getSession(sessionId: string): SessionState {
  let state = SESSIONS.get(sessionId);
  
  if (!state) {
    state = createNewSession();
    SESSIONS.set(sessionId, state);
  }
  
  // Update last activity timestamp
  state.lastActivity = Date.now();
  
  return state;
}

/**
 * Updates session state
 */
export function updateSession(sessionId: string, state: SessionState): void {
  state.lastActivity = Date.now();
  SESSIONS.set(sessionId, state);
}

/**
 * Deletes a session
 */
export function deleteSession(sessionId: string): boolean {
  return SESSIONS.delete(sessionId);
}

/**
 * Resets a session to initial state while preserving conversation history
 */
export function resetSession(sessionId: string, preserveHistory: boolean = true): SessionState {
  const existingState = SESSIONS.get(sessionId);
  const conversationHistory = preserveHistory && existingState 
    ? existingState.conversationHistory 
    : [];

  const newState: SessionState = {
    stage: 'START',
    selectedIndustry: null,
    industryCompanies: [],
    selectedTicker: null,
    conversationHistory,
    lastActivity: Date.now()
  };

  SESSIONS.set(sessionId, newState);
  return newState;
}

/**
 * Checks if a session exists
 */
export function sessionExists(sessionId: string): boolean {
  return SESSIONS.has(sessionId);
}

/**
 * Gets the total number of active sessions
 */
export function getActiveSessionCount(): number {
  return SESSIONS.size;
}

// ============================================================================
// Conversation History Management
// ============================================================================

/**
 * Adds a conversation entry to the session history
 */
export function addConversationEntry(
  sessionId: string,
  userInput: string,
  aiResponse: string,
  intent: string
): void {
  const state = getSession(sessionId);
  
  state.conversationHistory.push({
    user: userInput,
    ai: aiResponse,
    intent,
    timestamp: Date.now()
  });

  // Limit history size to prevent memory bloat
  if (state.conversationHistory.length > SESSION_CONFIG.maxHistorySize) {
    state.conversationHistory = state.conversationHistory.slice(-SESSION_CONFIG.maxHistorySize);
  }

  updateSession(sessionId, state);
}

/**
 * Gets recent conversation history for context generation
 */
export function getRecentConversationContext(sessionId: string): string | undefined {
  const state = getSession(sessionId);
  const recentHistory = state.conversationHistory.slice(-SESSION_CONFIG.recentHistorySize);
  
  if (recentHistory.length === 0) {
    return undefined;
  }

  return recentHistory
    .map(entry => `사용자: ${entry.user} → AI: ${entry.ai}`)
    .join('\n');
}

/**
 * Clears conversation history for a session
 */
export function clearConversationHistory(sessionId: string): void {
  const state = getSession(sessionId);
  state.conversationHistory = [];
  updateSession(sessionId, state);
}

// ============================================================================
// Session Cleanup
// ============================================================================

/**
 * Cleans up old sessions based on last activity timestamp
 * This prevents memory leaks from abandoned sessions
 */
export function cleanupOldSessions(): number {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [sessionId, session] of SESSIONS.entries()) {
    if (now - session.lastActivity > SESSION_CONFIG.maxAge) {
      SESSIONS.delete(sessionId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} old sessions. Active sessions: ${SESSIONS.size}`);
  }

  return cleanedCount;
}

/**
 * Starts the periodic session cleanup process
 */
export function startSessionCleanup(): NodeJS.Timeout {
  console.log(`🔄 Starting session cleanup with ${SESSION_CONFIG.cleanupInterval}ms interval`);
  
  return setInterval(() => {
    cleanupOldSessions();
  }, SESSION_CONFIG.cleanupInterval);
}

/**
 * Stops the periodic session cleanup process
 */
export function stopSessionCleanup(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId);
  console.log('🛑 Session cleanup stopped');
}

/**
 * Forces cleanup of all sessions (useful for testing or shutdown)
 */
export function clearAllSessions(): number {
  const count = SESSIONS.size;
  SESSIONS.clear();
  console.log(`🗑️ Cleared all ${count} sessions`);
  return count;
}

// ============================================================================
// Session State Utilities
// ============================================================================

/**
 * Updates the stage of a session
 */
export function updateSessionStage(sessionId: string, stage: Stage): void {
  const state = getSession(sessionId);
  state.stage = stage;
  updateSession(sessionId, state);
}

/**
 * Updates the selected industry for a session
 */
export function updateSelectedIndustry(sessionId: string, industry: string | null): void {
  const state = getSession(sessionId);
  state.selectedIndustry = industry;
  updateSession(sessionId, state);
}

/**
 * Updates the industry companies list for a session
 */
export function updateIndustryCompanies(sessionId: string, companies: string[]): void {
  const state = getSession(sessionId);
  state.industryCompanies = companies;
  updateSession(sessionId, state);
}

/**
 * Updates the selected ticker for a session
 */
export function updateSelectedTicker(sessionId: string, ticker: string | null): void {
  const state = getSession(sessionId);
  state.selectedTicker = ticker;
  updateSession(sessionId, state);
}

/**
 * Gets session statistics for monitoring
 */
export function getSessionStats(): {
  totalSessions: number;
  sessionsByStage: Record<Stage, number>;
  averageHistoryLength: number;
  oldestSessionAge: number;
} {
  const sessions = Array.from(SESSIONS.values());
  const now = Date.now();
  
  const sessionsByStage: Record<Stage, number> = {
    'START': 0,
    'SHOW_INDUSTRY': 0,
    'ASK_CHART': 0
  };

  let totalHistoryLength = 0;
  let oldestSessionAge = 0;

  for (const session of sessions) {
    sessionsByStage[session.stage]++;
    totalHistoryLength += session.conversationHistory.length;
    
    const age = now - session.lastActivity;
    if (age > oldestSessionAge) {
      oldestSessionAge = age;
    }
  }

  return {
    totalSessions: sessions.length,
    sessionsByStage,
    averageHistoryLength: sessions.length > 0 ? totalHistoryLength / sessions.length : 0,
    oldestSessionAge
  };
}

// ============================================================================
// Session Initialization
// ============================================================================

// Start the cleanup process when the module is loaded
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Initializes the session manager
 */
export function initializeSessionManager(): void {
  if (!cleanupInterval) {
    cleanupInterval = startSessionCleanup();
  }
}

/**
 * Shuts down the session manager
 */
export function shutdownSessionManager(): void {
  if (cleanupInterval) {
    stopSessionCleanup(cleanupInterval);
    cleanupInterval = null;
  }
  clearAllSessions();
}

// Auto-initialize when module is imported
initializeSessionManager();
