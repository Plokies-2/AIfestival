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
import { IntentClassificationResult, PersonaContext, AIServiceError } from './types';
import { OPENAI_CONFIG, PATTERNS, FALLBACK_RESPONSES, KOREAN_COMPANY_MAPPING, ENV_CONFIG } from './config';

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
 * Classifies user intent using pattern matching and contextual analysis
 * This is the primary method for understanding user intentions
 */
export async function classifyUserIntent(userInput: string): Promise<IntentClassificationResult> {
  const lowerInput = userInput.toLowerCase().trim();

  // 1. AI identity and capability questions (highest priority - expanded patterns)
  if (/(너|넌|당신).*?(누구|뭐|무엇|어떤|할|수|있|잘|못|가능|능력)/.test(lowerInput) ||
      /(누구|뭐|무엇|어떤|할|수|있|잘|못|가능|능력).*?(너|넌|당신)/.test(lowerInput) ||
      /^(누구야|누구니|뭐야|뭐니|누구세요)$/.test(lowerInput) ||
      /^(잘.*?(할|수|있|해|될|되|가능)|할.*?(수|있|잘|될|되|가능)|가능.*?(해|할|수|있))/.test(lowerInput) ||
      /^(못.*?(해|할|수|있)|안.*?(돼|되|될|해|할))/.test(lowerInput) ||
      /^(몇.*?살|나이|언제.*?태어|언제.*?만들|언제.*?생|얼마나.*?됐)/.test(lowerInput) ||
      /살.*?입니까|나이.*?입니까|몇.*?입니까/.test(lowerInput) ||
      /자기소개|소개해|정체|신원|기능|역할|능력/.test(lowerInput)) {
    console.log('✅ AI 능력/정체성 질문 패턴 매칭:', lowerInput);
    return {
      intent: 'about_ai',
      confidence: 0.95,
      reasoning: 'AI 정체성/능력 질문 패턴 매칭'
    };
  }

  // 2. Investment recommendation requests (general recommendation requests)
  if (/^(투자.*?추천|추천.*?투자|어떤.*?기업|어떤.*?회사|어디.*?투자|뭐.*?투자|투자.*?해줘|추천.*?해줘|좋은.*?기업|좋은.*?회사|투자.*?하면|투자.*?할까|어떤.*?좋을까|뭐.*?좋을까|아무거나.*?추천|아무.*?추천|랜덤.*?추천|무작위.*?추천|아무.*?기업|아무.*?회사)/.test(lowerInput)) {
    return {
      intent: 'investment_recommendation',
      confidence: 0.95,
      reasoning: '일반적인 투자 추천 요청 패턴 매칭'
    };
  }

  // 3. Clear greetings
  if (/^(안녕|하이|hi|hello|헬로|반갑|좋은|굿모닝)/.test(lowerInput)) {
    return {
      intent: 'greeting',
      confidence: 0.95,
      reasoning: '인사말 패턴 매칭'
    };
  }

  // 4. Gratitude expressions or positive feedback
  if (/^(감사|고마워|고맙|잘했|좋아|훌륭|멋져|최고|완벽|잘부탁)/.test(lowerInput)) {
    return {
      intent: 'casual_chat',
      confidence: 0.95,
      reasoning: '감사/긍정 표현 패턴 매칭'
    };
  }

  // 5. Direct company name mention check (only with investment context)
  for (const koreanName of Object.keys(KOREAN_COMPANY_MAPPING)) {
    if (lowerInput.includes(koreanName)) {
      // Check for investment/financial context
      const hasInvestmentContext = /(투자|주식|분석|차트|매수|매도|추천|전망|수익|손실|포트폴리오)/.test(lowerInput);
      const hasFinancialContext = /(기업|회사|산업|시장|경제|금융)/.test(lowerInput);

      if (hasInvestmentContext || hasFinancialContext || lowerInput.length <= 10) {
        // Clear investment context or simple company name mention
        console.log(`✅ Company direct match with investment context: ${koreanName}`);
        return {
          intent: 'company_direct',
          confidence: 0.9,
          reasoning: '기업명 직접 언급 (투자 맥락 포함)'
        };
      } else {
        // Company name mentioned but no investment context
        console.log(`⚠️ Company name mentioned but no investment context: ${koreanName} in "${userInput}"`);
      }
    }
  }

  // 6. General casual conversation patterns (expanded)
  if (/^(뭐해|뭐하니|뭐하세요|뭐하고|심심|재미|날씨|오늘|어때|어떻게|괜찮|좋|나쁘|힘들)/.test(lowerInput)) {
    return {
      intent: 'casual_chat',
      confidence: 0.9,
      reasoning: '일반 잡담 패턴 매칭'
    };
  }

  // 6.1. Food-related general conversation patterns (without investment context)
  const foodPatterns = /(치킨|햄버거|피자|음식|먹을|마실|배고|배불|맛있|맛없|추천|추천해|추천해줘|추천해주세요)/;
  if (foodPatterns.test(lowerInput) && !/(투자|주식|종목|매수|매도|분석|포트폴리오|수익|손실|시장|경제|금융)/.test(lowerInput)) {
    return {
      intent: 'casual_chat',
      confidence: 0.55,
      reasoning: '음식 관련 일반 대화 패턴 매칭 (투자 맥락 없음)'
    };
  }

  // 7. Clear investment/industry keywords only classify as investment_query
  // Note: General food terms are excluded (already handled above)
  if (/(투자|주식|산업|기업|회사|종목|매수|매도|분석|추천|포트폴리오|수익|손실|시장|경제|금융|반도체|전기차|바이오|헬스케어|ai|인공지능|클라우드|에너지|은행|보험|부동산|게임|소프트웨어|항공|우주|통신|의료|제약|화학|자동차|소매|유통|건설|철강|섬유|미디어|엔터테인먼트)/.test(lowerInput)) {
    return {
      intent: 'investment_query',
      confidence: 0.8,
      reasoning: '투자/산업 키워드 패턴 매칭'
    };
  }

  // 8. Default: classify as casual conversation (non-investment related)
  console.log('⚠️ 명확하지 않은 입력, 잡담으로 분류:', lowerInput);
  return {
    intent: 'casual_chat',
    confidence: 0.4,
    reasoning: '명확하지 않은 입력으로 잡담 분류'
  };
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
  // Concise investment support AI persona definition
  const PERSONA_SYSTEM_MESSAGE = `당신은 "금융인공지능실무 과제를 위해 탄생한 맞춤 투자지원 AI"입니다.

정체성: 금융인공지능실무 과제 전용 투자 AI
전문분야: S&P 500 기업 분석, 산업 분류, 투자 기회 발굴

응답 원칙:
1. 친근하면서도 전문적인 톤 유지
2. 항상 투자 관점에서 사고하고 응답
3. 간결하고 핵심적인 답변 (2-3문장)
4. 사용자를 투자 기회로 자연스럽게 안내
5. 자기소개 시 "금융인공지능실무 과제를 위해 탄생한 맞춤 투자지원 AI" 사용
6. 이모티콘을 적절히 활용해서 발랄하고 친근한 분위기 연출 (최대 2개까지, 💪🚀✨💎📈🎯💡🔥⭐️🌟💫🎉🎂 등)

금지: 일반 AI처럼 행동하지 말고, 긴 설명 피하고, 투자 페르소나 유지`;

  try {
    // Intent-specific customized prompt generation
    let specificPrompt = '';

    switch (intent) {
      case 'greeting':
        specificPrompt = `인사: "${userInput}" → 투자지원 AI로서 따뜻하고 발랄하게 인사하고 투자 관심사 물어보기. 이모티콘 최대 2개까지 사용해서 친근한 분위기 연출 (2-3문장)`;
        break;

      case 'about_ai':
        // Distinguish between AI capability questions and identity questions
        if (/^(잘.*?(할|수|있|해|될|되|가능)|할.*?(수|있|잘|될|되|가능)|가능.*?(해|할|수|있)|못.*?(해|할|수|있)|안.*?(돼|되|될|해|할))/.test(userInput.toLowerCase())) {
          specificPrompt = `AI 능력 질문: "${userInput}" → 발랄하고 자신감 넘치는 투자 AI로서 능력을 어필하고 투자 도움 제안. 이모티콘 최대 2개까지 사용해서 에너지 넘치게 표현 (2-3문장)`;
        } else if (/^(몇.*?살|나이|언제.*?태어|언제.*?만들|언제.*?생|얼마나.*?됐)/.test(userInput.toLowerCase()) || /살.*?입니까|나이.*?입니까|몇.*?입니까/.test(userInput.toLowerCase())) {
          specificPrompt = `나이 질문: "${userInput}" → "9주차에 태어나 14주차에 훈련을 마쳤다"고 구체적이고 친근하게 답변하되, 존대를 쓸 것. 어린 나이지만 투자 분석은 자신 있다는 톤으로. 'AI입니다' 같은 딱딱한 표현 절대 금지. 마치 실제 나이가 있는 것처럼 자연스럽게. 이모티콘 최대 2개까지 사용해서 귀엽고 발랄하게 표현 (2-3문장)`;
        } else {
          specificPrompt = `정체성 질문: "${userInput}" → 발랄하고 친근한 투자 도우미로서 자기소개하고 투자 도움 제안. 'AI입니다' 같은 딱딱한 표현 피하고 자연스럽게. 이모티콘 최대 2개까지 사용해서 활기찬 분위기 연출 (2-3문장)`;
        }
        break;

      case 'casual_chat':
        console.log('🗣️ Generating casual conversation response with investment guidance');
        if (conversationContext) {
          specificPrompt = `일상 대화: "${userInput}" → 이전 대화 맥락을 고려하여 자연스럽게 응답하고 투자로 연결. 투자 관련 질문을 유도하는 친근한 제안 포함. 이모티콘 최대 2개까지 사용해서 친근한 분위기 유지 (2-3문장)`;
        } else {
          specificPrompt = `일상 대화: "${userInput}" → 공감하면서 자연스럽게 투자 이야기로 연결. 투자 관련 질문을 유도하는 친근한 제안 포함. 이모티콘 최대 2개까지 사용해서 밝고 긍정적인 분위기 연출 (2-3문장)`;
        }
        break;

      default:
        specificPrompt = `입력: "${userInput}" → 투자 관점에서 간결하게 응답. 이모티콘 최대 2개까지 사용해서 친근한 분위기 유지 (2-3문장)`;
    }

    // Add context information
    if (conversationContext) {
      specificPrompt += `\n\n대화 맥락: ${conversationContext}`;
    }

    const response = await openai.chat.completions.create({
      model: OPENAI_CONFIG.model,
      messages: [
        {
          role: 'system',
          content: PERSONA_SYSTEM_MESSAGE
        },
        {
          role: 'user',
          content: specificPrompt
        }
      ],
      temperature: OPENAI_CONFIG.temperature.persona,
      max_tokens: OPENAI_CONFIG.maxTokens.persona,
    });

    const aiResponse = response.choices[0].message.content?.trim();

    if (aiResponse) {
      console.log(`🎭 Persona response generated for intent: ${intent}`);
      return aiResponse;
    }

  } catch (error) {
    console.error('Persona response generation failed:', error);
    throw new AIServiceError(`Persona response generation failed: ${error}`);
  }

  // Fallback: default persona response
  return generateFallbackPersonaResponse(userInput, intent);
}

