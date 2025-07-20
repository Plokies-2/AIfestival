/**
 * Main Request Handler Module
 * 
 * This module serves as the main orchestrator for the AI chat system.
 * It coordinates between all other modules and handles the HTTP request/response flow.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuid } from 'uuid';
import { 
  ParsedRequest, 
  ChatResponse, 
  PipelineContext, 
  SessionState,
  AIChatError 
} from './types';
import { WELCOME_MESSAGES } from './config';
import { 
  getSession, 
  updateSession, 
  resetSession,
  addConversationEntry 
} from './session-manager';
import { 
  handleStartStage, 
  handleShowIndustryStage, 
  handleAskChartStage 
} from './pipeline-handlers';
import { isNegative } from './company-utils';
import { classifyUserIntent } from './ai-service';

// ============================================================================
// Request Parsing
// ============================================================================

/**
 * Parses incoming HTTP request to extract user input and session information
 */
export function parseRequest(req: NextApiRequest): ParsedRequest {
  // Parse request - support both JSON and raw text
  let userInput = '';
  if (req.headers['content-type']?.includes('application/json')) {
    // JSON format (from frontend)
    const { message } = req.body;
    userInput = message?.trim() || '';
  } else {
    // Raw text format
    userInput = req.body?.trim() || '';
  }

  // Session management
  let sessionId = req.cookies.sessionId;
  const isNewSession = !sessionId;
  
  if (!sessionId) {
    sessionId = uuid();
  }

  return {
    userInput,
    sessionId,
    isNewSession
  };
}

/**
 * Sets session cookie in response
 */
