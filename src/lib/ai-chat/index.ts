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
  Stage,
  SessionState,
  IntentClassificationResult,
  PersonaContext,
  RAGThresholds,
  // IndustryMatchResult 제거됨 - 사용되지 않는 타입
  CompanyRecommendation,
  RandomRecommendation,
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
  AIServiceError
  // RAGServiceError 제거됨 - 사용되지 않는 에러 타입
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
  findBestIndustries,
  getIndustryCompanies,
  getCompanyName,
  getCompanyData,
  getAllAvailableIndustries
} from './rag-service';



// ============================================================================
// Company Utilities Exports
// ============================================================================

export {
  isPositive,
  isNegative,
  getCompanyName as getCompanyNameUtil,
  getCompanyData as getCompanyDataUtil,
  isValidTicker,
  getAllTickers,
  getCompaniesByIndustry,
  formatCompanyList
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

// 테스트 함수 제거됨 - 프로덕션에서 사용되지 않음



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
  
  // KOSPI 데이터 검증은 필요할 때 수행됨
  
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
    'company-utils',
    'pipeline-handlers',
    'request-handler'
  ];
  
  const configuration = {
    note: 'Configuration details available through individual service modules'
  };

  let stats = {};
  try {
    const { getSessionStatistics } = require('./request-handler');
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
