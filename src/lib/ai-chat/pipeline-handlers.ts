/**
 * Pipeline Stage Handlers Module
 * 
 * This module contains the stage-specific logic handlers for the AI chat pipeline:
 * - START stage: Initial user input processing and industry matching
 * - SHOW_INDUSTRY stage: Company selection within an industry
 * - ASK_CHART stage: Chart confirmation and final response
 */

import { PipelineContext, StageHandlerResult, SessionState, IntentClassificationResult } from './types';
import { QUICK_ENRICHED_FINAL as DATA } from '@/data/sp500_enriched_final';
import {
  classifyUserIntent,
  generateDynamicResponse
} from './ai-service';
import { 
  findBestIndustry, 
  findCompanyInAllData, 
  findTickerInText, 
  getIndustryCompanies, 
  getCompanyName 
} from './rag-service';
import { 
  enhanceResponseWithLSTMData, 
  getDetailedLSTMAnalysis 
} from './lstm-service';
import {
  isPositive,
  isNegative,
  formatCompanyList
} from './company-utils';
import {
  getCurrentIndustryCache,
  setCurrentIndustryCache
} from './session-manager';

// ============================================================================
// START Stage Handler
// ============================================================================

/**
 * Handles the START stage of the pipeline
 */
export async function handleStartStage(context: PipelineContext): Promise<StageHandlerResult> {
  const { userInput } = context;

  // 더보기 버튼 클릭 명령 처리 (START 단계에서도 처리 가능)
  if (userInput === '__SHOW_MORE_COMPANIES__') {
    console.log(`🔍 [START] 더보기 요청 처리`);
    return await handleShowMoreCompanies(context);
  }

  // Perform intent classification
  const intentResult = await classifyUserIntent(userInput);
  console.log(`User intent: ${intentResult.intent}`);

  // Handle different intents
  switch (intentResult.intent) {
    case 'greeting':
    case 'about_ai':
    case 'casual_chat':
      return await handleConversationalIntent(context, intentResult);

    case 'company_direct':
      return await handleDirectCompanyQuery(context);

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
 * Handles direct company queries
 */
async function handleDirectCompanyQuery(context: PipelineContext): Promise<StageHandlerResult> {
  const { userInput, state } = context;
  
  const directCompany = findCompanyInAllData(userInput);
  if (directCompany) {
    // Company name directly entered - go straight to chart confirmation stage
    const newState: SessionState = {
      ...state,
      stage: 'ASK_CHART',
      selectedTicker: directCompany
    };
    
    const companyName = getCompanyName(directCompany);
    const directChartQuestions = [
      `🎯 ${companyName} (${directCompany}) 분석을 시작하시겠습니까? 📊`,
      `📈 ${companyName} (${directCompany}) 차트 분석을 시작해볼까요? ✨`,
      `🚀 ${companyName} (${directCompany})의 주가 분석을 확인해 드릴까요? 💹`
    ];
    
    // Get LSTM data
    const lstmAnalysis = await getDetailedLSTMAnalysis(directCompany);
    let analysisInfo = '';
    
    if (lstmAnalysis) {
      analysisInfo = `\n\n${lstmAnalysis.summary}${lstmAnalysis.details}`;
    }
    
    const reply = `${directChartQuestions[Math.floor(Math.random() * directChartQuestions.length)]}${analysisInfo}`;
    
    // 대화 기록 저장 제거
    
    return {
      reply,
      newState,
      shouldReturn: true
    };
  }
  
  // If company not found, fall back to investment query handling
  return await handleInvestmentQuery(context);
}

/**
 * Handles investment queries (industry matching)
 */
async function handleInvestmentQuery(
  context: PipelineContext
): Promise<StageHandlerResult> {
  const { userInput, sessionId, state } = context;
  
  const industry = await findBestIndustry(userInput);

  // RAG score too low, classified as greeting (수정된 로직)
  if (industry === null) {
    console.log(`🗣️ Input classified as greeting due to low RAG scores: "${userInput}"`);
    const reply = await generateDynamicResponse(userInput, 'greeting');

    return {
      reply,
      newState: state // Stay in START stage
    };
  }

  // Valid industry matched
  const companies = getIndustryCompanies(industry);

  // Proceed if at least one company exists (even if less than 5)
  if (companies.length > 0) {
    const newState: SessionState = {
      ...state,
      stage: 'SHOW_INDUSTRY',
      selectedIndustry: industry,
      industryCompanies: companies
    };

    // 세션 상태 변경 디버깅 로그
    console.log(`🔄 [세션 상태 변경] START → SHOW_INDUSTRY:`);
    console.log(`   - Session ID: ${sessionId}`);
    console.log(`   - Selected Industry: ${industry}`);
    console.log(`   - Companies Count: ${companies.length}`);
    console.log(`   - Companies: [${companies.slice(0, 3).join(', ')}${companies.length > 3 ? '...' : ''}]`);

    // 더보기 기능을 위해 산업군 캐시 설정
    setCurrentIndustryCache(industry);

    const companyList = formatCompanyList(companies);

    const totalCompaniesInIndustry = Object.entries(DATA)
      .filter(([_, company]: [string, any]) => company.industry === industry).length;

    const moreText = totalCompaniesInIndustry > 5 
      ? `\n\n총 기업의 수는 ${totalCompaniesInIndustry}개입니다! 모든 기업을 보고 싶다면 '더보기' 버튼을 눌러주세요! 🔍✨` 
      : '';

    const industryResponses = [
      `🏢 ${industry} 산업의 주요 기업들입니다!\n\n${companyList}${moreText}\n\n관심 있는 기업이 있나요? 😊`,
      `⭐ ${industry} 분야의 대표 기업들입니다!\n\n${companyList}${moreText}\n\n어떤 회사가 궁금하신가요? 🤔`,
      `💼 ${industry} 산업에는 다음과 같은 멋진 기업들이 있습니다!\n\n${companyList}${moreText}\n\n이 중에서 관심 있는 기업이 있으신가요? 💡`
    ];
    let baseReply = industryResponses[Math.floor(Math.random() * industryResponses.length)];

    // Enhance with LSTM data if available
    const reply = await enhanceResponseWithLSTMData(companies, baseReply);

    return {
      reply,
      newState,
      additionalData: {
        status: 'showing_companies',
        hasMore: totalCompaniesInIndustry > 5 && companies.length === 5
      }
    };
  } else {
    // No companies found for industry - debugging info added
    console.log(`No companies found for industry: "${industry}"`);
    console.log('Available industries in DATA:', [...new Set(Object.values(DATA).map((c: any) => c.industry))].slice(0, 10));
    const reply = `😅 죄송합니다! "${industry}" 산업의 기업 정보를 찾을 수 없네요. 다른 관심 분야를 말씀해 주시면 더 좋은 추천을 드릴게요! 💡✨`;
    
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
 */
export async function handleShowIndustryStage(context: PipelineContext): Promise<StageHandlerResult> {
  const { userInput, state } = context;

  // 더보기 버튼 클릭 명령 처리 (단순화된 버전)
  if (userInput === '__SHOW_MORE_COMPANIES__') {
    console.log(`🔍 [SHOW_INDUSTRY] 더보기 요청 처리`);
    return await handleShowMoreCompanies(context);
  }

  // Check for ticker selection (priority over intent classification)
  // 현재 산업의 전체 기업 목록을 동적으로 가져와서 매칭에 사용
  // 이렇게 하면 [더보기] 후에도 전체 목록에서 매칭이 가능함
  const allIndustryCompanies = Object.entries(DATA)
    .filter(([_, company]: [string, any]) => company.industry === state.selectedIndustry!)
    .map(([ticker, _]: [string, any]) => ticker);

  const selectedTicker = findTickerInText(userInput, allIndustryCompanies);
  if (selectedTicker) {
    return await handleTickerSelection(context, selectedTicker);
  }

  // If no ticker found, perform intent classification
  const intentResult = await classifyUserIntent(userInput);
  console.log(`User intent in SHOW_INDUSTRY: ${intentResult.intent} (confidence: ${intentResult.confidence})`);

  // 제거된 기능: casual_chat 의도 처리 - 더 이상 사용되지 않음

  // Not in list input → ask again
    // Not in list input → ask again
    const companyList = formatCompanyList(state.industryCompanies);

    const retryMessages = [
      `🤗 위 목록에서 선택해 주세요!\n\n${companyList}\n\n또는 "아니오"라고 말씀해 주세요! 😊`,
      `💡 다음 기업 중에서 골라주세요!\n\n${companyList}\n\n관심 없으시면 "아니오"라고 해주세요! 🙂`,
      `✨ 이 중에서 선택해 주시거나 "아니오"라고 말씀해 주세요!\n\n${companyList} 🎯`
    ];
    const reply = retryMessages[Math.floor(Math.random() * retryMessages.length)];
    
    return {
      reply,
      newState: state // Stay in SHOW_INDUSTRY stage
    };
}

/**
 * Handles "더보기" requests to show all companies in industry (단순화된 버전)
 */
async function handleShowMoreCompanies(context: PipelineContext): Promise<StageHandlerResult> {
  const { state } = context;

  // 산업군 캐시에서 현재 산업 정보 가져오기
  const cachedIndustry = getCurrentIndustryCache();

  console.log(`🔍 [더보기] 단순화된 처리 시작`);
  console.log(`   - 캐시된 산업: ${cachedIndustry}`);
  console.log(`   - 세션 산업: ${state.selectedIndustry}`);

  // 캐시된 산업 정보가 있으면 사용, 없으면 세션에서 가져오기
  const targetIndustry = cachedIndustry || state.selectedIndustry;

  if (!targetIndustry) {
    console.log(`❌ [더보기] 산업 정보 없음`);
    return {
      reply: '더보기 기능을 사용할 수 없습니다. 먼저 산업을 선택해주세요.',
      newState: state
    };
  }

  // 해당 산업의 모든 기업 조회
  const allCompanies = Object.entries(DATA)
    .filter(([_, company]: [string, any]) => company.industry === targetIndustry)
    .map(([ticker, _]: [string, any]) => ticker);

  console.log(`🔍 ${targetIndustry} 산업의 전체 기업 목록 (${allCompanies.length}개)`);

  const allCompanyList = formatCompanyList(allCompanies);
  const reply = `🎉 ${targetIndustry} 산업의 전체 기업 목록입니다! (총 ${allCompanies.length}개) 📊\n\n${allCompanyList}\n\n어떤 기업이 가장 흥미로우신가요? ✨`;

  // 세션 상태 업데이트 (SHOW_INDUSTRY 단계로 설정하고 모든 기업 포함)
  const newState: SessionState = {
    ...state,
    stage: 'SHOW_INDUSTRY',
    selectedIndustry: targetIndustry,
    industryCompanies: allCompanies
  };

  console.log(`✅ [더보기] 처리 완료 - ${allCompanies.length}개 기업 표시`);

  return {
    reply,
    newState,
    additionalData: {
      status: 'showing_companies',
      hasMore: false // No more "더보기" after showing all
    }
  };
}

/**
 * Handles ticker selection in SHOW_INDUSTRY stage
 */
async function handleTickerSelection(context: PipelineContext, selectedTicker: string): Promise<StageHandlerResult> {
  const { state } = context;
  
  console.log(`✅ Ticker found in industry list: ${selectedTicker}`);
  
  const newState: SessionState = {
    ...state,
    stage: 'ASK_CHART',
    selectedTicker
  };

  const chartQuestions = [
    `📈 ${getCompanyName(selectedTicker)} (${selectedTicker}) 차트 분석을 시작해볼까요? (예/아니오) ✨`,
    `📊 ${getCompanyName(selectedTicker)} (${selectedTicker})의 차트를 확인해 드릴까요? (예/아니오) 🚀`,
    `💹 ${getCompanyName(selectedTicker)} (${selectedTicker}) 주가 차트를 보여드릴까요? (예/아니오) 😊`
  ];
  const reply = chartQuestions[Math.floor(Math.random() * chartQuestions.length)];
  
  return {
    reply,
    newState
  };
}

// ============================================================================
// ASK_CHART Stage Handler
// ============================================================================

/**
 * Handles the ASK_CHART stage of the pipeline
 */
export async function handleAskChartStage(context: PipelineContext): Promise<StageHandlerResult> {
  const { userInput, state } = context;

  console.log(`🎯 [ASK_CHART] 사용자 입력: "${userInput}"`);
  console.log(`🎯 [ASK_CHART] 긍정 패턴 매칭: ${isPositive(userInput)}`);
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
 * Handles positive chart confirmation
 */
async function handleChartConfirmation(context: PipelineContext): Promise<StageHandlerResult> {
  const { state } = context;
  
  const ticker = state.selectedTicker!;
  const chartResponses = [
    `🎉 ${getCompanyName(ticker)} (${ticker}) 차트입니다. SpeedTraffic도 준비하는 중! 📈`,
    `✨ ${getCompanyName(ticker)}는 투자해도 될까요? 같이 분석 도와드릴게요! 💹`,
    `🚀 ${getCompanyName(ticker)} 분석을 요청주셨네요. 조금만 기다려 주세요! 📊`
  ];
  const reply = chartResponses[Math.floor(Math.random() * chartResponses.length)];

  // Reset session after chart request (for new search)
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
      symbol: ticker,
      status: 'chart_requested'
    }
  };
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
