// src/pages/api/ai_chat.ts
//-----------------------------------------------------------
// AI Chat API - Refactored Modular Architecture
//
// This file now serves as a thin wrapper around the modular AI chat system.
// The core functionality has been extracted into separate, focused modules
// for better maintainability, testability, and code organization.
//
// Key improvements:
// - Separated concerns into focused modules (types, config, session-manager, etc.)
// - Improved type safety and error handling
// - Better session management with automatic cleanup
// - Enhanced performance optimization
// - Cleaner code organization following Single Responsibility Principle
// - Maintained backward compatibility with existing API interface
//
// Module Structure:
// ├── types.ts                    # All TypeScript interfaces and types
// ├── config.ts                   # Configuration constants and patterns
// ├── session-manager.ts          # Session state management and cleanup
// ├── ai-service.ts              # OpenAI integration and AI responses
// ├── rag-service.ts             # RAG, embeddings, and industry matching
// ├── lstm-service.ts            # LSTM data integration
// ├── company-utils.ts           # Company lookup and utilities
// ├── pipeline-handlers.ts       # Stage-specific logic handlers
// ├── request-handler.ts         # Main request orchestration
// └── index.ts                   # Public API exports
//-----------------------------------------------------------

import { NextApiRequest, NextApiResponse } from 'next';
import { handleChatRequest } from '@/lib/ai-chat';

//-----------------------------------------------------------
// API Configuration
//-----------------------------------------------------------
// bodyParser configuration to support JSON parsing
export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

//-----------------------------------------------------------
// Main API Handler
//-----------------------------------------------------------
/**
 * Main API handler for AI chat requests
 *
 * This handler delegates all processing to the modular AI chat system
 * while maintaining the same external API interface as the original implementation.
 *
 * The modular system provides:
 * - Session management with automatic cleanup
 * - Intent classification and persona-based responses
 * - RAG-based industry and company matching
 * - LSTM data integration for enhanced analysis
 * - Multi-stage pipeline processing (START → SHOW_INDUSTRY → ASK_CHART)
 * - Comprehensive error handling and logging
 *
 * Data Flow:
 * 1. Request Handler receives HTTP request
 * 2. Session Manager handles session state
 * 3. Pipeline Handlers determine stage-specific logic
 * 4. AI Service handles intent classification and responses
 * 5. RAG Service performs industry/company matching
 * 6. LSTM Service enhances responses with predictions
 * 7. Company Utils provides lookup functionality
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await handleChatRequest(req, res);
}

//-----------------------------------------------------------
// Legacy Exports for Backward Compatibility
//-----------------------------------------------------------

// Re-export commonly used functions for backward compatibility
export {
  resetSessionAfterChart,
  // testRAGThresholds 제거됨 - 디버깅용 함수로 프로덕션에서 사용되지 않음
  getSessionStatistics,
  performHealthCheck
} from '@/lib/ai-chat';