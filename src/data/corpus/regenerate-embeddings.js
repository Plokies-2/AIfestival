#!/usr/bin/env node

/**
 * 캐시 재생성 스크립트
 * 
 * about_ai.md와 greeting.md, investment.md 파일 변경 시 임베딩 캐시를 자동으로 재생성합니다.
 * 
 * 사용법:
 *   node src/data/corpus/regenerate-embeddings.js
 *   또는
 *   npm run regenerate-embeddings
 *   
 *   RAG 임계값을 조정하려면 config.ts 파일을 수정하세요.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 색상 출력을 위한 ANSI 코드
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// 로깅 함수들
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  step: (msg) => console.log(`${colors.cyan}🔄${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.magenta}🚀 ${msg}${colors.reset}\n`)
};

// 프로젝트 루트 경로
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const CACHE_FILE = path.join(PROJECT_ROOT, '.cache', 'kospi_vectors.json');
const CORPUS_DIR = path.join(PROJECT_ROOT, 'src', 'data', 'corpus');

/**
 * 환경 변수 확인
 */
function checkEnvironment() {
  log.step('환경 변수 확인 중...');
  
  // .env.local 파일 확인
  const envLocalPath = path.join(PROJECT_ROOT, '.env.local');
  if (!fs.existsSync(envLocalPath)) {
    log.error('.env.local 파일이 없습니다.');
    return false;
  }
  
  // .env.local에서 OPENAI_API_KEY 확인
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  const hasApiKey = envContent.includes('OPENAI_API_KEY=') && 
                   !envContent.includes('OPENAI_API_KEY=""') &&
                   !envContent.includes('OPENAI_API_KEY=your-api-key-here');
  
  if (!hasApiKey) {
    log.error('OPENAI_API_KEY가 .env.local 파일에 설정되지 않았습니다.');
    log.info('다음과 같이 설정해주세요: OPENAI_API_KEY=your-actual-api-key');
    return false;
  }
  
  log.success('환경 변수 확인 완료');
  return true;
}

/**
 * MD 파일 존재 여부 확인
 */
function checkMarkdownFiles() {
  log.step('마크다운 파일 확인 중...');

  const aboutAiPath = path.join(CORPUS_DIR, 'about_ai.md');
  const greetingPath = path.join(CORPUS_DIR, 'greeting.md');
  const investmentPath = path.join(CORPUS_DIR, 'investment.md');

  if (!fs.existsSync(aboutAiPath)) {
    log.error(`about_ai.md 파일을 찾을 수 없습니다: ${aboutAiPath}`);
    return false;
  }

  if (!fs.existsSync(greetingPath)) {
    log.error(`greeting.md 파일을 찾을 수 없습니다: ${greetingPath}`);
    return false;
  }

  if (!fs.existsSync(investmentPath)) {
    log.error(`investment.md 파일을 찾을 수 없습니다: ${investmentPath}`);
    return false;
  }

  // 파일 내용 간단 검증
  const aboutAiContent = fs.readFileSync(aboutAiPath, 'utf8');
  const greetingContent = fs.readFileSync(greetingPath, 'utf8');
  const investmentContent = fs.readFileSync(investmentPath, 'utf8');

  if (!aboutAiContent.includes('## Examples')) {
    log.error('about_ai.md 파일에 "## Examples" 섹션이 없습니다.');
    return false;
  }
  
  if (!greetingContent.includes('## Examples')) {
    log.error('greeting.md 파일에 "## Examples" 섹션이 없습니다.');
    return false;
  }

  if (!investmentContent.includes('## Examples')) {
    log.error('investment.md 파일에 "## Examples" 섹션이 없습니다.');
    return false;
  }

  // 예시 개수 확인
  const aboutAiExamples = aboutAiContent.split('\n').filter(line => line.trim().startsWith('- ')).length;
  const greetingExamples = greetingContent.split('\n').filter(line => line.trim().startsWith('- ')).length;
  const investmentExamples = investmentContent.split('\n').filter(line => line.trim().startsWith('- ')).length;

  log.success(`about_ai.md: ${aboutAiExamples}개 예시 발견`);
  log.success(`greeting.md: ${greetingExamples}개 예시 발견`);
  log.success(`investment.md: ${investmentExamples}개 예시 발견`);

  return true;
}

/**
 * 기존 캐시 파일 삭제
 */
