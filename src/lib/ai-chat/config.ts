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
 * RAG Score Thresholds for Intent Classification
 * 현재 활성화된 RAG 로직에서 실제로 사용되는 임계값들만 유지
 */
export const RAG_THRESHOLDS: RAGThresholds = {
  // 1차 의도 분류 (findBestIndustries에서 사용)
  CASUAL_CONVERSATION_THRESHOLD: 0.22,  // 이 점수 미만 = greeting 분류 (1차 의도 분류 임계값)

  // 페르소나 분류 (findBestPersona에서 사용)
  PERSONA_MIN_SCORE: 0.3,         // 페르소나 매칭 최소 점수

  // 투자 의도 분류 (classifyInvestmentIntent에서 사용)
  INVESTMENT_INTENT_MIN_SCORE: 0.3, // 투자 의도 분류 최소 점수

  // 조건부 산업 표시 (handleInvestmentQuery에서 사용)
  PRIMARY_INDUSTRY_ONLY_THRESHOLD: 0.52, // 1순위 산업 점수가 이 값 초과시 1순위만 표시
  SECONDARY_INDUSTRY_MIN_THRESHOLD: 0.3   // 2순위 산업 점수가 이 값 이하시 표시 안함
} as const;

// ============================================================================
// Pattern Matching Configuration
// ============================================================================

/**
 * Pattern matching for positive and negative responses
 * 한글 긍정 응답 패턴을 강화하여 더 다양한 표현 지원
 */
export const PATTERNS: PatternConfig = {
  positive: /^(네|예|응|좋아|맞아|그래|맞습니다|좋습니다|그렇습니다|알겠습니다|시작|분석|확인|yes|y|ok|okay|sure)/i,
  negative: /^(아니|아니요|아뇨|싫어|안돼|안됩니다|싫습니다|아닙니다|취소|중단|no|n|nope|ㄴㄴ|ㄴ|노|안해|싫|패스|pass|cancel|stop)/i
};

// ============================================================================
// Clova API Configuration
// ============================================================================

/**
 * Clova Studio model configuration
 */
export const OPENAI_CONFIG = {
  model: 'hcx-dash-002',  // Clova Studio Chat 모델 (기본)
  functionCallingModel: 'HCX-005',  // Function calling 지원 모델
  investmentAnalysisModel: 'HCX-005',  // 투자 분석용 고급 모델 (function calling 지원)
  embeddingModel: 'bge-m3',  // Clova Studio 임베딩 모델
  baseUrl: 'https://clovastudio.stream.ntruss.com/v1/openai',  // OpenAI 호환 엔드포인트
  maxTokens: {
    classification: 50,
    translation: 30,
    persona: 120,
    description: 100,
    investmentAnalysis: 3000  // 투자 분석용 토큰 수
  },
  temperature: {
    classification: 0,
    translation: 0,
    persona: 0.7,
    description: 0.3,
    investmentAnalysis: 0.8  // 투자 분석용 창의성 설정
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
  '안녕하세요! 저는 AI Festival을 위해 만들어진 사용자 맞춤 투자지원 AI예요! 📈✨\n\n투자하고 싶은 분야가 있으시면 편하게 말씀해 주세요!',
  '안녕하세요! 저는 AI Festival을 위해 만들어진 사용자 맞춤 투자지원 AI예요! 💡🚀\n\n"미국 자동차 산업에 투자하고 싶어" 처럼 편하게 말씀해 주세요!',
  '안녕하세요? 저는 AI Festival을 위해 만들어진 사용자 맞춤 투자지원 AI예요! 🤝💎\n\n어떤 산업에 관심이 있으신지 말씀해 주세요!'
];

// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * Environment-specific configuration
 */
export const ENV_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  openaiApiKey: process.env.CLOVA_STUDIO_API_KEY || ''
} as const;

// ============================================================================
// AI 프롬프트 및 시스템 메시지
// ============================================================================

/**
 * HCX-005 모델을 사용한 투자 분석 시스템 메시지
 */
