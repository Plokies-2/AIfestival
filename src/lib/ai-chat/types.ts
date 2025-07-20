/**
 * Core types and interfaces for the AI Chat system
 * 
 * This module contains all TypeScript type definitions used across
 * the AI chat pipeline, ensuring type consistency and maintainability.
 */

import { NextApiRequest, NextApiResponse } from 'next';

// ============================================================================
// LSTM Data Types
// ============================================================================

/**
 * LSTM prediction data structure from the LSTM service
 */
export interface LSTMData {
  symbol: string;
  timestamp: string;
  prediction_data: {
    shock_level: string;
    shock_description: string;
    last_prediction: number;
    accuracy: number;
    model_type: string;
  };
  analysis: {
    ai_summary: string;
    explanation: string;
  };
}

// ============================================================================
// Session Management Types
// ============================================================================

/**
 * Pipeline stages for the conversation flow
 */
export type Stage = 'START' | 'SHOW_INDUSTRY' | 'ASK_CHART';

/**
 * Session state structure for maintaining conversation context
 */
export interface SessionState {
  stage: Stage;
  selectedIndustry: string | null;
  industryCompanies: string[]; // Exactly 5 tickers or all companies in industry
  selectedTicker: string | null;
  conversationHistory: Array<{
    user: string;
    ai: string;
    intent: string;
    timestamp: number;
  }>;
  lastActivity: number; // For session cleanup optimization
}

// ============================================================================
// AI Service Types
// ============================================================================

/**
 * User intent classification result
 */
export interface IntentClassificationResult {
  intent: 'greeting' | 'about_ai' | 'investment_query' | 'company_direct' | 'casual_chat' | 'investment_recommendation';
  confidence: number;
  reasoning: string;
}

/**
 * Persona response generation context
 */
export interface PersonaContext {
  userInput: string;
  intent: string;
  conversationHistory?: string;
}

// ============================================================================
// RAG and Embeddings Types
// ============================================================================

/**
 * RAG threshold configuration
 */
export interface RAGThresholds {
  INDUSTRY_MIN_SCORE: number;
  COMPANY_MIN_SCORE: number;
  GPT_FALLBACK_THRESHOLD: number;
  CASUAL_CONVERSATION_THRESHOLD: number;
}

/**
 * Industry matching result
 */
export interface IndustryMatchResult {
  industry: string | null;
  score: number;
  method: 'rag_industry' | 'rag_company' | 'gpt_classification' | 'casual_conversation';
}

// ============================================================================
// Company and Industry Types
// ============================================================================

/**
 * Company recommendation structure
 */
export interface CompanyRecommendation {
  ticker: string;
  name: string;
  description: string;
  translatedDescription?: string;
}

/**
 * Random investment recommendation result
 */
export interface RandomRecommendation {
  industry: string;
  companies: CompanyRecommendation[];
}

/**
 * Korean to English company name mapping
 */
export interface KoreanCompanyMapping {
  [koreanName: string]: string[];
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Parsed request data
 */
export interface ParsedRequest {
  userInput: string;
  sessionId: string;
  isNewSession: boolean;
}

/**
 * API response structure
 */
export interface ChatResponse {
  reply: string;
  symbol?: string;
  status?: 'showing_companies' | 'chart_requested';
  hasMore?: boolean;
}

/**
 * Pipeline processing context
 */
export interface PipelineContext {
  userInput: string;
  sessionId: string;
  state: SessionState;
  intentResult?: IntentClassificationResult;
}

/**
 * Stage handler result
 */
export interface StageHandlerResult {
  reply: string;
  newState: SessionState;
  shouldReturn?: boolean;
  additionalData?: {
    symbol?: string;
    status?: string;
    hasMore?: boolean;
  };
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * OpenAI configuration
 */
export interface OpenAIConfig {
  apiKey: string;
  model: string;
  embeddingModel: string;
}

/**
 * Pattern matching configuration
 */
export interface PatternConfig {
  positive: RegExp;
  negative: RegExp;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Company data structure from the S&P 500 dataset
 */
export interface CompanyData {
  name: string;
  industry: string;
  description: string;
}

/**
 * Enhanced API request with Next.js types
 */
export interface EnhancedNextApiRequest extends NextApiRequest {
  cookies: {
    sessionId?: string;
  };
}

/**
 * Enhanced API response with Next.js types
 */
export interface EnhancedNextApiResponse extends NextApiResponse {
  // Additional response methods can be added here if needed
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Custom error types for the AI chat system
 */
export class AIChatError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AIChatError';
  }
}

/**
 * Session error types
 */
export class SessionError extends AIChatError {
  constructor(message: string) {
    super(message, 'SESSION_ERROR', 400);
  }
}

/**
 * AI service error types
 */
export class AIServiceError extends AIChatError {
  constructor(message: string) {
    super(message, 'AI_SERVICE_ERROR', 503);
  }
}

/**
 * RAG service error types
 */
export class RAGServiceError extends AIChatError {
  constructor(message: string) {
    super(message, 'RAG_SERVICE_ERROR', 500);
  }
}
