import { NextApiRequest, NextApiResponse } from 'next';
import {
  generateEnhancedInvestmentAnalysis,
  InvestmentRecommendationInput
} from '@/lib/ai-chat/ai-service';

import {
  getSession,
  updateSession,
  updateAnalysisProgress,
  completeAnalysis,
  clearAnalysisProgress
} from '@/lib/ai-chat/session-manager';
import { KOSPI_ENRICHED_FINAL as DATA } from '@/data/kospi_enriched_final';

/**
 * 상세 투자 분석 API 엔드포인트
 * 고급 모델을 사용하여 심층적인 투자 추천을 제공
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId = 'global-session' } = req.body;

  try {

    // 세션에서 상세 분석 데이터 가져오기
    const session = getSession(sessionId);
    const analysisData = session.pendingDetailedAnalysis;

    console.log(`🔍 [상세 분석] 세션 상태 확인:`, {
      sessionId,
      stage: session.stage,
      selectedIndustry: session.selectedIndustry,
      hasPendingAnalysis: !!analysisData,
      analysisDataKeys: analysisData ? Object.keys(analysisData) : []
    });

    if (!analysisData) {
      console.error(`❌ [상세 분석] 세션에 상세 분석 데이터가 없음:`, {
        sessionId,
        sessionStage: session.stage,
        sessionIndustry: session.selectedIndustry,
        sessionCompanies: session.industryCompanies?.length || 0
      });

      return res.status(400).json({
        error: '상세 분석 데이터가 없습니다. 먼저 투자 질의를 해주세요.',
        debug: process.env.NODE_ENV === 'development' ? {
          sessionStage: session.stage,
          sessionIndustry: session.selectedIndustry,
          sessionCompanies: session.industryCompanies?.length || 0
        } : undefined
      });
    }

    console.log(`🤖 [상세 분석] 고급 모델로 투자 추천 생성 시작`);

    // 상세 분석 데이터 구조 로깅
    console.log(`📊 [상세 분석] 입력 데이터 구조:`, {
      userMessage: analysisData.userMessage?.substring(0, 50) + '...',
      industryResultsCount: analysisData.industryResults?.length || 0,
      industryResults: analysisData.industryResults?.map((industry: any) => ({
        industry_ko: industry.industry_ko,
        sp500_industry: industry.sp500_industry,
        score: industry.score,
        companiesCount: industry.companies?.length || 0,
        companies: industry.companies || [] // 전체 기업 목록 로깅
      })),
      ragAccuracy: analysisData.ragAccuracy
    });

    // LLM 투자 분석 입력 데이터 구성
    const investmentInput: InvestmentRecommendationInput = {
      userMessage: analysisData.userMessage,
      selectedIndustries: analysisData.industryResults.map((industry: any) => ({
        industry_ko: industry.industry_ko,
        score: industry.score,
        companies: industry.companies.map((ticker: string) => {
          const companyData = (DATA as any)[ticker];
          return {
            ticker: ticker,
            name: companyData?.name || ticker,
            industry: companyData?.industry || industry.industry_ko
          };
        })
      })),
      ragAccuracy: analysisData.ragAccuracy
    };

    // 최종 투자 입력 데이터 로깅
    console.log(`🎯 [상세 분석] 최종 투자 입력 데이터:`, {
      userMessage: investmentInput.userMessage?.substring(0, 50) + '...',
      selectedIndustriesCount: investmentInput.selectedIndustries.length,
      totalCompanies: investmentInput.selectedIndustries.reduce((sum, industry) => sum + industry.companies.length, 0),
      ragAccuracy: investmentInput.ragAccuracy
    });

    // 🚀 검색 기능이 통합된 고급 투자 분석 (HCX-005 Function Calling + 네이버 뉴스 API)
    console.log(`🚀 [Enhanced Analysis] 검색 기능이 통합된 투자 분석 시작`);

    // 분석 진행 상황 초기화
    clearAnalysisProgress(sessionId);

    const investmentRecommendation = await generateEnhancedInvestmentAnalysis(investmentInput, {
      onProgress: (step: string, message: string, icon?: string, detail?: string) => {
        // 실시간 진행 상황 업데이트
        updateAnalysisProgress(sessionId, step, message, icon, detail);
        console.log(`📊 [Progress] ${step}: ${message}${detail ? ` (${detail})` : ''}`);
      }
    });

    // 🔍 새로운 산업 동향 중심 답변 구조로 응답 생성
    let reply = '';

    // 검색 요약 추가
    if (investmentRecommendation.searchSummary) {
      reply += `📊 **${investmentRecommendation.searchSummary}**\n\n`;
    }

    // 분석 근거를 먼저 표시 (산업 동향 중심)
    if (investmentRecommendation.analysisReasoning) {
      reply += `${investmentRecommendation.analysisReasoning}\n\n`;
    }

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

    // 전략 비교 분석 섹션
    if (investmentRecommendation.strategyComparison) {
      reply += `## ⚖️ 전략 비교 분석\n${investmentRecommendation.strategyComparison}\n\n`;
    }



    console.log(`✅ [상세 분석] 고급 모델 응답 생성 완료`);

    // LSTM 데이터로 응답 향상 (첫 번째 산업 기준) - LSTM 서비스 비활성화됨
    // const primaryIndustryCompanies = analysisData.industryResults[0]?.companies || [];
    // const enhancedReply = await enhanceResponseWithLSTMData(primaryIndustryCompanies, reply);
    const enhancedReply = reply; // LSTM 기능 비활성화로 원본 응답 사용

    // 📊 포트폴리오 데이터 저장 (클라이언트에서 처리하도록 데이터 전달)
    const portfolioData = {
      traditionalStrategy: investmentRecommendation.traditionalStrategy,
      creativeStrategy: investmentRecommendation.creativeStrategy,
      selectedIndustries: investmentInput.selectedIndustries,
      userMessage: investmentInput.userMessage,
      refinedQuery: analysisData?.refinedQuery || investmentInput.userMessage
    };

    // 분석 완료 처리
    completeAnalysis(sessionId);

    // 세션에서 상세 분석 데이터 제거 (완료됨)
    updateSession(sessionId, {
      ...session,
      pendingDetailedAnalysis: undefined
    });

    res.status(200).json({
      success: true,
      reply: enhancedReply,
      portfolioData, // 포트폴리오 데이터 추가
      status: 'detailed_analysis_complete'
    });

  } catch (error) {
    console.error('❌ [상세 분석] 투자 추천 생성 실패:', error);

    // 에러 발생 시에도 분석 완료 처리
    completeAnalysis(sessionId);

    // 더 상세한 에러 정보 제공
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('❌ [상세 분석] 에러 상세:', {
      message: errorMessage,
      stack: errorStack,
      sessionId,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      error: '상세 분석 중 오류가 발생했습니다.',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    });
  }
}
