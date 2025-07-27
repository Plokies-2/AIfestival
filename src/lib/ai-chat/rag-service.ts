/**
 * RAG (Retrieval-Augmented Generation) Service Module
 * 
 * This module handles all RAG-related functionality including:
 * - Industry matching using embeddings and cosine similarity
 * - Company finding and matching
 * - Korean-English translation mapping
 * - Embedding generation and similarity calculations
 */

import OpenAI from 'openai';
import { getEmbeddings, cosine } from '@/lib/embeddings';
import { QUICK_ENRICHED_FINAL as DATA } from '@/data/sp500_enriched_final';
import { IndustryMatchResult, RAGServiceError, CompanyData, PersonaMatchResult, InvestmentIntentResult } from './types';
import { RAG_THRESHOLDS, KOREAN_COMPANY_MAPPING, OPENAI_CONFIG, PERFORMANCE_CONFIG, ENV_CONFIG } from './config';
// 제거된 기능: classifyIndustryWithGPT import - GPT 기반 산업 분류 백업 로직 제거됨

// ============================================================================
// OpenAI Client for Embeddings
// ============================================================================

const openai = new OpenAI({ 
  apiKey: ENV_CONFIG.openaiApiKey 
});

// ============================================================================
// Cached Industry List
// ============================================================================

/**
 * Performance optimization: Runtime dynamic generation to save memory
 */
const getAvailableIndustries = (() => {
  let cached: string[] | null = null;
  return () => {
    if (!cached) {
      cached = [...new Set(Object.values(DATA).map((c: any) => c.industry))];
    }
    return cached;
  };
})();

// ============================================================================
// Persona Matching Functions
// ============================================================================

/**
 * 2단계 RAG 시스템 - 1단계: 기본 페르소나 분류 (greeting, about_ai, investment)
 * 투자 관련 여부를 먼저 판단하여 성능 최적화
 * 수정된 로직: RAG 점수가 낮을 때 casual_chat 대신 greeting으로 분류
 */
export async function findBestPersona(userInput: string): Promise<string | null> {
  try {
    // Generate embedding for user input
    const queryEmbedding = (await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: userInput
    })).data[0].embedding;

    const normalizedQuery = queryEmbedding.map((v, _, arr) => v / Math.hypot(...arr));

    // RAG: Calculate cosine similarity with persona embeddings (MD files only)
    const embeddings = await getEmbeddings();
    const { personas } = embeddings;

    // Validate personas array
    if (!personas || !Array.isArray(personas) || personas.length === 0) {
      console.error('❌ Personas array is invalid or empty');
      return null; // Fallback to greeting
    }

    let bestPersona: string | null = null;
    let bestScore = -1;
    const scores: { [key: string]: number } = {};

    for (const persona of personas) {
      if (!persona.vec || !Array.isArray(persona.vec)) {
        continue;
      }

      const score = cosine(persona.vec, normalizedQuery);
      scores[persona.persona] = score;

      if (score > bestScore) {
        bestScore = score;
        bestPersona = persona.persona;
      }
    }

    // Simplified logging: only scores and selected direction
    const scoreText = Object.entries(scores)
      .map(([persona, score]) => `${persona}: ${score.toFixed(3)}`)
      .join(', ');

    // Threshold check: If score is below threshold, classify as greeting
    if (bestScore < RAG_THRESHOLDS.PERSONA_CASUAL_THRESHOLD || bestScore < RAG_THRESHOLDS.PERSONA_MIN_SCORE) {
      console.log(`🎯 Scores: ${scoreText} → Selected: greeting`);
      return null; // Will be classified as greeting
    }

    console.log(`🎯 Scores: ${scoreText} → Selected: ${bestPersona}`);
    return bestPersona;

  } catch (error) {
    console.error('❌ Error in persona classification:', error);
    return null; // Fallback to greeting
  }
}

// ============================================================================
// Investment Intent Classification Functions
// ============================================================================

/**
 * Classifies investment intent using RAG with company and industry data
 * Returns investment_recommendation, investment_query, company_direct, or null
 */
