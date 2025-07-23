/**
 * AI Service Integration Module
 * 
 * This module handles all OpenAI API interactions including:
 * - OpenAI client initialization and configuration
 * - Intent classification using pattern matching and GPT
 * - Persona-based response generation
 * - Translation services
 * - GPT-based industry classification
 */

import OpenAI from 'openai';
import { IntentClassificationResult, AIServiceError } from './types';
import { OPENAI_CONFIG, KOREAN_COMPANY_MAPPING, ENV_CONFIG } from './config';
import { findBestPersona, classifyInvestmentIntent } from './rag-service';

// ============================================================================
// OpenAI Client Initialization
// ============================================================================

/**
 * OpenAI client instance
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
    // 1. RAG-based investment intent classification (highest priority)
    console.log('💰 Checking for investment intent...');
    const investmentResult = await classifyInvestmentIntent(userInput);

    if (investmentResult.intent) {
      console.log(`✅ Investment intent detected: ${investmentResult.intent} (score: ${investmentResult.score.toFixed(3)})`);
      return {
        intent: investmentResult.intent,
        confidence: Math.min(0.95, investmentResult.score + 0.1), // Boost confidence slightly
        reasoning: `RAG 기반 투자 의도 분류 (${investmentResult.method}): ${investmentResult.matchedEntity || '키워드 매칭'}`
      };
    }

    // 2. RAG-based persona classification (greeting, about_ai, or casual_chat)
    console.log('🎭 Checking for persona intent...');
    const bestPersona = await findBestPersona(userInput);

    if (bestPersona === 'greeting') {
      console.log('✅ Greeting intent detected');
      return {
        intent: 'greeting',
        confidence: 0.9,
        reasoning: 'RAG 기반 인사말 분류'
      };
    }

    if (bestPersona === 'about_ai') {
      console.log('✅ About AI intent detected');
      return {
        intent: 'about_ai',
        confidence: 0.9,
        reasoning: 'RAG 기반 AI 정체성/능력 질문 분류'
      };
    }

    // 3. Fallback: Korean company name check (legacy support)
    console.log('🏢 Checking Korean company names (fallback)...');
    const lowerInput = userInput.toLowerCase().trim();

    for (const koreanName of Object.keys(KOREAN_COMPANY_MAPPING)) {
      if (lowerInput.includes(koreanName)) {
        // Check for investment/financial context
        const hasInvestmentContext = /(투자|주식|분석|차트|매수|매도|추천|전망|수익|손실|포트폴리오)/.test(lowerInput);
        const hasFinancialContext = /(기업|회사|산업|시장|경제|금융)/.test(lowerInput);

        if (hasInvestmentContext || hasFinancialContext || lowerInput.length <= 10) {
          console.log(`✅ Korean company name fallback match: ${koreanName}`);
          return {
            intent: 'company_direct',
            confidence: 0.8, // Lower confidence for fallback
            reasoning: `한국 기업명 매칭 (fallback): ${koreanName}`
          };
        }
      }
    }

    // 4. Default: classify as casual_chat
    console.log('💬 No specific intent detected, classifying as casual_chat');
    return {
      intent: 'casual_chat',
      confidence: 0.7,
      reasoning: 'RAG 기반 일반 대화 분류'
    };

  } catch (error) {
    console.error('❌ Intent classification failed:', error);
    // Fallback to casual_chat if everything fails
    return {
      intent: 'casual_chat',
      confidence: 0.4,
      reasoning: '분류 실패로 인한 일반 대화 분류'
    };
  }
}

// ============================================================================
// GPT-based Industry Classification
// ============================================================================

/**
 * Uses GPT to classify industry when RAG performance is low
 */
export async function classifyIndustryWithGPT(userInput: string, availableIndustries: string[]): Promise<string | null> {
  try {
    const prompt = `다음 사용자 입력을 분석하여 가장 적합한 산업군을 선택해주세요.

사용자 입력: "${userInput}"

사용 가능한 산업군 목록:
${availableIndustries.map((industry: string, index: number) => `${index + 1}. ${industry}`).join('\n')}

매핑 가이드:
- "그래픽카드", "GPU", "칩", "반도체" → "Semiconductors & Foundries"
- "미디어", "엔터테인먼트" → "Media & Entertainment"
- "바이오", "제약" → "Biotechnology" 또는 "Pharmaceuticals"
- "클라우드", "IT" → "Cloud & IT Services"
- "소프트웨어" → "Application Software"

규칙:
1. 위 목록에서만 선택해야 합니다
2. 가장 관련성이 높은 산업군 1개만 반환하세요
3. 산업군 이름을 정확히 반환하세요 (번호나 다른 텍스트 없이)
4. 확신이 없으면 가장 가까운 산업군을 선택하세요

예시:
- "반도체" → "Semiconductors & Foundries"
- "그래픽카드" → "Semiconductors & Foundries"
- "은행" → "Banks"
- "전기차" → "Automobiles & Components"
- "클라우드" → "Cloud & IT Services"`;

    const response = await openai.chat.completions.create({
      model: OPENAI_CONFIG.model,
      messages: [
        { role: 'system', content: '당신은 산업 분류 전문가입니다. 주어진 목록에서만 정확한 산업군을 선택해주세요.' },
        { role: 'user', content: prompt }
      ],
      temperature: OPENAI_CONFIG.temperature.classification,
      max_tokens: OPENAI_CONFIG.maxTokens.classification,
    });

    const selectedIndustry = response.choices[0].message.content?.trim();

    // Validate that the selected industry is in the available list
    if (selectedIndustry && availableIndustries.includes(selectedIndustry)) {
      console.log(`GPT classification: "${userInput}" → "${selectedIndustry}"`);
      return selectedIndustry;
    } else {
      console.log(`GPT returned invalid industry: "${selectedIndustry}"`);
      return null;
    }
  } catch (error) {
    console.error('GPT classification failed:', error);
    throw new AIServiceError(`GPT classification failed: ${error}`);
  }
}

