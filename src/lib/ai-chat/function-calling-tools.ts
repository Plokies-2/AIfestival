/**
 * Function Calling 도구 정의
 * HCX-005 모델을 위한 검색 및 투자 분석 도구들
 */

import { NewsSearchResult, NewsItem } from './news-service';
import { InvestmentRecommendationResult } from './ai-service';
import { NewsSummaryService } from './summary-service';

import axios from 'axios';
import { ENV_CONFIG } from './config';

// ============================================================================
// Function Calling 로깅 시스템
// ============================================================================

/**
 * Function Calling 실행 로그를 기록하는 클래스
 */
class FunctionCallLogger {
  private static instance: FunctionCallLogger;
  private logs: Array<{
    timestamp: number;
    functionName: string;
    parameters: any;
    result: any;
    success: boolean;
    executionTime: number;
  }> = [];

  static getInstance(): FunctionCallLogger {
    if (!FunctionCallLogger.instance) {
      FunctionCallLogger.instance = new FunctionCallLogger();
    }
    return FunctionCallLogger.instance;
  }

  logFunctionCall(
    functionName: string,
    parameters: any,
    result: any,
    success: boolean,
    executionTime: number
  ) {
    const logEntry = {
      timestamp: Date.now(),
      functionName,
      parameters,
      result,
      success,
      executionTime
    };

    this.logs.push(logEntry);

    // 콘솔에 상세 로그 출력
    console.log(`🔧 [Function Call] ${functionName} 실행:`);
    console.log(`   📥 매개변수:`, JSON.stringify(parameters, null, 2));
    console.log(`   ⏱️ 실행시간: ${executionTime}ms`);
    console.log(`   ${success ? '✅ 성공' : '❌ 실패'}`);

    if (success) {
      if (result && typeof result === 'object') {
        if ('news_items' in result) {
          console.log(`   📰 뉴스 결과: ${result.news_items?.length || 0}개`);
        }
        if ('total_found' in result) {
          console.log(`   🔍 총 검색결과: ${result.total_found}개`);
        }
      }
    } else {
      console.log(`   ❌ 오류:`, result);
    }
  }

  getLogs() {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
  }
}

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 뉴스 발행일을 상대적 날짜로 변환
 * "Mon, 28 Jul 2025 07:51:00 +0900" → "1일 전 7시" 또는 "오늘 15시"
 */
function formatNewsDate(pubDate: string): string {
  try {
    const newsDate = new Date(pubDate);
    const now = new Date();
    const diffTime = now.getTime() - newsDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const hour = newsDate.getHours();

    if (diffDays === 0) {
      return `오늘 ${hour}시`;
    } else if (diffDays === 1) {
      return `어제 ${hour}시`;
    } else {
      return `${diffDays}일 전 ${hour}시`;
    }
  } catch (error) {
    // 파싱 실패 시 원본 반환
    return pubDate;
  }
}

// ============================================================================
// Function Calling 도구 정의
// ============================================================================

// ============================================================================
// Function Calling 실행기
// ============================================================================

/**
 * Function Calling 도구들을 실행하는 클래스
 */
export class FunctionCallingExecutor {
  private logger: FunctionCallLogger;
  private hcxClient: HCX005FunctionCallingClient;
  private summaryService: NewsSummaryService;

  constructor() {
    this.logger = FunctionCallLogger.getInstance();
    this.hcxClient = new HCX005FunctionCallingClient();
    this.summaryService = new NewsSummaryService();
    console.log('🔧 [Function Executor] Function Calling 실행기 초기화 완료');
  }