export async function classifyInvestmentIntent(userInput: string): Promise<InvestmentIntentResult> {
  try {
    // Generate embedding for user input
    const queryEmbedding = (await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: userInput
    })).data[0].embedding;

    const normalizedQuery = queryEmbedding.map((v, _, arr) => v / Math.hypot(...arr));

    // Load embeddings
    const embeddings = await getEmbeddings();
    const { companies, industries } = embeddings;

    if (!companies || !industries) {
      return { intent: null, score: 0, method: 'none' };
    }

    // 1. Check for direct company match (highest priority)
    let bestCompanyScore = -1;
    let bestCompanyMatch = null;

    const topCompanies = companies.slice(0, PERFORMANCE_CONFIG.maxCompaniesForRAG);

    for (const company of topCompanies) {
      if (!company.vec || !Array.isArray(company.vec)) continue;

      const score = cosine(company.vec, normalizedQuery);
      if (score > bestCompanyScore) {
        bestCompanyScore = score;
        bestCompanyMatch = company;
      }
    }

    // 2. Check for industry match
    let bestIndustryScore = -1;
    let bestIndustryMatch = null;

    for (const industry of industries) {
      if (!industry.vec || !Array.isArray(industry.vec)) continue;

      const score = cosine(industry.vec, normalizedQuery);
      if (score > bestIndustryScore) {
        bestIndustryScore = score;
        bestIndustryMatch = industry;
      }
    }

    // 3. Determine intent based on scores and patterns

    // Check for investment recommendation patterns
    const recommendationPatterns = /(추천|어떤.*?기업|어떤.*?회사|좋은.*?기업|좋은.*?회사|아무거나|랜덤|무작위)/;
    const hasRecommendationPattern = recommendationPatterns.test(userInput.toLowerCase());

    if (hasRecommendationPattern && (bestCompanyScore > 0.2 || bestIndustryScore > 0.2)) {
      const selectedEntity = bestCompanyScore > bestIndustryScore ? bestCompanyMatch?.name : bestIndustryMatch?.industry;
      const selectedScore = Math.max(bestCompanyScore, bestIndustryScore);
      console.log(`💡 Selected: ${selectedEntity} (${selectedScore.toFixed(3)})`);
      return {
        intent: 'investment_recommendation',
        score: selectedScore,
        matchedEntity: selectedEntity,
        method: bestCompanyScore > bestIndustryScore ? 'rag_company' : 'rag_industry'
      };
    }

    // Check for direct company mention (high confidence)
    if (bestCompanyScore >= RAG_THRESHOLDS.COMPANY_DIRECT_MIN_SCORE) {
      console.log(`🏢 Selected: ${bestCompanyMatch?.name} (${bestCompanyScore.toFixed(3)})`);
      return {
        intent: 'company_direct',
        score: bestCompanyScore,
        matchedEntity: bestCompanyMatch?.name,
        method: 'rag_company'
      };
    }

    // Check for investment query (medium confidence)
    if (bestCompanyScore >= RAG_THRESHOLDS.INVESTMENT_INTENT_MIN_SCORE ||
        bestIndustryScore >= RAG_THRESHOLDS.INVESTMENT_INTENT_MIN_SCORE) {
      const selectedEntity = bestCompanyScore > bestIndustryScore ? bestCompanyMatch?.name : bestIndustryMatch?.industry;
      const selectedScore = Math.max(bestCompanyScore, bestIndustryScore);
      const icon = bestCompanyScore > bestIndustryScore ? '🏢' : '🏭';
      console.log(`${icon} Selected: ${selectedEntity} (${selectedScore.toFixed(3)})`);
      return {
        intent: 'investment_query',
        score: selectedScore,
        matchedEntity: selectedEntity,
        method: bestCompanyScore > bestIndustryScore ? 'rag_company' : 'rag_industry'
      };
    }

    // Check for basic investment keywords (fallback)
    const investmentKeywords = /(투자|주식|종목|매수|매도|분석|포트폴리오|수익|손실|시장|경제|금융)/;
    if (investmentKeywords.test(userInput.toLowerCase())) {
      console.log('📈 Selected: investment keywords (0.600)');
      return {
        intent: 'investment_query',
        score: 0.6, // Medium confidence for keyword matching
        method: 'investment_keywords'
      };
    }

    return { intent: null, score: 0, method: 'none' };

  } catch (error) {
    console.error('❌ Error in investment intent classification:', error);
    return { intent: null, score: 0, method: 'none' };
  }
}

// ============================================================================
// Industry Matching Functions
// ============================================================================

/**
 * Finds the best matching industry using RAG with threshold-based classification
 */
