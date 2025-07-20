
// src/pages/api/ai_chat.ts
//-----------------------------------------------------------
// 빠른 3단계 파이프라인 챗봇 - GPT-4.1-nano 사용
//-----------------------------------------------------------
import { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuid } from 'uuid';
import OpenAI from 'openai';
import {
  getEmbeddings,
  cosine,
  IndustryRow,
} from '@/lib/embeddings';
import { QUICK_ENRICHED_FINAL as DATA } from '@/data/sp500_enriched_final';

// LSTM Data Integration for AI Chat
interface LSTMData {
  symbol: string;
  timestamp: string;
  prediction_data: {
    shock_level: string;
    shock_description: string;
    last_prediction: number;
    accuracy: number;
    model_type: string;
  };
  analysis: {
    ai_summary: string;
    explanation: string;
  };
}

//-----------------------------------------------------------
// OpenAI 클라이언트 - GPT-4.1 nano (가장 빠르고 저렴)
//-----------------------------------------------------------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

//-----------------------------------------------------------
// RAG Score Thresholds for Casual Conversation Detection
//
// 
//-----------------------------------------------------------
const RAG_THRESHOLDS = {
  INDUSTRY_MIN_SCORE: 0.25,       // Minimum score for industry-level matching (lowered for better recall)
  COMPANY_MIN_SCORE: 0.2,         // Minimum score for company-level matching (lowered for better recall)
  GPT_FALLBACK_THRESHOLD: 0.15,   // Threshold to trigger GPT classification (lowered)
  CASUAL_CONVERSATION_THRESHOLD: 0.2  // Below this score = casual conversation (lowered for better industry matching)
} as const;

//-----------------------------------------------------------
// 파이프라인 상태 관리
//-----------------------------------------------------------
type Stage = 'START' | 'SHOW_INDUSTRY' | 'ASK_CHART';

interface SessionState {
  stage: Stage;
  selectedIndustry: string | null;
  industryCompanies: string[]; // 정확히 5개 티커
  selectedTicker: string | null;
  conversationHistory: Array<{
    user: string;
    ai: string;
    intent: string;
    timestamp: number;
  }>;
  lastActivity: number; // 성능 최적화: 세션 정리용
}

const SESSIONS = new Map<string, SessionState>();

// 패턴 매칭
const POSITIVE_PATTERNS = /^(네|예|응|좋아|맞아|그래|yes|y|ok)/i;
const NEGATIVE_PATTERNS = /^(아니|아니요|아뇨|싫어|안돼|no|n|nope|ㄴㄴ|ㄴ|노|안해|싫|패스|pass)/i;

// 성능 최적화: 런타임에 동적으로 생성하여 메모리 절약
const getAvailableIndustries = (() => {
  let cached: string[] | null = null;
  return () => {
    if (!cached) {
      cached = [...new Set(Object.values(DATA).map((c: any) => c.industry))];
    }
    return cached;
  };
})();

// 성능 최적화: 세션 정리 (메모리 누수 방지)
const cleanupOldSessions = () => {
  const now = Date.now();
  const THIRTY_MINUTES = 30 * 60 * 1000;

  for (const [sessionId, session] of SESSIONS.entries()) {
    if (now - session.lastActivity > THIRTY_MINUTES) {
      SESSIONS.delete(sessionId);
    }
  }
};

// 주기적 세션 정리 (5분마다)
setInterval(cleanupOldSessions, 5 * 60 * 1000);

//-----------------------------------------------------------
// LSTM Data Integration Functions
//-----------------------------------------------------------
async function getLSTMDataForSymbol(symbol: string): Promise<LSTMData | null> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/lstm_data?symbol=${symbol}&format=summary`);
    if (!response.ok) {
      return null;
    }
    const result = await response.json();
    return result.success ? result.data : null;
  } catch (error) {
    console.error(`Failed to get LSTM data for ${symbol}:`, error);
    return null;
  }
}

async function getAvailableLSTMSymbols(): Promise<string[]> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/lstm_data?action=list`);
    if (!response.ok) {
      return [];
    }
    const result = await response.json();
    return result.success ? (result.available_symbols || []) : [];
  } catch (error) {
    console.error('Failed to get available LSTM symbols:', error);
    return [];
  }
}

async function enhanceResponseWithLSTMData(companies: string[], response: string): Promise<string> {
  try {
    const availableSymbols = await getAvailableLSTMSymbols();
    const lstmDataPromises = companies
      .filter(ticker => availableSymbols.includes(ticker))
      .slice(0, 2) // Limit to 2 companies to avoid overwhelming the response
      .map(ticker => getLSTMDataForSymbol(ticker));

    const lstmResults = await Promise.all(lstmDataPromises);
    const validResults = lstmResults.filter(result => result !== null) as LSTMData[];

    if (validResults.length > 0) {
      let lstmEnhancement = '\n\n🔮 **LSTM 실시간 분석 결과:**\n';

      for (const data of validResults) {
        const companyName = getCompanyName(data.symbol);
        lstmEnhancement += `\n**${companyName} (${data.symbol})**: ${data.analysis.ai_summary}`;
      }

      lstmEnhancement += '\n\n*LSTM 분석은 AI 기반 실시간 예측으로 참고용입니다.*';
      return response + lstmEnhancement;
    }

    return response;
  } catch (error) {
    console.error('Failed to enhance response with LSTM data:', error);
    return response;
  }
}

//-----------------------------------------------------------
// GPT API를 사용한 산업 분류 (RAG 성능이 낮을 때 사용)
//-----------------------------------------------------------
async function classifyIndustryWithGPT(userInput: string): Promise<string | null> {
  try {
    const availableIndustries = getAvailableIndustries();
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
      model: 'gpt-4.1-nano',
      messages: [
        { role: 'system', content: '당신은 산업 분류 전문가입니다. 주어진 목록에서만 정확한 산업군을 선택해주세요.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0,
      max_tokens: 50,
    });

    const selectedIndustry = response.choices[0].message.content?.trim();

    // 선택된 산업이 유효한 목록에 있는지 확인
    if (selectedIndustry && availableIndustries.includes(selectedIndustry)) {
      console.log(`GPT classification: "${userInput}" → "${selectedIndustry}"`);
      return selectedIndustry;
    } else {
      console.log(`GPT returned invalid industry: "${selectedIndustry}"`);
      return null;
    }
  } catch (error) {
    console.error('GPT classification failed:', error);
    return null;
  }
}