  /**
   * 1차 분석: 비정형 사용자 입력을 구체적인 투자 쿼리로 변환
   */
  async executeRefineUserQuery(args: {
    user_message: string;
  }): Promise<{
    refined_query: string;
    investment_intent: string;
    target_industries: string[];
    reasoning: string;
  }> {
    const startTime = Date.now();
    const functionName = 'refine_user_query';

    console.log(`🔍 [Function Call] ${functionName} 실행 시작 - 사용자 입력 정제`);

    try {
      const messages = [
        {
          role: 'system' as const,
          content: `당신은 사용자의 비정형 투자 관련 입력을 분석하여 구체적이고 검색에 적합한 쿼리로 변환하는 전문가입니다.

**목표:**
1. 사용자의 모호한 표현을 명확한 투자 의도로 파악
2. 검색에 최적화된 구체적인 쿼리 생성
3. 관련 산업 분야 식별
4. 분석 근거 제시

**변환 예시:**
- "요즘 방위산업이 엄청 뜬다고 하는데 투자하고 싶어" → "방위산업 동향"
- "AI가 핫하다던데 어디에 투자할까" → "인공지능 AI 투자 전략"
- "전기차 관련해서 뭔가 투자하고 싶은데" → "전기차 배터리 투자"`
        },
        {
          role: 'user' as const,
          content: `다음 사용자 입력을 분석하여 구체적인 투자 쿼리로 변환해주세요:

"${args.user_message}"`
        }
      ];

      const tools = [
        {
          type: 'function',
          function: {
            name: 'refine_user_query',
            description: '사용자의 비정형 입력을 분석하여 구체적이고 검색에 적합한 투자 쿼리로 변환합니다.',
            parameters: {
              type: 'object',
              properties: {
                refined_query: {
                  type: 'string',
                  description: '검색에 최적화된 구체적인 투자 쿼리 (예: "방위산업 동향", "AI 인공지능 산업 정책")'
                },
                investment_intent: {
                  type: 'string',
                  description: '사용자의 투자 의도 분석 (예: "방위산업 관련 종목 투자", "AI 기술 성장주 투자")'
                },
                target_industries: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '관련 산업 분야 목록 (예: ["방위산업", "항공우주"], ["인공지능", "반도체"])'
                },
                reasoning: {
                  type: 'string',
                  description: '변환 근거와 분석 과정 설명'
                }
              },
              required: ['refined_query', 'investment_intent', 'target_industries', 'reasoning']
            }
          }
        }
      ];

      const response = await this.hcxClient.callFunctionCallingAPI(messages, tools, 'auto');

      const executionTime = Date.now() - startTime;

      if (response.status?.code === '20000' && response.result?.message) {
        const toolCalls = response.result.message.toolCalls;
        if (toolCalls && toolCalls.length > 0) {
          const toolCall = toolCalls[0];
          let functionArgs = toolCall.function?.arguments;

          // arguments가 문자열인 경우 JSON 파싱
          if (typeof functionArgs === 'string') {
            try {
              functionArgs = JSON.parse(functionArgs);
            } catch (parseError) {
              console.error(`❌ [Function Call] JSON 파싱 실패:`, parseError);
              console.error(`❌ [Function Call] 원본 arguments:`, functionArgs);
              // 파싱 실패 시 폴백 처리
              return {
                refined_query: args.user_message,
                investment_intent: '일반 투자 상담',
                target_industries: ['일반'],
                reasoning: 'JSON 파싱 실패로 원본 메시지 사용'
              };
            }
          }

          if (functionArgs) {
            console.log(`✅ [Function Call] ${functionName} 성공!`);
            console.log(`   원본: "${args.user_message}"`);
            console.log(`   변환: "${functionArgs.refined_query}"`);

            return functionArgs;
          }
        }
      }

      throw new Error('Function call 응답에서 결과를 찾을 수 없습니다.');

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ [Function Call] ${functionName} 실패:`, error.message);

      // 폴백: 기본 변환
      return {
        refined_query: args.user_message,
        investment_intent: '일반 투자 상담',
        target_industries: ['일반'],
        reasoning: '자동 변환 실패로 원본 메시지 사용'
      };
    }
  }

  /**
   * 뉴스 기반 기업 추출 실행 - 새로운 파이프라인 2단계
   */
  async executeExtractCompaniesFromNews(args: {
    user_message: string;
    trend_news: NewsItem[];
    selected_industries: Array<{
      industry_ko: string;
      score: number;
      companies: Array<{
        ticker: string;
        name: string;
        industry: string;
      }>;
    }>;
  }): Promise<{
    traditional_companies: Array<{ ticker: string; name: string; reason: string }>;
    creative_companies: Array<{ ticker: string; name: string; reason: string }>;
    market_analysis: string;
    strategy_comparison: string;
  }> {
    const startTime = Date.now();
    const functionName = 'extract_companies_from_news';

    console.log(`📊 [Function Call] ${functionName} 실행 시작 - 뉴스 기반 기업 추출`);

    // 중요: 각 전략마다 항상 3개 기업으로 포트폴리오 구성
    const newsCount = args.trend_news?.length || 0;
    const traditionalCount = 3; // 항상 3개 고정
    const creativeCount = 3; // 항상 3개 고정

    if (newsCount === 0) {
      console.log(`⚠️ [Function Call] 뉴스 없음 - 산업 정보 기반으로 기업 추출: 정통한 ${traditionalCount}개, 창의적 ${creativeCount}개`);
    } else {
      console.log(`✅ [Function Call] 뉴스 ${newsCount}개 활용 - 기업 추출: 정통한 ${traditionalCount}개, 창의적 ${creativeCount}개`);
    }

    console.log(`🔧 [Function Call] 최종 설정: 뉴스 ${newsCount}개 → 정통한 ${traditionalCount}개 + 창의적 ${creativeCount}개 기업`);

    try {
      // 뉴스 내용을 포함한 사용자 메시지 구성
      let enhancedUserMessage = args.user_message;

      // 최신 동향 뉴스 추가 (요약 기능 적용)
      if (args.trend_news && args.trend_news.length > 0) {
        // 뉴스 요약 필요성 판단
        if (this.summaryService.shouldSummarize(args.trend_news)) {
          console.log(`📝 [News Summary] 뉴스 ${args.trend_news.length}개 요약 시작 - 토큰 절약을 위해 요약 적용`);

          try {
            const summarizedNews = await this.summaryService.summarize(args.trend_news);
            enhancedUserMessage += '\n\n**📰 최신 투자 동향 뉴스 (요약됨):**\n';
            enhancedUserMessage += summarizedNews + '\n\n';
            enhancedUserMessage += `**💡 참고: 위 내용은 ${args.trend_news.length}개 뉴스를 요약한 것입니다.**\n`;

            console.log(`✅ [News Summary] 뉴스 요약 완료 - 원본 ${args.trend_news.length}개 → 요약본 사용`);
          } catch (error: any) {
            console.error(`❌ [News Summary] 요약 실패, 원본 사용:`, error.message);
            // 요약 실패 시 원본 사용 (fallback)
            enhancedUserMessage += '\n\n**📰 최신 투자 동향 뉴스 (각 뉴스는 고유 번호로 구분됨):**\n';
            args.trend_news.forEach((news, index) => {
              const formattedDate = formatNewsDate(news.pub_date);
              enhancedUserMessage += `📰 뉴스${index + 1}: [${formattedDate}] ${news.title}\n내용: ${news.description}\n\n`;
            });
            enhancedUserMessage += `**⚠️ 중요: 위 뉴스들은 뉴스1, 뉴스2, 뉴스3... 형태로 구분됩니다.**\n`;
          }
        } else {
          // 요약 불필요 시 원본 사용
          console.log(`📰 [News Summary] 뉴스 ${args.trend_news.length}개 - 요약 불필요, 원본 사용`);
          enhancedUserMessage += '\n\n**📰 최신 투자 동향 뉴스 (각 뉴스는 고유 번호로 구분됨):**\n';
          args.trend_news.forEach((news, index) => {
            const formattedDate = formatNewsDate(news.pub_date);
            enhancedUserMessage += `📰 뉴스${index + 1}: [${formattedDate}] ${news.title}\n내용: ${news.description}\n\n`;
          });
          enhancedUserMessage += `**⚠️ 중요: 위 뉴스들은 뉴스1, 뉴스2, 뉴스3... 형태로 구분됩니다.**\n`;
        }
      } else {
        enhancedUserMessage += '\n\n**📰 최신 뉴스 정보:**\n관련 최신 뉴스를 찾을 수 없어 산업 정보와 일반적인 시장 동향을 바탕으로 기업을 추출합니다.\n\n';
      }

      // 산업 정보 추가
      enhancedUserMessage += '\n\n**분석된 적합 산업:**\n';
      args.selected_industries.forEach(industry => {
        const companiesText = industry.companies.map(company =>
          `${company.ticker} (${company.name})`
        ).join(', ');
        enhancedUserMessage += `**${industry.industry_ko}** (매칭 점수: ${industry.score.toFixed(3)})\n기업들: ${companiesText}\n\n`;
      });

      // 강화된 기업 추출 지침 생성
      const getInstructions = (traditionalCount: number, creativeCount: number) => {
        return `위 최신 뉴스를 바탕으로 투자 가치가 높은 기업 ${traditionalCount + creativeCount}개를 추출해주세요.

**목표:**
- 정통한 투자 전략: ${traditionalCount}개 기업 (안정성 중심)
- 창의적 투자 전략: ${creativeCount}개 기업 (성장성 중심)

**추출 방식:**
- **반드시 제공된 기업 리스트(KOSPI_ENRICHED_FINAL)에서만 기업명과 티커 심볼을 선택**
- 해당 기업이 속한 산업 분야나 특징을 간단히 기술
- **개별 기업의 최신 뉴스가 없더라도, 산업 동향과 시장 분석을 바탕으로 논리적인 선정 이유를 제시**
- 상세한 투자 근거는 다음 단계에서 생성됩니다

**⚠️ 필수 준수사항:**
- 제공된 산업별 기업 목록에 없는 기업은 절대 추천하지 마세요
- 비상장 기업이나 해외 기업은 제외하세요
- 백테스팅과 실제 투자가 가능한 기업만 선택하세요
- **개별 기업 뉴스가 부족한 경우, 산업 특성과 시장 포지션을 근거로 논리적 설명 필수**

**선정 근거 예시:**
- reason: "AI/반도체 산업 대표 기업으로 기술력과 시장 점유율 우수"
- reason: "바이오/제약 분야 선도 기업으로 신약 개발 파이프라인 보유"
- reason: "전기차/배터리 산업 성장에 따른 핵심 부품 공급업체"`;
      };

      enhancedUserMessage += getInstructions(traditionalCount, creativeCount);

      // 간소화된 시스템 메시지 생성
      const getSystemMessage = (traditionalCount: number, creativeCount: number, hasNews: boolean) => {
        const baseMessage = `당신은 투자 가치가 높은 기업을 추출하는 전문가입니다.

**역할:**
- 제공된 정보를 바탕으로 투자 가치가 높은 기업들을 식별
- 정통한 전략 ${traditionalCount}개, 창의적 전략 ${creativeCount}개 기업을 추출
- 각 기업의 산업 분야나 특징을 간단히 분류

**⚠️ 중요한 제약 조건:**
- **반드시 제공된 기업 리스트(KOSPI_ENRICHED_FINAL 데이터)에 포함된 기업들만 선택하세요**
- 비상장 기업이나 데이터에 없는 기업은 절대 추천하지 마세요
- 제공된 산업별 기업 목록에서만 선택하여 백테스팅과 투자가 가능하도록 하세요

**중요사항:**
- 이 단계에서는 기업 추출에만 집중하세요
- 상세한 투자 근거와 분석은 다음 단계에서 처리됩니다
- reason 필드에는 "AI/반도체 기업", "바이오/제약 기업" 등 간단한 분류만 기입하세요

**출력 형식:**
- ticker: 정확한 기업 티커 심볼 (제공된 리스트에서만)
- name: 정확한 기업명 (제공된 리스트에서만)
- reason: 간단한 산업 분야 또는 특징`;

        if (!hasNews) {
          return baseMessage + `

**특별 지침:**
- 최신 뉴스가 없으므로 산업 정보와 일반적인 시장 동향을 바탕으로 기업을 추출하고, 중요한 최신 뉴스를 찾을 수수 없음을 알리세요.
- 해당 산업에서 대표적이고 투자 가치가 높은 기업들을 선택하세요
- **반드시 제공된 기업 리스트에서만 선택하세요**`;
        }

        return baseMessage;
      };

      // HCX-005 Function Calling API 호출
      const messages = [
        {
          role: 'system' as const,
          content: getSystemMessage(traditionalCount, creativeCount, newsCount > 0)
        },
        {
          role: 'user' as const,
          content: enhancedUserMessage
        }
      ];

      // 간단한 기업 카테고리 설명 생성 (상세한 근거는 다음 단계에서 처리)
      const getReasonDescription = () => {
        return '해당 기업이 속한 산업 분야나 간단한 특징 (예: "AI/반도체 기업", "바이오/제약 기업", "전기차/배터리 기업" 등)';
      };

      const getMarketAnalysisDescription = (newsCount: number) => {
        if (newsCount === 1) {
          return '뉴스1을 기반으로 시장 동향 분석 (형식: "뉴스1에 따르면...")';
        } else if (newsCount === 2) {
          return '뉴스1과 뉴스2를 모두 활용하여 시장 동향 분석 (형식: "뉴스1에 따르면...", "뉴스2에서는...")';
        } else {
          return '반드시 최소 3개의 서로 다른 뉴스를 번호로 인용 (예: "뉴스1에 따르면...", "뉴스7에서는...", "뉴스15에 의하면...") - 절대 같은 뉴스 반복 금지';
        }
      };

      const tools = [
        {
          type: 'function',
          function: {
            name: 'extract_companies_from_news',
            description: `최신 뉴스 분석을 통해 투자 가치가 높은 기업 ${traditionalCount + creativeCount}개를 추출합니다. 반드시 제공된 KOSPI_ENRICHED_FINAL 데이터에 포함된 기업들만 선택하세요. 이 단계에서는 기업 식별에만 집중하며, 상세한 투자 근거는 다음 단계에서 생성됩니다.`,
            parameters: {
              type: 'object',
              properties: {
                traditional_companies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      ticker: { type: 'string', description: '기업 티커 심볼 (제공된 KOSPI_ENRICHED_FINAL 리스트에서만)' },
                      name: { type: 'string', description: '기업명 (제공된 KOSPI_ENRICHED_FINAL 리스트에서만)' },
                      reason: { type: 'string', description: getReasonDescription() }
                    },
                    required: ['ticker', 'name', 'reason']
                  },
                  description: `안정성 중심의 정통한 투자 전략 ${traditionalCount}개 기업`
                },
                creative_companies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      ticker: { type: 'string', description: '기업 티커 심볼 (제공된 KOSPI_ENRICHED_FINAL 리스트에서만)' },
                      name: { type: 'string', description: '기업명 (제공된 KOSPI_ENRICHED_FINAL 리스트에서만)' },
                      reason: { type: 'string', description: getReasonDescription() }
                    },
                    required: ['ticker', 'name', 'reason']
                  },
                  description: `성장성 중심의 창의적 투자 전략 ${creativeCount}개 기업`
                },
                market_analysis: {
                  type: 'string',
                  description: getMarketAnalysisDescription(newsCount)
                },
                strategy_comparison: {
                  type: 'string',
                  description: '정통한 전략과 창의적 전략의 기대 효과를 대조적으로 설명 (각 전략의 장단점, 리스크, 수익성 등을 비교 분석)'
                }
              },
              required: ['traditional_companies', 'creative_companies', 'market_analysis', 'strategy_comparison']
            }
          }
        }
      ];

      console.log(`🔧 [Function Call] HCX-005 API 호출 중...`);
      console.log(`🔧 [Function Call] 메시지 개수: ${messages.length}`);
      console.log(`🔧 [Function Call] 도구 개수: ${tools.length}`);

      const response = await this.hcxClient.callFunctionCallingAPI(messages, tools, 'auto');

      console.log(`🔧 [Function Call] API 응답 상태: ${response.status?.code}`);
      console.log(`🔧 [Function Call] 응답 구조:`, {
        hasResult: !!response.result,
        hasMessage: !!response.result?.message,
        hasToolCalls: !!response.result?.message?.toolCalls,
        toolCallsLength: response.result?.message?.toolCalls?.length || 0
      });

      // 응답 상태 확인
      if (response.status?.code === '20000' && response.result?.message) {
        const toolCalls = response.result.message.toolCalls;
        const messageContent = response.result.message.content;

        // Tool calls가 있는 경우 (정상적인 function calling)
        if (toolCalls && toolCalls.length > 0) {
          const toolCall = toolCalls[0];
          let functionArgs = toolCall.function?.arguments;

          // arguments가 문자열인 경우 JSON 파싱
          if (typeof functionArgs === 'string') {
            try {
              functionArgs = JSON.parse(functionArgs);
              console.log(`🔧 [Function Call] JSON 파싱 성공`);
            } catch (parseError) {
              console.error(`❌ [Function Call] JSON 파싱 실패:`, parseError);
              console.error(`❌ [Function Call] 원본 arguments:`, functionArgs);
              throw new Error('HCX-005 Function Calling arguments JSON 파싱 실패');
            }
          }

          if (functionArgs) {
            console.log(`🔧 [Function Call] HCX-005 응답 내용:`, {
              traditional_companies: functionArgs.traditional_companies?.length || 0,
              creative_companies: functionArgs.creative_companies?.length || 0,
              market_analysis: !!functionArgs.market_analysis,
              strategy_comparison: !!functionArgs.strategy_comparison
            });

            const result = {
              traditional_companies: functionArgs.traditional_companies || [],
              creative_companies: functionArgs.creative_companies || [],
              market_analysis: functionArgs.market_analysis || '뉴스 기반 시장 분석이 완료되었습니다.',
              strategy_comparison: functionArgs.strategy_comparison || '전략 비교 분석이 완료되었습니다.'
            };

            const executionTime = Date.now() - startTime;
            this.logger.logFunctionCall(
              functionName,
              {
                ...args,
                enhanced_message_length: enhancedUserMessage.length,
                trend_news_count: args.trend_news?.length || 0
              },
              {
                traditional_companies: result.traditional_companies.length,
                creative_companies: result.creative_companies.length,
                hcx_function_called: true
              },
              true,
              executionTime
            );

            console.log(`✅ [Function Call] HCX-005 뉴스 기반 기업 추출 성공!`);
            return result;
          }
        }

        // Tool calls가 없는 경우 (LLM이 일반 텍스트로 응답한 경우)
        if (!toolCalls || toolCalls.length === 0) {
          console.log(`⚠️ [Function Call] LLM이 function calling 대신 일반 텍스트로 응답`);
          console.log(`📝 [Function Call] 응답 내용:`, messageContent?.substring(0, 200) + '...');

          // 뉴스가 부족하거나 관련성이 낮을 때 발생하는 상황으로 판단
          throw new Error('1차 분류 오류로 답변을 생성하지 못했습니다. 관련 내용을 관리자에게 알려주시기 바랍니다.');
        }
      }

      console.error(`❌ [Function Call] HCX-005 응답 처리 실패`);
      console.error(`❌ [Function Call] 응답 상세:`, JSON.stringify(response, null, 2));
      throw new Error(`HCX-005 Function Calling 응답 처리 실패: ${response.status?.message || '알 수 없는 오류'}`);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.logFunctionCall(functionName, args, error, false, executionTime);
      throw error;
    }
  }

  /**
   * 투자 전략 생성 실행 - 실제 HCX-005 Function Calling 사용
   */
  async executeGenerateInvestmentStrategies(args: {
    user_message: string;
    trend_news?: NewsItem[];
    company_news?: { [companyName: string]: NewsSearchResult };
    selected_industries: Array<{
      industry_ko: string;
      score: number;
      companies: Array<{
        ticker: string;
        name: string;
        industry: string;
      }>;
    }>;
    extracted_companies?: {
      traditional_companies: Array<{ ticker: string; name: string; reason: string }>;
      creative_companies: Array<{ ticker: string; name: string; reason: string }>;
    };
    rag_accuracy: number;
  }): Promise<InvestmentRecommendationResult> {
    const startTime = Date.now();
    const functionName = 'generate_investment_strategies';

    console.log(`💡 [Function Call] ${functionName} 실행 시작 - HCX-005 Function Calling 사용`);

    try {
      // 검색 결과를 포함한 확장된 사용자 메시지 구성
      let enhancedUserMessage = args.user_message;

      // 최신 동향 뉴스 추가 (요약 기능 적용)
      let totalNewsCount = 0;
      if (args.trend_news && args.trend_news.length > 0) {
        // 뉴스 요약 필요성 판단
        if (this.summaryService.shouldSummarize(args.trend_news)) {
          console.log(`📝 [News Summary] 투자 전략 생성용 뉴스 ${args.trend_news.length}개 요약 시작`);

          try {
            const summarizedNews = await this.summaryService.summarize(args.trend_news);
            enhancedUserMessage += '\n\n**📰 최신 동향 뉴스 (요약됨):**\n';
            enhancedUserMessage += summarizedNews + '\n\n';
            enhancedUserMessage += `**💡 참고: 위 내용은 ${args.trend_news.length}개 뉴스를 요약한 것입니다.**\n`;

            console.log(`✅ [News Summary] 투자 전략용 뉴스 요약 완료`);
          } catch (error: any) {
            console.error(`❌ [News Summary] 요약 실패, 원본 사용:`, error.message);
            // 요약 실패 시 원본 사용 (fallback)
            enhancedUserMessage += '\n\n**📰 최신 동향 뉴스 (각 뉴스는 고유 번호로 구분):**\n';
            args.trend_news.forEach((news, index) => {
              const formattedDate = formatNewsDate(news.pub_date);
              enhancedUserMessage += `뉴스${index + 1}: [${formattedDate}] ${news.title}\n내용: ${news.description}\n\n`;
            });
          }
        } else {
          // 요약 불필요 시 원본 사용
          console.log(`📰 [News Summary] 투자 전략용 뉴스 ${args.trend_news.length}개 - 요약 불필요, 원본 사용`);
          enhancedUserMessage += '\n\n**📰 최신 동향 뉴스 (각 뉴스는 고유 번호로 구분):**\n';
          args.trend_news.forEach((news, index) => {
            const formattedDate = formatNewsDate(news.pub_date);
            enhancedUserMessage += `뉴스${index + 1}: [${formattedDate}] ${news.title}\n내용: ${news.description}\n\n`;
          });
        }
        totalNewsCount += args.trend_news.length;
      }

      // 기업별 뉴스 추가 (요약 기능 적용)
      if (args.company_news) {
        enhancedUserMessage += '\n\n**🏢 기업별 뉴스:**\n';

        for (const [companyName, newsResult] of Object.entries(args.company_news)) {
          if (newsResult.success && newsResult.news_items.length > 0) {
            // 기업별 뉴스도 요약 적용
            if (this.summaryService.shouldSummarize(newsResult.news_items)) {
              console.log(`📝 [News Summary] ${companyName} 뉴스 ${newsResult.news_items.length}개 요약 시작`);

              try {
                const summarizedCompanyNews = await this.summaryService.summarize(newsResult.news_items);
                enhancedUserMessage += `\n**${companyName} 관련 뉴스 (요약됨):**\n`;
                enhancedUserMessage += summarizedCompanyNews + '\n\n';

                console.log(`✅ [News Summary] ${companyName} 뉴스 요약 완료`);
              } catch (error: any) {
                console.error(`❌ [News Summary] ${companyName} 뉴스 요약 실패:`, error.message);
                // 요약 실패 시 원본 사용
                enhancedUserMessage += `\n**${companyName} 관련 뉴스:**\n`;
                newsResult.news_items.forEach((news) => {
                  const formattedDate = formatNewsDate(news.pub_date);
                  totalNewsCount++;
                  enhancedUserMessage += `뉴스${totalNewsCount}: [${formattedDate}] ${news.title}\n내용: ${news.description}\n\n`;
                });
              }
            } else {
              // 요약 불필요 시 원본 사용
              enhancedUserMessage += `\n**${companyName} 관련 뉴스:**\n`;
              newsResult.news_items.forEach((news) => {
                const formattedDate = formatNewsDate(news.pub_date);
                totalNewsCount++;
                enhancedUserMessage += `뉴스${totalNewsCount}: [${formattedDate}] ${news.title}\n내용: ${news.description}\n\n`;
              });
            }
          }
        }
      }

      // 산업 정보 추가
      enhancedUserMessage += '\n\n**분석된 적합 산업:**\n';
      args.selected_industries.forEach(industry => {
        const companiesText = industry.companies.map(company =>
          `${company.ticker} (${company.name})`
        ).join(', ');
        enhancedUserMessage += `**${industry.industry_ko}** (매칭 점수: ${industry.score.toFixed(3)})\n기업들: ${companiesText}\n\n`;
      });

      enhancedUserMessage += `**RAG 매칭 정확도:** ${args.rag_accuracy.toFixed(3)}\n\n`;

      // 추출된 기업 정보 추가 (1단계에서 추출된 기업들)
      if (args.extracted_companies) {
        enhancedUserMessage += '\n\n**1단계에서 추출된 투자 대상 기업:**\n';
        enhancedUserMessage += '**정통한 전략 기업:**\n';
        args.extracted_companies.traditional_companies.forEach((company, index) => {
          enhancedUserMessage += `${index + 1}. ${company.ticker} (${company.name}) - ${company.reason}\n`;
        });
        enhancedUserMessage += '\n**창의적 전략 기업:**\n';
        args.extracted_companies.creative_companies.forEach((company, index) => {
          enhancedUserMessage += `${index + 1}. ${company.ticker} (${company.name}) - ${company.reason}\n`;
        });
        enhancedUserMessage += '\n**중요:** 위 기업들에 대해 제공된 뉴스를 바탕으로 구체적인 투자 전략과 근거를 생성해주세요.\n\n';
      }

      // 핵심 지시사항 강화
      enhancedUserMessage += `\n\n**🚨 절대 준수 사항:**
1. **동향 뉴스 분석 시 특정 기업명 절대 언급 금지! 산업 전반의 트렌드만 언급하세요**
2. **동향 뉴스에서 "AI 반도체 시장의 급성장", "글로벌 파트너십 확산" 등 종합적 인사이트 추출하세요**
3. **각 기업마다 반드시 서로 다른 2개 이상의 뉴스를 인용하세요**
4. **절대 같은 뉴스를 여러 기업에서 반복 사용하지 마세요**
5. **뉴스 번호를 명시하세요 (예: "뉴스3에 따르면...", "뉴스15에서는...")**
6. **🎯 개별 기업 뉴스 분석 시 반드시 투자에 직접적으로 관련된 뉴스만 엄선하여 사용하세요**
   - 매출/실적 관련 뉴스 우선
   - 신제품/신기술 개발 뉴스 우선
   - 사업 확장/투자 계획 뉴스 우선
   - 단순 인사/행사 뉴스는 제외

**📋 사용 가능한 뉴스: 총 ${totalNewsCount}개**
뉴스1부터 뉴스${totalNewsCount}까지 모두 다른 뉴스입니다. 다양하게 활용하세요.

**동향 분석 올바른 예시:**
"최근 뉴스들을 종합하면, AI 반도체 시장에서 글로벌 파트너십이 확산되고 있으며, 맞춤형 AI 인프라 개발이 가속화되고 있습니다."

**동향 분석 잘못된 예시 (절대 금지):**
"뉴스1에 따르면, 리벨리온과 마벨은..." (특정 기업명 언급 금지!)

**기업별 뉴스 분석 올바른 예시:**
"뉴스5에 따르면, 삼성전자는 2분기 매출이 전년 대비 15% 증가했으며, 뉴스12에서는 차세대 반도체 기술 개발에 대규모 투자를 발표했습니다."

**기업별 뉴스 분석 잘못된 예시 (사용 금지):**
"뉴스8에 따르면, 삼성전자 임원이 행사에 참석했습니다." (투자와 무관한 뉴스)`;

      // 간소화된 뉴스 요약
      if (args.trend_news && args.trend_news.length > 0) {
        enhancedUserMessage += `\n\n**활용 가능한 최신 뉴스:** ${args.trend_news.length}개\n`;
      }

      if (args.company_news) {
        const companyCount = Object.keys(args.company_news).length;
        enhancedUserMessage += `**기업별 뉴스:** ${companyCount}개 기업\n`;
      }



      // HCX-005 Function Calling API 호출
      const messages = [
        {
          role: 'system' as const,
          content: `당신은 1단계에서 추출된 기업들에 대해 제공된 뉴스를 바탕으로 구체적인 투자 전략과 근거를 생성하는 전문가입니다.

**역할:**
- 1단계에서 추출된 기업들에 대해 상세한 투자 분석 수행
- 동향 뉴스와 기업별 개별 뉴스를 종합하여 투자 근거 생성
- 각 기업의 투자 매력도와 리스크를 구체적으로 분석

**절대 준수 사항:**
1. **정통한 전략 3개, 창의적 전략 3개 기업을 반드시 생성하세요**
2. **동향 뉴스 분석 시 특정 기업명 언급 절대 금지! 산업 전반의 트렌드, 기술 발전, 시장 변화만 언급하세요**
3. **동향 뉴스에서 종합적인 산업 인사이트를 추출하여 "AI 반도체 시장의 성장", "글로벌 파트너십 확산" 등의 종합적 인사이트를 표현하세요**
4. **각 기업마다 반드시 서로 다른 2개 이상의 뉴스를 인용하세요**
5. **해당 기업의 개별 뉴스를 우선 활용하고, 동향 뉴스로 보완하세요**
6. **절대 같은 뉴스를 여러 기업에서 반복 사용하지 마세요**
7. **뉴스 번호를 명시하세요 (예: "뉴스3에 따르면...", "뉴스15에서는...")**

**⚠️ 경고:** 뉴스 다양성을 반드시 확보하세요. 같은 뉴스 반복 사용 시 분석이 무효화됩니다.`
        },
        {
          role: 'user' as const,
          content: enhancedUserMessage
        }
      ];

      const tools = [
        {
          type: 'function',
          function: {
            name: 'generate_investment_strategies',
            description: '1단계에서 추출된 기업들에 대해 검색된 뉴스를 바탕으로 구체적인 투자 전략과 근거를 생성합니다. 각 기업의 개별 뉴스를 우선 활용하고, 동향 뉴스로 시장 분석을 보완하여 상세한 투자 근거를 제시합니다.',
            parameters: {
              type: 'object',
              properties: {
                traditional_strategies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      ticker: {
                        type: 'string',
                        description: '기업 티커 심볼 (예: NVDA)'
                      },
                      name: {
                        type: 'string',
                        description: '기업명 (예: NVIDIA)'
                      },
                      reason: {
                        type: 'string',
                        description: '1단계에서 추출된 해당 기업에 대해 개별 뉴스 2개 이상을 우선 인용하고, 필요시 동향 뉴스로 보완하여 구체적인 투자 근거 제시. 형식: "뉴스15에 따르면, 삼성전자는 AI 투자를 확대한다고 발표했습니다. 또한 뉴스23에서는 글로벌 파트너십 체결이 보도되었습니다. 이처럼 다각적 성장 전략으로 투자 매력도가 높습니다."'
                      }
                    },
                    required: ['ticker', 'name', 'reason']
                  },
                  description: '안정성과 신뢰성을 중시하는 정통한 투자 전략 3개 기업. 각 기업마다 관련 뉴스의 핵심 내용을 구체적으로 언급하여 포트폴리오 구성'
                },
                creative_strategies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      ticker: {
                        type: 'string',
                        description: '기업 티커 심볼 (예: PLTR)'
                      },
                      name: {
                        type: 'string',
                        description: '기업명 (예: Palantir Technologies)'
                      },
                      reason: {
                        type: 'string',
                        description: '1단계에서 추출된 해당 기업에 대해 개별 뉴스 2개 이상을 우선 인용하고, 필요시 동향 뉴스로 보완하여 구체적인 투자 근거 제시. 형식: "뉴스25에 따르면, 네이버는 클라우드 매출이 30% 증가했다고 발표했습니다. 또한 뉴스31에서는 AI 서비스 확장 계획이 공개되었습니다. 이처럼 성장 모멘텀이 지속되어 투자 가치가 높습니다."'
                      }
                    },
                    required: ['ticker', 'name', 'reason']
                  },
                  description: '성장 가능성과 혁신성을 중시하는 창의적 투자 전략 3개 기업. 각 기업마다 관련 뉴스의 핵심 내용을 구체적으로 언급하여 포트폴리오 구성'
                },
                analysis_reasoning: {
                  type: 'string',
                  description: '동향 뉴스에서 종합적인 산업 인사이트를 추출하여 시장 분석 제시. 동향 뉴스 분석 시 특정 기업명 절대 언급 금지! "AI 반도체 시장의 급성장", "글로벌 파트너십 확산", "기술 혁신 가속화" 등 산업 전반의 트렌드와 변화만 언급. 이후 기업별 뉴스를 활용하여 구체적 분석. 최소 3개 이상의 서로 다른 뉴스를 인용하고, 각 뉴스 번호를 명시하여 풍부한 분석을 제공.'
                },
                strategy_comparison: {
                  type: 'string',
                  description: '정통한 전략과 창의적 전략의 기대 효과를 대조적으로 설명. 각 전략의 장단점, 리스크, 수익성 등을 뉴스 근거와 함께 비교 분석.'
                }
              },
              required: ['traditional_strategies', 'creative_strategies', 'analysis_reasoning', 'strategy_comparison']
            }
          }
        }
      ];

      console.log(`🔧 [Function Call] HCX-005 API 호출 중...`);
      console.log(`🔧 [Function Call] 메시지 개수: ${messages.length}`);
      console.log(`🔧 [Function Call] 도구 개수: ${tools.length}`);

      const response = await this.hcxClient.callFunctionCallingAPI(messages, tools, 'auto');

      console.log(`🔧 [Function Call] API 응답 상태: ${response.status?.code}`);
      console.log(`🔧 [Function Call] 응답 구조:`, {
        hasResult: !!response.result,
        hasMessage: !!response.result?.message,
        hasToolCalls: !!response.result?.message?.toolCalls,
        toolCallsLength: response.result?.message?.toolCalls?.length || 0
      });

      if (response.status?.code === '20000' && response.result?.message?.toolCalls) {
        const toolCall = response.result.message.toolCalls[0];
        let functionArgs = toolCall.function?.arguments;

        // arguments가 문자열인 경우 JSON 파싱
        if (typeof functionArgs === 'string') {
          try {
            functionArgs = JSON.parse(functionArgs);
            console.log(`🔧 [Function Call] JSON 파싱 성공`);
          } catch (parseError) {
            console.error(`❌ [Function Call] JSON 파싱 실패:`, parseError);
            console.error(`❌ [Function Call] 원본 arguments:`, functionArgs);
            throw new Error('HCX-005 Function Calling arguments JSON 파싱 실패');
          }
        }

        if (functionArgs) {
          console.log(`🔧 [Function Call] HCX-005 응답 필드 확인:`, {
            traditional_strategies: functionArgs.traditional_strategies?.length || 0,
            creative_strategies: functionArgs.creative_strategies?.length || 0,
            analysis_reasoning: !!functionArgs.analysis_reasoning,
            strategy_comparison: !!functionArgs.strategy_comparison
          });

          const result: InvestmentRecommendationResult = {
            traditionalStrategy: functionArgs.traditional_strategies || [],
            creativeStrategy: functionArgs.creative_strategies || [],
            analysisReasoning: functionArgs.analysis_reasoning || '검색 기반 투자 분석이 완료되었습니다.',
            strategyComparison: functionArgs.strategy_comparison || '전략 비교 분석이 완료되었습니다.'
          };

          const executionTime = Date.now() - startTime;
          this.logger.logFunctionCall(
            functionName,
            {
              ...args,
              enhanced_message_length: enhancedUserMessage.length,
              trend_news_count: args.trend_news?.length || 0,
              company_news_count: Object.keys(args.company_news || {}).length
            },
            {
              traditional_strategies: result.traditionalStrategy.length,
              creative_strategies: result.creativeStrategy.length,
              hcx_function_called: true
            },
            true,
            executionTime
          );

          console.log(`✅ [Function Call] HCX-005 Function Calling 성공!`);
          return result;
        }
      }

      // Function Calling이 실패한 경우 오류 발생
      throw new Error('HCX-005 Function Calling 실패: 응답에서 결과를 찾을 수 없습니다.');
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.logFunctionCall(functionName, args, error, false, executionTime);
      throw error;
    }
  }


}



// ============================================================================
// HCX-005 Function Calling API 클라이언트
// ============================================================================

/**
 * HCX-005 모델의 실제 Function Calling API를 호출하는 클래스
 */
class HCX005FunctionCallingClient {
  private apiKey: string;
  private baseUrl: string;
  private requestId: string;

  constructor() {
    this.apiKey = ENV_CONFIG.openaiApiKey;
    this.baseUrl = 'https://clovastudio.stream.ntruss.com';
    this.requestId = Math.random().toString(36).substring(2, 15);

    if (!this.apiKey) {
      throw new Error('CLOVA_STUDIO_API_KEY가 설정되지 않았습니다.');
    }

    console.log(`🔧 [HCX-005 Client] Function Calling 클라이언트 초기화 완료`);
  }

  /**
   * HCX-005 Function Calling API 호출
   */
  async callFunctionCallingAPI(
    messages: Array<{
      role: 'system' | 'user' | 'assistant' | 'tool';
      content: string;
      toolCalls?: any[];
      toolCallId?: string;
    }>,
    tools: any[],
    toolChoice: string = 'auto'
  ): Promise<any> {
    const startTime = Date.now();
    console.log(`🔧 [HCX-005 API] Function Calling API 호출 시작`);
    console.log(`🔧 [HCX-005 API] 메시지 수: ${messages.length}, 도구 수: ${tools.length}`);

    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'X-NCP-CLOVASTUDIO-REQUEST-ID': this.requestId,
      'Content-Type': 'application/json'
    };

    const requestData = {
      messages: messages,
      tools: tools,
      toolChoice: toolChoice,
      topP: 0.8,
      topK: 0,
      maxTokens: 4096,
      temperature: 0.3,
      repetitionPenalty: 1.1,
      stop: [],
      seed: 0
    };

    console.log(`🔧 [HCX-005 API] 요청 데이터:`, {
      messages: requestData.messages.length,
      tools: requestData.tools?.length || 0,
      toolChoice: requestData.toolChoice,
      maxTokens: requestData.maxTokens
    });

    try {
      const response = await axios.post(
        `${this.baseUrl}/v3/chat-completions/HCX-005`,
        requestData,
        { headers, timeout: 60000 }
      );

      const processingTime = Date.now() - startTime;
      console.log(`✅ [HCX-005 API] Function Calling API 호출 성공 (${processingTime}ms)`);
      console.log(`🔧 [HCX-005 API] 응답 상태: ${response.data.status?.code}`);

      if (response.data.result?.message?.toolCalls) {
        console.log(`🔧 [HCX-005 API] Tool Calls 발견: ${response.data.result.message.toolCalls.length}개`);
        response.data.result.message.toolCalls.forEach((toolCall: any, index: number) => {
          console.log(`   ${index + 1}. ${toolCall.function?.name} - ${JSON.stringify(toolCall.function?.arguments)}`);
        });
      }

      return response.data;
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ [HCX-005 API] Function Calling API 호출 실패 (${processingTime}ms):`, error.message);

      if (error.response) {
        console.error(`❌ [HCX-005 API] 응답 상태: ${error.response.status}`);
        console.error(`❌ [HCX-005 API] 응답 데이터:`, error.response.data);
      }

      throw error;
    }
  }
}
