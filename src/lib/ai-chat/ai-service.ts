
import OpenAI from 'openai';
import { IntentClassificationResult } from './types';
import {
  OPENAI_CONFIG,
  ENV_CONFIG,
  INVESTMENT_ANALYSIS_SYSTEM_PROMPT,
  ABOUT_AI_SYSTEM_PROMPT,
  GREETING_SYSTEM_PROMPT,
  DEFAULT_SYSTEM_PROMPT,
  INVESTMENT_ANALYSIS_USER_MESSAGE_TEMPLATE
} from './config';
import { findBestPersona, classifyInvestmentIntent } from './rag-service';
import { FunctionCallingExecutor } from './function-calling-tools';
import { NewsItem, NewsSearchResult, RAGNewsSearchSystem } from './news-service';

// ============================================================================
// OpenAI Client 초기화 (복구됨)
// ============================================================================

/**
 * Clova Studio client instance for dynamic response generation (OpenAI 호환)
 */
const openai = ENV_CONFIG.openaiApiKey ? new OpenAI({
  apiKey: ENV_CONFIG.openaiApiKey,
  baseURL: OPENAI_CONFIG.baseUrl
}) : null;

// ============================================================================
// Intent Classification
// ============================================================================

/**
 * Classifies user intent using RAG-based classification for both investment and persona intents
 * This is the primary method for understanding user intentions
 */
export async function classifyUserIntent(userInput: string): Promise<IntentClassificationResult> {
  // 로그 최적화: 상세 입력 로그 제거
  // console.log(`🔍 Classifying user intent for: "${userInput}"`);

  try {
    // 2단계 RAG 시스템 구현
    // 1단계: 기본 페르소나 분류 (MD 파일만 사용 - 빠른 처리)
    const bestPersona = await findBestPersona(userInput);

    if (bestPersona === 'greeting') {
      return {
        intent: 'greeting',
        confidence: 0.9,
        reasoning: 'RAG 기반 인사말 분류'
      };
    }

    if (bestPersona === 'about_ai') {
      return {
        intent: 'about_ai',
        confidence: 0.9,
        reasoning: 'RAG 기반 AI 정체성/능력 질문 분류'
      };
    }

    // 2단계: investment로 분류되거나 임계값 미달인 경우 기업/산업 데이터 RAG 수행
    // 수정된 로직: bestPersona가 null인 경우도 투자 의도 검사 수행
    console.log(`🔍 [2단계 RAG] bestPersona: ${bestPersona}, 투자 의도 검사 수행 여부: ${bestPersona === 'investment' || bestPersona === null}`);

    if (bestPersona === 'investment' || bestPersona === null) {
      // 로그 최적화: 상세 과정 로그 제거
      // console.log(`🔍 [2단계 RAG] classifyInvestmentIntent 호출 시작`);
      const investmentResult = await classifyInvestmentIntent(userInput);
      // console.log(`🔍 [2단계 RAG] classifyInvestmentIntent 결과:`, investmentResult);

      if (investmentResult.intent) {
        // 로그 최적화: 최종 결과만 출력
        console.log(`✅ [Intent] ${investmentResult.intent}: ${investmentResult.matchedEntity || '키워드 매칭'}`);
        return {
          intent: investmentResult.intent,
          confidence: Math.min(0.95, investmentResult.score + 0.1), // Boost confidence slightly
          reasoning: `2단계 RAG 기반 투자 의도 분류 (${investmentResult.method}): ${investmentResult.matchedEntity || '키워드 매칭'}`
        };
      } else {
        // 로그 최적화: 실패 로그 제거
        // console.log(`❌ [2단계 RAG] 투자 의도 없음, 기본값으로 진행`);
      }
    }

    // Company direct match 기능 제거됨

    // 4. Default: classify as greeting (수정된 로직)
    return {
      intent: 'greeting',
      confidence: 0.7,
      reasoning: 'RAG 기반 인사말 분류'
    };

  } catch (error) {
    console.error('❌ Intent classification failed:', error);
    // Fallback to greeting if everything fails (수정된 로직)
    return {
      intent: 'greeting',
      confidence: 0.4,
      reasoning: '분류 실패로 인한 인사말 분류'
    };
  }
}





// ============================================================================
// llm 기반 동적 응답
// ============================================================================

/**
 * llm 기반 동적 응답 생성 - 의도별 차별화된 응답
 */
