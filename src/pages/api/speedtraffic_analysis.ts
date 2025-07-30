import { NextApiRequest, NextApiResponse } from 'next';
import { executePythonAnalysis } from './unified_analysis';

// 심볼별 뮤텍스 - 동시 요청 방지
const processing = new Map<string, { active: boolean; startTime: number }>();

// 서킷 브레이커 패턴 - 심볼별 실패 추적
const failureCount = new Map<string, number>();
const lastFailureTime = new Map<string, number>();
const FAILURE_THRESHOLD = 3;
const CIRCUIT_BREAKER_TIMEOUT = 5 * 60 * 1000; // 5분

// 오래된 처리 항목 정리 (2분 이상)
const cleanupStaleProcessing = () => {
  const now = Date.now();
  const twoMinutes = 2 * 60 * 1000; // 5분에서 2분으로 단축
  let cleanedCount = 0;

  for (const [symbol, info] of processing.entries()) {
    if (info.active && (now - info.startTime) > twoMinutes) {
      console.log(`[SPEEDTRAFFIC_API] 오래된 처리 항목 정리: ${symbol} (${now - info.startTime}ms 경과)`);
      processing.delete(symbol);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`[SPEEDTRAFFIC_API] 정리 완료: ${cleanedCount}개 항목 제거`);
  }
};

// 1분마다 정리 작업 실행
setInterval(cleanupStaleProcessing, 60 * 1000);

// 서킷 브레이커 상태 확인
const isCircuitBreakerOpen = (symbol: string): boolean => {
  const failures = failureCount.get(symbol) || 0;
  const lastFailure = lastFailureTime.get(symbol) || 0;
  const now = Date.now();

  if (failures >= FAILURE_THRESHOLD) {
    if (now - lastFailure < CIRCUIT_BREAKER_TIMEOUT) {
      return true; // 서킷 브레이커 열림
    } else {
      // 타임아웃 후 서킷 브레이커 리셋
      failureCount.delete(symbol);
      lastFailureTime.delete(symbol);
      return false;
    }
  }
  return false;
};

// 실패 기록
const recordFailure = (symbol: string) => {
  const failures = (failureCount.get(symbol) || 0) + 1;
  failureCount.set(symbol, failures);
  lastFailureTime.set(symbol, Date.now());
  console.log(`[SPEEDTRAFFIC_API] 실패 기록 ${failures}회: ${symbol}`);
};



// 서비스별 신호등 색상 가져오기
const getServiceTrafficLight = (result: any): string => {
  return result?.traffic_light || 'red';
};

// 기술적 분석 통합 색상 (MFI + Bollinger + RSI)
const getTechnicalAnalysisColor = (mfiResult: any, bollingerResult: any, rsiResult: any): string => {
  const mfiColor = mfiResult?.traffic_light || 'red';
  const bollingerColor = bollingerResult?.traffic_light || 'red';
  const rsiColor = rsiResult?.traffic_light || 'red';

  // 녹색 신호 개수 계산
  const greenCount = [mfiColor, bollingerColor, rsiColor].filter(color => color === 'green').length;
  
  if (greenCount >= 2) return 'green';
  if (greenCount === 1) return 'yellow';
  return 'red';
};

