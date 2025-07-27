import fs from 'fs';
import path from 'path';

/* ──────────── 타입 ──────────── */
type Vec = number[];
export interface CompanyRow { ticker: string; name: string; industry: string; vec: Vec; }
export interface IndustryRow {
  industry_ko: string;
  sp500_industry: string;
  vec: Vec;
}
export interface PersonaRow { persona: string; vec: Vec; }
interface CacheFile { companies: CompanyRow[]; industries: IndustryRow[]; personas: PersonaRow[]; }

/* ──────────── 상수 ──────────── */
const CACHE = path.join(process.cwd(), '.cache', 'sp500_vectors.json');

/* ──────────── 벡터 유틸 ──────────── */
export const dot = (a: Vec, b: Vec) => a.reduce((s, x, i) => s + x * b[i], 0);
export const cosine = dot;  // 정규화 후 dot=cos

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
    const hasInvestment = cached.personas.some((p: any) => p.persona === 'investment');
    if (!hasInvestment) {
      throw new Error('❌ Cache file missing investment persona. Please run regenerate-embeddings.js to update the cache file.');
    }

    console.log(`✅ Loaded cache with ${cached.companies?.length || 0} companies, ${cached.industries?.length || 0} industries, ${cached.personas?.length || 0} personas`);
    return (mem = cached);
  }

  // 캐시 파일이 없으면 에러 발생 - regenerate-embeddings.js만이 캐시를 생성할 수 있음
  throw new Error('❌ Embeddings cache file not found. Please run regenerate-embeddings.js to create the cache file.');
}
