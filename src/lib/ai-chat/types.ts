/**
 * Core types and interfaces for the AI Chat system
 * 
 * This module contains all TypeScript type definitions used across
 * the AI chat pipeline, ensuring type consistency and maintainability.
 */

import { NextApiRequest, NextApiResponse } from 'next';



// ============================================================================
// Session Management Types
// ============================================================================

/**
 * Pipeline stages for the conversation flow
 */
export type Stage = 'START' | 'SHOW_INDUSTRY' | 'ASK_CHART';

/**
 * Analysis progress tracking for real-time thinking box
 */
export interface AnalysisProgress {
  step: string;
  message: string;
  icon?: string;
  detail?: string;
  timestamp: number;
  completed: boolean;
}

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
  lastActivity: number;
  lastLogTime?: number; // 로깅 제한을 위한 마지막 로그 시간 // For session cleanup optimization
  pendingDetailedAnalysis?: any; // 상세 분석 대기 데이터
  analysisProgress?: AnalysisProgress[]; // 분석 진행 상황 히스토리
  currentProgress?: AnalysisProgress; // 현재 진행 상황
  isAnalyzing?: boolean; // 분석 진행 중 여부
  // 1차 응답에서 실제로 추천된 산업들 (2차 응답에서 사용)
  recommendedIndustries?: Array<{
    industry_ko: string;
    score: number;
    companies: Array<{
      ticker: string;
      name: string;
      industry: string;
    }>;
  }>;
}

// ============================================================================
// AI Service Types
// ============================================================================

/**
 * User intent classification result
 */
export interface IntentClassificationResult {
  intent: 'greeting' | 'about_ai' | 'investment_query' | 'casual_chat';
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
 * RAG threshold configuration (최적화됨)
 * 사용되지 않는 임계값들을 제거하여 타입 안전성 향상
 * 현재 활성화된 RAG 로직에서 실제로 사용되는 임계값들만 정의
 */
export interface RAGThresholds {
  // 1차 의도 분류
  CASUAL_CONVERSATION_THRESHOLD: number; // findBestIndustries에서 사용

  // 페르소나 분류
  PERSONA_MIN_SCORE: number; // findBestPersona에서 사용

  // 투자 의도 분류
  INVESTMENT_INTENT_MIN_SCORE: number; // classifyInvestmentIntent에서 사용

  // 조건부 산업 표시
  PRIMARY_INDUSTRY_ONLY_THRESHOLD: number; // 1순위 산업 점수가 이 값 초과시 1순위만 표시
  SECONDARY_INDUSTRY_MIN_THRESHOLD: number; // 2순위 산업 점수가 이 값 이하시 표시 안함
}

/**
 * Persona row structure for embeddings
 */
export interface PersonaRow {
  persona: string;
  vec: number[];
}

// IndustryMatchResult, PersonaMatchResult 제거됨 - 사용되지 않는 타입들

/**
 * Investment intent matching result
 */
export interface InvestmentIntentResult {
  intent: 'investment_query' | null;
  score: number;
  matchedEntity?: string; // 매칭된 산업명
  method: 'rag_industry' | 'investment_keywords' | 'none';
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
  needsDetailedAnalysis?: boolean; // 상세 분석 필요 여부
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
    needsDetailedAnalysis?: boolean; // 상세 분석 필요 여부
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
 * Company data structure from the KOSPI dataset
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

// RAGServiceError 제거됨 - 사용되지 않는 에러 타입
