import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { QUICK_ENRICHED_FINAL as DATA } from '../data/sp500_enriched_final';

/* ──────────── 타입 ──────────── */
type Vec = number[];
export interface CompanyRow { ticker: string; name: string; industry: string; vec: Vec; }
export interface IndustryRow { industry: string; vec: Vec; }
interface CacheFile { companies: CompanyRow[]; industries: IndustryRow[]; }

/* ──────────── 상수 ──────────── */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const CACHE = path.join(process.cwd(), '.cache', 'sp500_vectors.json');
const BATCH = 100;

/* ──────────── 벡터 유틸 ──────────── */
export const dot = (a: Vec, b: Vec) => a.reduce((s, x, i) => s + x * b[i], 0);
export const cosine = dot;  // 정규화 후 dot=cos
const norm = (v: Vec) => { const n = Math.hypot(...v); return v.map(x => x / n); };

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

  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify({ companies, industries }));
  return { companies, industries };
}

/* ──────────── 캐시 로드 ──────────── */
let mem: CacheFile | null = null;
export async function getEmbeddings(): Promise<CacheFile> {
  if (mem) return mem;
  if (fs.existsSync(CACHE)) return (mem = JSON.parse(fs.readFileSync(CACHE, 'utf8')));
  return (mem = await createEmbeddings());
}
