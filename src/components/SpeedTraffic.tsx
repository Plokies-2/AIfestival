import React, { useState, useEffect, useRef } from 'react';
import { getCompanyName } from '../utils/companyLookup';

interface SpeedTrafficProps {
  symbol?: string;
  onPhaseMessage?: (message: string, hasReportButton?: boolean) => void;
  onAnalysisComplete?: (results: AnalysisResults) => void;
}

interface AnalysisResults {
  symbol: string;
  companyName: string;
  timestamp: string;
  analysisDate: string;
  mfi?: any;
  bollinger?: any;
  rsi?: any;
  industry?: any;
  capm?: any;
  garch?: any;
  traffic_lights: {
    technical?: string;
    industry?: string;
    market?: string;
    risk?: string;
  };
}

const SpeedTraffic: React.FC<SpeedTrafficProps> = ({ symbol, onPhaseMessage, onAnalysisComplete }) => {
  // 분석 상태 관리
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // 요청 중복 방지
  const inFlight = useRef(false);
  const lastRequestTime = useRef(0);
  const processedSymbols = useRef(new Set<string>());

  // 분석 실행 함수
  const executeAnalysis = async () => {
    if (!symbol || inFlight.current) return;

    // 이미 처리된 심볼인지 확인
    if (processedSymbols.current.has(symbol)) {
      console.log(`${symbol}은 이미 분석되었습니다.`);
      return;
    }

    // 요청 간격 제한 (최소 10초)
    const now = Date.now();
    if (now - lastRequestTime.current < 10000) {
      console.log('요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      inFlight.current = true;
      lastRequestTime.current = now;
      setIsAnalyzing(true);
      setAnalysisError(null);

      const companyName = getCompanyName(symbol);
      onPhaseMessage?.(`🚀 ${companyName} 차트 분석을 시작할게요! 📊`);

      // 1.5초 대기
      await new Promise(resolve => setTimeout(resolve, 1500));

      // API 호출
      const response = await fetch(`/api/speedtraffic_analysis?symbol=${symbol}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(45000), // 45초 타임아웃
      });

      if (!response.ok) {
        throw new Error(`분석 실패: HTTP ${response.status}`);
      }

      const result = await response.json();

      // 분석 완료 메시지
      onPhaseMessage?.('기술적 분석, 산업 민감도, 시장 민감도, 변동성 리스크 분석을 완료했어요! 📊');

      // 최종 결과 구성
      const finalResults: AnalysisResults = {
        symbol,
        companyName,
        timestamp: new Date().toISOString(),
        analysisDate: new Date().toISOString().split('T')[0],
        mfi: result.mfi,
        bollinger: result.bollinger,
        rsi: result.rsi,
        industry: result.industry,
        capm: result.capm,
        garch: result.garch,
        traffic_lights: result.traffic_lights || {}
      };

      // 분석 완료 콜백 호출
      onAnalysisComplete?.(finalResults);

      // 처리된 심볼로 표시
      processedSymbols.current.add(symbol);

      // 완료 메시지
      onPhaseMessage?.('4단계 분석이 완료되었습니다! 투자 신호등을 확인해보세요. 🎯', true);

    } catch (error) {
      console.error('분석 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '분석 서비스 연결 실패';
      setAnalysisError(errorMessage);
      onPhaseMessage?.(`❌ 분석 중 오류가 발생했습니다: ${errorMessage}`);
    } finally {
      setIsAnalyzing(false);
      inFlight.current = false;
    }
  };

  // symbol이 변경될 때 한 번만 분석 실행 (매우 제한적)
  useEffect(() => {
    if (symbol && !processedSymbols.current.has(symbol) && !inFlight.current) {
      console.log(`Starting analysis for ${symbol}`);
      executeAnalysis();
    }
  }, [symbol]); // isAnalyzing 의존성 제거로 무한 루프 방지

  // symbol이 없으면 아무것도 렌더링하지 않음
  if (!symbol) {
    return null;
  }

  // 컴포넌트는 UI를 렌더링하지 않음 (백그라운드에서만 동작)
  return null;
};

export default SpeedTraffic;