function deleteCacheFile() {
  log.step('기존 캐시 파일 확인 중...');
  
  if (fs.existsSync(CACHE_FILE)) {
    log.warning(`기존 캐시 파일 발견: ${CACHE_FILE}`);
    log.step('기존 캐시 파일 삭제 중...');
    
    try {
      fs.unlinkSync(CACHE_FILE);
      log.success('기존 캐시 파일 삭제 완료');
    } catch (error) {
      log.error(`캐시 파일 삭제 실패: ${error.message}`);
      return false;
    }
  } else {
    log.info('기존 캐시 파일이 없습니다. (새로 생성됩니다)');
  }
  
  return true;
}

/**
 * 임베딩 생성 트리거
 */
async function triggerEmbeddingGeneration() {
  log.step('임베딩 생성을 위한 API 호출 준비 중...');

  try {
    log.info('임베딩 생성을 시작합니다...');
    log.info('이 과정은 몇 분이 소요될 수 있습니다...');

    // 더 간단하고 안정적인 방법: Next.js API 엔드포인트 호출
    const embeddingScript = `
const path = require('path');
const fs = require('fs');

// 프로젝트 루트로 이동 (Windows 경로 처리)
const projectRoot = ${JSON.stringify(PROJECT_ROOT)};
process.chdir(projectRoot);

// 환경 변수 로드
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\\n');
  for (const line of lines) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  }
}

async function generateEmbeddings() {
  try {
    console.log('🔄 임베딩 생성 시작...');

    // Clova Studio OpenAI 호환 임베딩 API 사용
    const OpenAI = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.CLOVA_STUDIO_API_KEY,
      baseURL: 'https://clovastudio.stream.ntruss.com/v1/openai'
    });

    // 데이터 로드 (TypeScript 파일을 직접 읽어서 파싱)
    const dataPath = path.join(process.cwd(), 'src', 'data', 'kospi_enriched_final.ts');
    console.log('📄 데이터 파일 경로:', dataPath);

    if (!fs.existsSync(dataPath)) {
      throw new Error(\`데이터 파일을 찾을 수 없습니다: \${dataPath}\`);
    }

    const dataContent = fs.readFileSync(dataPath, 'utf8');
    console.log('📄 파일 읽기 완료, 크기:', dataContent.length, 'bytes');

    // TypeScript 파일에서 데이터 추출 (개선된 정규식 사용)
    const dataMatch = dataContent.match(/export const KOSPI_ENRICHED_FINAL = ({[\\s\\S]*?})\\s*as const;/);
    if (!dataMatch) {
      console.error('정규식 매칭 실패. 파일 시작 부분:', dataContent.substring(0, 200));
      throw new Error('kospi_enriched_final.ts에서 데이터를 찾을 수 없습니다. 파일 형식을 확인해주세요.');
    }

    console.log('📝 데이터 추출 성공, 파싱 중...');
    console.log('추출된 데이터 크기:', dataMatch[1].length, 'bytes');

    // 더 안전한 파싱 방법 사용
    let DATA;
    try {
      DATA = eval('(' + dataMatch[1] + ')');
    } catch (parseError) {
      console.error('데이터 파싱 오류:', parseError.message);
      throw new Error('데이터 파싱에 실패했습니다: ' + parseError.message);
    }

    console.log('📊 기업 데이터 로드 완료:', Object.keys(DATA).length, '개');

    // 캐시 디렉토리 생성
    const cacheDir = path.join(process.cwd(), '.cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // 벡터 정규화 함수
    const norm = (v) => {
      const n = Math.hypot(...v);
      return v.map(x => x / n);
    };

    // Rate limit 방지를 위한 delay 함수
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // 기업 임베딩 생성 제거 - industry_vector와 md 파일들만 임베딩
    console.log('🏢 기업 임베딩 생성 건너뛰기...');
    const companies = [];

    console.log('🏭 산업 임베딩 생성 중 (industry_vectors.ts 기반)...');

    // kospi_industry_vectors.ts에서 모든 산업 데이터 로드
    const industryVectorsPath = path.join(process.cwd(), 'src', 'data', 'kospi_industry_vectors.ts');
    console.log('📄 산업 벡터 파일 경로:', industryVectorsPath);

    if (!fs.existsSync(industryVectorsPath)) {
      throw new Error(\`산업 벡터 파일을 찾을 수 없습니다: \${industryVectorsPath}\`);
    }

    const industryVectorsContent = fs.readFileSync(industryVectorsPath, 'utf8');
    console.log('📄 산업 벡터 파일 읽기 완료, 크기:', industryVectorsContent.length, 'bytes');

    // TypeScript 파일에서 KOSPI_INDUSTRY_VECTORS 배열 추출
    const industryMatch = industryVectorsContent.match(/export const KOSPI_INDUSTRY_VECTORS: IndustryVector\\[\\] = (\\[[\\s\\S]*?\\]);/);
    if (!industryMatch) {
      console.error('정규식 매칭 실패. 파일 시작 부분:', industryVectorsContent.substring(0, 200));
      throw new Error('kospi_industry_vectors.ts에서 KOSPI_INDUSTRY_VECTORS를 찾을 수 없습니다. 파일 형식을 확인해주세요.');
    }

    console.log('📝 산업 벡터 데이터 추출 성공, 파싱 중...');
    console.log('추출된 데이터 크기:', industryMatch[1].length, 'bytes');

    // 더 안전한 파싱 방법 사용
    let INDUSTRY_VECTORS;
    try {
      INDUSTRY_VECTORS = eval(industryMatch[1]);
    } catch (parseError) {
      console.error('산업 벡터 데이터 파싱 오류:', parseError.message);
      throw new Error('산업 벡터 데이터 파싱에 실패했습니다: ' + parseError.message);
    }

    console.log('📊 산업 벡터 데이터 로드 완료:', INDUSTRY_VECTORS.length, '개');

    console.log(\`📊 \${INDUSTRY_VECTORS.length}개 산업의 임베딩 생성 중...\`);

    const industryEmbeddings = [];

    // 산업 임베딩 - BGE-M3 최적화된 텍스트 구성
    for (let i = 0; i < INDUSTRY_VECTORS.length; i++) {
      const industry = INDUSTRY_VECTORS[i];

      // BGE-M3 모델을 위한 의미적 구분 강화 텍스트 구성
      const text = \`산업 분야: \${industry.industry_ko}. 이 산업의 핵심 특징과 관련 키워드들: \${industry.keywords.join(', ')}. 이 산업은 한국 \${industry.industry_ko} 기업들이 속한 분야로, 다른 산업과 구별되는 고유한 특성을 가지고 있습니다.\`;

      console.log(\`  \${i + 1}/\${INDUSTRY_VECTORS.length} 처리 중: \${industry.industry_ko}\`);

      try {
        console.log(\`    📝 입력 텍스트: \${text}\`);

        const startTime = Date.now();
        const response = await openai.embeddings.create({
          model: 'bge-m3',
          input: text,
          encoding_format: "float"
        });
        const endTime = Date.now();

        console.log(\`    ⏱️  API 호출 시간: \${endTime - startTime}ms\`);
        console.log(\`    📊 응답 데이터 길이: \${response.data[0].embedding.length}\`);

        const normalizedVec = norm(response.data[0].embedding);

        industryEmbeddings.push({
          industry_ko: industry.industry_ko,
          vec: normalizedVec
        });

        // Rate limit 방지를 위한 delay (100ms)
        await delay(1200);
      } catch (error) {
        console.error(\`❌ \${industry.industry_ko} 임베딩 생성 실패:\`, error.message);
        console.error(\`❌ 전체 에러:\`, error);
        throw error; // 오류 발생 시 중단
      }
    }

    console.log('🎭 페르소나 임베딩 생성 중...');

    // 마크다운 파일 읽기 (경로 안전하게 처리)
    const aboutAiPath = path.join(process.cwd(), 'src', 'data', 'corpus', 'about_ai.md');
    const greetingPath = path.join(process.cwd(), 'src', 'data', 'corpus', 'greeting.md');
    const investmentPath = path.join(process.cwd(), 'src', 'data', 'corpus', 'investment.md');

    console.log('📄 about_ai.md 경로:', aboutAiPath);
    console.log('📄 greeting.md 경로:', greetingPath);
    console.log('📄 investment.md 경로:', investmentPath);

    const aboutAiContent = fs.readFileSync(aboutAiPath, 'utf8');
    const greetingContent = fs.readFileSync(greetingPath, 'utf8');
    const investmentContent = fs.readFileSync(investmentPath, 'utf8');

    // 예시 추출
    const extractExamples = (content) => {
      const lines = content.split('\\n');
      const examples = [];
      let inExamplesSection = false;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === '## Examples') {
          inExamplesSection = true;
          continue;
        }
        if (inExamplesSection && trimmed.startsWith('- ')) {
          examples.push(trimmed.substring(2));
        }
        if (inExamplesSection && trimmed.startsWith('#') && trimmed !== '## Examples') {
          break;
        }
      }
      return examples;
    };

    const aboutAiExamples = extractExamples(aboutAiContent);
    const greetingExamples = extractExamples(greetingContent);
    const investmentExamples = extractExamples(investmentContent);

    console.log(\`  about_ai 예시: \${aboutAiExamples.length}개\`);
    console.log(\`  greeting 예시: \${greetingExamples.length}개\`);
    console.log(\`  investment 예시: \${investmentExamples.length}개\`);

    // BGE-M3 모델 최적화: 데이터 균형과 명확한 컨텍스트
    // Investment는 모든 예시 사용, about_ai와 greeting은 확장된 모든 예시 사용

    console.log(\`  전체 예시 개수 - about_ai: \${aboutAiExamples.length}개, greeting: \${greetingExamples.length}개, investment: \${investmentExamples.length}개\`);

    // 텍스트 길이 균형을 위한 청킹 함수 (BGE-M3의 8192 토큰 한도 고려)
    const createBalancedText = (examples, category, description) => {
      // 예시들을 적절한 크기로 청킹하여 의미적 일관성 유지
      const chunkSize = Math.min(50, Math.ceil(examples.length / 4)); // 최대 50개씩 청킹
      const chunks = [];

      for (let i = 0; i < examples.length; i += chunkSize) {
        chunks.push(examples.slice(i, i + chunkSize));
      }

      // 각 청크를 의미적으로 연결하여 하나의 텍스트로 구성
      const chunkTexts = chunks.map((chunk, index) => {
        return \`[\${category} 패턴 \${index + 1}] \${chunk.join(' / ')}\`;
      });

      return \`\${description} 이 카테고리의 특징적인 표현 패턴들: \${chunkTexts.join(' || ')}\`;
    };

    // BGE-M3 최적화된 텍스트 구성: 모든 데이터 활용 + 명확한 구분
    const personaTexts = [
      {
        name: 'about_ai',
        text: createBalancedText(
          aboutAiExamples,
          'AI 정체성',
          'AI 어시스턴트의 정체성, 능력, 기능, 특성에 대한 질문들입니다. 사용자가 AI의 역할, 능력, 성격, 한계 등을 궁금해할 때 사용하는 표현들로, AI가 무엇을 할 수 있고 어떤 존재인지에 대한 호기심을 나타냅니다.'
        )
      },
      {
        name: 'greeting',
        text: createBalancedText(
          greetingExamples,
          '인사 표현',
          '일상적인 인사말, 안부 표현, 만남과 헤어짐의 인사들입니다. 시간대별 인사, 상황별 안부, 예의를 지키는 사회적 상호작용의 기본 표현들로, 대화의 시작이나 끝에서 사용됩니다.'
        )
      },
      {
        name: 'investment',
        text: createBalancedText(
          investmentExamples,
          '투자 관련',
          '투자, 금융, 주식, 기업, 산업, 경제에 관한 질문과 표현들입니다. 투자 기회 탐색, 시장 분석, 기업 정보, 산업 동향 등 투자 의사결정과 관련된 모든 표현들을 포함합니다.'
        )
      }
    ];

    console.log('🎭 페르소나 임베딩 생성 중...');
    const personas = [];

    // 페르소나 임베딩 - Clova Studio OpenAI 호환 API 사용
    for (let i = 0; i < personaTexts.length; i++) {
      const persona = personaTexts[i];

      console.log(\`  \${i + 1}/\${personaTexts.length} 처리 중: \${persona.name}\`);

      try {
        console.log(\`    📝 입력 텍스트 길이: \${persona.text.length}자\`);
        console.log(\`    📝 입력 텍스트 미리보기: \${persona.text.substring(0, 100)}...\`);

        const startTime = Date.now();
        const response = await openai.embeddings.create({
          model: 'bge-m3',
          input: persona.text,
          encoding_format: "float"
        });
        const endTime = Date.now();

        console.log(\`    ⏱️  API 호출 시간: \${endTime - startTime}ms\`);
        console.log(\`    📊 응답 데이터 길이: \${response.data[0].embedding.length}\`);
        console.log(\`    📊 임베딩 벡터 샘플: [\${response.data[0].embedding.slice(0, 5).join(', ')}...]\`);

        const normalizedVec = norm(response.data[0].embedding);
        console.log(\`    📊 정규화 후 벡터 샘플: [\${normalizedVec.slice(0, 5).join(', ')}...]\`);

        personas.push({
          persona: persona.name,
          vec: normalizedVec
        });

        // Rate limit 방지를 위한 delay (100ms)
        await delay(100);
      } catch (error) {
        console.error(\`❌ \${persona.name} 임베딩 생성 실패:\`, error.message);
        console.error(\`❌ 전체 에러:\`, error);
        throw error; // 오류 발생 시 중단
      }
    }

    // 캐시 파일 저장
    const cacheData = {
      companies,
      industries: industryEmbeddings,
      personas
    };

    const cachePath = path.join(cacheDir, 'kospi_vectors.json');
    console.log('💾 캐시 파일 저장 경로:', cachePath);
    fs.writeFileSync(cachePath, JSON.stringify(cacheData));

    console.log('✅ 임베딩 생성 완료!');
    console.log(\`📊 생성된 임베딩: 기업 \${companies.length}개, 산업 \${industryEmbeddings.length}개, 페르소나 \${personas.length}개\`);

    // 캐시 파일 검증
    console.log('✅ 캐시 파일 검증 완료:');
    console.log(\`ℹ   - 기업: \${companies.length}개\`);
    console.log(\`ℹ   - 산업: \${industryEmbeddings.length}개\`);
    console.log(\`ℹ   - 페르소나: \${personas.length}개 (\${personas.map(p => p.persona).join(', ')})\`);

    return true;
  } catch (error) {
    console.error('❌ 임베딩 생성 실패:', error.message);
    console.error(error.stack);
    return false;
  }
}

generateEmbeddings().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ 스크립트 실행 오류:', error);
  process.exit(1);
});
`;

    // 임시 스크립트 파일 생성
    const tempScriptPath = path.join(PROJECT_ROOT, 'temp-generate-embeddings.js');
    fs.writeFileSync(tempScriptPath, embeddingScript);

    try {
      // Node.js로 임베딩 생성 스크립트 실행
      execSync(`node "${tempScriptPath}"`, {
        stdio: 'inherit',
        cwd: PROJECT_ROOT,
        env: { ...process.env }
      });

      log.success('임베딩 생성 완료!');
      return true;

    } finally {
      // 임시 스크립트 파일 삭제
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath);
      }
    }

  } catch (error) {
    log.error(`임베딩 생성 실패: ${error.message}`);
    log.info('상세 오류 정보를 확인하려면 위의 로그를 참조하세요.');
    return false;
  }
}

