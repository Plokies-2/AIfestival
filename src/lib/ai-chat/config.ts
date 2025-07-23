/**
 * Configuration constants and patterns for the AI Chat system
 * 
 * This module centralizes all configuration values, thresholds, patterns,
 * and constants used throughout the AI chat pipeline.
 */

import { RAGThresholds, PatternConfig, KoreanCompanyMapping } from './types';

// ============================================================================
// RAG Configuration
// ============================================================================

/**
 * RAG Score Thresholds for Casual Conversation Detection
 * These thresholds determine when to classify user input as casual conversation
 * vs. investment-related queries
 */
export const RAG_THRESHOLDS: RAGThresholds = {
  INDUSTRY_MIN_SCORE: 0.25,       // Minimum score for industry-level matching (lowered for better recall)
  COMPANY_MIN_SCORE: 0.2,         // Minimum score for company-level matching (lowered for better recall)
  GPT_FALLBACK_THRESHOLD: 0.15,   // Threshold to trigger GPT classification (lowered)
  CASUAL_CONVERSATION_THRESHOLD: 0.2,  // Below this score = casual conversation (lowered for better industry matching)
  PERSONA_MIN_SCORE: 0.3,         // Minimum score for persona matching (greeting, about_ai)
  PERSONA_CASUAL_THRESHOLD: 0.25, // Below this score = casual_chat for persona classification
  INVESTMENT_INTENT_MIN_SCORE: 0.35, // Minimum score for investment intent classification
  COMPANY_DIRECT_MIN_SCORE: 0.4   // Minimum score for direct company mention
} as const;

// ============================================================================
// Pattern Matching Configuration
// ============================================================================

/**
 * Pattern matching for positive and negative responses
 */
export const PATTERNS: PatternConfig = {
  positive: /^(네|예|응|좋아|맞아|그래|yes|y|ok)/i,
  negative: /^(아니|아니요|아뇨|싫어|안돼|no|n|nope|ㄴㄴ|ㄴ|노|안해|싫|패스|pass)/i
};

// ============================================================================
// OpenAI Configuration
// ============================================================================

/**
 * OpenAI model configuration
 */
export const OPENAI_CONFIG = {
  model: 'gpt-4.1-nano',
  embeddingModel: 'text-embedding-3-small',
  maxTokens: {
    classification: 50,
    translation: 30,
    persona: 120,
    description: 100
  },
  temperature: {
    classification: 0,
    translation: 0,
    persona: 0.7,
    description: 0.3
  }
} as const;

// ============================================================================
// Session Management Configuration
// ============================================================================

/**
 * Session management settings
 */
export const SESSION_CONFIG = {
  maxAge: 30 * 60 * 1000,        // 30 minutes in milliseconds
  cleanupInterval: 5 * 60 * 1000, // 5 minutes in milliseconds
  maxHistorySize: 10,             // Maximum conversation history entries
  recentHistorySize: 3            // Recent history for context generation
} as const;

// ============================================================================
// Performance Optimization Configuration
// ============================================================================

/**
 * Performance optimization settings
 */
export const PERFORMANCE_CONFIG = {
  maxCompaniesForRAG: 500,        // Maximum companies to search in RAG
  maxCompaniesForDisplay: 5,      // Maximum companies to display initially
  maxLSTMEnhancement: 2,          // Maximum companies to enhance with LSTM data
  batchSize: 100                  // Batch size for embedding generation
} as const;

// ============================================================================
// Korean-English Company Name Mapping
// ============================================================================

/**
 * Korean to English company name mapping for better user experience
 * This allows users to input Korean company names and get matched to English names
 */
export const KOREAN_COMPANY_MAPPING: KoreanCompanyMapping = {
  // Major Technology Companies
  '인텔': ['intel', 'intel corporation'],
  '애플': ['apple'],
  '마이크로소프트': ['microsoft'],
  '구글': ['alphabet', 'google'],
  '알파벳': ['alphabet'],
  '테슬라': ['tesla'],
  '아마존': ['amazon'],
  '메타': ['meta'],
  '페이스북': ['meta'],
  '넷플릭스': ['netflix'],
  '엔비디아': ['nvidia'],
  '삼성': ['samsung'],
  '어도비': ['adobe'],
  '오라클': ['oracle'],
  '세일즈포스': ['salesforce'],
  '시스코': ['cisco'],

  // Semiconductor Companies
  '퀄컴': ['qualcomm'],
  '브로드컴': ['broadcom'],
  'amd': ['advanced micro devices', 'amd'],
  '에이엠디': ['advanced micro devices', 'amd'],
  '어드밴스드': ['advanced micro devices'],
  '마이크론': ['micron'],
  '텍사스': ['texas instruments'],
  '어플라이드': ['applied materials'],
  '아날로그': ['analog devices'],
  '램리서치': ['lam research'],
  '케이엘에이': ['kla'],
  '테라다인': ['teradyne'],
  '마이크로칩': ['microchip'],
  '온세미': ['on semiconductor'],
  '스카이웍스': ['skyworks'],
  '엔엑스피': ['nxp'],
  '모놀리식': ['monolithic power'],

  // Financial Companies
  '골드만삭스': ['goldman sachs'],
  '모건스탠리': ['morgan stanley'],
  '뱅크오브아메리카': ['bank of america'],
  '씨티그룹': ['citigroup'],
  '웰스파고': ['wells fargo'],
  '제이피모간': ['jpmorgan'],

  // Consumer Companies
  '코카콜라': ['coca-cola'],
  '펩시': ['pepsico'],
  '맥도날드': ['mcdonald'],
  '스타벅스': ['starbucks'],
  '나이키': ['nike'],
  '디즈니': ['disney'],

  // Healthcare Companies
  '존슨앤존슨': ['johnson & johnson'],
  '화이자': ['pfizer'],
  '머크': ['merck'],
  '애브비': ['abbvie'],

  // Energy Companies
  '엑손모빌': ['exxon mobil'],
  '셰브론': ['chevron'],

  // Telecommunications
  '버라이즌': ['verizon'],
  '에이티앤티': ['at&t'],

  // Aerospace
  '보잉': ['boeing'],
  '록히드마틴': ['lockheed martin']
};





// ============================================================================
// Welcome Messages
// ============================================================================

/**
 * Welcome messages for new sessions
 */
export const WELCOME_MESSAGES = [
  '안녕하세요! 저는 금융인공지능실무 과제를 위해 탄생한 맞춤 투자지원 AI예요! 📈✨\n\n투자하고 싶은 분야가 있으시면 편하게 말씀해 주세요!',
  '안녕하세요! 저는 금융인공지능실무 과제를 위해 탄생한 맞춤 투자지원 AI예요! 💡🚀\n\n"전기차", "AI", "바이오" 같은 키워드를 자유롭게 말씀해 주세요!',
  '안녕하세요? 저는 금융인공지능실무 과제를 위해 탄생한 맞춤 투자지원 AI예요! 🤝💎\n\n어떤 산업에 관심이 있으신지 말씀해 주세요!'
];

// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * Environment-specific configuration
 */
export const ENV_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  openaiApiKey: process.env.OPENAI_API_KEY!
} as const;