//-----------------------------------------------------------
// STAGE 0: 한국어 입력 → 산업 매칭 (RAG 임계값 적용)
//-----------------------------------------------------------
async function findBestIndustry(userInput: string): Promise<string | null> {
  // 성능 최적화: 간단한 한국어 키워드 매핑으로 번역 API 호출 최소화
  let enhancedQuery = userInput;
  if (/[가-힣]/.test(userInput)) {
    // 빠른 키워드 매핑 (API 호출 없이)
    const quickTranslations: Record<string, string> = {
      '반도체': 'semiconductors foundries chip fabrication',
      '그래픽카드': 'semiconductors foundries graphics card GPU nvidia amd',
      '그래픽': 'semiconductors foundries graphics GPU nvidia',
      '칩': 'semiconductors foundries chip',
      '전기차': 'electric vehicle EV automotive',
      '은행': 'bank financial',
      '바이오': 'biotechnology pharmaceutical',
      '클라우드': 'cloud computing IT services',
      '인공지능': 'artificial intelligence AI semiconductors',
      'ai': 'artificial intelligence semiconductors foundries',
      '소프트웨어': 'application software technology',
      '게임': 'gaming entertainment media',
      '항공': 'aerospace aviation defense',
      '미디어': 'media entertainment',
      '엔터테인먼트': 'media entertainment',
      '의료': 'healthcare medical devices',
      '제약': 'pharmaceuticals biotechnology drug',
      '자동차': 'automotive vehicle',
      '에너지': 'energy power utilities',
      '통신': 'telecommunications telecom',
      '만드는': 'manufacturing production',
      '회사': 'company companies corporation',
      '기업': 'company companies corporation',
      '산업': 'industry industrial',
      '분야': 'industry sector',
      '업계': 'industry sector',
      '제조': 'manufacturing production',
      '생산': 'manufacturing production',
      '개발': 'development technology',
      '설계': 'design technology',
      '디자인': 'design technology'
    };

    // 빠른 매핑 시도 (복합 키워드 지원)
    let foundTranslation = false;
    const translationParts: string[] = [];

    for (const [korean, english] of Object.entries(quickTranslations)) {
      if (userInput.includes(korean)) {
        translationParts.push(english);
        foundTranslation = true;
      }
    }

    if (foundTranslation) {
      // 모든 매칭된 번역을 결합
      enhancedQuery = `${userInput} ${translationParts.join(' ')}`;
      console.log(`Enhanced query with Korean mappings: "${enhancedQuery}"`);
    }

    // 매핑되지 않은 경우에만 API 호출 (성능 최적화)
    if (!foundTranslation && userInput.length > 10) {
      try {
        const { choices } = await openai.chat.completions.create({
          model: 'gpt-4.1-nano',
          messages: [
            {
              role: 'system',
              content: 'Translate Korean to English with domain synonyms. Examples: "그래픽카드"→"graphics card GPU semiconductor", "전기차"→"electric vehicle EV automotive"'
            },
            { role: 'user', content: userInput }
          ],
          temperature: 0,
          max_tokens: 30,
        });
        const translation = choices[0].message.content?.trim();
        if (translation) {
          enhancedQuery = `${userInput} ${translation}`;
        }
      } catch (error) {
        console.error('Translation failed:', error);
      }
    }
  }

  // RAG: 사용자 입력 임베딩 생성
  const queryEmbedding = (await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: enhancedQuery
  })).data[0].embedding;

  const normalizedQuery = queryEmbedding.map((v, _, arr) => v / Math.hypot(...arr));

  // RAG: 미리 계산된 산업 임베딩과 코사인 유사도 계산
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

  // RAG 임계값 체크: 산업 레벨 점수가 너무 낮으면 회사 레벨 검색 시도
  if (bestScore < RAG_THRESHOLDS.COMPANY_MIN_SCORE) {
    console.log('Industry score too low, trying company-level RAG...');

    const { companies } = await getEmbeddings();
    let bestCompanyIndustry: string | null = null;
    let bestCompanyScore = -1;

    // 성능 최적화: 상위 n개 회사만 검색 - 최대 500
    const topCompanies = companies.slice(0, 500);
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

  // RAG 임계값 체크: 점수가 임계값보다 낮으면 잡담으로 분류
  if (bestScore < RAG_THRESHOLDS.CASUAL_CONVERSATION_THRESHOLD) {
    console.log(`⚠️ RAG score too low (${bestScore.toFixed(3)} < ${RAG_THRESHOLDS.CASUAL_CONVERSATION_THRESHOLD}), classifying as casual conversation`);

    // GPT 분류를 시도하되, 실패하면 잡담으로 처리
    if (bestScore < RAG_THRESHOLDS.GPT_FALLBACK_THRESHOLD) {
      console.log('RAG scores too low, trying GPT classification...');
      const gptIndustry = await classifyIndustryWithGPT(userInput);
      if (gptIndustry) {
        console.log(`GPT classification successful: ${gptIndustry}`);
        bestIndustry = gptIndustry;
        bestScore = 0.8; // GPT 분류 성공 시 높은 점수 부여
      } else {
        console.log('GPT classification also failed, treating as casual conversation');
        return null; // 잡담으로 분류
      }
    } else {
      console.log('Score above GPT threshold but below casual threshold, treating as casual conversation');
      return null; // 잡담으로 분류
    }
  }

  // 선택된 산업이 실제 DATA에 있는지 검증 (캐시된 산업 목록 사용)
  const validIndustries = getAvailableIndustries();
  if (bestIndustry && !validIndustries.includes(bestIndustry)) {
    console.log(`Selected industry "${bestIndustry}" not found in DATA.`);
    bestIndustry = validIndustries[0]; // 첫 번째 산업 사용
  }

  // 유효한 산업 반환
  return bestIndustry;
}

//-----------------------------------------------------------
// STAGE 1: 산업 내 정확히 5개 회사 선택
//-----------------------------------------------------------
function getIndustryCompanies(industry: string): string[] {
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
    .slice(0, 5) // 정확히 5개
    .map(([ticker, _]: [string, any]) => ticker);

  console.log(`Found ${matchingCompanies.length} companies for industry "${industry}":`, matchingCompanies);
  return matchingCompanies;
}

// 안전한 DATA 접근 함수
function getCompanyName(ticker: string): string {
  const company = (DATA as any)[ticker];
  return company ? company.name : ticker;
}