export function setSessionCookie(res: NextApiResponse, sessionId: string): void {
  res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; HttpOnly; SameSite=Lax`);
}

// ============================================================================
// Special Command Handling
// ============================================================================

/**
 * Handles special commands like session reset
 */
export function handleSpecialCommands(userInput: string, sessionId: string): ChatResponse | null {
  // Session reset command
  if (userInput === '__RESET_SESSION__') {
    resetSession(sessionId, false);
    return { reply: '새로운 검색을 시작하세요.' };
  }

  // "더보기" command handling (moved to pipeline handlers)
  // This is now handled in the pipeline stage handlers

  return null;
}

/**
 * Handles empty input (welcome message)
 */
export function handleEmptyInput(): ChatResponse {
  const welcomeMessage = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
  return { reply: welcomeMessage };
}

// ============================================================================
// Negative Response Handling
// ============================================================================

/**
 * Handles negative responses across all stages (rollback logic)
 */
export function handleNegativeResponse(state: SessionState, sessionId: string): ChatResponse {
  if (state.stage === 'ASK_CHART') {
    // STAGE 2 → STAGE 1 or START (check if industry info exists)
    if (state.selectedIndustry && state.industryCompanies.length > 0) {
      // If industry info exists, rollback to SHOW_INDUSTRY
      const newState: SessionState = {
        ...state,
        stage: 'SHOW_INDUSTRY',
        selectedTicker: null
      };

      const companyList = state.industryCompanies
        .map((ticker, index) => `${index + 1}. ${require('./company-utils').getCompanyName(ticker)} (${ticker})`)
        .join('\n');

      const totalCompaniesInIndustry = Object.entries(require('@/data/sp500_enriched_final').QUICK_ENRICHED_FINAL)
        .filter(([_, company]: [string, any]) => company.industry === state.selectedIndustry!).length;
      const moreText = totalCompaniesInIndustry > 5 ? `\n\n더 많은 기업을 보시려면 "더보기"라고 말씀해 주세요. (총 ${totalCompaniesInIndustry}개 기업)` : '';

      const reply = `${state.selectedIndustry} 산업의 주요 기업들입니다:\n\n${companyList}${moreText}\n\n관심 있는 기업이 있나요?`;
      
      updateSession(sessionId, newState);
      return { reply };
    } else {
      // If no industry info (direct company input case), rollback to START
      const newState = resetSession(sessionId, true);
      
      const rollbackMessages = [
        '알겠습니다. 다른 관심 분야나 투자하고 싶은 산업을 말씀해 주세요.',
        '네, 이해했습니다. 어떤 다른 투자 아이디어가 있으신가요?',
        '좋습니다. 관심 있는 다른 산업이나 기업이 있으시면 말씀해 주세요.'
      ];
      const reply = rollbackMessages[Math.floor(Math.random() * rollbackMessages.length)];
      
      return { reply };
    }
  } else if (state.stage === 'SHOW_INDUSTRY') {
    // STAGE 1 → STAGE 0 (reset)
    const newState = resetSession(sessionId, true);
    const reply = '알겠습니다. 다른 관심 분야를 말씀해 주세요.';
    
    return { reply };
  }

  // Default case (shouldn't reach here normally)
  return { reply: '알겠습니다. 다른 질문이 있으시면 말씀해 주세요.' };
}

// ============================================================================
// Main Pipeline Processing
// ============================================================================

/**
 * Processes user input through the appropriate pipeline stage
 */
export async function processPipeline(context: PipelineContext): Promise<ChatResponse> {
  const { userInput, sessionId, state } = context;

  // Handle negative responses across all stages (rollback logic)
  if (isNegative(userInput)) {
    return handleNegativeResponse(state, sessionId);
  }

  // Handle "더보기" command at the beginning (before stage processing)
  if (/^더보기$/i.test(userInput.trim())) {
    console.log(`🔍 Detected "더보기" command, checking for SHOW_INDUSTRY stage`);

    // Check if user is in SHOW_INDUSTRY stage with available companies
    if (state.stage === 'SHOW_INDUSTRY' && state.selectedIndustry && state.industryCompanies.length > 0) {
      console.log(`✅ Processing "더보기" for industry: ${state.selectedIndustry}`);

      // This will be handled by the SHOW_INDUSTRY stage handler
      // Continue to stage processing
    } else {
      console.log(`❌ "더보기" command received but not in valid state. Current stage: ${state.stage}, Industry: ${state.selectedIndustry}`);
      // If not in the right state, fall through to normal processing
    }
  }

  // Process based on current stage
  let result;
  
  switch (state.stage) {
    case 'START':
      result = await handleStartStage(context);
      break;
      
    case 'SHOW_INDUSTRY':
      result = await handleShowIndustryStage(context);
      break;
      
    case 'ASK_CHART':
      result = await handleAskChartStage(context);
      break;
      
    default:
      throw new AIChatError(`Unknown stage: ${state.stage}`, 'INVALID_STAGE');
  }

  // Update session with new state
  updateSession(sessionId, result.newState);

  // Build response
  const response: ChatResponse = {
    reply: result.reply
  };

  // Add additional data if present
  if (result.additionalData) {
    if (result.additionalData.symbol) response.symbol = result.additionalData.symbol;
    if (result.additionalData.status) response.status = result.additionalData.status as any;
    if (result.additionalData.hasMore !== undefined) response.hasMore = result.additionalData.hasMore;
  }

  return response;
}

// ============================================================================
// Main Request Handler
// ============================================================================

/**
 * Main request handler function that orchestrates the entire pipeline
 */
export async function handleChatRequest(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Parse request
    const { userInput, sessionId, isNewSession } = parseRequest(req);

    // Set session cookie for new sessions
    if (isNewSession) {
      setSessionCookie(res, sessionId);
    }

    // Get session state
    const state = getSession(sessionId);

    // Handle special commands
    const specialResponse = handleSpecialCommands(userInput, sessionId);
    if (specialResponse) {
      res.json(specialResponse);
      return;
    }

    // Handle empty input
    if (!userInput) {
      const response = handleEmptyInput();
      res.json(response);
      return;
    }

    // Create pipeline context
    const context: PipelineContext = {
      userInput,
      sessionId,
      state
    };

    // Process through pipeline
    const response = await processPipeline(context);

    // Send response
    res.json(response);

  } catch (error) {
    console.error('Pipeline error:', error);
    
    if (error instanceof AIChatError) {
      res.status(error.statusCode).json({ 
        reply: '일시적인 오류가 발생했습니다. 다시 시도해 주세요.',
        error: error.message 
      });
    } else {
      res.status(500).json({ 
        reply: '일시적인 오류가 발생했습니다. 다시 시도해 주세요.' 
      });
    }
  }
}

// ============================================================================
// Utility Functions for External Use
// ============================================================================

/**
 * Resets session after chart request (for external use)
 */
export function resetSessionAfterChart(sessionId: string): void {
  resetSession(sessionId, true);
}

/**
 * Gets session statistics for monitoring
 */
export function getSessionStatistics() {
  const { getSessionStats } = require('./session-manager');
  return getSessionStats();
}

/**
 * Health check for the chat system
 */
export async function performHealthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, boolean>;
  timestamp: number;
}> {
  const checks: Record<string, boolean> = {};
  
  try {
    // Check session manager
    checks.sessionManager = true;
    
    // Check AI service
    const { classifyUserIntent } = require('./ai-service');
    await classifyUserIntent('test');
    checks.aiService = true;
    
    // Check RAG service
    const { getAllAvailableIndustries } = require('./rag-service');
    const industries = getAllAvailableIndustries();
    checks.ragService = industries.length > 0;
    
    // Check LSTM service
    const { checkLSTMServiceHealth } = require('./lstm-service');
    const lstmHealth = await checkLSTMServiceHealth();
    checks.lstmService = lstmHealth.isAvailable;
    
  } catch (error) {
    console.error('Health check error:', error);
  }
  
  const healthyChecks = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;
  
  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (healthyChecks === totalChecks) {
    status = 'healthy';
  } else if (healthyChecks > totalChecks / 2) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }
  
  return {
    status,
    checks,
    timestamp: Date.now()
  };
}
