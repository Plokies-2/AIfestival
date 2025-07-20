import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function generatePersonaResponse(userInput: string, intent: string, conversationContext?: string): Promise<string> {
  const PERSONA_SYSTEM_MESSAGE = `당신은 "금융인공지능실무 과제를 위해 탄생한 맞춤 투자지원 AI"입니다.`;

  let specificPrompt = '';
  switch (intent) {
    case 'greeting':
      specificPrompt = `인사: "${userInput}" → 투자지원 AI로서 간결하게 인사`;
      break;
    case 'about_ai':
      specificPrompt = `정체성 질문: "${userInput}" → 자신감 있게 소개`;
      break;
    case 'casual_chat':
      specificPrompt = `일상 대화: "${userInput}" → 투자 이야기로 자연스럽게 연결`;
      break;
    default:
      specificPrompt = `입력: "${userInput}" → 투자 관점에서 간결하게 응답`;
  }

  if (conversationContext) {
    specificPrompt += `\n\n대화 맥락: ${conversationContext}`;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        { role: 'system', content: PERSONA_SYSTEM_MESSAGE },
        { role: 'user', content: specificPrompt }
      ],
      temperature: 0.7,
      max_tokens: 120
    });
    return response.choices[0].message.content?.trim() || '';
  } catch {
    return generateFallbackPersonaResponse(userInput, intent);
  }
}

const FALLBACK_RESPONSES = {
  greeting: ['안녕하세요! 어떤 산업이 궁금하신가요?'],
  ability: ['투자 분석을 도와드릴 수 있어요!'],
  age: ['저는 아주 젊은 AI랍니다!'],
  intro: ['투자 분석 전문가 AI예요!'],
  followUp: ['어떤 기업이 궁금하신가요?']
} as const;

export function generateFallbackPersonaResponse(userInput: string, intent: string): string {
  switch (intent) {
    case 'greeting':
      return FALLBACK_RESPONSES.greeting[0];
    case 'about_ai':
      return FALLBACK_RESPONSES.intro[0];
    case 'casual_chat':
      return FALLBACK_RESPONSES.followUp[0];
    default:
      return FALLBACK_RESPONSES.greeting[0];
  }
}
