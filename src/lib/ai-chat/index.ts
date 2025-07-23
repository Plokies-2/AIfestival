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
  startSessionCleanup,
  stopSessionCleanup,
  clearAllSessions,
  updateSessionStage,
  updateSelectedIndustry,
  updateIndustryCompanies,
  updateSelectedTicker,
  getSessionStats,
  initializeSessionManager,
  shutdownSessionManager
} from './session-manager';

// ============================================================================
// AI Service Exports
// ============================================================================

export {
  classifyUserIntent,
  classifyIndustryWithGPT,
  translateDescription,
  generatePersonaResponse
} from './ai-service';

// ============================================================================
// RAG Service Exports
// ============================================================================

export {
  findBestIndustry,
  findCompanyInAllData,
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
  translateAndFormatRecommendations,
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
 * 비동기 임베딩 시스템 검증 함수
 */
export async function validateEmbeddingsSystem(): Promise<{
  isAvailable: boolean;
  cacheExists: boolean;
  error?: string;
}> {
  try {
    const fs = require('fs');
    const path = require('path');
    const { getEmbeddings } = require('@/lib/embeddings');

    const cacheFile = path.join(process.cwd(), '.cache', 'sp500_vectors.json');
    const cacheExists = fs.existsSync(cacheFile);

    // 임베딩 함수 실제 호출 테스트 (캐시가 있으면 빠르게 완료됨)
    if (cacheExists) {
      await getEmbeddings();
      return { isAvailable: true, cacheExists: true };
    } else {
      // 캐시가 없으면 함수만 확인
      return {
        isAvailable: typeof getEmbeddings === 'function',
        cacheExists: false
      };
    }
  } catch (error) {
    return {
      isAvailable: false,
      cacheExists: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
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
  
  // Check embeddings - 임베딩 캐시 파일 존재 여부 확인 (함수 호출 없이)
  try {
    const fs = require('fs');
    const path = require('path');

    // 임베딩 캐시 파일 존재 여부만 확인 (함수 호출 없이)
    const cacheFile = path.join(process.cwd(), '.cache', 'sp500_vectors.json');
    if (!fs.existsSync(cacheFile)) {
      warnings.push('Embeddings cache file not found - will be created on first use');
    }
    // 캐시 파일이 존재하면 임베딩 시스템이 정상적으로 작동할 것으로 판단
  } catch (error) {
    warnings.push('Embeddings module may not be available');
  }
  
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

    // 비동기 임베딩 시스템 검증 (백그라운드에서 실행)
    validateEmbeddingsSystem()
      .then((embeddingValidation) => {
        if (embeddingValidation.isAvailable) {
          console.log('✅ Embeddings system is available');
          if (embeddingValidation.cacheExists) {
            console.log('📁 Embeddings cache file found');
          } else {
            console.log('📁 Embeddings cache will be created on first use');
          }
        } else {
          console.warn('⚠️ Embeddings system may not be available:', embeddingValidation.error);
        }
      })
      .catch((error) => {
        console.warn('⚠️ Failed to validate embeddings system:', error);
      });

  } catch (error) {
    console.error('❌ Failed to initialize AI Chat System:', error);
  }
}

// Auto-initialize when module is imported
initializeSystem();
