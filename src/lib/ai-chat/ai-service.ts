/**
 * AI Service Integration Module (단순화됨)
 *
 * This module handles:
 * - OpenAI client initialization and configuration
 * - 100% RAG-based intent classification
 * - GPT-based industry classification
 * - 단순화된 응답 생성
 */

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

    // 3. Fallback: Korean company name check (legacy support) - 주석처리: company direct match 제거
    // const lowerInput = userInput.toLowerCase().trim();

    // for (const koreanName of Object.keys(KOREAN_COMPANY_MAPPING)) {
    //   if (lowerInput.includes(koreanName)) {
    //     // 제거된 기능: 한국 기업명 컨텍스트 기반 필터링 - 사용되지 않던 레거시 코드
    //     return {
    //       intent: 'company_direct',
    //       confidence: 0.8, // Lower confidence for fallback
    //       reasoning: `한국 기업명 매칭 (fallback): ${koreanName}`
    //     };
    //   }
    // }

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
// llm 기반 동적 응답 생성 (복구됨)
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

  // Intent별 차별화된 max_tokens 설정
  let maxTokens: number;
  switch (intent) {
    case 'greeting':
      maxTokens = 180; // 인사말은 조금 더 길게 (투자 관심사 질문 포함)
      break;
    case 'about_ai':
      maxTokens = 200; // AI 정체성/능력 설명은 가장 길게
      break;
    default:
      maxTokens = 150; // 기타 상황은 적당한 길이
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
 * GPT 실패 시
 */
function getSimpleFallbackResponse(intent: string): string {
  switch (intent) {
    case 'greeting':
      return '호출 오류!';

    case 'about_ai':
      return '호출 오류!';


    default:
      return '호출 오류!';
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
    sp500_industry: string;
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
}

/**
 * 고급 모델을 사용한 투자 분석 및 기업 추천
 * 사용자의 메시지와 선택된 산업, 기업들을 기반으로 정통한 전략과 창의적 전략으로 각각 3개씩 기업을 추천
 */
export async function generateInvestmentRecommendations(
  input: InvestmentRecommendationInput
): Promise<InvestmentRecommendationResult> {
  try {
    if (!openai) {
      throw new Error('OpenAI client not initialized - CLOVA_STUDIO_API_KEY is required');
    }

    // 산업별 기업 정보를 문자열로 포맷팅
    const industriesInfo = input.selectedIndustries.map(industry => {
      const companiesText = industry.companies.map(company =>
        `${company.ticker} (${company.name})`
      ).join(', ');

      return `**${industry.industry_ko}** (매칭 점수: ${industry.score.toFixed(3)})\n기업들: ${companiesText}`;
    }).join('\n\n');

    // 시스템 메시지 구성 (config에서 가져옴)
    const systemMessage = INVESTMENT_ANALYSIS_SYSTEM_PROMPT;

    // 사용자 메시지 구성 (config 템플릿 사용)
    const userMessage = INVESTMENT_ANALYSIS_USER_MESSAGE_TEMPLATE(
      input.userMessage,
      industriesInfo,
      input.ragAccuracy
    );

    console.log(`🤖 [투자 분석] 고급 모델로 투자 추천 생성 시작`);
    console.log(`📝 [투자 분석] 전달되는 사용자 메시지:`, userMessage);
    console.log(`🏢 [투자 분석] 기업 데이터 확인:`, {
      industriesCount: input.selectedIndustries.length,
      totalCompanies: input.selectedIndustries.reduce((sum, industry) => sum + industry.companies.length, 0),
      industriesInfo: industriesInfo.substring(0, 500) + '...'
    });

    const response = await openai.chat.completions.create({
      model: OPENAI_CONFIG.investmentAnalysisModel, // 고급 모델 사용
      messages: [
        {
          role: 'system',
          content: systemMessage
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      temperature: OPENAI_CONFIG.temperature.investmentAnalysis,
      max_tokens: OPENAI_CONFIG.maxTokens.investmentAnalysis,
    });

    const aiResponse = response.choices[0].message.content?.trim();

    if (!aiResponse) {
      throw new Error('투자 분석 응답 생성 실패');
    }

    console.log(`✅ [투자 분석] 고급 모델 응답 생성 완료`);

    // 응답을 파싱하여 구조화된 데이터로 변환
    return parseInvestmentRecommendation(aiResponse);

  } catch (error) {
    console.error('❌ 투자 분석 실패:', error);
    throw error;
  }
}

/**
 * LLM 응답을 파싱하여 구조화된 투자 추천 결과로 변환
 */
function parseInvestmentRecommendation(
  aiResponse: string
): InvestmentRecommendationResult {
  console.log(`🔍 [응답 파싱] AI 응답 길이: ${aiResponse.length}자`);
  console.log(`🔍 [응답 파싱] AI 응답 미리보기:`, aiResponse.substring(0, 300) + '...');

  // 기본 결과 구조
  const result: InvestmentRecommendationResult = {
    traditionalStrategy: [],
    creativeStrategy: [],
    analysisReasoning: aiResponse // 전체 응답을 기본값으로 사용
  };

  try {
    // 정통한 전략 섹션 추출
    const traditionalMatch = aiResponse.match(/## 🎯 정통한 투자 전략[\s\S]*?(?=## 🚀|$)/);
    if (traditionalMatch) {
      const traditionalSection = traditionalMatch[0];
      console.log(`🔍 [파싱] 정통한 전략 섹션:`, traditionalSection.substring(0, 200) + '...');

      // 실제 AI 응답 형식에 맞는 정규식: **GM (General Motors)** - 설명
      const traditionalItems = traditionalSection.match(/\d+\.\s*\*\*([^*]+)\*\*\s*-\s*([^\n]+)/g);
      console.log(`🔍 [파싱] 정통한 전략 아이템 수:`, traditionalItems?.length || 0);

      if (traditionalItems) {
        traditionalItems.slice(0, 3).forEach((item, index) => {
          console.log(`🔍 [파싱] 정통한 전략 아이템 ${index + 1}:`, item);
          const match = item.match(/\d+\.\s*\*\*([^*]+)\*\*\s*-\s*(.+)/);
          if (match) {
            const [, companyInfo, reason] = match;
            // 티커와 회사명 분리: "GM (General Motors)" -> ticker: "GM", name: "General Motors"
            const companyMatch = companyInfo.trim().match(/^([A-Z]+)\s*\(([^)]+)\)$/) ||
                                companyInfo.trim().match(/^([A-Z]+)\s+(.+)$/) ||
                                [null, companyInfo.trim(), companyInfo.trim()];

            if (companyMatch) {
              const ticker = companyMatch[1]?.trim() || companyInfo.trim();
              const name = companyMatch[2]?.trim() || companyInfo.trim();

              result.traditionalStrategy.push({
                ticker,
                name,
                reason: reason.trim()
              });
              console.log(`✅ [파싱] 정통한 전략 추가:`, { ticker, name, reason: reason.substring(0, 50) + '...' });
            }
          }
        });
      }
    }

    // 창의적 전략 섹션 추출
    const creativeMatch = aiResponse.match(/## 🚀 창의적 투자 전략[\s\S]*?(?=## 📊|$)/);
    if (creativeMatch) {
      const creativeSection = creativeMatch[0];
      console.log(`🔍 [파싱] 창의적 전략 섹션:`, creativeSection.substring(0, 200) + '...');

      // 실제 AI 응답 형식에 맞는 정규식: **GM (General Motors)** - 설명
      const creativeItems = creativeSection.match(/\d+\.\s*\*\*([^*]+)\*\*\s*-\s*([^\n]+)/g);
      console.log(`🔍 [파싱] 창의적 전략 아이템 수:`, creativeItems?.length || 0);

      if (creativeItems) {
        creativeItems.slice(0, 3).forEach((item, index) => {
          console.log(`🔍 [파싱] 창의적 전략 아이템 ${index + 1}:`, item);
          const match = item.match(/\d+\.\s*\*\*([^*]+)\*\*\s*-\s*(.+)/);
          if (match) {
            const [, companyInfo, reason] = match;
            // 티커와 회사명 분리: "GM (General Motors)" -> ticker: "GM", name: "General Motors"
            const companyMatch = companyInfo.trim().match(/^([A-Z]+)\s*\(([^)]+)\)$/) ||
                                companyInfo.trim().match(/^([A-Z]+)\s+(.+)$/) ||
                                [null, companyInfo.trim(), companyInfo.trim()];

            if (companyMatch) {
              const ticker = companyMatch[1]?.trim() || companyInfo.trim();
              const name = companyMatch[2]?.trim() || companyInfo.trim();

              result.creativeStrategy.push({
                ticker,
                name,
                reason: reason.trim()
              });
              console.log(`✅ [파싱] 창의적 전략 추가:`, { ticker, name, reason: reason.substring(0, 50) + '...' });
            }
          }
        });
      }
    }

    // 분석 근거 섹션 추출
    const reasoningMatch = aiResponse.match(/## 📊 분석 근거[\s\S]*$/);
    if (reasoningMatch) {
      result.analysisReasoning = reasoningMatch[0].trim();
    }

  } catch (parseError) {
    console.warn('⚠️ 투자 추천 파싱 실패, 원본 응답 반환:', parseError);
    // 파싱 실패시 원본 응답을 그대로 사용
  }

  console.log(`✅ [응답 파싱] 파싱 결과:`, {
    traditionalCount: result.traditionalStrategy.length,
    creativeCount: result.creativeStrategy.length,
    hasReasoning: !!result.analysisReasoning,
    traditionalTickers: result.traditionalStrategy.map(s => s.ticker),
    creativeTickers: result.creativeStrategy.map(s => s.ticker)
  });

  return result;
}