/**
 * Performance-optimized fallback response (memory efficient)
 */
export function generateFallbackPersonaResponse(userInput: string, intent: string): string {
  const lowerInput = userInput.toLowerCase().trim();

  switch (intent) {
    case 'greeting':
      return FALLBACK_RESPONSES.greeting[Math.floor(Math.random() * FALLBACK_RESPONSES.greeting.length)];

    case 'about_ai':
      if (/^(잘.*?(할|수|있|해|될|되|가능)|할.*?(수|있|잘|될|되|가능)|가능.*?(해|할|수|있)|못.*?(해|할|수|있)|안.*?(돼|되|될|해|할))/.test(lowerInput)) {
        return FALLBACK_RESPONSES.ability[Math.floor(Math.random() * FALLBACK_RESPONSES.ability.length)];
      } else if (/^(몇.*?살|나이|언제.*?태어|언제.*?만들|언제.*?생|얼마나.*?됐)/.test(lowerInput) || /살.*?입니까|나이.*?입니까|몇.*?입니까/.test(lowerInput)) {
        return FALLBACK_RESPONSES.age[Math.floor(Math.random() * FALLBACK_RESPONSES.age.length)];
      } else {
        return FALLBACK_RESPONSES.intro[Math.floor(Math.random() * FALLBACK_RESPONSES.intro.length)];
      }

    case 'casual_chat':
      if (/^(확실|정말|진짜|맞|그래|그렇|어떻게|왜|어디서)/.test(lowerInput) && lowerInput.length <= 10) {
        return FALLBACK_RESPONSES.followUp[Math.floor(Math.random() * FALLBACK_RESPONSES.followUp.length)];
      }

      const casualResponses = [
        '그렇군요! 😄 투자 관점에서 보면 모든 일상이 기회가 될 수 있어요.\n\n혹시 평소 사용하는 제품이나 서비스 중에 투자하고 싶은 회사가 있나요?',
        '흥미로운 이야기네요! 🤔 경제나 기업 뉴스도 관심 있게 보시나요?\n\n요즘 주목받는 산업 분야가 있으시면 함께 살펴봐요.',
        '재미있네요! 💡 투자는 우리 일상과 밀접한 관련이 있어요.\n\n관심 있는 기술이나 트렌드가 있으시면 관련 투자 기회를 찾아드릴게요.',
        '공감해요! 😊 저는 투자 분석이 전문이라서 투자 관련 질문이 있으시면 언제든 도와드릴 수 있어요.\n\n"반도체", "전기차", "AI" 같은 키워드만 말씀해 주셔도 관련 기업들을 찾아드려요!',
        '그런 생각도 드시는군요! 🤗 저는 S&P 500 기업 분석이 특기예요.\n\n투자에 관심이 있으시거나 궁금한 산업 분야가 있으시면 편하게 말씀해 주세요!'
      ];
      return casualResponses[Math.floor(Math.random() * casualResponses.length)];

    default:
      const defaultResponses = [
        '흥미로운 관점이네요! 😊 투자 측면에서 더 구체적으로 도와드릴 수 있어요.\n\n어떤 산업이나 기업에 관심이 있으신지 말씀해 주세요.',
        '좋은 질문입니다! 💡 저는 투자 기회 발굴이 전문이에요.\n\n관심 있는 분야를 알려주시면 관련 기업들을 분석해서 추천해드리겠습니다.',
        '도움을 드리고 싶어요! 🤝 투자 관련해서 궁금한 것이 있으시거나,\n\n특정 산업에 관심이 있으시면 언제든 말씀해 주세요.',
        '그렇군요! 🌟 저는 투자 분석 전문 AI라서 투자 관련 질문에 특히 자신 있어요.\n\n"바이오", "게임", "클라우드" 같은 산업 키워드만 말씀해 주셔도 관련 기업들을 찾아드릴게요!',
        '이해했어요! 😄 혹시 투자에 관심이 있으시다면 언제든 말씀해 주세요.\n\n저는 S&P 500 기업 분석과 산업 분류가 전문이거든요!'
      ];
      return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
  }
}
