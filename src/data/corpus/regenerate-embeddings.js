#!/usr/bin/env node

/**
 * 캐시 재생성 스크립트
 * 
 * about_ai.md와 greeting.md 파일 변경 시 임베딩 캐시를 자동으로 재생성합니다.
 * 
 * 사용법:
 *   node src/data/corpus/regenerate-embeddings.js
 *   또는
 *   npm run regenerate-embeddings
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
const CACHE_FILE = path.join(PROJECT_ROOT, '.cache', 'sp500_vectors.json');
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

    // OpenAI 클라이언트 직접 사용
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 데이터 로드 (TypeScript 파일을 직접 읽어서 파싱)
    const dataPath = path.join(process.cwd(), 'src', 'data', 'sp500_enriched_final.ts');
    console.log('📄 데이터 파일 경로:', dataPath);

    if (!fs.existsSync(dataPath)) {
      throw new Error(\`데이터 파일을 찾을 수 없습니다: \${dataPath}\`);
    }

    const dataContent = fs.readFileSync(dataPath, 'utf8');
    console.log('📄 파일 읽기 완료, 크기:', dataContent.length, 'bytes');

    // TypeScript 파일에서 데이터 추출 (개선된 정규식 사용)
    const dataMatch = dataContent.match(/export const QUICK_ENRICHED_FINAL = ({[\\s\\S]*?})\\s*as const;/);
    if (!dataMatch) {
      console.error('정규식 매칭 실패. 파일 시작 부분:', dataContent.substring(0, 200));
      throw new Error('sp500_enriched_final.ts에서 데이터를 찾을 수 없습니다. 파일 형식을 확인해주세요.');
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

    console.log('🏢 기업 임베딩 생성 중...');
    const tickers = Object.keys(DATA);
    const companies = [];
    const BATCH_SIZE = 100;

    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      const batch = tickers.slice(i, i + BATCH_SIZE);
      const texts = batch.map(t => \`\${DATA[t].name}. \${DATA[t].industry}. \${DATA[t].description}\`);

      console.log(\`  배치 \${Math.floor(i/BATCH_SIZE) + 1}/\${Math.ceil(tickers.length/BATCH_SIZE)} 처리 중...\`);

      const { data } = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
      });

      data.forEach((d, j) => {
        const ticker = batch[j];
        const company = DATA[ticker];
        companies.push({
          ticker,
          name: company.name,
          industry: company.industry,
          vec: norm(d.embedding)
        });
      });
    }

    console.log('🏭 산업 임베딩 생성 중...');
    const industries = [...new Set(companies.map(c => c.industry))];
    const { data: indData } = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: industries.map(s => \`\${s}: companies in \${s.toLowerCase()}\`),
    });

    const industryEmbeddings = indData.map((d, i) => ({
      industry: industries[i],
      vec: norm(d.embedding)
    }));

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

    const aboutAiText = aboutAiExamples.join('. ');
    const greetingText = greetingExamples.join('. ');
    const investmentText = investmentExamples.join('. ');

    const { data: personaData } = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: [aboutAiText, greetingText, investmentText],
    });

    const personas = [
      { persona: 'about_ai', vec: norm(personaData[0].embedding) },
      { persona: 'greeting', vec: norm(personaData[1].embedding) },
      { persona: 'investment', vec: norm(personaData[2].embedding) }
    ];

    // 캐시 파일 저장
    const cacheData = {
      companies,
      industries: industryEmbeddings,
      personas
    };

    const cachePath = path.join(cacheDir, 'sp500_vectors.json');
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
