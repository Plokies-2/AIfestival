import { NextApiRequest, NextApiResponse } from 'next';
import {
  generateEnhancedInvestmentAnalysis,
  InvestmentRecommendationInput
} from '@/lib/ai-chat/ai-service';
import { 
  getSession, 
  updateSession 
} from '@/lib/ai-chat/session-manager';
import { KOSPI_ENRICHED_FINAL as DATA } from '@/data/kospi_enriched_final';

/**
 * 실시간 스트리밍 상세 투자 분석 API 엔드포인트
 * Server-Sent Events를 사용하여 실시간 진행 상황 전송
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // SSE 헤더 설정
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const sendEvent = (type: string, data: any) => {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { userMessage, sessionId } = req.body;

    if (!userMessage) {
      sendEvent('error', { message: '사용자 메시지가 필요합니다.' });
      res.end();
      return;
    }

    // 세션 정보 가져오기
    const session = getSession(sessionId);
    if (!session || !session.recommendedIndustries || session.recommendedIndustries.length === 0) {
      sendEvent('error', { message: '세션 정보가 없거나 추천된 산업이 없습니다.' });
      res.end();
      return;
    }

    sendEvent('progress', { 
      step: 'start',
      message: '상세 분석을 시작합니다...',
      icon: '🚀'
    });

    // 투자 추천 입력 데이터 구성 - 1차 응답에서 실제로 추천된 산업만 사용
    const investmentInput: InvestmentRecommendationInput = {
      userMessage,
      selectedIndustries: session.recommendedIndustries || []
    };

    sendEvent('progress', { 
      step: 'search',
      message: '투자 동향 뉴스 검색 중...',
      icon: '🔍'
    });

    // 고급 투자 분석 실행 (진행 상황 콜백 포함)
    const analysisData = await generateEnhancedInvestmentAnalysis(investmentInput, {
      onProgress: (step: string, message: string, icon?: string, detail?: string) => {
        sendEvent('progress', { step, message, icon: icon || '⚡', detail });
      }
    });

    sendEvent('progress', { 
      step: 'generate',
      message: '투자 전략 생성 중...',
      icon: '📊'
    });

    // 응답 생성
    let reply = `📊 **투자 동향 뉴스 ${analysisData.trendNewsCount || 0}개와 기업별 뉴스를 종합 분석하였습니다.**\n\n`;
    
    // 시장 분석 추가
    if (analysisData.marketAnalysis) {
      reply += `${analysisData.marketAnalysis}\n\n`;
    }

    const investmentRecommendation = analysisData.investmentRecommendation;

    // 정통한 전략 섹션
    if (investmentRecommendation.traditionalStrategy.length > 0) {
      reply += `## 🎯 정통한 투자 전략\n\n`;
      investmentRecommendation.traditionalStrategy.forEach((rec) => {
        reply += `**${rec.ticker} (${rec.name})**\n${rec.reason}\n\n`;
      });
    }

    // 창의적 전략 섹션
    if (investmentRecommendation.creativeStrategy.length > 0) {
      reply += `## 🚀 창의적 투자 전략\n\n`;
      investmentRecommendation.creativeStrategy.forEach((rec) => {
        reply += `**${rec.ticker} (${rec.name})**\n${rec.reason}\n\n`;
      });
    }

    // 전략 비교 분석 추가
    if (analysisData.strategyComparison) {
      reply += `## ⚖️ 전략 비교 분석\n${analysisData.strategyComparison}`;
    }

    sendEvent('progress', { 
      step: 'complete',
      message: '분석 완료!',
      icon: '✅'
    });

    // 포트폴리오 데이터 전송
    const portfolioData = {
      traditionalStrategy: investmentRecommendation.traditionalStrategy,
      creativeStrategy: investmentRecommendation.creativeStrategy,
      selectedIndustries: investmentInput.selectedIndustries,
      userMessage: investmentInput.userMessage,
      refinedQuery: analysisData?.refinedQuery || investmentInput.userMessage
    };

    // 최종 결과 전송
    sendEvent('result', {
      reply,
      portfolioData,
      analysisData
    });

    // 세션 업데이트
    updateSession(sessionId, {
      stage: 'COMPLETED',
      lastAnalysis: {
        userMessage,
        reply,
        timestamp: new Date().toISOString()
      }
    });

    res.end();

  } catch (error) {
    console.error('❌ [상세 분석] 스트리밍 오류:', error);
    
    sendEvent('error', {
      message: error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.stack : String(error)
    });
    
    res.end();
  }
}
