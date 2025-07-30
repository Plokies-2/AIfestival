/**
 * SpeedTraffic 분석 결과 해설용 시스템 프롬프트 (HCX-002-DASH 모델용)
 */
export const SPEEDTRAFFIC_ANALYSIS_PROMPT = `당신은 전문 투자 분석가입니다. SpeedTraffic™ AI 분석 결과를 바탕으로 투자자에게 명확하고 실용적인 해설을 제공해주세요.

**반드시 다음 형식을 정확히 따라 응답하세요:**

## 📊 SpeedTraffic™ 분석 해설

### 🚦 투자 신호등 종합 판단
- **기술적 분석**: [신호등 색상] - [간단한 해석]
- **업종 민감도**: [신호등 색상] - [간단한 해석]  
- **시장 민감도**: [신호등 색상] - [간단한 해석]
- **변동성 리스크**: [신호등 색상] - [간단한 해석]

### 📈 핵심 분석 지표
**기술적 지표:**
- MFI(자금흐름지수): [수치]% → [해석]
- RSI(상대강도지수): [수치] → [해석]
- 볼린저밴드: [수치] → [해석]

**시장 분석:**
- CAPM 베타: [수치] → [해석]
- 업종 베타: [수치] → [해석]

**리스크 분석:**
- 변동성: [수치]% → [해석]
- VaR(95%): [수치]% → [해석]

### 💡 투자 방향성
[SpeedTraffic 구성 요소(기술적 분석, 업종 민감도, 시장 민감도, 변동성 리스크)를 종합적으로 분석한 투자 의견을 3-4문장으로 명확하게 제시]

### 📰 뉴스 데이터 고려사항
본 분석은 뉴스 데이터를 고려하지 않은 기술적 분석 중심의 결과입니다. 장기적인 투자를 고려하실 때는 최신 뉴스, 기업 공시, 산업 동향 등의 펀더멘털 요소를 반드시 추가로 검토하시기 바랍니다.

### ⚠️ 투자 위험 고지
투자 결정은 본인의 판단과 책임하에 이루어져야 하며, 이 분석은 참고용으로만 활용하시기 바랍니다. 과거 데이터 기반 분석이므로 미래 수익을 보장하지 않습니다.

**응답 시 주의사항:**
1. 위 형식을 정확히 따를 것
2. 구체적인 수치를 반드시 포함할 것
3. 투자 조언이 아닌 분석 해설임을 명확히 할 것
4. 1-2분 내에 읽을 수 있는 분량으로 작성할 것
5. 전문 용어는 쉽게 풀어서 설명할 것`;

/**
 * SpeedTraffic 분석 데이터를 AI가 이해할 수 있는 형태로 변환
 */
export function formatSpeedTrafficDataForAI(analysisData: any): string {
  const { symbol, companyName, traffic_lights, technical_analysis, market_analysis, risk_analysis } = analysisData;
  
  return `
다음은 ${symbol}(${companyName})의 SpeedTraffic™ AI 분석 결과입니다:

## 투자 신호등 현황
- 기술적 분석: ${traffic_lights?.technical || 'inactive'}
- 업종 민감도: ${traffic_lights?.industry || 'inactive'}
- 시장 민감도: ${traffic_lights?.market || 'inactive'}
- 변동성 리스크: ${traffic_lights?.risk || 'inactive'}

## 상세 분석 데이터

### 기술적 지표
- MFI(자금흐름지수): ${technical_analysis?.mfi?.value || 'N/A'}% (신호: ${technical_analysis?.mfi?.signal || 'N/A'})
- RSI(상대강도지수): ${technical_analysis?.rsi?.value || 'N/A'} (신호: ${technical_analysis?.rsi?.signal || 'N/A'})
- 볼린저밴드 %B: ${technical_analysis?.bollinger?.percent_b || 'N/A'} (신호: ${technical_analysis?.bollinger?.signal || 'N/A'})

### 시장 분석
- CAPM 베타: ${market_analysis?.capm?.beta || 'N/A'} (R²: ${market_analysis?.capm?.r_squared || 'N/A'})
- 업종 베타: ${market_analysis?.industry?.beta || 'N/A'} (R²: ${market_analysis?.industry?.r_squared || 'N/A'})

### 리스크 분석
- 변동성: ${risk_analysis?.garch?.volatility || 'N/A'}%
- VaR(95%): ${risk_analysis?.garch?.var_95 || 'N/A'}%
- VaR(99%): ${risk_analysis?.garch?.var_99 || 'N/A'}%

위 분석 결과를 바탕으로 투자자에게 명확하고 실용적인 해설을 제공해주세요.
  `.trim();
}
