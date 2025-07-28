/**
 * Pipeline Stage Handlers Module
 * 
 * This module contains the stage-specific logic handlers for the AI chat pipeline:
 * - START stage: Initial user input processing and industry matching
 * - SHOW_INDUSTRY stage: Company selection within an industry
 * - ASK_CHART stage: Chart confirmation and final response
 */

import { PipelineContext, StageHandlerResult, SessionState, IntentClassificationResult } from './types';
import { KOSPI_ENRICHED_FINAL as DATA } from '@/data/kospi_enriched_final';
import { RAG_THRESHOLDS } from './config';
import {
  classifyUserIntent,
  generateDynamicResponse,
  generateEnhancedInvestmentAnalysis,
  InvestmentRecommendationInput
} from './ai-service';
import {
  findBestIndustries,
  getIndustryCompanies,
  getCompanyName
} from './rag-service';

import {
  isPositive,
  isNegative,
  formatCompanyList
} from './company-utils';
// 더보기 기능 제거됨 - session-manager import 불필요

// ============================================================================
// START Stage Handler
// ============================================================================

/**
 * Handles the START stage of the pipeline
 */
export async function handleStartStage(context: PipelineContext): Promise<StageHandlerResult> {
  const { userInput } = context;

  // 더보기 기능 제거됨 - 모든 기업을 처음부터 표시

  // Perform intent classification
  const intentResult = await classifyUserIntent(userInput);
  // 로그 최적화: 의도 분류 결과는 이미 ai-service에서 출력됨
  // console.log(`User intent: ${intentResult.intent}`);

  // Handle different intents
  switch (intentResult.intent) {
    case 'greeting':
    case 'about_ai':
    case 'casual_chat':
      return await handleConversationalIntent(context, intentResult);

    // case 'company_direct': // 주석처리: company direct match 제거
    //   return await handleDirectCompanyQuery(context);

    case 'investment_query':
    default:
      return await handleInvestmentQuery(context);
  }
}

/**
 * Handles conversational intents (greeting, about_ai, casual_chat)
 */
async function handleConversationalIntent(
  context: PipelineContext,
  intentResult: IntentClassificationResult
): Promise<StageHandlerResult> {
  const { userInput, state } = context;

  // GPT 기반 동적 응답 생성 (복구됨)
  const reply = await generateDynamicResponse(userInput, intentResult.intent);

  return {
    reply,
    newState: state // 단발성 응답 후 START 상태 유지
  };
}

// 제거된 기능: handleInvestmentRecommendation - investment_recommendation 의도 처리 제거됨

/**
 * Handles direct company queries - 주석처리: company direct match 제거
 */
// async function handleDirectCompanyQuery(context: PipelineContext): Promise<StageHandlerResult> {
//   const { userInput, state } = context;
//
//   const directCompany = findCompanyInAllData(userInput);
//   if (directCompany) {
//     // Company name directly entered - go straight to chart confirmation stage
//     const newState: SessionState = {
//       ...state,
//       stage: 'ASK_CHART',
//       selectedTicker: directCompany
//     };
//
//     const companyName = getCompanyName(directCompany);
//     const directChartQuestions = [
//       `🎯 ${companyName} (${directCompany}) 분석을 시작하시겠습니까? 📊`,
//       `📈 ${companyName} (${directCompany}) 차트 분석을 시작해볼까요? ✨`,
//       `🚀 ${companyName} (${directCompany})의 주가 분석을 확인해 드릴까요? 💹`
//     ];
//
//     // Get LSTM data
//     const lstmAnalysis = await getDetailedLSTMAnalysis(directCompany);
//     let analysisInfo = '';
//
//     if (lstmAnalysis) {
//       analysisInfo = `\n\n${lstmAnalysis.summary}${lstmAnalysis.details}`;
//     }
//
//     const reply = `${directChartQuestions[Math.floor(Math.random() * directChartQuestions.length)]}${analysisInfo}`;
//
//     // 대화 기록 저장 제거
//
//     return {
//       reply,
//       newState,
//       shouldReturn: true
//     };
//   }
//
//   // If company not found, fall back to investment query handling
//   return await handleInvestmentQuery(context);
// }

