import OpenAI from 'openai';
import { getEmbeddings, cosine } from '@/lib/embeddings';
import { QUICK_ENRICHED_FINAL as DATA } from '@/data/sp500_enriched_final';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export const POSITIVE_PATTERNS = /^(네|예|응|좋아|맞아|그래|yes|y|ok)/i;
export const NEGATIVE_PATTERNS = /^(아니|아니요|아뇨|싫어|안돼|no|n|nope|ㄴㄴ|ㄴ|노|안해|싫|패스|pass)/i;

export function isPositive(text: string): boolean {
  return POSITIVE_PATTERNS.test(text.trim());
}

export function isNegative(text: string): boolean {
  return NEGATIVE_PATTERNS.test(text.trim());
}

let cachedIndustries: string[] | null = null;
export function getAvailableIndustries(): string[] {
  if (!cachedIndustries) {
    cachedIndustries = [...new Set(Object.values(DATA).map((c: any) => c.industry))];
  }
  return cachedIndustries;
}

export async function classifyIndustryWithGPT(userInput: string): Promise<string | null> {
  try {
    const industries = getAvailableIndustries();
    const prompt = `다음 사용자 입력을 분석하여 가장 적합한 산업군을 선택해주세요.\n\n사용자 입력: "${userInput}"`;
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        { role: 'system', content: '당신은 산업 분류 전문가입니다.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0,
      max_tokens: 50
    });
    const selected = response.choices[0].message.content?.trim();
    return selected && industries.includes(selected) ? selected : null;
  } catch {
    return null;
  }
}

const RAG_THRESHOLDS = {
  INDUSTRY_MIN_SCORE: 0.25,
  COMPANY_MIN_SCORE: 0.2,
  GPT_FALLBACK_THRESHOLD: 0.15,
  CASUAL_CONVERSATION_THRESHOLD: 0.2
} as const;

export async function findBestIndustry(userInput: string): Promise<string | null> {
  const queryEmbedding = (await openai.embeddings.create({ model: 'text-embedding-3-small', input: userInput })).data[0].embedding;
  const normalizedQuery = queryEmbedding.map((v, _, arr) => v / Math.hypot(...arr));
  const { industries } = await getEmbeddings();
  let best: { industry: string; score: number } = { industry: '', score: -1 };
  for (const ind of industries) {
    const score = cosine(ind.vec, normalizedQuery);
    if (score > best.score) {
      best = { industry: ind.industry, score };
    }
  }
  if (best.score < RAG_THRESHOLDS.CASUAL_CONVERSATION_THRESHOLD) {
    if (best.score < RAG_THRESHOLDS.GPT_FALLBACK_THRESHOLD) {
      return classifyIndustryWithGPT(userInput);
    }
    return null;
  }
  const valid = getAvailableIndustries();
  return valid.includes(best.industry) ? best.industry : valid[0];
}

export function getIndustryCompanies(industry: string): string[] {
  return Object.entries(DATA)
    .filter(([_, c]) => (c as any).industry === industry)
    .slice(0, 5)
    .map(([t]) => t);
}

export function getCompanyName(ticker: string): string {
  const company = (DATA as any)[ticker];
  return company ? company.name : ticker;
}

export function findTickerInText(text: string, availableTickers: string[]): string | null {
  const norm = text.trim().toLowerCase();
  const upper = text.trim().toUpperCase();
  const direct = availableTickers.find(t => t.toLowerCase() === norm || t === upper || norm.includes(t.toLowerCase()) || upper.includes(t));
  if (direct) return direct;
  return null;
}

export async function classifyUserIntent(userInput: string): Promise<{ intent: string; confidence: number; reasoning: string }> {
  const lower = userInput.toLowerCase().trim();
  if (/안녕|hello|hi/.test(lower)) return { intent: 'greeting', confidence: 0.9, reasoning: 'greet' };
  if (/(누구|정체)/.test(lower)) return { intent: 'about_ai', confidence: 0.9, reasoning: 'about ai' };
  if (/(추천)/.test(lower)) return { intent: 'investment_recommendation', confidence: 0.9, reasoning: 'recommend' };
  return { intent: 'investment_query', confidence: 0.5, reasoning: 'default' };
}

export function findCompanyInAllData(userInput: string): string | null {
  const allTickers = Object.keys(DATA);
  const upper = userInput.toUpperCase().trim();
  const direct = allTickers.find(t => t === upper);
  if (direct) return direct;
  return null;
}