//-----------------------------------------------------------
// 무작위 투자 추천 기능 (성능 최적화)
//-----------------------------------------------------------
function generateRandomRecommendation(): { industry: string; companies: Array<{ ticker: string; name: string; description: string }> } {
  const allIndustries = getAvailableIndustries();
  const randomIndustry = allIndustries[Math.floor(Math.random() * allIndustries.length)];

  // 해당 산업의 기업들을 효율적으로 수집
  const industryCompanies: Array<{ ticker: string; name: string; description: string }> = [];

  for (const [ticker, company] of Object.entries(DATA)) {
    const comp = company as any;
    if (comp.industry === randomIndustry) {
      industryCompanies.push({
        ticker,
        name: comp.name,
        description: comp.description
      });
    }
  }

  // Fisher-Yates 셔플 알고리즘으로 성능 최적화
  for (let i = industryCompanies.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [industryCompanies[i], industryCompanies[j]] = [industryCompanies[j], industryCompanies[i]];
  }

  return {
    industry: randomIndustry,
    companies: industryCompanies.slice(0, 3)
  };
}

// 영어 설명을 한글로 번역하는 함수
async function translateDescription(description: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
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
      temperature: 0.3,
      max_tokens: 100,
    });

    return response.choices[0].message.content?.trim() || description;
  } catch (error) {
    console.error('Translation failed:', error);
    return description; // 번역 실패 시 원문 반환
  }
}

//-----------------------------------------------------------
// 유틸리티 함수들
//-----------------------------------------------------------
function isPositive(text: string): boolean {
  return POSITIVE_PATTERNS.test(text.trim());
}

function isNegative(text: string): boolean {
  return NEGATIVE_PATTERNS.test(text.trim());
}

// 강화된 페르소나 기반 응답 생성 시스템
async function generatePersonaResponse(userInput: string, intent: string, conversationContext?: string): Promise<string> {
  // 간결한 투자지원 AI 페르소나 정의
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
    // 의도별 맞춤 프롬프트 생성
    let specificPrompt = '';

    switch (intent) {
      case 'greeting':
        specificPrompt = `인사: "${userInput}" → 투자지원 AI로서 따뜻하고 발랄하게 인사하고 투자 관심사 물어보기. 이모티콘 최대 2개까지 사용해서 친근한 분위기 연출 (2-3문장)`;
        break;

      case 'about_ai':
        // AI 능력 질문인지 정체성 질문인지 구분
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

    // 맥락 정보 추가
    if (conversationContext) {
      specificPrompt += `\n\n대화 맥락: ${conversationContext}`;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
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
      temperature: 0.7, // 창의성과 일관성의 균형
      max_tokens: 120, // 간결한 응답을 위해 토큰 수 제한
    });

    const aiResponse = response.choices[0].message.content?.trim();

    if (aiResponse) {
      console.log(`🎭 Persona response generated for intent: ${intent}`);
      return aiResponse;
    }

  } catch (error) {
    console.error('Persona response generation failed:', error);
  }

  // Fallback: 기본 페르소나 응답
  return generateFallbackPersonaResponse(userInput, intent);
}

// 성능 최적화된 fallback 응답 (메모리 효율적)
const FALLBACK_RESPONSES = {
  greeting: [
    '안녕하세요! 저는 금융인공지능실무 과제를 위해 탄생한 맞춤 투자지원 AI예요! 📈✨\n\n어떤 분야에 투자 관심이 있으신지 들려주세요!',
    '안녕하세요! 저는 금융인공지능실무 과제를 위해 탄생한 맞춤 투자지원 AI예요! 💡🚀\n\n관심 있는 산업이나 기업이 있으시면 편하게 말씀해 주세요!',
    '안녕하세요! 저는 금융인공지능실무 과제를 위해 탄생한 맞춤 투자지원 AI예요! ✨💎\n\n함께 투자 기회를 찾아보아요!'
  ],
  ability: [
    '저는 금융인공지능실무 과제를 위해 탄생한 맞춤 투자지원 AI예요! 💪✨\n\nS&P 500 기업 분석과 산업 분류에 자신감 넘치게 도와드릴게요!',
    '저는 금융인공지능실무 과제를 위해 탄생한 맞춤 투자지원 AI예요! 🎯🚀\n\nS&P 500 기업 분석과 투자 기회 발굴이 제 특기예요!'
  ],
  age: [
    '저는 9주차에 태어나서 14주차에 훈련을 마쳤어요! 🎂✨\n\n아직 어리지만 투자 분석은 자신 있답니다!',
    '9주차에 태어나 14주차에 훈련을 완료한 신입 투자 AI예요! 💪🚀\n\n나이는 어리지만 열정만큼은 누구에게도 지지 않아요!'
  ],
  intro: [
    '저는 금융인공지능실무 과제를 위해 탄생한 맞춤 투자지원 AI예요! 🎯✨\n\nS&P 500 기업 분석과 산업 분류에 자신감 넘치게 도와드릴게요!',
    '저는 금융인공지능실무 과제를 위해 탄생한 맞춤 투자지원 AI예요! 💡🚀\n\n"반도체", "전기차" 같은 키워드만 말씀해 주셔도 관련 기업들을 찾아드려요!'
  ],
  followUp: [
    '네, 확실해요! 💪🔥 투자 분석은 제가 가장 자신 있는 분야거든요!\n\n어떤 산업이나 기업에 관심이 있으신지 말씀해 주세요!',
    '물론이죠! 🎯💡 데이터 기반으로 정확한 분석을 해드려요!\n\n투자하고 싶은 분야를 알려주시면 바로 도와드릴게요!'
  ]
} as const;

