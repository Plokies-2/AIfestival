/**
 * AI Chat System - Public API
 * 
 * This module exports the public interface for the AI chat system.
 * It provides a clean, modular API while maintaining backward compatibility.
 */

// ============================================================================
// Main Request Handler (Primary Export)
// ============================================================================

export { 
  handleChatRequest,
  resetSessionAfterChart,
  getSessionStatistics,
  performHealthCheck
} from './request-handler';

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Core types
  LSTMData,
  Stage,
  SessionState,
  IntentClassificationResult,
  PersonaContext,
  RAGThresholds,
  IndustryMatchResult,
  CompanyRecommendation,
  RandomRecommendation,
  KoreanCompanyMapping,
  ParsedRequest,
  ChatResponse,
  PipelineContext,
  StageHandlerResult,
  OpenAIConfig,
  PatternConfig,
  CompanyData,
  
  // Error types
  AIChatError,
  SessionError,
  AIServiceError,
  RAGServiceError
} from './types';

// ============================================================================
// Configuration Exports
// ============================================================================

export {
  RAG_THRESHOLDS,
  PATTERNS,
  OPENAI_CONFIG,
  SESSION_CONFIG,
  PERFORMANCE_CONFIG,
  KOREAN_COMPANY_MAPPING,
  WELCOME_MESSAGES,
  ENV_CONFIG
} from './config';

// ============================================================================
// Session Management Exports
// ============================================================================

export {
  createNewSession,
  generateSessionId,
  getSession,
  updateSession,
  deleteSession,
  resetSession,
  sessionExists,
  getActiveSessionCount,
  addConversationEntry,
  getRecentConversationContext,
  clearConversationHistory,
  cleanupOldSessions,
  triggerSessionCleanup,
  startSessionCleanup,
  stopSessionCleanup,
  clearAllSessions,
  updateSessionStage,
  updateSelectedIndustry,
  updateIndustryCompanies,
  updateSelectedTicker,
  getSessionStats,
  initializeSessionManager,
  shutdownSessionManager,
  resetSessionToStart
} from './session-manager';

// ============================================================================
// AI Service Exports
// ============================================================================

export {
  classifyUserIntent,
  generateDynamicResponse
} from './ai-service';

// ============================================================================
// RAG Service Exports
// ============================================================================

export {
  findBestIndustry,
  // findCompanyInAllData, // 주석처리: Company Direct Match 완전 제거
  findTickerInText,
  getIndustryCompanies,
  getCompanyName,
  getCompanyData,
  getAllAvailableIndustries,
  testRAGThresholds
} from './rag-service';

// ============================================================================
// LSTM Service Exports
// ============================================================================

export {
  getLSTMDataForSymbol,
  getAvailableLSTMSymbols,
  enhanceResponseWithLSTMData,
  getDetailedLSTMAnalysis,
  isLSTMDataAvailable,
  getBatchLSTMData,
  formatLSTMDataForDisplay,
  checkLSTMServiceHealth,
  lstmSymbolCache,
  getCachedAvailableLSTMSymbols,
  shouldEnhanceWithLSTM,
  getLSTMAvailabilitySummary
} from './lstm-service';

// ============================================================================
// Company Utilities Exports
// ============================================================================

export {
  isPositive,
  isNegative,
  getResponseType,
  getCompanyName as getCompanyNameUtil,
  getCompanyData as getCompanyDataUtil,
  isValidTicker,
  getAllTickers,
  getCompaniesByIndustry,
  generateRandomRecommendation,
  generateMultipleRecommendations,
  formatCompanyDisplay,
  formatCompanyList,

  formatCompanyDescriptions,
  getIndustryStats,
  getTopIndustries,
  getCompaniesWithDetailedDescriptions,
  searchCompaniesByName,
  filterCompanies,
  validateCompanyData,
  getDatasetStats
} from './company-utils';

// ============================================================================
// Pipeline Handlers Exports (for advanced usage)
// ============================================================================

export {
  handleStartStage,
  handleShowIndustryStage,
  handleAskChartStage
} from './pipeline-handlers';

// ============================================================================
// Backward Compatibility Exports
// ============================================================================

/**
 * Legacy function exports for backward compatibility
 * These maintain the same interface as the original ai_chat.ts
 */

// Main handler (same interface as original)
export { handleChatRequest as default } from './request-handler';

// Configuration export (same as original)
export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

// ============================================================================
// Utility Functions for Testing and Debugging
// ============================================================================

/**
 * Creates a test context for pipeline testing
 */
export function createTestContext(
  userInput: string,
  sessionId: string = 'test-session',
  stage: Stage = 'START'
): PipelineContext {
  const { createNewSession } = require('./session-manager');
  const state = createNewSession();
  state.stage = stage;
  
  return {
    userInput,
    sessionId,
    state
  };
}



/**
 * Validates the system configuration
 */
export function validateSystemConfiguration(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check environment variables
  if (!process.env.OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY environment variable is not set');
  }
  
  // Check data availability
  try {
    const { QUICK_ENRICHED_FINAL } = require('@/data/sp500_enriched_final');
    if (!QUICK_ENRICHED_FINAL || Object.keys(QUICK_ENRICHED_FINAL).length === 0) {
      errors.push('S&P 500 data is not available or empty');
    }
  } catch (error) {
    errors.push('Failed to load S&P 500 data');
  }
  
  // 임베딩 시스템 검증 제거 - 필요할 때 로드되며 적절한 에러 메시지 제공
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Gets system information
 */
export function getSystemInfo(): {
  version: string;
  modules: string[];
  configuration: Record<string, any>;
  stats: Record<string, any>;
} {
  const modules = [
    'types',
    'config', 
    'session-manager',
    'ai-service',
    'rag-service',
    'lstm-service',
    'company-utils',
    'pipeline-handlers',
    'request-handler'
  ];
  
  const configuration = {
    ragThresholds: RAG_THRESHOLDS,
    sessionConfig: SESSION_CONFIG,
    performanceConfig: PERFORMANCE_CONFIG
  };
  
  let stats = {};
  try {
    stats = getSessionStatistics();
  } catch (error) {
    stats = { error: 'Failed to get session statistics' };
  }
  
  return {
    version: '2.0.0', // Refactored version
    modules,
    configuration,
    stats
  };
}

// ============================================================================
// Module Initialization
// ============================================================================

/**
 * Initializes the AI chat system
 * This is called automatically when the module is imported
 */
function initializeSystem(): void {
  try {
    // Session manager is auto-initialized
    console.log('🚀 AI Chat System initialized successfully');

    // Validate configuration (동기 검증)
    const validation = validateSystemConfiguration();
    if (!validation.isValid) {
      console.error('❌ System configuration validation failed:', validation.errors);
    }
    if (validation.warnings.length > 0) {
      console.warn('⚠️ System configuration warnings:', validation.warnings);
    }

    // 임베딩 시스템은 필요할 때 로드됨 (검증 제거)

  } catch (error) {
    console.error('❌ Failed to initialize AI Chat System:', error);
  }
}

// Auto-initialize when module is imported
initializeSystem();