/**
 * 투자 질의 처리 (산업 매칭) - 새로운 로직: top 2 산업 처리
 * kospi_industry_vectors.ts 기반으로 직접 산업 매칭하여 상위 2개 산업 반환
 */
async function handleInvestmentQuery(
  context: PipelineContext
): Promise<StageHandlerResult> {
  const { userInput, sessionId, state } = context;

  // 새로운 RAG 로직: kospi_industry_vectors.ts 기반 top 2 산업 매칭
  const topIndustries = await findBestIndustries(userInput);

  // RAG 점수가 임계값보다 낮으면 인사말로 분류
  if (!topIndustries || topIndustries.length === 0) {
    // 로그 최적화: 상세 분류 로그 제거
    // console.log(`🗣️ Input classified as greeting due to low RAG scores: "${userInput}"`);
    const reply = await generateDynamicResponse(userInput, 'greeting');

    return {
      reply,
      newState: state // START 단계 유지
    };
  }

  // Top 2 산업에 대한 기업 정보 수집
  const industryResults = [];

  // 각 산업별로 기업 정보 수집 및 포맷팅
  for (const industryInfo of topIndustries) {
    const companies = getIndustryCompanies(industryInfo.industry_ko);
    if (companies.length > 0) {
      const companyList = formatCompanyList(companies);
      const totalCompaniesInIndustry = Object.entries(DATA)
        .filter(([_, company]: [string, any]) => company.industry === industryInfo.industry_ko).length;

      industryResults.push({
        industry_ko: industryInfo.industry_ko,
        companies,
        companyList,
        totalCompanies: totalCompaniesInIndustry,
        score: industryInfo.score
      });
    }
  }

  if (industryResults.length > 0) {
    // 첫 번째 산업을 주 산업으로 설정 (기존 로직과의 호환성)
    const primaryIndustry = industryResults[0];

    // RAG 점수 0.4 미만 처리: 더 자세한 정보 요청 메시지 출력 후 초기 상태로 돌아가기
    if (primaryIndustry.score < 0.4) {
      const detailRequestMessages = [
        "🤔 좀 더 구체적으로 알려주시면 더 정확한 추천을 드릴 수 있어요! 어떤 분야에 관심이 있으신지 자세히 말씀해 주세요.",
        "💡 투자하고 싶은 분야를 조금 더 자세히 설명해 주시면 맞춤형 추천을 해드릴게요!",
        "🎯 관심 있는 산업이나 기업 유형을 더 구체적으로 말씀해 주시면 정확한 분석을 도와드릴 수 있어요.",
        "📈 투자 관심사를 좀 더 상세하게 알려주시면 더 나은 투자 기회를 찾아드릴게요!",
        "🔍 어떤 종류의 투자에 관심이 있으신지 더 자세히 설명해 주시면 맞춤 추천을 해드릴 수 있어요!"
      ];

      // 메시지 rotate를 위한 인덱스 계산 (세션 ID 기반)
      const messageIndex = Math.abs(sessionId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % detailRequestMessages.length;
      const reply = detailRequestMessages[messageIndex];

      console.log(`⚠️ [RAG 점수 부족] 1순위 산업 점수 ${primaryIndustry.score.toFixed(3)} < 0.4 → 더 자세한 정보 요청 (메시지 ${messageIndex + 1}/5)`);

      return {
        reply,
        newState: {
          ...state,
          stage: 'START', // 초기 상태로 돌아가기
          selectedIndustry: null,
          industryCompanies: [],
          selectedTicker: null
        }
      };
    }

    const newState: SessionState = {
      ...state,
      stage: 'SHOW_INDUSTRY',
      selectedIndustry: primaryIndustry.industry_ko,
      industryCompanies: primaryIndustry.companies
    };

    // 세션 상태 변경 디버깅 로그
    console.log(`🔄 [세션 상태 변경] START → SHOW_INDUSTRY:`);
    console.log(`   - Session ID: ${sessionId}`);
    console.log(`   - Primary Industry: ${primaryIndustry.industry_ko} - Score: ${primaryIndustry.score.toFixed(3)}`);
    console.log(`   - Secondary Industry: ${industryResults[1]?.industry_ko || 'N/A'} - Score: ${industryResults[1]?.score ? industryResults[1].score.toFixed(3) : 'N/A'}`);

    // 더보기 기능 제거됨 - 산업군 캐시 설정 불필요

    // 조건부 산업 표시 로직 구현
    let displayIndustries = [];

    // 1순위 산업은 항상 포함
    displayIndustries.push(industryResults[0]);

    // 조건부 2순위 산업 포함 로직
    if (industryResults.length > 1) {
      const secondaryIndustry = industryResults[1];

      // 1순위 점수가 0.55 초과이면 1순위만 표시
      if (primaryIndustry.score > RAG_THRESHOLDS.PRIMARY_INDUSTRY_ONLY_THRESHOLD) {
        console.log(`🥇 [조건부 표시] 1순위 점수 ${primaryIndustry.score.toFixed(3)} > ${RAG_THRESHOLDS.PRIMARY_INDUSTRY_ONLY_THRESHOLD} → 1순위만 표시`);
      }
      // 2순위 점수가 0.3 이하이면 표시 안함
      else if (secondaryIndustry.score <= RAG_THRESHOLDS.SECONDARY_INDUSTRY_MIN_THRESHOLD) {
        console.log(`🥈 [조건부 표시] 2순위 점수 ${secondaryIndustry.score.toFixed(3)} <= ${RAG_THRESHOLDS.SECONDARY_INDUSTRY_MIN_THRESHOLD} → 2순위 표시 안함`);
      }
      // 조건을 만족하면 2순위도 표시
      else {
        displayIndustries.push(secondaryIndustry);
        console.log(`🥈 [조건부 표시] 2순위 점수 ${secondaryIndustry.score.toFixed(3)} > ${RAG_THRESHOLDS.SECONDARY_INDUSTRY_MIN_THRESHOLD} → 2순위도 표시`);
      }
    }

    // 1단계: hcx-dash-002로 빠른 산업 적합성 메시지 생성
    let quickReply;
    if (displayIndustries.length === 1) {
      quickReply = `🎯 사용자님의 투자 전략을 생각해봤을 때, **${displayIndustries[0].industry_ko}** 산업이 가장 적합해 보입니다! 💡\n\n잠시만 기다려주세요, AI가 더 자세한 투자 전략을 구상하고 있어요... ⚡️`;
    } else {
      quickReply = `🎯 사용자님의 투자 전략을 생각해봤을 때, **${displayIndustries[0].industry_ko}**와 **${displayIndustries[1].industry_ko}** 산업이 가장 적합해 보입니다! 💡\n\n잠시만 기다려주세요, AI가 더 자세한 투자 전략을 구상하고 있어요... ⚡️`;
    }

    // 세션에 상세 분석용 데이터 저장
    const detailedAnalysisData = {
      userMessage: userInput,
      industryResults: industryResults,
      displayIndustries: displayIndustries,
      ragAccuracy: industryResults.reduce((sum, industry) => sum + industry.score, 0) / industryResults.length
    };

    // 세션 상태에 상세 분석 데이터 저장
    const newStateWithAnalysisData: SessionState = {
      ...newState,
      pendingDetailedAnalysis: detailedAnalysisData
    };

    return {
      reply: quickReply,
      newState: newStateWithAnalysisData,
      additionalData: {
        status: 'showing_companies',
        hasMore: false,
        needsDetailedAnalysis: true // 상세 분석이 필요함을 표시
      }
    };
  } else {
    // No companies found for any industry
    console.log('No companies found for any of the top industries');
    const reply = `😅 죄송합니다! 관련 산업의 기업 정보를 찾을 수 없네요. 다른 관심 분야를 말씀해 주시면 더 좋은 추천을 드릴게요! 💡✨`;

    return {
      reply,
      newState: state // Stay in START stage
    };
  }
}

// ============================================================================
// SHOW_INDUSTRY Stage Handler
// ============================================================================

/**
 * Handles the SHOW_INDUSTRY stage of the pipeline
 * 수정된 로직: 기업 선택 기능 제거, 투자 질의만 처리
 */
export async function handleShowIndustryStage(context: PipelineContext): Promise<StageHandlerResult> {
  const { userInput, state } = context;

  // 의도 분류 수행
  const intentResult = await classifyUserIntent(userInput);
  console.log(`User intent in SHOW_INDUSTRY: ${intentResult.intent} (confidence: ${intentResult.confidence})`);

  // 새로운 투자 질의가 들어온 경우 새로운 검색 시작
  if (intentResult.intent === 'investment_query') {
    console.log(`🔄 [SHOW_INDUSTRY] 새로운 투자 질의 감지 - 새로운 검색 시작: "${userInput}"`);
    // 새로운 투자 질의를 START 단계에서 처리하도록 위임
    const newContext = {
      ...context,
      state: {
        ...state,
        stage: 'START' as const,
        selectedIndustry: null,
        industryCompanies: [],
        selectedTicker: null
      }
    };
    return await handleInvestmentQuery(newContext);
  }

  // 기타 의도는 인사말로 처리
  const reply = await generateDynamicResponse(userInput, intentResult.intent || 'greeting');

  return {
    reply,
    newState: state // 현재 상태 유지
  };
}

// 기업 선택 기능 제거됨 - RAG 기반 투자 분석만 제공

// ============================================================================
// ASK_CHART Stage Handler
// ============================================================================

/**
 * Handles the ASK_CHART stage of the pipeline
 */
export async function handleAskChartStage(context: PipelineContext): Promise<StageHandlerResult> {
  const { userInput } = context;

  // 로그 최적화: 상세 입력 분석 로그 제거
  // console.log(`🎯 [ASK_CHART] 사용자 입력: "${userInput}"`);
  // console.log(`🎯 [ASK_CHART] 긍정 패턴 매칭: ${isPositive(userInput)}`);
  console.log(`🎯 [ASK_CHART] 부정 패턴 매칭: ${isNegative(userInput)}`);

  // ASK_CHART 단계에서는 의도 분류 없이 직접 긍정/부정 응답만 확인
  // '네', '예', '응' 등의 긍정 응답은 차트 확인으로 처리
  if (isPositive(userInput)) {
    console.log(`✅ [ASK_CHART] 긍정 응답 감지 - 차트 확인 진행`);
    return await handleChartConfirmation(context);
  }
  // '아니오', '아니요' 등의 부정 응답은 이전 단계로 롤백 (이미 request-handler에서 처리됨)
  else if (isNegative(userInput)) {
    console.log(`❌ [ASK_CHART] 부정 응답 감지 - 명확화 요청`);
    // 부정 응답은 request-handler.ts의 handleNegativeResponse에서 처리됨
    // 여기서는 명시적으로 부정 응답임을 표시하고 넘어감
    return await handleChartClarification(context);
  }
  // 추가 긍정 응답 패턴 확인 (fallback)
  else if (userInput.trim().length <= 3 && /^(예|네|응|ok|y)$/i.test(userInput.trim())) {
    console.log(`✅ [ASK_CHART] 간단한 긍정 응답 감지 (fallback) - 차트 확인 진행`);
    return await handleChartConfirmation(context);
  }
  // 명확하지 않은 응답은 다시 질문
  else {
    console.log(`❓ [ASK_CHART] 명확하지 않은 응답 - 재질문`);
    return await handleChartClarification(context);
  }
}

/**
 * Handles positive chart confirmation - 이제 검색 기능이 통합된 투자 분석 실행
 */
async function handleChartConfirmation(context: PipelineContext): Promise<StageHandlerResult> {
  const { state, userInput } = context;

  console.log(`🚀 [Chart Confirmation] 검색 기능이 통합된 투자 분석 시작`);
  console.log(`🔧 [Chart Confirmation] handleChartConfirmation 함수 호출됨!`);

  try {
    // 현재 세션에서 선택된 산업과 기업 정보 수집
    const selectedIndustries = [];

    if (state.selectedIndustry && state.industryCompanies.length > 0) {
      // 간단한 산업 정보 구성
      const companies = state.industryCompanies.map(ticker => ({
        ticker: ticker,
        name: getCompanyName(ticker),
        industry: state.selectedIndustry || 'Unknown'
      }));

      selectedIndustries.push({
        industry_ko: state.selectedIndustry,
        score: 0.8, // 기본 점수
        companies: companies
      });
    }

    // 사용자의 원본 메시지 재구성 (대화 히스토리에서 추출)
    const originalUserMessage = state.conversationHistory.length > 0
      ? (typeof state.conversationHistory[0] === 'string'
         ? state.conversationHistory[0]
         : state.conversationHistory[0].user)
      : `${state.selectedIndustry} 산업에 투자하고 싶습니다.`;

    // 검색 기능이 통합된 투자 분석 실행
    const input: InvestmentRecommendationInput = {
      userMessage: originalUserMessage,
      selectedIndustries: selectedIndustries,
      ragAccuracy: 0.8
    };

    console.log(`📊 [Chart Confirmation] 투자 분석 입력:`, {
      userMessage: input.userMessage,
      industriesCount: input.selectedIndustries.length,
      companiesCount: input.selectedIndustries.reduce((sum, industry) => sum + industry.companies.length, 0)
    });

    const analysisResult = await generateEnhancedInvestmentAnalysis(input);

    // 분석 결과를 사용자 친화적 형태로 포맷팅
    let reply = `🎯 **검색 기반 투자 분석 결과**\n\n`;

    // 검색 요약 추가
    reply += `📰 **최신 정보 수집**: ${analysisResult.searchSummary}\n\n`;

    // 정통한 전략
    if (analysisResult.traditionalStrategy.length > 0) {
      reply += `## 🎯 정통한 투자 전략\n`;
      analysisResult.traditionalStrategy.forEach((strategy, index) => {
        reply += `${index + 1}. **${strategy.ticker} (${strategy.name})** - ${strategy.reason}\n`;
      });
      reply += `\n`;
    }

    // 창의적 전략
    if (analysisResult.creativeStrategy.length > 0) {
      reply += `## 🚀 창의적 투자 전략\n`;
      analysisResult.creativeStrategy.forEach((strategy, index) => {
        reply += `${index + 1}. **${strategy.ticker} (${strategy.name})** - ${strategy.reason}\n`;
      });
      reply += `\n`;
    }

    // 최신 동향 뉴스 요약 (상위 3개만)
    if (analysisResult.trendNews.length > 0) {
      reply += `## 📰 관련 최신 동향\n`;
      analysisResult.trendNews.slice(0, 3).forEach((news, index) => {
        reply += `${index + 1}. ${news.title}\n`;
      });
      reply += `\n`;
    }

    reply += `💡 더 자세한 분석이 필요하시면 언제든 말씀해 주세요!`;

    console.log(`✅ [Chart Confirmation] 검색 기반 투자 분석 완료`);

    // Reset session after analysis (for new search)
    const resetState: SessionState = {
      stage: 'START',
      selectedIndustry: null,
      industryCompanies: [],
      selectedTicker: null,
      conversationHistory: state.conversationHistory,
      lastActivity: Date.now()
    };

    return {
      reply,
      newState: resetState,
      additionalData: {
        status: 'enhanced_analysis_completed'
      }
    };

  } catch (error) {
    console.error('❌ [Chart Confirmation] 검색 기반 투자 분석 실패:', error);

    // 오류 발생 시 기본 응답
    const fallbackReply = `죄송합니다. 투자 분석 중 오류가 발생했습니다. 다시 시도해 주세요. 🙏`;

    const resetState: SessionState = {
      stage: 'START',
      selectedIndustry: null,
      industryCompanies: [],
      selectedTicker: null,
      conversationHistory: state.conversationHistory,
      lastActivity: Date.now()
    };

    return {
      reply: fallbackReply,
      newState: resetState,
      additionalData: {
        status: 'analysis_failed'
      }
    };
  }
}

/**
 * Handles unclear chart responses
 */
async function handleChartClarification(context: PipelineContext): Promise<StageHandlerResult> {
  const { state } = context;
  
  // Unclear answer → ask again
  const clarifyMessages = [
    `🤔 ${getCompanyName(state.selectedTicker!)}(${state.selectedTicker}) 차트 분석을 시작해볼까요? "예" 또는 "아니오"로 답해주세요! 😊`,
    `💭 차트를 확인하시겠어요? "예" 또는 "아니오"로 말씀해 주세요! ✨`,
    `🎯 ${getCompanyName(state.selectedTicker!)} 차트가 필요하신가요? "예"나 "아니오"로 답변해 주세요! 📈`
  ];
  const reply = clarifyMessages[Math.floor(Math.random() * clarifyMessages.length)];
  
  return {
    reply,
    newState: state // Stay in ASK_CHART stage
  };
}