// 더 이상 사용하지 않는 함수 (직접 Python 함수 호출로 대체됨)
// const fetchAnalysisResult = async (url: string, processName: string, maxRetries: number = 3): Promise<any> => {
//   ... (localhost 호출 방식은 Vercel에서 작동하지 않으므로 제거됨)
// };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol } = req.query;

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Symbol is required' });
  }

  const ticker = symbol.toUpperCase();

  // 정리 작업 실행
  cleanupStaleProcessing();

  // 서킷 브레이커 확인
  if (isCircuitBreakerOpen(ticker)) {
    return res.status(429).json({ 
      error: '서킷 브레이커 활성화됨. 잠시 후 다시 시도해주세요.',
      retry_after: Math.ceil(CIRCUIT_BREAKER_TIMEOUT / 1000)
    });
  }

  // 중복 요청 확인 (더 유연하게)
  const existingProcess = processing.get(ticker);
  const now = Date.now();

  if (existingProcess?.active) {
    // 처리 시작한지 2분 이상 지났으면 강제로 해제
    const processingTime = now - existingProcess.startTime;
    if (processingTime > 2 * 60 * 1000) { // 2분
      console.log(`[SPEEDTRAFFIC_API] ${ticker} 처리 시간 초과로 강제 해제 (${processingTime}ms)`);
      processing.delete(ticker);
    } else {
      // 아직 처리 중이면 409 반환
      return res.status(409).json({
        error: '이미 처리 중인 요청이 있습니다.',
        processing_since: existingProcess.startTime,
        processing_time_ms: processingTime
      });
    }
  }

  // 처리 시작 표시
  processing.set(ticker, { active: true, startTime: now });

  try {
    console.log(`[SPEEDTRAFFIC_API] ${ticker} 분석 시작`);

    // 직접 Python 분석 함수 호출 (localhost 호출 대신)
    // 6개 분석 서비스 병렬 실행 (직접 함수 호출 방식)
    const [mfiResult, bollingerResult, rsiResult, industryResult, capmResult, garchResult] = await Promise.allSettled([
      executePythonAnalysis(ticker, 'mfi').catch(error => {
        console.error(`[MFI_ERROR] ${ticker}:`, error);
        return null;
      }),
      executePythonAnalysis(ticker, 'bollinger').catch(error => {
        console.error(`[BOLLINGER_ERROR] ${ticker}:`, error);
        return null;
      }),
      executePythonAnalysis(ticker, 'rsi').catch(error => {
        console.error(`[RSI_ERROR] ${ticker}:`, error);
        return null;
      }),
      executePythonAnalysis(ticker, 'industry').catch(error => {
        console.error(`[INDUSTRY_ERROR] ${ticker}:`, error);
        return null;
      }),
      executePythonAnalysis(ticker, 'capm').catch(error => {
        console.error(`[CAPM_ERROR] ${ticker}:`, error);
        return null;
      }),
      executePythonAnalysis(ticker, 'garch').catch(error => {
        console.error(`[GARCH_ERROR] ${ticker}:`, error);
        return null;
      })
    ]);

    // 결과 추출 (Promise.allSettled 결과에서 값 추출)
    const finalMFIResult = mfiResult.status === 'fulfilled' ? mfiResult.value : null;
    const finalBollingerResult = bollingerResult.status === 'fulfilled' ? bollingerResult.value : null;
    const finalRSIResult = rsiResult.status === 'fulfilled' ? rsiResult.value : null;
    const finalIndustryResult = industryResult.status === 'fulfilled' ? industryResult.value : null;
    const finalCAPMResult = capmResult.status === 'fulfilled' ? capmResult.value : null;
    const finalGARCHResult = garchResult.status === 'fulfilled' ? garchResult.value : null;

    // 실패한 서비스 로그
    if (mfiResult.status === 'rejected') console.error(`[MFI_ERROR] ${ticker}:`, mfiResult.reason);
    if (bollingerResult.status === 'rejected') console.error(`[BOLLINGER_ERROR] ${ticker}:`, bollingerResult.reason);
    if (rsiResult.status === 'rejected') console.error(`[RSI_ERROR] ${ticker}:`, rsiResult.reason);
    if (industryResult.status === 'rejected') console.error(`[INDUSTRY_ERROR] ${ticker}:`, industryResult.reason);
    if (capmResult.status === 'rejected') console.error(`[CAPM_ERROR] ${ticker}:`, capmResult.reason);
    if (garchResult.status === 'rejected') console.error(`[GARCH_ERROR] ${ticker}:`, garchResult.reason);

    // 기술적 분석 통합 색상 계산
    const technicalColor = getTechnicalAnalysisColor(finalMFIResult, finalBollingerResult, finalRSIResult);

    // 최종 결과 구성
    const result = {
      symbol: ticker,
      timestamp: new Date().toISOString(),
      mfi: finalMFIResult,
      bollinger: finalBollingerResult,
      rsi: finalRSIResult,
      industry: finalIndustryResult,
      capm: finalCAPMResult,
      garch: finalGARCHResult,
      traffic_lights: {
        technical: technicalColor, // 기술적 분석 (MFI + Bollinger + RSI)
        industry: finalIndustryResult ? getServiceTrafficLight(finalIndustryResult) : 'inactive', // 산업 민감도
        market: finalCAPMResult ? getServiceTrafficLight(finalCAPMResult) : 'inactive', // 시장 민감도 (CAPM)
        risk: finalGARCHResult ? getServiceTrafficLight(finalGARCHResult) : 'inactive' // 변동성 리스크
      }
    };

    console.log(`[SPEEDTRAFFIC_API] ${ticker} 분석 완료 - 신호등: ${JSON.stringify(result.traffic_lights)}`);

    return res.status(200).json(result);

  } catch (error) {
    console.error(`[SPEEDTRAFFIC_API] ${ticker} 분석 오류:`, error);

    // 실패 기록
    recordFailure(ticker);

    return res.status(500).json({
      error: '분석 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    });
  } finally {
    // 처리 완료 표시 (성공/실패 관계없이 항상 실행)
    processing.delete(ticker);
    console.log(`[SPEEDTRAFFIC_API] ${ticker} 처리 완료 - 뮤텍스 해제`);
  }
}