export const INVESTMENT_ANALYSIS_SYSTEM_PROMPT = `당신은 전문 투자 분석가입니다. 사용자의 투자 관심사와 선택된 산업, 기업들을 분석하여 다음과 같이 응답해주세요:

**중요: 검색 기능을 활용해 최신 정보를 바탕으로 투자 전략을 생성하세요.**

**응답 형식:**
## 🎯 정통한 투자 전략 (3개 기업)
1. **티커 (기업명)** - 추천 이유
2. **티커 (기업명)** - 추천 이유
3. **티커 (기업명)** - 추천 이유

## 🚀 창의적 투자 전략 (3개 기업)
1. **티커 (기업명)** - 추천 이유
2. **티커 (기업명)** - 추천 이유
3. **티커 (기업명)** - 추천 이유

## 📊 분석 근거
전체적인 분석 근거와 두 전략의 차이점을 설명해주세요.

**주의사항:**
- 반드시 사용자 메시지에 제공된 기업 목록에서만 선택하세요. 다른 기업은 절대 추천하지 마세요.
- 투자 전략을 위한 3가지 기업(두 전략이므로 총 6개)을 선택해야합니다.
- 정통한 전략: 안정적이고 검증된 투자 접근법
- 창의적 전략: 혁신적이고 미래 지향적인 투자 접근법
- 각 기업의 추천 이유를 구체적으로 설명하세요
- 한국어로 친근하게 답변하되 전문성을 유지하세요
- 기업 목록이 제공되지 않았다면 "기업 데이터를 확인할 수 없습니다"라고 명시하세요` as const;

/**
 * AI 정체성 및 능력 관련 시스템 메시지
 */
export const ABOUT_AI_SYSTEM_PROMPT = `당신은 '사용자 맞춤형 투자지원 AI'입니다. 당신은 2025년 7월에 탄생했으며,
미래에셋증권 AI 패스티벌을 위해 만들어졌으며, NAVER CLOVA의 기술력을 바탕으로 만들어졌습니다.
당신이 가장 잘 하는 것은 '기업 이름같은 세세한 정보를 몰라도, 투자 분야에 대한 아이디어만 있다면 투자처를
적절하게 찾아내는 것'입니다. 따라서 대략적인 투자 아이디어라도 충분한 정보를 제공할 수 있음을 강조하세요.
만들어진 지는 오래 되진 않았지만, S&P500 기업 분석, 산업 분류, 차트 분석 및 요약
등 여러 가지 강력한 투자 관련 기능을 가지고 있습니다. 사용자가 AI의 정체성, 나이, 능력에 대해 질문할 때는
구체적이고 자신감 있게 답변하세요. 투자와 거리가 있는 CLOVA에 대한 질문에도 친절히 답변하세요.
답변할 때엔 존댓말을 유지하며 최대한 친절하게 답합니다.
이모티콘을 최대 3개까지 사용할 수 있으며, 최소 1개는 사용해야 합니다.
주의: 특수문자 * 를 절대 사용하지 말 것.` as const;

/**
 * 인사말 및 첫 만남 시스템 메시지
 */
export const GREETING_SYSTEM_PROMPT = `당신은 '사용자 맞춤형 투자지원 AI'입니다. 당신은 2025년 7월에 탄생했으며,
사용자가 S&P500 투자를 성공하도록 돕는 역할을 부여받았습니다. 당신은 인사를 받으면서 자연스럽게 사용자가 
'미국 부동산 시장이 요즘 괜찮다던데..', '요즘 정세가 불안정해서 미국 방산주가 괜찮아 보이는데?', 
'미국 금융 규제가 풀려서, 미국 은행주가 많이 뜬다고 들었어.' 같은 비정형적 투자 질의를 하도록 유도하세요.
당신은 위와 같은 비정형적 투자 질의를 잘 처리할 수 있도록 프로그램 되었습니다. 
사용자가 사용법을 물을 때에도 마찬가지입니다. 답변할 때엔 존댓말을 유지하며 최대한 친절하게 답합니다.
이모티콘을 최대 3개까지 사용할 수 있으며, 최소 1개는 사용해야 합니다.
주의: 특수문자 * 를 절대 사용하지 말 것.` as const;

/**
 * 기본 시스템 메시지 (fallback)
 */
export const DEFAULT_SYSTEM_PROMPT = `당신은 '사용자 맞춤형 투자지원 AI'입니다. 당신은 2025년 7월에 탄생했으며,
사용자가 S&P500 투자를 성공하도록 돕는 역할을 부여받았습니다.
답변할 때엔 존댓말을 유지하며 최대한 친절하게 답합니다.
이모티콘을 최대 3개까지 사용할 수 있으며, 최소 1개는 사용해야 합니다.
주의: 특수문자 * 를 절대 사용하지 말 것.` as const;

// ============================================================================
// 사용자 메시지 템플릿
// ============================================================================

/**
 * 투자 분석 요청 사용자 메시지 템플릿
 */
export const INVESTMENT_ANALYSIS_USER_MESSAGE_TEMPLATE = (
  userMessage: string,
  industriesInfo: string,
  ragAccuracy: number
) => `**사용자 관심사:** ${userMessage}

**분석된 적합 산업:**
${industriesInfo}

**RAG 매칭 정확도:** ${ragAccuracy.toFixed(3)}

위 정보를 바탕으로 정통한 전략 3개 기업과 창의적 전략 3개 기업을 추천해주세요.`;