export async function generateDynamicResponse(userInput: string, intent: string): Promise<string> {
  // Intent별 차별화된 시스템 메시지 선택
  let systemMessage = '';

  switch (intent) {
    case 'about_ai':
      systemMessage = ABOUT_AI_SYSTEM_PROMPT;
      break;

    case 'greeting':
      systemMessage = GREETING_SYSTEM_PROMPT;
      break;

    default:
      systemMessage = DEFAULT_SYSTEM_PROMPT;
  }

  // Intent별 차별화된 max_tokens 설정 (2배로 증가)
  let maxTokens: number;
  switch (intent) {
    case 'greeting':
      maxTokens = 360; // 인사말은 조금 더 길게 (투자 관심사 질문 포함) - 2배
      break;
    case 'about_ai':
      maxTokens = 400; // AI 정체성/능력 설명은 가장 길게 - 2배
      break;
    case 'investment_query':
      maxTokens = 300; // 1차 분류 응답 - 2배
      break;
    default:
      maxTokens = 300; // 기타 상황은 적당한 길이 - 2배
  }

  try {
    if (!openai) {
      throw new Error('OpenAI client not initialized - CLOVA_STUDIO_API_KEY is required');
    }

    const response = await openai.chat.completions.create({
      model: OPENAI_CONFIG.model, // Clova Studio hcx-dash-002 모델 사용
      messages: [
        {
          role: 'system',
          content: systemMessage
        },
        {
          role: 'user',
          content: userInput
        }
      ],
      temperature: OPENAI_CONFIG.temperature.persona,
      max_tokens: maxTokens,
    });

    const aiResponse = response.choices[0].message.content?.trim();

    if (!aiResponse) {
      throw new Error('llm 응답 생성 실패');
    }

    console.log(`🎭 Dynamic response generated for intent: ${intent}`);
    return aiResponse;

  } catch (error) {
    console.error('❌ llm response generation failed:', error);
    // Fallback to simple responses if GPT fails
    return getSimpleFallbackResponse(intent);
  }
}

/**
 * LLM 실패 시 폴백 응답
 */
function getSimpleFallbackResponse(intent: string): string {
  switch (intent) {
    case 'greeting':
      return '안녕하세요! 투자 관련 질문을 해주세요.';
    case 'about_ai':
      return '저는 투자 분석을 도와드리는 AI입니다.';
    default:
      return '죄송합니다. 일시적인 오류가 발생했습니다.';
  }
}

// ============================================================================
// 투자 분석 및 기업 추천 (고급 모델 사용)
// ============================================================================

/**
 * 투자 분석 및 기업 추천 인터페이스
 */
export interface InvestmentRecommendationInput {
  userMessage: string;
  selectedIndustries: Array<{
    industry_ko: string;
    score: number;
    companies: Array<{
      ticker: string;
      name: string;
      industry: string;
    }>;
  }>;
  ragAccuracy: number;
}

export interface InvestmentRecommendationResult {
  traditionalStrategy: Array<{
    ticker: string;
    name: string;
    reason: string;
  }>;
  creativeStrategy: Array<{
    ticker: string;
    name: string;
    reason: string;
  }>;
  analysisReasoning: string;
  strategyComparison?: string;
}






// ============================================================================
// 검색 기능이 통합된 투자 분석
// ============================================================================

/**
 * 검색 기능이 통합된 투자 분석 결과
 */
export interface EnhancedInvestmentAnalysisResult {
  traditionalStrategy: Array<{
    ticker: string;
    name: string;
    reason: string;
  }>;
  creativeStrategy: Array<{
    ticker: string;
    name: string;
    reason: string;
  }>;
  analysisReasoning: string;
  strategyComparison: string;
  trendNews: NewsItem[];
  companyNews: { [companyName: string]: NewsItem[] };
  searchSummary: string;
}

/**
 * 검색 기능이 통합된 투자 분석 함수
 * 사용자의 비정형적 응답 → RAG reasoning 검색 → 기업별 검색 → 투자 전략 생성
 */
