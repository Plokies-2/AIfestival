/**
 * AI 채팅 파이프라인 오류 수정 테스트
 * 
 * 이 테스트는 다음 3가지 오류 수정 사항을 검증합니다:
 * 1. '더보기' 텍스트 응답 처리 오류 수정
 * 2. ASK_CHART 단계에서 '네' 응답 분류 오류 수정  
 * 3. JSON 저장 로직 제거
 */

import { 
  handleShowIndustryStage, 
  handleAskChartStage 
} from '@/lib/ai-chat/pipeline-handlers';
import { isPositive, isNegative } from '@/lib/ai-chat/company-utils';
import { PipelineContext, SessionState } from '@/lib/ai-chat/types';

// 모킹된 세션 상태
const mockSessionState: SessionState = {
  stage: 'SHOW_INDUSTRY',
  selectedIndustry: 'Technology',
  industryCompanies: ['AAPL', 'MSFT', 'GOOGL'],
  selectedTicker: null,
  conversationHistory: [],
  lastActivity: Date.now()
};

const mockAskChartState: SessionState = {
  stage: 'ASK_CHART',
  selectedIndustry: 'Technology',
  industryCompanies: ['AAPL', 'MSFT', 'GOOGL'],
  selectedTicker: 'AAPL',
  conversationHistory: [],
  lastActivity: Date.now()
};

