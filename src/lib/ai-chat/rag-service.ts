/**
 * RAG (Retrieval-Augmented Generation) Service Module
 * 
 * This module handles all RAG-related functionality including:
 * - Industry matching using embeddings and cosine similarity
 * - Company finding and matching
 * - Korean-English translation mapping
 * - Embedding generation and similarity calculations
 */

import { getEmbeddings, cosine } from '@/lib/embeddings';
import { KOSPI_ENRICHED_FINAL as DATA } from '@/data/kospi_enriched_final';
import { CompanyData, InvestmentIntentResult } from './types';
import { RAG_THRESHOLDS } from './config';
import { createEmbeddingCompatible } from '@/lib/clova-embedding';
// 제거된 기능: classifyIndustryWithGPT import - GPT 기반 산업 분류 백업 로직 제거됨

// ============================================================================
// Clova Studio 네이티브 임베딩 API 사용
// ============================================================================

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
    // Generate embedding for user input using Clova Studio native API
    const queryEmbedding = (await createEmbeddingCompatible(userInput)).data[0].embedding;

    const normalizedQuery = queryEmbedding.map((v: number, _: number, arr: number[]) => v / Math.hypot(...arr));

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
    // 수정된 로직: AND 조건으로 변경하여 더 정확한 분류
    if (bestScore < RAG_THRESHOLDS.PERSONA_MIN_SCORE) {
      console.log(`🎯 Scores: ${scoreText} → Selected: greeting (score ${bestScore.toFixed(3)} < ${RAG_THRESHOLDS.PERSONA_MIN_SCORE})`);
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
 * Returns investment_query, company_direct, or null
 * 제거된 기능: investment_recommendation 의도 처리
 */
export async function classifyInvestmentIntent(userInput: string): Promise<InvestmentIntentResult> {
  try {
    // Generate embedding for user input using Clova Studio native API
    const queryEmbedding = (await createEmbeddingCompatible(userInput)).data[0].embedding;

    const normalizedQuery = queryEmbedding.map((v: number, _: number, arr: number[]) => v / Math.hypot(...arr));

    // Load embeddings
    const embeddings = await getEmbeddings();
    const { companies, industries } = embeddings;

    if (!companies || !industries) {
      return { intent: null, score: 0, method: 'none' };
    }

    // 1. Check for direct company match (highest priority) - 주석처리: company direct match 제거
    // let bestCompanyScore = -1;
    // let bestCompanyMatch = null;

    // const topCompanies = companies.slice(0, PERFORMANCE_CONFIG.maxCompaniesForRAG);

    // for (const company of topCompanies) {
    //   if (!company.vec || !Array.isArray(company.vec)) continue;

    //   const score = cosine(company.vec, normalizedQuery);
    //   if (score > bestCompanyScore) {
    //     bestCompanyScore = score;
    //     bestCompanyMatch = company;
    //   }
    // }

    // company direct match 제거로 인한 기본값 설정 - 변수 제거
    // let bestCompanyScore = -1;
    // let bestCompanyMatch = null;

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
    // 제거된 기능: investment_recommendation 패턴 매칭 - 더 이상 사용되지 않음

    // Check for direct company mention (high confidence) - 주석처리: company direct match 제거
    // if (bestCompanyScore >= RAG_THRESHOLDS.COMPANY_DIRECT_MIN_SCORE) {
    //   console.log(`🏢 Selected: ${bestCompanyMatch?.name} (${bestCompanyScore.toFixed(3)})`);
    //   return {
    //     intent: 'company_direct',
    //     score: bestCompanyScore,
    //     matchedEntity: bestCompanyMatch?.name,
    //     method: 'rag_company'
    //   };
    // }

    // Check for investment query (medium confidence) - 산업 매칭만 사용
    // 로그 최적화: 상세 점수 로그 제거
    // console.log(`🔍 [Investment Intent] Industry score: ${bestIndustryScore.toFixed(3)}, Threshold: ${RAG_THRESHOLDS.INVESTMENT_INTENT_MIN_SCORE}`);

    // 산업 매칭만 고려 (company direct match 제거)
    if (bestIndustryScore >= RAG_THRESHOLDS.INVESTMENT_INTENT_MIN_SCORE) {
      const selectedEntity = bestIndustryMatch?.industry_ko;
      const selectedScore = bestIndustryScore;
      // 로그 최적화: 최종 결과만 출력
      console.log(`🏭 [RAG] Selected: ${selectedEntity}`);
      return {
        intent: 'investment_query',
        score: selectedScore,
        matchedEntity: selectedEntity,
        method: 'rag_industry'
      };
    } else {
      // 로그 최적화: 실패 로그 제거
      // console.log(`❌ [Investment Intent] Industry score below threshold, returning null`);
    }

    // Check for basic investment keywords (fallback)
    const investmentKeywords = /(투자|주식|종목|매수|매도|분석|포트폴리오|수익|손실|시장|경제|금융)/;
    if (investmentKeywords.test(userInput.toLowerCase())) {
      // 로그 최적화: 키워드 매칭 로그 제거
      // console.log('📈 Selected: investment keywords (0.600)');
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
 * 새로운 RAG 로직: kospi_industry_vectors.ts 기반으로 top 2 산업을 직접 매칭
 */
export async function findBestIndustries(userInput: string): Promise<Array<{industry_ko: string, score: number}> | null> {
  // 사용자 입력 임베딩 생성 using Clova Studio native API
  const queryEmbedding = (await createEmbeddingCompatible(userInput)).data[0].embedding;

  const normalizedQuery = queryEmbedding.map((v: number, _: number, arr: number[]) => v / Math.hypot(...arr));

  // kospi_industry_vectors.ts 기반 산업 임베딩과 유사도 계산
  const { industries } = await getEmbeddings();

  const industryScores = industries.map(industry => ({
    industry_ko: industry.industry_ko,
    score: cosine(industry.vec, normalizedQuery)
  }));

  // 점수 기준으로 정렬하여 top 2 선택
  industryScores.sort((a, b) => b.score - a.score);
  const topIndustries = industryScores.slice(0, 2);

  console.log(`🏭 [RAG] Top 2 산업: ${topIndustries[0].industry_ko} (${topIndustries[0].score.toFixed(3)}), ${topIndustries[1].industry_ko} (${topIndustries[1].score.toFixed(3)})`);

  // 최고 점수가 임계값(0.22)보다 낮으면 null 반환 (1차 의도 분류)
  if (topIndustries[0].score < RAG_THRESHOLDS.CASUAL_CONVERSATION_THRESHOLD) {
    console.log(`⚠️ [1차 의도 분류] RAG score too low (${topIndustries[0].score.toFixed(3)} < ${RAG_THRESHOLDS.CASUAL_CONVERSATION_THRESHOLD}), classifying as casual conversation`);
    return null;
  }

  return topIndustries;
}

/**
 * 기존 호환성을 위한 래퍼 함수 (단일 산업 반환)
 */
export async function findBestIndustry(userInput: string): Promise<string | null> {
  const topIndustries = await findBestIndustries(userInput);
  if (!topIndustries || topIndustries.length === 0) {
    return null;
  }

  // 첫 번째 산업의 sp500_industry 반환 (기존 로직과의 호환성)
  return topIndustries[0].sp500_industry;
}

// ============================================================================
// Company Finding Functions
// ============================================================================

/**
 * Searches for company in all data (for START stage) - 주석처리: Company Direct Match 완전 제거
 */
// export function findCompanyInAllData(userInput: string): string | null {
//   const allTickers = Object.keys(DATA);

//   // 1. Direct ticker matching
//   const upperInput = userInput.toUpperCase().trim();
//   const directTicker = allTickers.find(ticker => ticker === upperInput);
//   if (directTicker) {
//     console.log(`Direct ticker match: ${userInput} -> ${directTicker}`);
//     return directTicker;
//   }

//   // 2. Korean company name mapping table usage - 주석처리: Korean Company Mapping 비활성화
//   // const normalizedInput = userInput.trim().toLowerCase();
//   // for (const [koreanName, englishNames] of Object.entries(KOREAN_COMPANY_MAPPING)) {
//   //   if (normalizedInput.includes(koreanName)) {
//   //     for (const ticker of allTickers) {
//   //       const company = (DATA as any)[ticker];
//   //       if (!company) continue;

//   //       const companyName = company.name.toLowerCase();
//   //       for (const englishName of englishNames) {
//   //         if (companyName.includes(englishName)) {
//   //           console.log(`Korean company name match: "${koreanName}" -> ${ticker} (${company.name})`);
//   //           return ticker;
//   //         }
//   //       }
//   //     }
//   //   }
//   // }

//   const normalizedInput = userInput.trim().toLowerCase();

//   // 3. Direct English company name matching
//   for (const ticker of allTickers) {
//     const company = (DATA as any)[ticker];
//     if (!company) continue;

//     const companyName = company.name.toLowerCase();

//     // Full name matching
//     if (companyName.includes(normalizedInput) || normalizedInput.includes(companyName)) {
//       console.log(`Full company name match: "${normalizedInput}" -> ${ticker} (${company.name})`);
//       return ticker;
//     }

//     // Main word matching (3+ characters)
//     const companyWords = companyName.split(' ').filter((word: string) => word.length > 2);
//     for (const word of companyWords) {
//       if (normalizedInput.includes(word) && word.length > 3) {
//         console.log(`Company word match: "${word}" -> ${ticker} (${company.name})`);
//         return ticker;
//       }
//     }
//   }

//   return null;
// }

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

  // 2. Korean company name matching - 주석처리: Korean Company Mapping 비활성화
  // 2-1. Korean-English mapping table usage
  // for (const [koreanName, englishNames] of Object.entries(KOREAN_COMPANY_MAPPING)) {
  //   if (normalizedInput.includes(koreanName.toLowerCase())) {
  //     for (const ticker of availableTickers) {
  //       const company = (DATA as any)[ticker];
  //       if (!company) continue;

  //       const companyName = company.name.toLowerCase();
  //       for (const englishName of englishNames) {
  //         if (companyName.includes(englishName)) {
  //           console.log(`Korean name match: "${koreanName}" -> ${ticker} (${company.name})`);
  //           return ticker;
  //         }
  //       }
  //     }
  //   }
  // }

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
 * 해당 산업의 모든 기업을 반환 (제한 없음)
 */
export function getIndustryCompanies(industry: string): string[] {
  // 로그 최적화: 상세 검색 로그 제거
  // console.log(`Looking for companies in industry: "${industry}"`);

  const allCompanies = Object.entries(DATA);
  // console.log(`Total companies in DATA: ${allCompanies.length}`);

  const matchingCompanies = allCompanies
    .filter(([ticker, company]: [string, any]) => {
      const matches = company.industry === industry;
      // 로그 최적화: 개별 회사 매칭 로그 제거
      // if (matches) {
      //   console.log(`Found matching company: ${company.name} (${ticker}) in ${company.industry}`);
      // }
      return matches;
    })
    // 더보기 기능 제거됨 - 모든 기업을 처음부터 표시
    .map(([ticker, _]: [string, any]) => ticker);

  // 로그 최적화: 최종 결과만 출력
  console.log(`[RAG] Found ${matchingCompanies.length} companies for "${industry}" (전체 표시)`);
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

// 디버깅용 testRAGThresholds 함수 제거됨 - 프로덕션에서 사용되지 않음