export async function findBestIndustry(userInput: string): Promise<string | null> {
  // RAG: Generate user input embedding directly (no translation needed)
  // 임베딩 공간에서는 언어가 달라도 의미적 유사성 매칭이 가능
  const queryEmbedding = (await openai.embeddings.create({
    model: OPENAI_CONFIG.embeddingModel,
    input: userInput
  })).data[0].embedding;

  const normalizedQuery = queryEmbedding.map((v, _, arr) => v / Math.hypot(...arr));

  // RAG: Calculate cosine similarity with pre-computed industry embeddings
  const { industries } = await getEmbeddings();

  let bestIndustry: string | null = null;
  let bestScore = -1;

  for (const industry of industries) {
    const score = cosine(industry.vec, normalizedQuery);
    if (score > bestScore) {
      bestScore = score;
      bestIndustry = industry.industry;
    }
  }

  console.log(`RAG Best match: ${bestIndustry} with score: ${bestScore.toFixed(3)}`);

  // RAG threshold check: If industry level score is too low, try company level search
  if (bestScore < RAG_THRESHOLDS.COMPANY_MIN_SCORE) {
    console.log('Industry score too low, trying company-level RAG...');

    const { companies } = await getEmbeddings();
    let bestCompanyIndustry: string | null = null;
    let bestCompanyScore = -1;

    // Performance optimization: Search only top n companies - maximum 500
    const topCompanies = companies.slice(0, PERFORMANCE_CONFIG.maxCompaniesForRAG);
    for (const company of topCompanies) {
      const score = cosine(company.vec, normalizedQuery);
      if (score > bestCompanyScore) {
        bestCompanyScore = score;
        bestCompanyIndustry = company.industry;
      }
    }

    console.log(`Company-level RAG: ${bestCompanyIndustry} with score: ${bestCompanyScore.toFixed(3)}`);

    if (bestCompanyScore > bestScore) {
      bestIndustry = bestCompanyIndustry;
      bestScore = bestCompanyScore;
    }
  }

  // RAG threshold check: If score is below threshold, classify as casual conversation
  if (bestScore < RAG_THRESHOLDS.CASUAL_CONVERSATION_THRESHOLD) {
    console.log(`⚠️ RAG score too low (${bestScore.toFixed(3)} < ${RAG_THRESHOLDS.CASUAL_CONVERSATION_THRESHOLD}), classifying as casual conversation`);

    // 제거된 기능: GPT 기반 산업 분류 백업 로직
    // RAG 점수가 낮으면 인사말로 분류 (수정된 로직)
    console.log('RAG scores too low, treating as greeting');
    return null; // Classify as greeting
  }

  // Validate that the selected industry actually exists in DATA (use cached industry list)
  const validIndustries = getAvailableIndustries();
  if (bestIndustry && !validIndustries.includes(bestIndustry)) {
    console.log(`Selected industry "${bestIndustry}" not found in DATA.`);
    bestIndustry = validIndustries[0]; // Use first industry
  }

  // Return valid industry
  return bestIndustry;
}

// ============================================================================
// Company Finding Functions
// ============================================================================

/**
 * Searches for company in all data (for START stage)
 */
export function findCompanyInAllData(userInput: string): string | null {
  const allTickers = Object.keys(DATA);

  // 1. Direct ticker matching
  const upperInput = userInput.toUpperCase().trim();
  const directTicker = allTickers.find(ticker => ticker === upperInput);
  if (directTicker) {
    console.log(`Direct ticker match: ${userInput} -> ${directTicker}`);
    return directTicker;
  }

  // 2. Korean company name mapping table usage
  const normalizedInput = userInput.trim().toLowerCase();
  for (const [koreanName, englishNames] of Object.entries(KOREAN_COMPANY_MAPPING)) {
    if (normalizedInput.includes(koreanName)) {
      for (const ticker of allTickers) {
        const company = (DATA as any)[ticker];
        if (!company) continue;

        const companyName = company.name.toLowerCase();
        for (const englishName of englishNames) {
          if (companyName.includes(englishName)) {
            console.log(`Korean company name match: "${koreanName}" -> ${ticker} (${company.name})`);
            return ticker;
          }
        }
      }
    }
  }

  // 3. Direct English company name matching
  for (const ticker of allTickers) {
    const company = (DATA as any)[ticker];
    if (!company) continue;

    const companyName = company.name.toLowerCase();

    // Full name matching
    if (companyName.includes(normalizedInput) || normalizedInput.includes(companyName)) {
      console.log(`Full company name match: "${normalizedInput}" -> ${ticker} (${company.name})`);
      return ticker;
    }

    // Main word matching (3+ characters)
    const companyWords = companyName.split(' ').filter((word: string) => word.length > 2);
    for (const word of companyWords) {
      if (normalizedInput.includes(word) && word.length > 3) {
        console.log(`Company word match: "${word}" -> ${ticker} (${company.name})`);
        return ticker;
      }
    }
  }

  return null;
}

/**
 * Finds ticker in text from available tickers list
 */
