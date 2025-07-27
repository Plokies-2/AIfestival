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

    // 캐시 파일에 personas 필드가 없으면 기본값 제공
    if (!cached.personas || !Array.isArray(cached.personas)) {
      console.warn('⚠️ Cache file missing personas field. Using fallback personas.');
      cached.personas = [
        { persona: 'greeting', vec: new Array(1024).fill(0) },
        { persona: 'about_ai', vec: new Array(1024).fill(0) },
        { persona: 'investment', vec: new Array(1024).fill(0) }
      ];
    }

    // investment 페르소나가 없으면 추가
    const hasInvestment = cached.personas.some((p: any) => p.persona === 'investment');
    if (!hasInvestment) {
      console.warn('⚠️ Cache file missing investment persona. Adding fallback.');
      cached.personas.push({ persona: 'investment', vec: new Array(1024).fill(0) });
    }

    console.log(`✅ Loaded cache with ${cached.companies?.length || 0} companies, ${cached.industries?.length || 0} industries, ${cached.personas?.length || 0} personas`);
    return (mem = cached);
  }

  // 캐시 파일이 없으면 기본 구조 반환 (빌드 시 호환성)
  console.warn('⚠️ Embeddings cache file not found. Using fallback data structure.');
  const fallbackCache: CacheFile = {
    companies: [],
    industries: [],
    personas: [
      { persona: 'greeting', vec: new Array(1024).fill(0) },
      { persona: 'about_ai', vec: new Array(1024).fill(0) },
      { persona: 'investment', vec: new Array(1024).fill(0) }
    ]
  };

  return (mem = fallbackCache);
}
