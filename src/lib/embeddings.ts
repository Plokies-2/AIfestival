import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { QUICK_ENRICHED_FINAL as DATA } from '../data/sp500_enriched_final';

/* ──────────── 타입 ──────────── */
type Vec = number[];
export interface CompanyRow { ticker: string; name: string; industry: string; vec: Vec; }
export interface IndustryRow { industry: string; vec: Vec; }
export interface PersonaRow { persona: string; vec: Vec; }
interface CacheFile { companies: CompanyRow[]; industries: IndustryRow[]; personas: PersonaRow[]; }

/* ──────────── 상수 ──────────── */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const CACHE = path.join(process.cwd(), '.cache', 'sp500_vectors.json');
const BATCH = 100;

/* ──────────── 벡터 유틸 ──────────── */
export const dot = (a: Vec, b: Vec) => a.reduce((s, x, i) => s + x * b[i], 0);
export const cosine = dot;  // 정규화 후 dot=cos
const norm = (v: Vec) => { const n = Math.hypot(...v); return v.map(x => x / n); };

/* ──────────── 페르소나 임베딩 생성 ──────────── */
async function createPersonaEmbeddings(): Promise<PersonaRow[]> {
  console.log('🎭 Creating persona embeddings...');

  try {
    const corpusPath = path.join(process.cwd(), 'src', 'data', 'corpus');
    console.log(`📁 Corpus path: ${corpusPath}`);

    // about_ai.md 파일 읽기
    const aboutAiPath = path.join(corpusPath, 'about_ai.md');
    console.log(`📄 Reading about_ai.md from: ${aboutAiPath}`);

    if (!fs.existsSync(aboutAiPath)) {
      throw new Error(`about_ai.md file not found at: ${aboutAiPath}`);
    }

    const aboutAiContent = fs.readFileSync(aboutAiPath, 'utf8');
    const aboutAiExamples = extractExamples(aboutAiContent);

    // greeting.md 파일 읽기
    const greetingPath = path.join(corpusPath, 'greeting.md');
    console.log(`📄 Reading greeting.md from: ${greetingPath}`);

    if (!fs.existsSync(greetingPath)) {
      throw new Error(`greeting.md file not found at: ${greetingPath}`);
    }

    const greetingContent = fs.readFileSync(greetingPath, 'utf8');
    const greetingExamples = extractExamples(greetingContent);

    // investment.md 파일 읽기
    const investmentPath = path.join(corpusPath, 'investment.md');
    console.log(`📄 Reading investment.md from: ${investmentPath}`);

    if (!fs.existsSync(investmentPath)) {
      throw new Error(`investment.md file not found at: ${investmentPath}`);
    }

    const investmentContent = fs.readFileSync(investmentPath, 'utf8');
    const investmentExamples = extractExamples(investmentContent);

    // 예시가 비어있는지 확인
    if (aboutAiExamples.length === 0) {
      throw new Error('No examples found in about_ai.md');
    }
    if (greetingExamples.length === 0) {
      throw new Error('No examples found in greeting.md');
    }
    if (investmentExamples.length === 0) {
      throw new Error('No examples found in investment.md');
    }

    // 각 페르소나의 예시들을 하나의 텍스트로 결합
    const aboutAiText = aboutAiExamples.join('. ');
    const greetingText = greetingExamples.join('. ');
    const investmentText = investmentExamples.join('. ');

    // 임베딩 생성
    console.log('🚀 Generating persona embeddings...');
    const { data } = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: [aboutAiText, greetingText, investmentText],
    });

    const personas = [
      { persona: 'about_ai', vec: norm(data[0].embedding) },
      { persona: 'greeting', vec: norm(data[1].embedding) },
      { persona: 'investment', vec: norm(data[2].embedding) }
    ];

    console.log('🎭 Persona embeddings created successfully');
    return personas;

  } catch (error) {
    console.error('❌ Error creating persona embeddings:', error);
    throw error;
  }
}

/* ──────────── 마크다운에서 예시 추출 ──────────── */
function extractExamples(content: string): string[] {
  const lines = content.split('\n');
  const examples: string[] = [];
  let inExamplesSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '## Examples') {
      inExamplesSection = true;
      continue;
    }

    if (inExamplesSection && trimmed.startsWith('- ')) {
      const example = trimmed.substring(2); // '- ' 제거
      examples.push(example);
    }

    if (inExamplesSection && trimmed.startsWith('#') && trimmed !== '## Examples') {
      break; // 다른 섹션 시작하면 종료
    }
  }

  console.log(`📝 Extracted ${examples.length} examples`);
  return examples;
}

/* ──────────── 임베딩 생성 ──────────── */
async function createEmbeddings(): Promise<CacheFile> {
  const tickers = Object.keys(DATA);
  const txt = tickers.map(t => `${DATA[t].name}. ${DATA[t].industry}. ${DATA[t].description}`);

  /* 기업 496개 */
  const companies: CompanyRow[] = [];
  for (let i = 0; i < txt.length; i += BATCH) {
    const { data } = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: txt.slice(i, i + BATCH),
    });
    data.forEach((d, j) => {
      const t = tickers[i + j], b = DATA[t];
      companies.push({ ticker: t, name: b.name, industry: b.industry, vec: norm(d.embedding) });
    });
  }

  /* 산업 40개 */
  const inds = [...new Set(companies.map(c => c.industry))];
  const { data: indEmb } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: inds.map(s => `${s}: companies in ${s.toLowerCase()}`),
  });
  const industries = indEmb.map((d, i) => ({ industry: inds[i], vec: norm(d.embedding) }));

  /* 페르소나 2개 (about_ai, greeting) */
  const personas = await createPersonaEmbeddings();

  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify({ companies, industries, personas }));
  return { companies, industries, personas };
}

/* ──────────── 캐시 로드 ──────────── */
let mem: CacheFile | null = null;
export async function getEmbeddings(): Promise<CacheFile> {
  if (mem) {
    console.log('📦 Using cached embeddings from memory');
    return mem;
  }

  if (fs.existsSync(CACHE)) {
    console.log('📦 Loading embeddings from cache file');
    const cached = JSON.parse(fs.readFileSync(CACHE, 'utf8'));

    // 캐시 파일에 personas 필드가 없으면 에러 발생
    if (!cached.personas || !Array.isArray(cached.personas)) {
      throw new Error('❌ Cache file missing personas field. Please run regenerate-embeddings.js to create a valid cache file.');
    }

    // investment 페르소나가 없으면 에러 발생 (2단계 RAG 시스템 필요)
    const hasInvestment = cached.personas.some(p => p.persona === 'investment');
    if (!hasInvestment) {
      throw new Error('❌ Cache file missing investment persona. Please run regenerate-embeddings.js to update the cache file.');
    }

    console.log(`✅ Loaded cache with ${cached.companies?.length || 0} companies, ${cached.industries?.length || 0} industries, ${cached.personas?.length || 0} personas`);
    return (mem = cached);
  }

  // 캐시 파일이 없으면 에러 발생 - regenerate-embeddings.js만이 캐시를 생성할 수 있음
  throw new Error('❌ Embeddings cache file not found. Please run regenerate-embeddings.js to create the cache file.');
}
