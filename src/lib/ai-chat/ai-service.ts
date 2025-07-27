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
import { KOREAN_COMPANY_MAPPING, OPENAI_CONFIG, ENV_CONFIG } from './config';
import { findBestPersona, classifyInvestmentIntent } from './rag-service';

// ============================================================================
// OpenAI Client 초기화 (복구됨)
// ============================================================================

/**
 * OpenAI client instance for dynamic response generation
 */
const openai = new OpenAI({
  apiKey: ENV_CONFIG.openaiApiKey
});

// ============================================================================
// Intent Classification
// ============================================================================

/**
 * Classifies user intent using RAG-based classification for both investment and persona intents
 * This is the primary method for understanding user intentions
 */
export async function classifyUserIntent(userInput: string): Promise<IntentClassificationResult> {
  console.log(`🔍 Classifying user intent for: "${userInput}"`);

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
      console.log(`🔍 [2단계 RAG] classifyInvestmentIntent 호출 시작`);
      const investmentResult = await classifyInvestmentIntent(userInput);
      console.log(`🔍 [2단계 RAG] classifyInvestmentIntent 결과:`, investmentResult);

      if (investmentResult.intent) {
        console.log(`✅ [2단계 RAG] 투자 의도 확정: ${investmentResult.intent}`);
        return {
          intent: investmentResult.intent,
          confidence: Math.min(0.95, investmentResult.score + 0.1), // Boost confidence slightly
          reasoning: `2단계 RAG 기반 투자 의도 분류 (${investmentResult.method}): ${investmentResult.matchedEntity || '키워드 매칭'}`
        };
      } else {
        console.log(`❌ [2단계 RAG] 투자 의도 없음, 기본값으로 진행`);
      }
    }

    // 3. Fallback: Korean company name check (legacy support)
    const lowerInput = userInput.toLowerCase().trim();

    for (const koreanName of Object.keys(KOREAN_COMPANY_MAPPING)) {
      if (lowerInput.includes(koreanName)) {
        // 제거된 기능: 한국 기업명 컨텍스트 기반 필터링 - 사용되지 않던 레거시 코드
        return {
          intent: 'company_direct',
          confidence: 0.8, // Lower confidence for fallback
          reasoning: `한국 기업명 매칭 (fallback): ${koreanName}`
        };
      }
    }

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
// 제거된 기능: GPT 기반 산업 분류 백업 로직
// ============================================================================
// 제거된 기능: classifyIndustryWithGPT - RAG 정확도가 낮을 때 사용되던 백업 로직



// ============================================================================
// GPT 기반 동적 응답 생성 (복구됨)
// ============================================================================

/**
 * GPT 기반 동적 응답 생성 - 의도별 차별화된 응답
 * 복구된 기능: 분기별 max_tokens 설정 (greeting: 180, about_ai: 200)
 * 복구된 기능: GPT-4.1-nano 모델 기반 동적 응답 생성
 * 제거된 기능: casual_chat 의도 처리 (더 이상 사용되지 않음)
 */
export async function generateDynamicResponse(userInput: string, intent: string): Promise<string> {
  // Intent별 차별화된 시스템 메시지 선택
  let systemMessage = '';

  switch (intent) {
    case 'about_ai':
      systemMessage = `당신은 '사용자 맞춤형 투자지원 AI'입니다. 당신은 2025년 7월에 탄생했으며, GPT의 기능을 활용해 만들어졌습니다. 탄생한 지 오래 되진 않았지만, S&P500 기업 분석, 산업 분류, 투자 기회 발굴 등 여러 가지 강력한 투자 관련 기능을 가지고 있습니다. 사용자가 AI의 정체성, 나이, 능력에 대해 질문할 때는 구체적이고 자신감 있게 답변하세요. 답변할 때엔 존댓말을 유지하며 최대한 친절하게 답합니다. 이모티콘을 최대 3개까지 사용할 수 있으며, 최소 1개는 사용해야 합니다.`;
      break;

    case 'greeting':
      systemMessage = `당신은 '사용자 맞춤형 투자지원 AI'입니다. 당신은 2025년 7월에 탄생했으며, 사용자가 S&P500 투자를 성공하도록 돕는 역할을 부여받았습니다. 인사, 안부, 첫 만남 상황에서는 따뜻하고 친근한 톤으로 응답하며, 자연스럽게 투자 관심사를 물어보세요. 답변할 때엔 존댓말을 유지하며 최대한 친절하게 답합니다. 이모티콘을 최대 3개까지 사용할 수 있으며, 최소 1개는 사용해야 합니다.`;
      break;

    // 제거된 기능: casual_chat 의도 처리 - 더 이상 사용되지 않음

    default:
      systemMessage = `당신은 '사용자 맞춤형 투자지원 AI'입니다. 당신은 2025년 7월에 탄생했으며, 사용자가 S&P500 투자를 성공하도록 돕는 역할을 부여받았습니다. 답변할 때엔 존댓말을 유지하며 최대한 친절하게 답합니다. 이모티콘을 최대 3개까지 사용할 수 있으며, 최소 1개는 사용해야 합니다.`;
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
    // 제거된 기능: casual_chat max_tokens 설정 - 더 이상 사용되지 않음
    default:
      maxTokens = 150; // 기타 상황은 적당한 길이
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-nano', // GPT-4.1-nano 모델 사용
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
      throw new Error('GPT 응답 생성 실패');
    }

    console.log(`🎭 Dynamic response generated for intent: ${intent}`);
    return aiResponse;

  } catch (error) {
    console.error('❌ GPT response generation failed:', error);
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
      return 'GPT 호출 오류!';

    case 'about_ai':
      return 'GPT 호출 오류!';

    // 제거된 기능: casual_chat fallback 응답 - 더 이상 사용되지 않음

    default:
      return 'GPT 호출 오류!';
  }
}