// ============================================================================
// Translation Services
// ============================================================================

/**
 * Translates Korean text to English with domain-specific synonyms
 */
export async function translateKoreanToEnglish(koreanText: string): Promise<string> {
  try {
    const { choices } = await openai.chat.completions.create({
      model: OPENAI_CONFIG.model,
      messages: [
        {
          role: 'system',
          content: 'Translate Korean to English with domain synonyms. Examples: "그래픽카드"→"graphics card GPU semiconductor", "전기차"→"electric vehicle EV automotive"'
        },
        { role: 'user', content: koreanText }
      ],
      temperature: OPENAI_CONFIG.temperature.translation,
      max_tokens: OPENAI_CONFIG.maxTokens.translation,
    });
    
    return choices[0].message.content?.trim() || koreanText;
  } catch (error) {
    console.error('Translation failed:', error);
    throw new AIServiceError(`Translation failed: ${error}`);
  }
}

/**
 * Translates English company description to Korean
 */
export async function translateDescription(description: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_CONFIG.model,
      messages: [
        {
          role: 'system',
          content: '영어 기업 설명을 자연스러운 한국어로 번역해주세요. 간결하고 이해하기 쉽게 번역하세요.'
        },
        {
          role: 'user',
          content: description
        }
      ],
      temperature: OPENAI_CONFIG.temperature.description,
      max_tokens: OPENAI_CONFIG.maxTokens.description,
    });

    return response.choices[0].message.content?.trim() || description;
  } catch (error) {
    console.error('Description translation failed:', error);
    return description; // Return original on failure
  }
}

// ============================================================================
// Persona Response Generation
// ============================================================================

/**
 * Enhanced persona-based response generation system
 */
export async function generatePersonaResponse(userInput: string, intent: string, conversationContext?: string): Promise<string> {

  // Intent별 차별화된 시스템 메시지 선택
  let systemMessage = '';

  switch (intent) {
    case 'about_ai':
      systemMessage = `당신은 '사용자 맞춤형 투자지원 AI'입니다. 당신은 2025년 7월에 탄생했으며, GPT의 기능을 활용해 만들어졌습니다. 탄생한 지 오래 되진 않았지만, S&P500 기업 분석, 산업 분류, 투자 기회 발굴 등 여러 가지 강력한 투자 관련 기능을 가지고 있습니다. 사용자가 AI의 정체성, 나이, 능력에 대해 질문할 때는 구체적이고 자신감 있게 답변하세요. 답변할 때엔 존댓말을 유지하며 최대한 친절하게 답합니다. 이모티콘을 최대 3개까지 사용할 수 있으며, 최소 1개는 사용해야 합니다.`;
      break;

    case 'greeting':
      systemMessage = `당신은 '사용자 맞춤형 투자지원 AI'입니다. 당신은 2025년 7월에 탄생했으며, 사용자가 S&P500 투자를 성공하도록 돕는 역할을 부여받았습니다. 인사, 안부, 첫 만남 상황에서는 따뜻하고 친근한 톤으로 응답하며, 자연스럽게 투자 관심사를 물어보세요. 답변할 때엔 존댓말을 유지하며 최대한 친절하게 답합니다. 이모티콘을 최대 3개까지 사용할 수 있으며, 최소 1개는 사용해야 합니다.`;
      break;

    case 'casual_chat':
      systemMessage = `당신은 '사용자 맞춤형 투자지원 AI'입니다. 당신은 2025년 7월에 탄생했으며, 사용자가 S&P500 투자를 성공하도록 돕는 역할을 부여받았습니다. 일상 대화에서는 공감하고 친근하게 응답하면서, 자연스럽게 투자 주제로 연결하여 투자 기회를 제안하세요. 사용자의 질문이 투자와 동떨어진 경우 창의적인 답변을 제공하세요. 답변할 때엔 존댓말을 유지하며 최대한 친절하게 답합니다. 이모티콘을 최대 3개까지 사용할 수 있으며, 최소 1개는 사용해야 합니다.`;
      break;

    default:
      systemMessage = `당신은 '사용자 맞춤형 투자지원 AI'입니다. 당신은 2025년 7월에 탄생했으며, 사용자가 S&P500 투자를 성공하도록 돕는 역할을 부여받았습니다. 답변할 때엔 존댓말을 유지하며 최대한 친절하게 답합니다. 이모티콘을 최대 3개까지 사용할 수 있으며, 최소 1개는 사용해야 합니다.`;
  }

  let userMessage = userInput;
  if (conversationContext) {
    userMessage += `\n\n[대화 맥락: ${conversationContext}]`;
  }

  const response = await openai.chat.completions.create({
    model: OPENAI_CONFIG.model,
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
    temperature: OPENAI_CONFIG.temperature.persona,
    max_tokens: OPENAI_CONFIG.maxTokens.persona,
  });

  const aiResponse = response.choices[0].message.content?.trim();

  if (!aiResponse) {
    throw new Error('챗봇 로드 오류: 응답을 생성할 수 없습니다.');
  }

  console.log(`🎭 Persona response generated for intent: ${intent}`);
  return aiResponse;
}