export function findTickerInText(text: string, availableTickers: string[]): string | null {
  const normalizedInput = text.trim().toLowerCase();
  const upperInput = text.trim().toUpperCase();

  // 1. Direct ticker matching (case insensitive exact match)
  const directTicker = availableTickers.find(ticker =>
    ticker.toLowerCase() === normalizedInput ||
    ticker === upperInput ||
    normalizedInput.includes(ticker.toLowerCase()) ||
    upperInput.includes(ticker)
  );
  if (directTicker) {
    console.log(`✅ 티커 매칭 성공: "${text}" -> ${directTicker} (${getCompanyName(directTicker)})`);
    return directTicker;
  }

  // 2. Korean company name matching
  // 2-1. Korean-English mapping table usage
  for (const [koreanName, englishNames] of Object.entries(KOREAN_COMPANY_MAPPING)) {
    if (normalizedInput.includes(koreanName.toLowerCase())) {
      for (const ticker of availableTickers) {
        const company = (DATA as any)[ticker];
        if (!company) continue;

        const companyName = company.name.toLowerCase();
        for (const englishName of englishNames) {
          if (companyName.includes(englishName)) {
            console.log(`Korean name match: "${koreanName}" -> ${ticker} (${company.name})`);
            return ticker;
          }
        }
      }
    }
  }

  // 2-2. Number matching (1, 2, 3 etc)
  const numberMatch = normalizedInput.match(/^(\d+)$/);
  if (numberMatch) {
    const index = parseInt(numberMatch[1]) - 1;
    if (index >= 0 && index < availableTickers.length) {
      console.log(`Number match: ${numberMatch[1]} -> ${availableTickers[index]}`);
      return availableTickers[index];
    }
  }

  // 2-3. Direct English company name matching (partial match included)
  for (const ticker of availableTickers) {
    const company = (DATA as any)[ticker];
    if (!company) continue;

    const companyName = company.name.toLowerCase();
    const tickerLower = ticker.toLowerCase();

    // 1. Check if company name or ticker is included in input
    const isCompanyInInput = normalizedInput.includes(companyName) || 
                           companyName.includes(normalizedInput) ||
                           upperInput.includes(ticker) ||
                           normalizedInput.includes(tickerLower);
    
    // 2. Check if input is included in company name or ticker
    const isInputInCompany = companyName.includes(normalizedInput) || 
                           tickerLower.includes(normalizedInput);

    if (isCompanyInInput || isInputInCompany) {
      console.log(`✅ 티커 매칭 성공: "${text}" -> ${ticker} (${company.name})`);
      return ticker;
    }

    // General partial matching (main words of English company names)
    const companyWords = companyName.split(' ').filter((word: string) => word.length > 2);
    for (const word of companyWords) {
      if (normalizedInput.includes(word) && word.length > 3) { // Only match longer words
        console.log(`✅ 티커 매칭 성공: "${text}" -> ${ticker} (${company.name})`);
        return ticker;
      }
    }
  }

  // 매칭 실패 로그
  console.log(`❌ 티커 매칭 실패: "${text}"`);
  return null;
}

// ============================================================================
// Industry and Company Utilities
// ============================================================================

/**
 * Gets companies in a specific industry (exactly 5 companies)
 */
export function getIndustryCompanies(industry: string): string[] {
  console.log(`Looking for companies in industry: "${industry}"`);

  const allCompanies = Object.entries(DATA);
  console.log(`Total companies in DATA: ${allCompanies.length}`);

  const matchingCompanies = allCompanies
    .filter(([ticker, company]: [string, any]) => {
      const matches = company.industry === industry;
      if (matches) {
        console.log(`Found matching company: ${company.name} (${ticker}) in ${company.industry}`);
      }
      return matches;
    })
    .slice(0, PERFORMANCE_CONFIG.maxCompaniesForDisplay) // Exactly 5 companies
    .map(([ticker, _]: [string, any]) => ticker);

  console.log(`Found ${matchingCompanies.length} companies for industry "${industry}":`, matchingCompanies);
  return matchingCompanies;
}

/**
 * Safe DATA access function
 */
export function getCompanyName(ticker: string): string {
  const company = (DATA as any)[ticker];
  return company ? company.name : ticker;
}

/**
 * Gets company data safely
 */
export function getCompanyData(ticker: string): CompanyData | null {
  const company = (DATA as any)[ticker];
  return company ? {
    name: company.name,
    industry: company.industry,
    description: company.description
  } : null;
}

/**
 * Gets all available industries
 */
export function getAllAvailableIndustries(): string[] {
  return getAvailableIndustries();
}

// ============================================================================
// RAG Testing and Debugging
// ============================================================================

/**
 * RAG Threshold Testing Function (for debugging)
 */
export async function testRAGThresholds(userInput: string): Promise<{
  industry: string | null;
  isCasualConversation: boolean;
  reasoning: string;
}> {
  console.log(`🧪 Testing RAG thresholds for input: "${userInput}"`);

  const industry = await findBestIndustry(userInput);
  const isCasualConversation = industry === null;

  const reasoning = isCasualConversation
    ? `Input classified as casual conversation (RAG score below ${RAG_THRESHOLDS.CASUAL_CONVERSATION_THRESHOLD})`
    : `Input matched to industry: ${industry}`;

  console.log(`🧪 Test result: ${reasoning}`);

  return {
    industry,
    isCasualConversation,
    reasoning
  };
}