function generateFallbackPersonaResponse(userInput: string, intent: string): string {
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

// 강화된 의도 분류 함수 (패턴 매칭 기반)
async function classifyUserIntent(userInput: string): Promise<{
  intent: 'greeting' | 'about_ai' | 'investment_query' | 'company_direct' | 'casual_chat' | 'investment_recommendation';
  confidence: number;
  reasoning: string;
}> {
  const lowerInput = userInput.toLowerCase().trim();

  // 1. AI 정체성 및 능력 질문 (최우선 - 확장된 패턴)
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

  // 2. 투자 추천 요청 (일반적인 추천 요청)
  if (/^(투자.*?추천|추천.*?투자|어떤.*?기업|어떤.*?회사|어디.*?투자|뭐.*?투자|투자.*?해줘|추천.*?해줘|좋은.*?기업|좋은.*?회사|투자.*?하면|투자.*?할까|어떤.*?좋을까|뭐.*?좋을까|아무거나.*?추천|아무.*?추천|랜덤.*?추천|무작위.*?추천|아무.*?기업|아무.*?회사)/.test(lowerInput)) {
    return {
      intent: 'investment_recommendation',
      confidence: 0.95,
      reasoning: '일반적인 투자 추천 요청 패턴 매칭'
    };
  }

  // 3. 명확한 인사말
  if (/^(안녕|하이|hi|hello|헬로|반갑|좋은|굿모닝)/.test(lowerInput)) {
    return {
      intent: 'greeting',
      confidence: 0.95,
      reasoning: '인사말 패턴 매칭'
    };
  }

  // 3. 감사 표현이나 긍정적 피드백
  if (/^(감사|고마워|고맙|잘했|좋아|훌륭|멋져|최고|완벽|잘부탁)/.test(lowerInput)) {
    return {
      intent: 'casual_chat',
      confidence: 0.95,
      reasoning: '감사/긍정 표현 패턴 매칭'
    };
  }

  // 4. 기업명 직접 언급 확인 (투자 맥락이 있는 경우만)
  for (const koreanName of Object.keys(KOREAN_COMPANY_MAPPING)) {
    if (lowerInput.includes(koreanName)) {
      // 투자/금융 맥락이 있는지 확인
      const hasInvestmentContext = /(투자|주식|분석|차트|매수|매도|추천|전망|수익|손실|포트폴리오)/.test(lowerInput);
      const hasFinancialContext = /(기업|회사|산업|시장|경제|금융)/.test(lowerInput);

      if (hasInvestmentContext || hasFinancialContext || lowerInput.length <= 10) {
        // 명확한 투자 맥락이 있거나 단순한 기업명 언급인 경우
        console.log(`✅ Company direct match with investment context: ${koreanName}`);
        return {
          intent: 'company_direct',
          confidence: 0.9,
          reasoning: '기업명 직접 언급 (투자 맥락 포함)'
        };
      } else {
        // 기업명이 포함되어 있지만 투자 맥락이 없는 경우 (예: "치킨을 먹을지 피자를 먹을지")
        console.log(`⚠️ Company name mentioned but no investment context: ${koreanName} in "${userInput}"`);
      }
    }
  }

  // 5. 일반적인 잡담 패턴 (확장)
  if (/^(뭐해|뭐하니|뭐하세요|뭐하고|심심|재미|날씨|오늘|어때|어떻게|괜찮|좋|나쁘|힘들)/.test(lowerInput)) {
    return {
      intent: 'casual_chat',
      confidence: 0.9,
      reasoning: '일반 잡담 패턴 매칭'
    };
  }

  // 5.1. 음식 관련 일반 대화 패턴 (투자 맥락이 없는 경우)
  const foodPatterns = /(치킨|햄버거|피자|음식|먹을|마실|배고|배불|맛있|맛없|추천|추천해|추천해줘|추천해주세요)/;
  if (foodPatterns.test(lowerInput) && !/(투자|주식|종목|매수|매도|분석|포트폴리오|수익|손실|시장|경제|금융)/.test(lowerInput)) {
    return {
      intent: 'casual_chat',
      confidence: 0.55,
      reasoning: '음식 관련 일반 대화 패턴 매칭 (투자 맥락 없음)'
    };
  }

  // 6. 명확한 투자/산업 키워드가 있는 경우만 investment_query로 분류
  // 주의: 일반적인 음식 용어는 제외 (위에서 이미 처리됨)
  if (/(투자|주식|산업|기업|회사|종목|매수|매도|분석|추천|포트폴리오|수익|손실|시장|경제|금융|반도체|전기차|바이오|헬스케어|ai|인공지능|클라우드|에너지|은행|보험|부동산|게임|소프트웨어|항공|우주|통신|의료|제약|화학|자동차|소매|유통|건설|철강|섬유|미디어|엔터테인먼트)/.test(lowerInput)) {
    return {
      intent: 'investment_query',
      confidence: 0.8,
      reasoning: '투자/산업 키워드 패턴 매칭'
    };
  }

  // 7. 기본값: 잡담으로 분류 (투자 관련이 아닌 경우)
  console.log('⚠️ 명확하지 않은 입력, 잡담으로 분류:', lowerInput);
  return {
    intent: 'casual_chat',
    confidence: 0.4,
    reasoning: '명확하지 않은 입력으로 잡담 분류'
  };
}

// 전체 데이터에서 기업명 검색 (START 단계용)
function findCompanyInAllData(userInput: string): string | null {
  const allTickers = Object.keys(DATA);

  // 1. 티커 직접 매칭
  const upperInput = userInput.toUpperCase().trim();
  const directTicker = allTickers.find(ticker => ticker === upperInput);
  if (directTicker) {
    console.log(`Direct ticker match: ${userInput} -> ${directTicker}`);
    return directTicker;
  }

  // 2. 한글 기업명 매핑 테이블 사용
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

  // 3. 영어 기업명 직접 매칭
  for (const ticker of allTickers) {
    const company = (DATA as any)[ticker];
    if (!company) continue;

    const companyName = company.name.toLowerCase();

    // 전체 이름 매칭
    if (companyName.includes(normalizedInput) || normalizedInput.includes(companyName)) {
      console.log(`Full company name match: "${normalizedInput}" -> ${ticker} (${company.name})`);
      return ticker;
    }

    // 주요 단어 매칭 (3글자 이상)
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

// 한글-영어 기업명 매핑
const KOREAN_COMPANY_MAPPING: { [key: string]: string[] } = {
  // 주요 기술 기업
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

  // 반도체 기업
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

  // 금융 기업
  '골드만삭스': ['goldman sachs'],
  '모건스탠리': ['morgan stanley'],
  '뱅크오브아메리카': ['bank of america'],
  '씨티그룹': ['citigroup'],
  '웰스파고': ['wells fargo'],
  '제이피모간': ['jpmorgan'],

  // 소비재 기업
  '코카콜라': ['coca-cola'],
  '펩시': ['pepsico'],
  '맥도날드': ['mcdonald'],
  '스타벅스': ['starbucks'],
  '나이키': ['nike'],
  '디즈니': ['disney'],

  // 헬스케어
  '존슨앤존슨': ['johnson & johnson'],
  '화이자': ['pfizer'],
  '머크': ['merck'],
  '애브비': ['abbvie'],

  // 에너지
  '엑손모빌': ['exxon mobil'],
  '셰브론': ['chevron'],

  // 통신
  '버라이즌': ['verizon'],
  '에이티앤티': ['at&t'],

  // 항공우주
  '보잉': ['boeing'],
  '록히드마틴': ['lockheed martin']
};

function findTickerInText(text: string, availableTickers: string[]): string | null {
  const normalizedInput = text.trim().toLowerCase();
  const upperInput = text.trim().toUpperCase();
  
  // 1. 티커 직접 매칭 (대소문자 구분 없이 정확히 일치)
  const directTicker = availableTickers.find(ticker => 
    ticker.toLowerCase() === normalizedInput || 
    ticker === upperInput ||
    normalizedInput.includes(ticker.toLowerCase()) ||
    upperInput.includes(ticker)
  );
  if (directTicker) {
    console.log(`Direct ticker match: "${text}" -> ${directTicker}`);
    return directTicker;
  }

  // 2. 한글 기업명 매칭
  // 2-1. 한글-영어 매핑 테이블 사용
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

  // 2-2. 숫자 매칭 (1, 2, 3 등)
  const numberMatch = normalizedInput.match(/^(\d+)$/);
  if (numberMatch) {
    const index = parseInt(numberMatch[1]) - 1;
    if (index >= 0 && index < availableTickers.length) {
      console.log(`Number match: ${numberMatch[1]} -> ${availableTickers[index]}`);
      return availableTickers[index];
    }
  }

  // 2-3. 영어 기업명 직접 매칭 (부분 일치 포함)
  for (const ticker of availableTickers) {
    const company = (DATA as any)[ticker];
    if (!company) continue;

    const companyName = company.name.toLowerCase();
    const tickerLower = ticker.toLowerCase();

    // 1. 회사명 또는 티커가 입력에 포함되어 있는지 확인
    const isCompanyInInput = normalizedInput.includes(companyName) || 
                           companyName.includes(normalizedInput) ||
                           upperInput.includes(ticker) ||
                           normalizedInput.includes(tickerLower);
    
    // 2. 입력이 회사명 또는 티커에 포함되어 있는지 확인
    const isInputInCompany = companyName.includes(normalizedInput) || 
                           tickerLower.includes(normalizedInput);

    if (isCompanyInInput || isInputInCompany) {
      console.log(`Company name/ticker match: "${text}" -> ${ticker} (${company.name})`);
      return ticker;
    }

    // 일반적인 부분 매칭 (영어 기업명의 주요 단어들)
    const companyWords = companyName.split(' ').filter((word: string) => word.length > 2);
    for (const word of companyWords) {
      if (normalizedInput.includes(word) && word.length > 3) { // 더 긴 단어만 매칭
        console.log(`Word match: "${word}" -> ${ticker} (${company.name})`);
        return ticker;
      }
    }
  }

  return null;
}

//-----------------------------------------------------------
// API 핸들러
//-----------------------------------------------------------
// bodyParser를 활성화하여 JSON 파싱 지원
export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // 요청 파싱 - JSON과 raw text 둘 다 지원
  let userInput = '';
  if (req.headers['content-type']?.includes('application/json')) {
    // JSON 형식 (frontend에서 오는 경우)
    const { message } = req.body;
    userInput = message?.trim() || '';
  } else {
    // Raw text 형식
    let body = '';
    for await (const chunk of req) body += chunk;
    userInput = body.trim();
  }

  // 세션 관리
  let sessionId = req.cookies.sessionId;
  if (!sessionId) {
    sessionId = uuid();
    res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; HttpOnly; SameSite=Lax`);
  }

  // 세션 상태 가져오기
  let state = SESSIONS.get(sessionId);
  if (!state) {
    state = {
      stage: 'START',
      selectedIndustry: null,
      industryCompanies: [],
      selectedTicker: null,
      conversationHistory: [],
      lastActivity: Date.now()
    };
  }

  // 세션 활동 시간 업데이트
  state.lastActivity = Date.now();

  // 세션 리셋 요청 처리
  if (userInput === '__RESET_SESSION__') {
    state = {
      stage: 'START',
      selectedIndustry: null,
      industryCompanies: [],
      selectedTicker: null,
      conversationHistory: [],
      lastActivity: Date.now()
    };
    SESSIONS.set(sessionId, state);
    return res.json({ reply: '새로운 검색을 시작하세요.' });
  }

  // 새 세션이거나 빈 입력일 때만 환영 메시지 (페르소나 반영)
  if (!userInput) {
    const welcomeMessages = [
      '안녕하세요! 저는 금융인공지능실무 과제를 위해 탄생한 맞춤 투자지원 AI예요! 📈✨\n\n투자하고 싶은 분야가 있으시면 편하게 말씀해 주세요!',
      '안녕하세요! 저는 금융인공지능실무 과제를 위해 탄생한 맞춤 투자지원 AI예요! 💡🚀\n\n"전기차", "AI", "바이오" 같은 키워드를 자유롭게 말씀해 주세요!',
      '안녕하세요? 저는 금융인공지능실무 과제를 위해 탄생한 맞춤 투자지원 AI예요! 🤝💎\n\n어떤 산업에 관심이 있으신지 말씀해 주세요!'
    ];
    const welcomeMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
    SESSIONS.set(sessionId, state);
    return res.json({ reply: welcomeMessage });
  }

  try {
    let reply = '';

    // 0. Special handling for "더보기" command (must come before intent classification)
    if (/^더보기$/i.test(userInput.trim())) {
      console.log(`🔍 Detected "더보기" command, checking for SHOW_INDUSTRY stage`);

      // Check if user is in SHOW_INDUSTRY stage with available companies
      if (state.stage === 'SHOW_INDUSTRY' && state.selectedIndustry && state.industryCompanies.length > 0) {
        console.log(`✅ Processing "더보기" for industry: ${state.selectedIndustry}`);

        // Show all companies in the industry
        const allCompanies = Object.entries(DATA)
          .filter(([_, company]: [string, any]) => company.industry === state!.selectedIndustry!)
          .map(([ticker, _]: [string, any]) => ticker);

        const allCompanyList = allCompanies
          .map((ticker, index) => `${index + 1}. ${getCompanyName(ticker)} (${ticker})`)
          .join('\n');

        const reply = `🎉 ${state.selectedIndustry} 산업의 전체 기업 목록입니다! (총 ${allCompanies.length}개) 📊\n\n${allCompanyList}\n\n어떤 기업이 가장 흥미로우신가요? ✨`;

        // Update state with all companies
        state.industryCompanies = allCompanies;
        SESSIONS.set(sessionId, state);

        return res.json({
          reply,
          status: 'showing_companies',
          hasMore: false // No more "더보기" after showing all
        });
      } else {
        console.log(`❌ "더보기" command received but not in valid state. Current stage: ${state.stage}, Industry: ${state.selectedIndustry}`);
        // If not in the right state, fall through to normal processing
      }
    }

    // 1. 의도 분류 수행 (START 단계에서만 처리, 다른 단계에서는 상태 기반 처리 우선)
    let intentResult: any = null;

    // START 단계가 아닌 경우, 먼저 상태 기반 처리를 시도
    if (state.stage !== 'START') {
      // 상태 기반 처리를 먼저 시도하고, 실패하면 의도 분류 수행
      intentResult = await classifyUserIntent(userInput);
      console.log(`User intent: ${intentResult.intent} (confidence: ${intentResult.confidence})`);

      // 인사말이나 AI 관련 질문은 바로 응답 (모든 단계에서)
      if (intentResult.intent === 'greeting' || intentResult.intent === 'about_ai') {
        // 대화 맥락 생성 (최근 3개 대화만 사용)
        const recentHistory = state.conversationHistory.slice(-3);
        const conversationContext = recentHistory.length > 0
          ? recentHistory.map(h => `사용자: ${h.user} → AI: ${h.ai}`).join('\n')
          : undefined;

        reply = await generatePersonaResponse(userInput, intentResult.intent, conversationContext);

        // 대화 히스토리에 추가
        state.conversationHistory.push({
          user: userInput,
          ai: reply,
          intent: intentResult.intent,
          timestamp: Date.now()
        });

        // 히스토리 크기 제한 (최대 10개)
        if (state.conversationHistory.length > 10) {
          state.conversationHistory = state.conversationHistory.slice(-10);
        }

        SESSIONS.set(sessionId, state);
        return res.json({ reply });
      }
    } else {
      // START 단계에서는 의도 분류를 먼저 수행
      intentResult = await classifyUserIntent(userInput);
      console.log(`User intent: ${intentResult.intent} (confidence: ${intentResult.confidence})`);

      // 2. 인사말이나 AI 관련 질문은 바로 응답
      if (intentResult.intent === 'greeting' || intentResult.intent === 'about_ai' || intentResult.intent === 'casual_chat') {
        // 대화 맥락 생성 (최근 3개 대화만 사용)
        const recentHistory = state.conversationHistory.slice(-3);
        const conversationContext = recentHistory.length > 0
          ? recentHistory.map(h => `사용자: ${h.user} → AI: ${h.ai}`).join('\n')
          : undefined;

        reply = await generatePersonaResponse(userInput, intentResult.intent, conversationContext);

        // 대화 히스토리에 추가
        state.conversationHistory.push({
          user: userInput,
          ai: reply,
          intent: intentResult.intent,
          timestamp: Date.now()
        });

        // 히스토리 크기 제한 (최대 10개)
        if (state.conversationHistory.length > 10) {
          state.conversationHistory = state.conversationHistory.slice(-10);
        }

        SESSIONS.set(sessionId, state);
        return res.json({ reply });
      }
    }

    // 모든 단계에서 명확한 "아니오"는 이전 단계로 롤백
    if (isNegative(userInput)) {

      if (state.stage === 'ASK_CHART') {
        // STAGE 2 → STAGE 1 또는 START (산업 정보가 있는지 확인)
        if (state.selectedIndustry && state.industryCompanies.length > 0) {
          // 산업 정보가 있으면 SHOW_INDUSTRY로 롤백
          state.stage = 'SHOW_INDUSTRY';
          state.selectedTicker = null;

          const companyList = state.industryCompanies
            .map((ticker, index) => `${index + 1}. ${getCompanyName(ticker)} (${ticker})`)
            .join('\n');

          const totalCompaniesInIndustry = Object.entries(DATA)
            .filter(([_, company]: [string, any]) => company.industry === state!.selectedIndustry!).length;
          const moreText = totalCompaniesInIndustry > 5 ? `\n\n더 많은 기업을 보시려면 "더보기"라고 말씀해 주세요. (총 ${totalCompaniesInIndustry}개 기업)` : '';

          reply = `${state.selectedIndustry} 산업의 주요 기업들입니다:\n\n${companyList}${moreText}\n\n관심 있는 기업이 있나요?`;
        } else {
          // 산업 정보가 없으면 (직접 기업명 입력 케이스) START로 롤백
          state.stage = 'START';
          state.selectedIndustry = null;
          state.industryCompanies = [];
          state.selectedTicker = null;

          const rollbackMessages = [
            '알겠습니다. 다른 관심 분야나 투자하고 싶은 산업을 말씀해 주세요.',
            '네, 이해했습니다. 어떤 다른 투자 아이디어가 있으신가요?',
            '좋습니다. 관심 있는 다른 산업이나 기업이 있으시면 말씀해 주세요.'
          ];
          reply = rollbackMessages[Math.floor(Math.random() * rollbackMessages.length)];
        }
        
      } else if (state.stage === 'SHOW_INDUSTRY') {
        // STAGE 1 → STAGE 0 (리셋)
        state = {
          stage: 'START',
          selectedIndustry: null,
          industryCompanies: [],
          selectedTicker: null,
          conversationHistory: state.conversationHistory,
          lastActivity: Date.now()
        };
        reply = '알겠습니다. 다른 관심 분야를 말씀해 주세요.';
      }
      
      SESSIONS.set(sessionId, state);
      return res.json({ reply });
    }

    // "더보기" command is now handled at the beginning of the request processing

    // 단계별 처리
    switch (state.stage) {
      case 'START':
        // STAGE 0-1: 의도 분류 (이미 위에서 수행됨)
        // intentResult는 이미 설정되어 있음

        // 의도별 처리
        if (intentResult.intent === 'greeting' || intentResult.intent === 'about_ai' || intentResult.intent === 'casual_chat') {
          // 대화 맥락 생성 (최근 3개 대화만 사용)
          const recentHistory = state.conversationHistory.slice(-3);
          const conversationContext = recentHistory.length > 0
            ? recentHistory.map(h => `사용자: ${h.user} → AI: ${h.ai}`).join('\n')
            : undefined;

          reply = await generatePersonaResponse(userInput, intentResult.intent, conversationContext);

          // 대화 히스토리에 추가
          state.conversationHistory.push({
            user: userInput,
            ai: reply,
            intent: intentResult.intent,
            timestamp: Date.now()
          });

          // 히스토리 크기 제한 (최대 10개)
          if (state.conversationHistory.length > 10) {
            state.conversationHistory = state.conversationHistory.slice(-10);
          }

          break;
        }

        // 무작위 투자 추천 요청 처리
        if (intentResult.intent === 'investment_recommendation') {
          const recommendation = generateRandomRecommendation();

          // 기업 설명들을 한글로 번역
          const translatedCompanies = await Promise.all(
            recommendation.companies.map(async (company) => ({
              ...company,
              translatedDescription: await translateDescription(company.description)
            }))
          );

          // 산업명을 한글로 번역
          const industryTranslation = await translateDescription(recommendation.industry);

          // 응답 생성 (발랄하게 + 이모티콘 추가 + 기업명 중복 방지)
          const companyDescriptions = translatedCompanies
            .map(company => {
              // 기업명이 설명에 포함되어 있으면 콜론 형식으로, 아니면 기존 형식 유지
              const companyNameInDescription = company.translatedDescription.includes(company.name.split(' ')[0]);
              if (companyNameInDescription) {
                return `${company.name}(${company.ticker}) : ${company.translatedDescription}`;
              } else {
                return `${company.name}(${company.ticker})는 ${company.translatedDescription}`;
              }
            })
            .join('\n\n');

          const excitingIntros = [
            `제가 🎯 ${industryTranslation} 분야를 골라봤습니다!`,
            `✨ ${industryTranslation} 산업을 추천해드려요!`,
            `🚀 ${industryTranslation} 분야가 어떠신가요?`,
            `💡 ${industryTranslation} 산업은 어떠실까요?`
          ];

          const industryDescriptions = [
            `이 산업엔 S&P 500에 소속된 멋진 기업들이 있어요! 🏢💼`,
            `이 분야에는 정말 흥미로운 기업들이 많답니다! ⭐💎`,
            `이 산업의 대표 기업들을 소개해드릴게요! 🌟📈`,
            `이 분야의 주목할 만한 기업들이에요! 🎯✨`
          ];

          const randomIntro = excitingIntros[Math.floor(Math.random() * excitingIntros.length)];
          const randomDescription = industryDescriptions[Math.floor(Math.random() * industryDescriptions.length)];

          reply = `${randomIntro}\n\n${randomDescription}\n\n${companyDescriptions}\n\n어떤 기업이 가장 흥미로우신가요? 😊`;

          // 대화 히스토리에 추가
          state.conversationHistory.push({
            user: userInput,
            ai: reply,
            intent: intentResult.intent,
            timestamp: Date.now()
          });

          break;
        }

        // STAGE 0-2: 기업명 직접 입력 확인
        if (intentResult.intent === 'company_direct') {
          const directCompany = findCompanyInAllData(userInput);
          if (directCompany) {
            // 기업명이 직접 입력된 경우 - 바로 차트 확인 단계로
            state.stage = 'ASK_CHART';
            state.selectedTicker = directCompany;
            state.lastActivity = Date.now();
            
            // 세션 상태 저장
            SESSIONS.set(sessionId, state);

            const companyName = getCompanyName(directCompany);
            const directChartQuestions = [
              `🎯 ${companyName} (${directCompany}) 분석을 시작하시겠습니까? 📊`,
              `📈 ${companyName} (${directCompany}) 차트 분석을 시작해볼까요? ✨`,
              `🚀 ${companyName} (${directCompany})의 주가 분석을 확인해 드릴까요? 💹`
            ];
            
            // LSTM 데이터 가져오기
            const lstmData = await getLSTMDataForSymbol(directCompany);
            let analysisInfo = '';
            
            if (lstmData) {
              analysisInfo = `\n\n📊 AI 분석 요약:\n${lstmData.analysis.ai_summary}\n`;
              analysisInfo += `- 충격 수준: ${lstmData.prediction_data.shock_level}\n`;
              analysisInfo += `- 예측 정확도: ${(lstmData.prediction_data.accuracy * 100).toFixed(2)}%`;
            }
            
            reply = `${directChartQuestions[Math.floor(Math.random() * directChartQuestions.length)]}${analysisInfo}`;
            
            // 대화 히스토리에 추가
            state.conversationHistory.push({
              user: userInput,
              ai: reply,
              intent: 'company_direct',
              timestamp: Date.now()
            });
            
            // 세션 상태 다시 저장 (대화 히스토리 업데이트 후)
            SESSIONS.set(sessionId, state);
            
            return res.json({ reply });
          }
        }

        // STAGE 0-3: 투자 관련 질문인 경우 - 산업 찾기 로직
        if (intentResult.intent === 'investment_query' || intentResult.confidence < 0.7) {
          const industry = await findBestIndustry(userInput);

          // RAG 점수가 낮아서 잡담으로 분류된 경우
          if (industry === null) {
            console.log(`🗣️ Input classified as casual conversation due to low RAG scores: "${userInput}"`);
            console.log(`📊 RAG threshold check: score below ${RAG_THRESHOLDS.CASUAL_CONVERSATION_THRESHOLD}, treating as casual conversation`);
            reply = await generatePersonaResponse(userInput, 'casual_chat');

            // 대화 히스토리에 추가
            state.conversationHistory.push({
              user: userInput,
              ai: reply,
              intent: 'casual_chat',
              timestamp: Date.now()
            });

            // 히스토리 크기 제한 (최대 10개)
            if (state.conversationHistory.length > 10) {
              state.conversationHistory = state.conversationHistory.slice(-10);
            }
            break;
          }

          // 유효한 산업이 매칭된 경우
          const companies = getIndustryCompanies(industry);

          // 회사가 1개라도 있으면 진행 (5개 미만이어도 OK)
          if (companies.length > 0) {
            state.stage = 'SHOW_INDUSTRY';
            state.selectedIndustry = industry;
            state.industryCompanies = companies;

            const companyList = companies
              .map((ticker, index) => `${index + 1}. ${getCompanyName(ticker)} (${ticker})`)
              .join('\n');

            const totalCompaniesInIndustry = Object.entries(DATA)
              .filter(([_, company]: [string, any]) => company.industry === industry).length;

            const moreText = totalCompaniesInIndustry > 5 ? `\n\n총 기업의 수는 ${totalCompaniesInIndustry}개입니다! 모든 기업을 보고 싶다면 '더보기' 버튼을 눌러주세요! 🔍✨` : '';

            const industryResponses = [
              `🏢 ${industry} 산업의 주요 기업들입니다!\n\n${companyList}${moreText}\n\n관심 있는 기업이 있나요? 😊`,
              `⭐ ${industry} 분야의 대표 기업들입니다!\n\n${companyList}${moreText}\n\n어떤 회사가 궁금하신가요? 🤔`,
              `💼 ${industry} 산업에는 다음과 같은 멋진 기업들이 있습니다!\n\n${companyList}${moreText}\n\n이 중에서 관심 있는 기업이 있으신가요? 💡`
            ];
            let baseReply = industryResponses[Math.floor(Math.random() * industryResponses.length)];

            // Enhance with LSTM data if available
            reply = await enhanceResponseWithLSTMData(companies, baseReply);

            // 기업 리스트 표시 상태 정보 추가
            SESSIONS.set(sessionId, state);
            return res.json({
              reply,
              status: 'showing_companies',
              hasMore: totalCompaniesInIndustry > 5 && companies.length === 5
            });
          } else {
            // 산업에 회사가 없는 경우 - 디버깅 정보 추가
            console.log(`No companies found for industry: "${industry}"`);
            console.log('Available industries in DATA:', [...new Set(Object.values(DATA).map((c: any) => c.industry))].slice(0, 10));
            reply = `😅 죄송합니다! "${industry}" 산업의 기업 정보를 찾을 수 없네요. 다른 관심 분야를 말씀해 주시면 더 좋은 추천을 드릴게요! 💡✨`;
          }
        } else {
          // 의도가 명확하지 않은 경우
          reply = await generatePersonaResponse(userInput, 'casual_chat');
        }
        break;

      case 'SHOW_INDUSTRY':
        // "더보기" 요청 확인
        if (/더보기|전체보기|더|모든|전체|all/i.test(userInput)) {
          // 해당 산업의 모든 회사 표시
          const allCompanies = Object.entries(DATA)
            .filter(([_, company]: [string, any]) => company.industry === state!.selectedIndustry!)
            .map(([ticker, _]: [string, any]) => ticker);

          const allCompanyList = allCompanies
            .map((ticker, index) => `${index + 1}. ${getCompanyName(ticker)} (${ticker})`)
            .join('\n');

          reply = `🎉 ${state.selectedIndustry} 산업의 전체 기업 목록입니다! (총 ${allCompanies.length}개) 📊\n\n${allCompanyList}\n\n어떤 기업이 가장 흥미로우신가요? ✨`;

          // 전체 리스트로 업데이트
          state.industryCompanies = allCompanies;

          // 기업 리스트 표시 상태 정보 추가
          SESSIONS.set(sessionId, state);
          return res.json({
            reply,
            status: 'showing_companies',
            hasMore: false // 전체 리스트를 보여줬으므로 더 이상 더보기 없음
          });
        }

        // STAGE 1: 티커 선택 확인 (의도 분류보다 우선)
        const selectedTicker = findTickerInText(userInput, state.industryCompanies);
        if (selectedTicker) {
          console.log(`✅ Ticker found in industry list: ${selectedTicker}`);
          state.stage = 'ASK_CHART';
          state.selectedTicker = selectedTicker;

          const chartQuestions = [
            `📈 ${getCompanyName(selectedTicker)} (${selectedTicker}) 차트 분석을 시작해볼까요? (예/아니오) ✨`,
            `📊 ${getCompanyName(selectedTicker)} (${selectedTicker})의 차트를 확인해 드릴까요? (예/아니오) 🚀`,
            `💹 ${getCompanyName(selectedTicker)} (${selectedTicker}) 주가 차트를 보여드릴까요? (예/아니오) 😊`
          ];
          reply = chartQuestions[Math.floor(Math.random() * chartQuestions.length)];
        } else {
          // 티커가 발견되지 않은 경우, 의도 분류 수행 (아직 안했다면)
          if (!intentResult) {
            intentResult = await classifyUserIntent(userInput);
            console.log(`User intent in SHOW_INDUSTRY: ${intentResult.intent} (confidence: ${intentResult.confidence})`);
          }

          if (intentResult.intent === 'casual_chat') {
            // 잡담으로 분류된 경우 페르소나 응답
            console.log(`🗣️ Generating casual conversation response in SHOW_INDUSTRY stage`);
            reply = await generatePersonaResponse(userInput, 'casual_chat');

            // 대화 히스토리에 추가
            state.conversationHistory.push({
              user: userInput,
              ai: reply,
              intent: 'casual_chat',
              timestamp: Date.now()
            });

            // 히스토리 크기 제한 (최대 10개)
            if (state.conversationHistory.length > 10) {
              state.conversationHistory = state.conversationHistory.slice(-10);
            }
          } else {
            // 리스트에 없는 입력 → 다시 요청
            const companyList = state.industryCompanies
              .map((ticker, index) => `${index + 1}. ${getCompanyName(ticker)} (${ticker})`)
              .join('\n');

            const retryMessages = [
              `🤗 위 목록에서 선택해 주세요!\n\n${companyList}\n\n또는 "아니오"라고 말씀해 주세요! 😊`,
              `💡 다음 기업 중에서 골라주세요!\n\n${companyList}\n\n관심 없으시면 "아니오"라고 해주세요! 🙂`,
              `✨ 이 중에서 선택해 주시거나 "아니오"라고 말씀해 주세요!\n\n${companyList} 🎯`
            ];
            reply = retryMessages[Math.floor(Math.random() * retryMessages.length)];
          }
        }
        break;

      case 'ASK_CHART':
        // STAGE 2: 차트 요청 확인
        if (isPositive(userInput)) {
          const ticker = state.selectedTicker!;
          const chartResponses = [
            `🎉 ${getCompanyName(ticker)} (${ticker}) 차트입니다. SpeedTraffic도 준비하는 중! 📈`,
            `✨ ${getCompanyName(ticker)}는 투자해도 될까요? 같이 분석 도와드릴게요! 💹`,
            `🚀 ${getCompanyName(ticker)} 분석을 요청주셨네요. 조금만 기다려 주세요! 📊`
          ];
          reply = chartResponses[Math.floor(Math.random() * chartResponses.length)];

          // 차트 요청 후 세션 리셋 (새로운 검색을 위해)
          const resetState = {
            stage: 'START' as Stage,
            selectedIndustry: null,
            industryCompanies: [],
            selectedTicker: null,
            conversationHistory: state.conversationHistory,
            lastActivity: Date.now()
          };
          SESSIONS.set(sessionId, resetState);

          // 차트 데이터와 함께 응답
          return res.json({
            reply,
            symbol: ticker,
            status: 'chart_requested'
          });
        } else {
          // 명확하지 않은 답변 → 다시 질문
          const clarifyMessages = [
            `🤔 ${getCompanyName(state.selectedTicker!)}(${state.selectedTicker}) 차트 분석을 시작해볼까요? "예" 또는 "아니오"로 답해주세요! 😊`,
            `💭 차트를 확인하시겠어요? "예" 또는 "아니오"로 말씀해 주세요! ✨`,
            `🎯 ${getCompanyName(state.selectedTicker!)} 차트가 필요하신가요? "예"나 "아니오"로 답변해 주세요! 📈`
          ];
          reply = clarifyMessages[Math.floor(Math.random() * clarifyMessages.length)];
        }
        break;
    }

    SESSIONS.set(sessionId, state);
    res.json({ reply });

  } catch (error) {
    console.error('Pipeline error:', error);
    res.status(500).json({ reply: '일시적인 오류가 발생했습니다. 다시 시도해 주세요.' });
  }
}

// 차트 요청 후 세션 리셋을 위한 별도 엔드포인트
export async function resetSessionAfterChart(sessionId: string) {
  const state = {
    stage: 'START' as Stage,
    selectedIndustry: null,
    industryCompanies: [],
    selectedTicker: null,
    conversationHistory: [],
    lastActivity: Date.now()
  };
  SESSIONS.set(sessionId, state);
}

//-----------------------------------------------------------
// RAG Threshold Testing Function (for debugging)
//-----------------------------------------------------------
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