export async function generateEnhancedInvestmentAnalysis(
  input: InvestmentRecommendationInput,
  options?: {
    onProgress?: (step: string, message: string, icon?: string, detail?: string) => void;
  }
): Promise<EnhancedInvestmentAnalysisResult> {
  const overallStartTime = Date.now();
  console.log(`🚀 [New Pipeline] 검색 최적화된 투자 분석 시작`);
  console.log(`🔧 [New Pipeline] 사용자 메시지: "${input.userMessage.substring(0, 50)}..."`);
  console.log(`🔧 [New Pipeline] 선택된 산업 수: ${input.selectedIndustries.length}`);

  const functionExecutor = new FunctionCallingExecutor(options?.onProgress);
  const newsSearchSystem = new RAGNewsSearchSystem();

  try {
    // 0단계: 사용자 입력 정제 (1차 분석)
    console.log(`💡 [New Pipeline] 0단계: 사용자 입력 정제 및 분석`);
    const refinedQueryResult = await functionExecutor.executeRefineUserQuery({
      user_message: input.userMessage
    });

    console.log(`✅ [Function Call] 사용자 입력 정제 완료!`);
    console.log(`   정제된 쿼리: "${refinedQueryResult.refined_query}"`);
    console.log(`   투자 의도: ${refinedQueryResult.investment_intent}`);
    console.log(`   대상 산업: ${refinedQueryResult.target_industries.join(', ')}`);

    // 1단계: RAG reasoning으로 투자 동향 뉴스 검색 (정제된 쿼리 사용)
    console.log(`💡 [New Pipeline] 1단계: 투자 동향 뉴스 대량 검색`);
    options?.onProgress?.('search', '투자 동향 뉴스 검색', '🔍');
    const trendSearchResult = await newsSearchSystem.searchInvestmentTrendNews(refinedQueryResult.refined_query);

    // 검색 완료 후 결과 표시
    if (trendSearchResult.success && trendSearchResult.news_items.length > 0) {
      const searchSources = [...new Set(trendSearchResult.news_items.map(item =>
        new URL(item.link).hostname.replace('www.', '')
      ))].slice(0, 3);
      options?.onProgress?.('search', `투자 동향 뉴스 검색 완료`, '✅',
        `${searchSources.join(', ')} 등 ${trendSearchResult.news_items.length}개 뉴스 수집`);

      // 1.5초 동안 결과 표시
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    if (!trendSearchResult.success) {
      throw new Error('투자 동향 뉴스 검색 실패');
    }

    // 🚨 중요: 필터링된 뉴스가 없으면 더 일반적인 검색어로 재시도
    if (!trendSearchResult.news_items || trendSearchResult.news_items.length === 0) {
      console.log(`⚠️ [New Pipeline] 필터링된 뉴스가 0개 - 일반적인 검색어로 재시도`);

      // 더 일반적인 검색어로 재시도
      const fallbackQuery = input.userMessage.includes('휴대폰') || input.userMessage.includes('스마트폰')
        ? '휴대폰 제조업'
        : input.userMessage.includes('AI') || input.userMessage.includes('인공지능')
        ? 'AI 기술'
        : input.userMessage.includes('반도체')
        ? '반도체'
        : input.userMessage.includes('전기차') || input.userMessage.includes('배터리')
        ? '전기차'
        : input.userMessage.includes('바이오') || input.userMessage.includes('제약')
        ? '바이오'
        : '주식';

      console.log(`🔄 [New Pipeline] 폴백 검색어로 재시도: "${fallbackQuery}"`);
      const fallbackSearchResult = await newsSearchSystem.searchInvestmentTrendNews(fallbackQuery);

      if (!fallbackSearchResult.success || !fallbackSearchResult.news_items || fallbackSearchResult.news_items.length === 0) {
        console.log(`❌ [New Pipeline] 폴백 검색도 실패 - 기본 분석으로 진행`);
        // 뉴스 없이도 기본 분석은 진행할 수 있도록 빈 배열로 설정
        trendSearchResult.news_items = [];
      } else {
        console.log(`✅ [New Pipeline] 폴백 검색 성공: ${fallbackSearchResult.news_items.length}개 뉴스 발견`);
        trendSearchResult.news_items = fallbackSearchResult.news_items;
        trendSearchResult.refined_query = fallbackSearchResult.refined_query;
      }
    }

    // 2단계: 뉴스 기반 기업 6개 추출 (정통한 3개 + 창의적 3개)
    console.log(`💡 [New Pipeline] 2단계: 뉴스 기반 기업 추출 (6개)`);
    console.log(`🔧 [New Pipeline] 사용할 뉴스 개수: ${trendSearchResult.news_items.length}개`);
    options?.onProgress?.('extract', '투자 대상 기업 추출', '🎯');

    const extractedCompanies = await functionExecutor.executeExtractCompaniesFromNews({
      user_message: refinedQueryResult.refined_query, // 정제된 쿼리 사용
      trend_news: trendSearchResult.news_items,
      selected_industries: input.selectedIndustries
    });

    // 기업 추출 완료 후 결과 표시
    const traditionalCount = extractedCompanies.traditional_companies?.length || 0;
    const creativeCount = extractedCompanies.creative_companies?.length || 0;
    const companyNames = [
      ...(extractedCompanies.traditional_companies || []).map(c => c.name),
      ...(extractedCompanies.creative_companies || []).map(c => c.name)
    ].slice(0, 3);

    options?.onProgress?.('extract', '투자 대상 기업 추출 완료', '✅',
      `정통한 ${traditionalCount}개, 창의적 ${creativeCount}개 (${companyNames.join(', ')} 등)`);

    // 1.5초 동안 결과 표시
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 3단계: 추출된 기업 6개만 개별 뉴스 검색
    console.log(`💡 [New Pipeline] 3단계: 추출된 기업 개별 뉴스 검색 (6개)`);
    options?.onProgress?.('search', '개별 기업 뉴스 수집', '📰');
    const companySearchResults: { [companyName: string]: NewsSearchResult } = {};

    const allExtractedCompanies = [
      ...extractedCompanies.traditional_companies,
      ...extractedCompanies.creative_companies
    ];

    for (const company of allExtractedCompanies) {
      try {
        const companyResult = await newsSearchSystem.searchCompanyNews(company.name, 10);
        companySearchResults[company.name] = companyResult;
        console.log(`   ✅ ${company.name}: ${companyResult.success ? companyResult.news_items.length : 0}개 뉴스 (목표: 10개)`);
      } catch (error) {
        console.error(`   ❌ ${company.name} 검색 실패:`, error);
      }
    }

    // 개별 기업 뉴스 수집 완료 후 결과 표시
    const successfulSearches = Object.entries(companySearchResults)
      .filter(([_, result]) => result.success)
      .map(([name, result]) => `${name}(${result.news_items.length}개)`)
      .slice(0, 3);

    options?.onProgress?.('search', '개별 기업 뉴스 수집 완료', '✅',
      `${successfulSearches.join(', ')} 등 기업별 뉴스 분석 완료`);

    // 1.5초 동안 결과 표시
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 4단계: 산업 동향 중심 최종 투자 전략 생성 (기업 뉴스 포함)
    console.log(`💡 [New Pipeline] 4단계: 동향 뉴스 + 기업 뉴스 통합 분석`);
    options?.onProgress?.('generate', '투자 전략 및 포트폴리오 생성', '⚡');

    // 검색 결과 정리
    const companyNews: { [companyName: string]: NewsItem[] } = {};
    Object.entries(companySearchResults).forEach(([company, result]) => {
      if (result.success) {
        companyNews[company] = result.news_items;
      }
    });

    // 기업 뉴스를 NewsSearchResult 형태로 변환
    const companyNewsFormatted: { [companyName: string]: NewsSearchResult } = {};
    Object.entries(companySearchResults).forEach(([company, result]) => {
      companyNewsFormatted[company] = result;
    });

    // 동향 뉴스와 기업 뉴스를 모두 활용한 최종 투자 전략 생성
    const finalInvestmentResult = await functionExecutor.executeGenerateInvestmentStrategies({
      user_message: refinedQueryResult.refined_query, // 정제된 쿼리 사용
      trend_news: trendSearchResult.news_items,
      company_news: companyNewsFormatted,
      selected_industries: input.selectedIndustries,
      extracted_companies: extractedCompanies, // 추출된 기업 정보 전달
      rag_accuracy: 0.95
    });

    // 최종 분석 완료 - 상세 결과 표시
    const finalCompanies = [
      ...(finalInvestmentResult?.traditionalStrategy || []).map(c => c.name || c.ticker),
      ...(finalInvestmentResult?.creativeStrategy || []).map(c => c.name || c.ticker)
    ].filter(Boolean).slice(0, 4);

    const searchSources = [...new Set(trendSearchResult.news_items.map(item =>
      new URL(item.link).hostname.replace('www.', '')
    ))].slice(0, 4);

    options?.onProgress?.('complete', '분석 마무리 중', '⚡',
      `선정 기업: ${finalCompanies.join(', ')} | 검색 출처: ${searchSources.join(', ')}`);

    // 완료 메시지를 더 오래 표시 (3초)
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log(`✅ [Function Call] 동향 뉴스 + 기업 뉴스 통합 분석 완료!`);

    // 최종 결과 구성 (기업 뉴스 분석 결과 활용)
    console.log(`🔧 [New Pipeline] finalInvestmentResult 필드 확인:`, {
      traditionalStrategy: finalInvestmentResult?.traditionalStrategy?.length || 0,
      creativeStrategy: finalInvestmentResult?.creativeStrategy?.length || 0,
      analysisReasoning: !!finalInvestmentResult?.analysisReasoning,
      strategyComparison: !!finalInvestmentResult?.strategyComparison
    });

    const result: EnhancedInvestmentAnalysisResult = {
      traditionalStrategy: finalInvestmentResult?.traditionalStrategy || [],
      creativeStrategy: finalInvestmentResult?.creativeStrategy || [],
      analysisReasoning: finalInvestmentResult?.analysisReasoning || '분석 결과를 가져올 수 없습니다.',
      strategyComparison: finalInvestmentResult?.strategyComparison || '전략 비교 분석을 가져올 수 없습니다.',
      trendNews: trendSearchResult.news_items,
      companyNews,
      searchSummary: `관련 산업 동향과 기업별 뉴스를 종합 분석하였습니다.`
    };

    const overallTime = Date.now() - overallStartTime;
    console.log(`✅ [New Pipeline] 전체 분석 완료 (${overallTime}ms)`);
    console.log(`✅ [New Pipeline] API 사용량: 총 7회 (동향 1회 + 기업 6회)`);
    console.log(`✅ [New Pipeline] 결과 요약: {
  traditionalCount: ${result.traditionalStrategy?.length || 0},
  creativeCount: ${result.creativeStrategy?.length || 0},
  trendNewsCount: ${result.trendNews?.length || 0},
  extractedCompaniesCount: ${allExtractedCompanies.length},
  companyNewsCount: ${Object.keys(result.companyNews).length}
}`);

    return result;

  } catch (error) {
    const overallTime = Date.now() - overallStartTime;
    console.error(`❌ [New Pipeline] 전체 분석 실패 (${overallTime}ms):`, error);
    throw error; // 오류를 상위로 전파
  }
}

/**
 * AI 응답에서 포트폴리오 데이터를 추출하고 저장
 */
export function savePortfoliosFromAnalysis(
  analysisResult: any,
  userMessage: string,
  recommendedIndustries: Array<{ industry_ko: string; score: number }>
) {
  try {
    const portfolios = [];
    const industryName = recommendedIndustries[0]?.industry_ko || '투자';
    const timestamp = new Date().toISOString();

    // 정통한 전략 포트폴리오
    if (analysisResult.traditionalStrategy && analysisResult.traditionalStrategy.length > 0) {
      const traditionalPortfolio = {
        id: `traditional_${Date.now()}`,
        name: `${industryName} 정통한 전략`,
        strategy: 'traditional' as const,
        companies: analysisResult.traditionalStrategy.map((company: any) => ({
          ticker: company.ticker,
          name: company.name,
          weight: 1000 // 기본 1000만원
        })),
        createdAt: timestamp,
        industry: industryName
      };
      portfolios.push(traditionalPortfolio);
    }

    // 창의적 전략 포트폴리오
    if (analysisResult.creativeStrategy && analysisResult.creativeStrategy.length > 0) {
      const creativePortfolio = {
        id: `creative_${Date.now() + 1}`,
        name: `${industryName} 창의적 전략`,
        strategy: 'creative' as const,
        companies: analysisResult.creativeStrategy.map((company: any) => ({
          ticker: company.ticker,
          name: company.name,
          weight: 1000 // 기본 1000만원
        })),
        createdAt: timestamp,
        industry: industryName
      };
      portfolios.push(creativePortfolio);
    }

    // 브라우저 환경에서만 localStorage 사용
    if (typeof window !== 'undefined') {
      const existingPortfolios = JSON.parse(localStorage.getItem('ai_portfolios') || '[]');
      const updatedPortfolios = [...existingPortfolios, ...portfolios];
      localStorage.setItem('ai_portfolios', JSON.stringify(updatedPortfolios));

      console.log(`✅ [Portfolio] ${portfolios.length}개 포트폴리오 저장 완료`);
      console.log(`📊 [Portfolio] 저장된 포트폴리오:`, portfolios.map(p => p.name));
    }

    return portfolios;
  } catch (error) {
    console.error('❌ [Portfolio] 포트폴리오 저장 실패:', error);
    return [];
  }
}