describe('AI 채팅 파이프라인 오류 수정 테스트', () => {
  
  // ============================================================================
  // 1. '더보기' 텍스트 응답 처리 오류 수정 테스트
  // ============================================================================
  
  describe('1. 더보기 텍스트 응답 처리 오류 수정', () => {
    
    test('텍스트 "더보기" 입력 시 더보기 기능이 실행되지 않아야 함', async () => {
      const context: PipelineContext = {
        userInput: '더보기',
        sessionId: 'test-session',
        state: mockSessionState
      };

      const result = await handleShowIndustryStage(context);
      
      // 더보기 기능이 실행되지 않고 일반 처리 로직으로 넘어가야 함
      expect(result.reply).not.toContain('전체 기업 목록');
      expect(result.reply).not.toContain('총');
      
      // 상태가 변경되지 않아야 함 (더보기 실행 안됨)
      expect(result.newState.industryCompanies).toEqual(['AAPL', 'MSFT', 'GOOGL']);
    });

    test('텍스트 "전체보기" 입력 시에도 더보기 기능이 실행되지 않아야 함', async () => {
      const context: PipelineContext = {
        userInput: '전체보기',
        sessionId: 'test-session',
        state: mockSessionState
      };

      const result = await handleShowIndustryStage(context);
      
      // 더보기 기능이 실행되지 않아야 함
      expect(result.reply).not.toContain('전체 기업 목록');
      expect(result.newState.industryCompanies).toEqual(['AAPL', 'MSFT', 'GOOGL']);
    });

    test('다른 텍스트 입력은 정상적으로 처리되어야 함', async () => {
      const context: PipelineContext = {
        userInput: 'AAPL',
        sessionId: 'test-session',
        state: mockSessionState
      };

      const result = await handleShowIndustryStage(context);
      
      // 정상적인 티커 선택 처리가 되어야 함
      expect(result.newState.stage).toBe('ASK_CHART');
      expect(result.newState.selectedTicker).toBe('AAPL');
    });
  });

  // ============================================================================
  // 2. ASK_CHART 단계에서 '네' 응답 분류 오류 수정 테스트
  // ============================================================================
  
  describe('2. ASK_CHART 단계에서 네 응답 분류 오류 수정', () => {
    
    test('ASK_CHART 단계에서 "네" 입력 시 긍정 응답으로 처리되어야 함', async () => {
      const context: PipelineContext = {
        userInput: '네',
        sessionId: 'test-session',
        state: mockAskChartState
      };

      const result = await handleAskChartStage(context);
      
      // 차트 확인 응답이 나와야 함
      expect(result.reply).toContain('차트');
      expect(result.additionalData?.symbol).toBe('AAPL');
      expect(result.additionalData?.status).toBe('chart_requested');
      
      // 세션이 리셋되어야 함
      expect(result.newState.stage).toBe('START');
    });

    test('ASK_CHART 단계에서 "예" 입력 시 긍정 응답으로 처리되어야 함', async () => {
      const context: PipelineContext = {
        userInput: '예',
        sessionId: 'test-session',
        state: mockAskChartState
      };

      const result = await handleAskChartStage(context);
      
      // 차트 확인 응답이 나와야 함
      expect(result.reply).toContain('차트');
      expect(result.additionalData?.symbol).toBe('AAPL');
      expect(result.newState.stage).toBe('START');
    });

    test('ASK_CHART 단계에서 "응" 입력 시 긍정 응답으로 처리되어야 함', async () => {
      const context: PipelineContext = {
        userInput: '응',
        sessionId: 'test-session',
        state: mockAskChartState
      };

      const result = await handleAskChartStage(context);
      
      // 차트 확인 응답이 나와야 함
      expect(result.reply).toContain('차트');
      expect(result.additionalData?.symbol).toBe('AAPL');
    });

    test('ASK_CHART 단계에서 명확하지 않은 응답 시 재질문해야 함', async () => {
      const context: PipelineContext = {
        userInput: '모르겠어요',
        sessionId: 'test-session',
        state: mockAskChartState
      };

      const result = await handleAskChartStage(context);
      
      // 재질문 응답이 나와야 함
      expect(result.reply).toContain('예');
      expect(result.reply).toContain('아니오');
      
      // 상태가 유지되어야 함
      expect(result.newState.stage).toBe('ASK_CHART');
      expect(result.newState.selectedTicker).toBe('AAPL');
    });
  });

  // ============================================================================
  // 3. 긍정/부정 응답 패턴 테스트
  // ============================================================================
  
  describe('3. 긍정/부정 응답 패턴 테스트', () => {
    
    test('긍정 응답 패턴이 올바르게 감지되어야 함', () => {
      expect(isPositive('네')).toBe(true);
      expect(isPositive('예')).toBe(true);
      expect(isPositive('응')).toBe(true);
      expect(isPositive('좋아')).toBe(true);
      expect(isPositive('맞아')).toBe(true);
      expect(isPositive('그래')).toBe(true);
      expect(isPositive('yes')).toBe(true);
      expect(isPositive('y')).toBe(true);
      expect(isPositive('ok')).toBe(true);
    });

    test('부정 응답 패턴이 올바르게 감지되어야 함', () => {
      expect(isNegative('아니')).toBe(true);
      expect(isNegative('아니요')).toBe(true);
      expect(isNegative('아뇨')).toBe(true);
      expect(isNegative('싫어')).toBe(true);
      expect(isNegative('안돼')).toBe(true);
      expect(isNegative('no')).toBe(true);
      expect(isNegative('n')).toBe(true);
      expect(isNegative('nope')).toBe(true);
    });

    test('중립적인 응답은 긍정/부정으로 분류되지 않아야 함', () => {
      expect(isPositive('모르겠어요')).toBe(false);
      expect(isNegative('모르겠어요')).toBe(false);
      expect(isPositive('잘 모르겠네요')).toBe(false);
      expect(isNegative('잘 모르겠네요')).toBe(false);
    });
  });

  // ============================================================================
  // 4. JSON 저장 로직 제거 검증
  // ============================================================================
  
  describe('4. JSON 저장 로직 제거 검증', () => {
    
    test('saveAnalysisResults 함수가 더 이상 존재하지 않아야 함', () => {
      // resultsStorage 모듈에서 saveAnalysisResults 함수가 제거되었는지 확인
      expect(() => {
        require('@/utils/resultsStorage').saveAnalysisResults;
      }).toThrow();
    });

    test('save_analysis_results API 엔드포인트가 제거되었는지 확인', async () => {
      // API 파일이 삭제되었는지 확인
      const fs = require('fs');
      const path = require('path');
      const apiPath = path.join(process.cwd(), 'src/pages/api/save_analysis_results.ts');
      
      expect(fs.existsSync(apiPath)).toBe(false);
    });
  });
});
