import { SessionState } from '../session';
import { findBestIndustry, getIndustryCompanies, findCompanyInAllData, getCompanyName } from '../intent';
import { generatePersonaResponse } from '../responses';
import { getLSTMDataForSymbol, enhanceResponseWithLSTMData } from '../lstm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function generateRandomRecommendation(): { industry: string; companies: Array<{ ticker: string; name: string; description: string }> } {
  const allIndustries = [...new Set(Object.values(require('@/data/sp500_enriched_final').QUICK_ENRICHED_FINAL).map((c: any) => c.industry))];
  const randomIndustry = allIndustries[Math.floor(Math.random() * allIndustries.length)];
  const industryCompanies: Array<{ ticker: string; name: string; description: string }> = [];
  for (const [ticker, company] of Object.entries(require('@/data/sp500_enriched_final').QUICK_ENRICHED_FINAL as any)) {
    const comp: any = company;
    if (comp.industry === randomIndustry) {
      industryCompanies.push({ ticker, name: comp.name, description: comp.description });
    }
  }
  return { industry: randomIndustry, companies: industryCompanies.slice(0, 3) };
}

async function translateDescription(description: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        { role: 'system', content: '영어 기업 설명을 한국어로 번역하세요.' },
        { role: 'user', content: description }
      ],
      temperature: 0.3,
      max_tokens: 100
    });
    return response.choices[0].message.content?.trim() || description;
  } catch {
    return description;
  }
}

export async function startStage(userInput: string, state: SessionState, intentResult: { intent: string; confidence: number }): Promise<{ reply: string; status?: string; hasMore?: boolean }> {
  if (['greeting', 'about_ai', 'casual_chat'].includes(intentResult.intent)) {
    const recent = state.conversationHistory.slice(-3);
    const ctx = recent.map(h => `사용자: ${h.user} → AI: ${h.ai}`).join('\n');
    const reply = await generatePersonaResponse(userInput, intentResult.intent, ctx || undefined);
    state.conversationHistory.push({ user: userInput, ai: reply, intent: intentResult.intent, timestamp: Date.now() });
    if (state.conversationHistory.length > 10) state.conversationHistory = state.conversationHistory.slice(-10);
    return { reply };
  }

  if (intentResult.intent === 'investment_recommendation') {
    const recommendation = generateRandomRecommendation();
    const translated = await Promise.all(recommendation.companies.map(async c => ({ ...c, translatedDescription: await translateDescription(c.description) })));
    const companyDescriptions = translated.map(c => `${c.name}(${c.ticker})는 ${c.translatedDescription}`).join('\n\n');
    const reply = `${recommendation.industry} 분야의 기업을 추천드려요!\n\n${companyDescriptions}\n\n어떤 기업이 궁금하신가요?`;
    state.conversationHistory.push({ user: userInput, ai: reply, intent: intentResult.intent, timestamp: Date.now() });
    return { reply };
  }

  if (intentResult.intent === 'company_direct') {
    const directCompany = findCompanyInAllData(userInput);
    if (directCompany) {
      state.stage = 'ASK_CHART';
      state.selectedTicker = directCompany;
      const lstmData = await getLSTMDataForSymbol(directCompany);
      let info = '';
      if (lstmData) {
        info = `\n\n📊 AI 분석 요약:\n${lstmData.analysis.ai_summary}`;
      }
      const reply = `📈 ${getCompanyName(directCompany)} (${directCompany}) 차트 분석을 시작하시겠습니까?${info}`;
      state.conversationHistory.push({ user: userInput, ai: reply, intent: 'company_direct', timestamp: Date.now() });
      return { reply };
    }
  }

  if (intentResult.intent === 'investment_query' || intentResult.confidence < 0.7) {
    const industry = await findBestIndustry(userInput);
    if (industry === null) {
      const reply = await generatePersonaResponse(userInput, 'casual_chat');
      state.conversationHistory.push({ user: userInput, ai: reply, intent: 'casual_chat', timestamp: Date.now() });
      if (state.conversationHistory.length > 10) state.conversationHistory = state.conversationHistory.slice(-10);
      return { reply };
    }
    const companies = getIndustryCompanies(industry);
    if (companies.length > 0) {
      state.stage = 'SHOW_INDUSTRY';
      state.selectedIndustry = industry;
      state.industryCompanies = companies;
      const companyList = companies.map((t, i) => `${i + 1}. ${getCompanyName(t)} (${t})`).join('\n');
      let reply = `${industry} 산업의 주요 기업들입니다!\n\n${companyList}\n\n관심 있는 기업이 있나요?`;
      reply = await enhanceResponseWithLSTMData(companies, reply, getCompanyName);
      return { reply, status: 'showing_companies', hasMore: companies.length === 5 };
    }
  }

  const reply = await generatePersonaResponse(userInput, 'casual_chat');
  return { reply };
}