/**
 * 캐시 파일 검증
 */
function verifyCacheFile() {
  log.step('생성된 캐시 파일 검증 중...');
  
  if (!fs.existsSync(CACHE_FILE)) {
    log.error('캐시 파일이 생성되지 않았습니다.');
    return false;
  }
  
  try {
    const cacheContent = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    
    const companiesCount = cacheContent.companies?.length || 0;
    const industriesCount = cacheContent.industries?.length || 0;
    const personasCount = cacheContent.personas?.length || 0;
    
    log.success(`캐시 파일 검증 완료:`);
    log.info(`  - 기업: ${companiesCount}개`);
    log.info(`  - 산업: ${industriesCount}개`);
    log.info(`  - 페르소나: ${personasCount}개`);
    
    if (personasCount < 2) {
      log.warning('페르소나 임베딩이 충분하지 않습니다. (최소 2개 필요)');
      return false;
    }
    
    return true;
    
  } catch (error) {
    log.error(`캐시 파일 검증 실패: ${error.message}`);
    return false;
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  log.header('임베딩 캐시 재생성 스크립트');
  
  const startTime = Date.now();
  
  try {
    // 1. 환경 변수 확인
    if (!checkEnvironment()) {
      process.exit(1);
    }
    
    // 2. 마크다운 파일 확인
    if (!checkMarkdownFiles()) {
      process.exit(1);
    }
    
    // 3. 기존 캐시 파일 삭제
    if (!deleteCacheFile()) {
      process.exit(1);
    }
    
    // 4. 임베딩 생성
    if (!await triggerEmbeddingGeneration()) {
      process.exit(1);
    }
    
    // 5. 캐시 파일 검증
    if (!verifyCacheFile()) {
      process.exit(1);
    }
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    log.header(`🎉 캐시 재생성 완료! (소요시간: ${duration}초)`);
    log.info('이제 애플리케이션에서 새로운 임베딩을 사용할 수 있습니다.');
    
  } catch (error) {
    log.error(`예상치 못한 오류 발생: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// 스크립트가 직접 실행될 때만 main 함수 호출
if (require.main === module) {
  main();
}

module.exports = {
  checkEnvironment,
  checkMarkdownFiles,
  deleteCacheFile,
  triggerEmbeddingGeneration,
  verifyCacheFile
};
