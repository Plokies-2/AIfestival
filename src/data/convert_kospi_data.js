const fs = require('fs');
const path = require('path');

// KOSPI 회사 데이터 로드
const kospiCompaniesPath = path.join(__dirname, 'KOSPI_companies.json');
const kospiCompanies = JSON.parse(fs.readFileSync(kospiCompaniesPath, 'utf8'));

console.log('📊 KOSPI 데이터 분석:');
console.log(`총 기업 수: ${kospiCompanies.length}`);

// 산업별 기업 수 계산
const industryCount = {};
kospiCompanies.forEach(company => {
  const industry = company.industry;
  industryCount[industry] = (industryCount[industry] || 0) + 1;
});

console.log('\n📈 산업별 기업 수:');
Object.entries(industryCount)
  .sort((a, b) => b[1] - a[1])
  .forEach(([industry, count]) => {
    console.log(`  ${industry}: ${count}개`);
  });

// main_product가 없는 기업들 확인
const noMainProduct = kospiCompanies.filter(company => 
  !company.main_product || 
  company.main_product === null || 
  company.main_product === 'NaN' ||
  company.main_product === ''
);

console.log(`\n⚠️ main_product가 없는 기업: ${noMainProduct.length}개`);
if (noMainProduct.length > 0) {
  console.log('예시:');
  noMainProduct.slice(0, 5).forEach(company => {
    console.log(`  ${company.name} (${company.ticker}): ${company.main_product}`);
  });
}

// kospi_enriched_final.ts 파일 생성
const enrichedData = {};
kospiCompanies.forEach(company => {
  // ticker에서 .KS 제거하여 키로 사용
  const ticker = company.ticker.replace('.KS', '');
  
  enrichedData[ticker] = {
    name: company.name,
    description: company.main_product && 
                 company.main_product !== null && 
                 company.main_product !== 'NaN' && 
                 company.main_product !== '' 
                 ? company.main_product 
                 : `${company.industry} 관련 사업`,
    industry: company.industry
  };
});

// TypeScript 파일로 출력
const tsContent = `export const KOSPI_ENRICHED_FINAL = ${JSON.stringify(enrichedData, null, 2)} as const;`;

const outputPath = path.join(__dirname, 'kospi_enriched_final.ts');
fs.writeFileSync(outputPath, tsContent, 'utf8');

console.log(`\n✅ kospi_enriched_final.ts 파일 생성 완료`);
console.log(`📁 위치: ${outputPath}`);
console.log(`📊 총 ${Object.keys(enrichedData).length}개 기업 데이터 변환 완료`);
