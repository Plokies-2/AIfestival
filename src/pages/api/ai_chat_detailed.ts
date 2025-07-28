import { NextApiRequest, NextApiResponse } from 'next';
import {
  generateInvestmentRecommendations,
  generateEnhancedInvestmentAnalysis,
  InvestmentRecommendationInput
} from '@/lib/ai-chat/ai-service';
import { 
  enhanceResponseWithLSTMData 
} from '@/lib/ai-chat/lstm-service';
import { 
  getSession, 
  updateSession 
} from '@/lib/ai-chat/session-manager';
import { QUICK_ENRICHED_FINAL as DATA } from '@/data/sp500_enriched_final';

/**
 * 상세 투자 분석 API 엔드포인트
 * 고급 모델을 사용하여 심층적인 투자 추천을 제공
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId = 'global-session' } = req.body;

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
        error: '상세 분석 데이터가 없습니다. 먼저 투자 질의를 해주세요.'
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
        sp500_industry: industry.sp500_industry,
        score: industry.score,
        companies: industry.companies.map((ticker: string) => {
          const companyData = (DATA as any)[ticker];
          return {
            ticker: ticker,
            name: companyData?.name || ticker,
            industry: companyData?.industry || industry.sp500_industry
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
    const investmentRecommendation = await generateEnhancedInvestmentAnalysis(investmentInput);

    // 🔍 검색 기능이 통합된 분석 결과를 기반으로 응답 생성
    let reply = `🎯 **검색 기반 투자 분석 결과**\n\n`;

    // 검색 요약 추가
    if (investmentRecommendation.searchSummary) {
      reply += `📰 **최신 정보 수집**: ${investmentRecommendation.searchSummary}\n\n`;
    }

    // 정통한 전략 섹션
    if (investmentRecommendation.traditionalStrategy.length > 0) {
      reply += `## 🎯 정통한 투자 전략\n`;
      investmentRecommendation.traditionalStrategy.forEach((rec, index) => {
        reply += `${index + 1}. **${rec.ticker} (${rec.name})** - ${rec.reason}\n`;
      });
      reply += `\n`;
    }

    // 창의적 전략 섹션
    if (investmentRecommendation.creativeStrategy.length > 0) {
      reply += `## 🚀 창의적 투자 전략\n`;
      investmentRecommendation.creativeStrategy.forEach((rec, index) => {
        reply += `${index + 1}. **${rec.ticker} (${rec.name})** - ${rec.reason}\n`;
      });
      reply += `\n`;
    }

    // 최신 동향 뉴스 요약 (상위 3개만)
    if (investmentRecommendation.trendNews && investmentRecommendation.trendNews.length > 0) {
      reply += `## 📰 관련 최신 동향\n`;
      investmentRecommendation.trendNews.slice(0, 3).forEach((news, index) => {
        reply += `${index + 1}. ${news.title}\n`;
      });
      reply += `\n`;
    }

    // 분석 근거 추가
    if (investmentRecommendation.analysisReasoning) {
      reply += `### 📈 분석 근거\n${investmentRecommendation.analysisReasoning}\n\n`;
    }

    reply += `💡 더 자세한 분석이 필요하시면 언제든 말씀해 주세요!`;

    console.log(`✅ [상세 분석] 고급 모델 응답 생성 완료`);

    // LSTM 데이터로 응답 향상 (첫 번째 산업 기준)
    const primaryIndustryCompanies = analysisData.industryResults[0]?.companies || [];
    const enhancedReply = await enhanceResponseWithLSTMData(primaryIndustryCompanies, reply);

    // 세션에서 상세 분석 데이터 제거 (완료됨)
    updateSession(sessionId, {
      ...session,
      pendingDetailedAnalysis: undefined
    });

    res.status(200).json({
      success: true,
      reply: enhancedReply,
      status: 'detailed_analysis_complete'
    });

  } catch (error) {
    console.error('❌ [상세 분석] 투자 추천 생성 실패:', error);
    
    res.status(500).json({
      error: '상세 분석 중 오류가 발생했습니다.',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
