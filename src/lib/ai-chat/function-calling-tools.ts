/**
 * Function Calling 도구 정의
 * HCX-005 모델을 위한 검색 및 투자 분석 도구들
 */

import { NewsSearchResult, NewsItem } from './news-service';
import { InvestmentRecommendationInput, InvestmentRecommendationResult } from './ai-service';
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

  constructor() {
    this.logger = FunctionCallLogger.getInstance();
    this.hcxClient = new HCX005FunctionCallingClient();
    console.log('🔧 [Function Executor] Function Calling 실행기 초기화 완료');
  }



  /**
   * 뉴스 기반 기업 추출 실행 - 새로운 파이프라인 1단계
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

    // 🚨 중요: 뉴스 개수에 따라 추출할 기업 수 동적 조정
    const newsCount = args.trend_news?.length || 0;
    let traditionalCount = 3;
    let creativeCount = 3;

    if (newsCount < 6) {
      // 뉴스가 6개 미만이면 기업 수를 줄임
      traditionalCount = Math.max(1, Math.floor(newsCount / 2));
      creativeCount = Math.max(1, newsCount - traditionalCount);

      console.log(`⚠️ [Function Call] 뉴스 부족 (${newsCount}개) - 기업 수 조정: 정통한 ${traditionalCount}개, 창의적 ${creativeCount}개`);
    }

    console.log(`🔧 [Function Call] 최종 설정: 뉴스 ${newsCount}개 → 정통한 ${traditionalCount}개 + 창의적 ${creativeCount}개 기업`);

    try {
      // 뉴스 내용을 포함한 사용자 메시지 구성
      let enhancedUserMessage = args.user_message;

      // 최신 동향 뉴스 추가 (사전 필터링된 최근 3일 뉴스, 번호로 구분)
      if (args.trend_news && args.trend_news.length > 0) {
        enhancedUserMessage += '\n\n**최신 투자 동향 뉴스 (각 뉴스는 고유 번호로 구분됨):**\n';
        args.trend_news.forEach((news, index) => {
          const formattedDate = formatNewsDate(news.pub_date);
          enhancedUserMessage += `📰 뉴스${index + 1}: [${formattedDate}] ${news.title}\n내용: ${news.description}\n\n`;
        });

        enhancedUserMessage += `**⚠️ 중요: 위 뉴스들은 뉴스1, 뉴스2, 뉴스3... 형태로 구분됩니다. 절대 같은 뉴스를 반복 사용하지 마세요!**\n`;
      }

      // 산업 정보 추가
      enhancedUserMessage += '\n\n**분석된 적합 산업:**\n';
      args.selected_industries.forEach(industry => {
        const companiesText = industry.companies.map(company =>
          `${company.ticker} (${company.name})`
        ).join(', ');
        enhancedUserMessage += `**${industry.industry_ko}** (매칭 점수: ${industry.score.toFixed(3)})\n기업들: ${companiesText}\n\n`;
      });

      // 뉴스 개수에 따른 동적 지침 생성
      const getInstructions = (newsCount: number, traditionalCount: number, creativeCount: number) => {
        if (newsCount === 1) {
          return `위 최신 뉴스를 바탕으로 투자 가치가 높은 기업 ${traditionalCount + creativeCount}개를 추출해주세요.

**절대 준수 사항:**
1. **뉴스1만 사용 가능하므로 모든 기업에서 뉴스1을 활용하세요**
2. **각 기업마다 뉴스1의 서로 다른 측면을 강조하여 차별화하세요**
3. **시장 분석에서도 뉴스1을 기반으로 작성하세요**

**예시 형식:**
"뉴스1에 따르면, [기업명]은 [특정 측면]에서 강점을 보입니다..."`;
        } else if (newsCount === 2) {
          return `위 최신 뉴스를 바탕으로 투자 가치가 높은 기업 ${traditionalCount + creativeCount}개를 추출해주세요.

**절대 준수 사항:**
1. **뉴스1과 뉴스2를 골고루 활용하세요**
2. **각 기업마다 가능한 한 두 뉴스를 모두 언급하세요**
3. **시장 분석에서는 뉴스1과 뉴스2를 모두 활용하세요**

**예시 형식:**
"뉴스1에 따르면, [기업명]은 [사실1]입니다. 또한 뉴스2에서는 [사실2]가 보도되었습니다..."`;
        } else {
          return `위 최신 뉴스를 바탕으로 투자 가치가 높은 기업 ${traditionalCount + creativeCount}개를 추출해주세요.

**절대 준수 사항:**
1. **각 기업마다 반드시 서로 다른 2개 이상의 뉴스를 인용하세요 (예: 뉴스1과 뉴스5 사용)**
2. **절대 같은 뉴스를 여러 기업에서 반복 사용하지 마세요**
3. **시장 분석에서는 최소 3개의 서로 다른 뉴스를 언급하세요**
4. 뉴스 번호를 명시하여 "뉴스3에 따르면..." 형식으로 작성하세요

**예시 형식:**
"뉴스1에 따르면, [기업명]은 [사실1]입니다. 또한 뉴스7에서는 [사실2]가 보도되었습니다..."`;
        }
      };

      enhancedUserMessage += getInstructions(newsCount, traditionalCount, creativeCount);

      enhancedUserMessage += `\n\n**📋 사용 가능한 뉴스 목록: 총 ${newsCount}개**\n`;
      enhancedUserMessage += `뉴스1부터 뉴스${newsCount}까지 사용 가능합니다. 각각 다른 뉴스이므로 다양하게 활용하세요.\n`;

      // 뉴스 개수에 따른 동적 시스템 메시지 생성
      const getSystemMessage = (newsCount: number, traditionalCount: number, creativeCount: number) => {
        if (newsCount === 1) {
          return `당신은 최신 뉴스를 분석하여 투자 가치가 높은 기업을 추출하는 전문가입니다.

**현재 상황:** 사용 가능한 뉴스가 1개뿐입니다.

**절대 준수 사항:**
1. **뉴스1만 사용 가능하므로 모든 기업에서 뉴스1을 활용하세요**
2. **각 기업마다 뉴스1의 서로 다른 측면을 강조하여 차별화하세요**
3. **정통한 전략 ${traditionalCount}개, 창의적 전략 ${creativeCount}개 기업을 추출하세요**

**응답 형식:**
"뉴스1에 따르면, [기업명]은 [특정 측면]에서 강점을 보입니다. 이처럼 [분석]하므로 [투자 강점]합니다."`;
        } else if (newsCount === 2) {
          return `당신은 최신 뉴스를 분석하여 투자 가치가 높은 기업을 추출하는 전문가입니다.

**현재 상황:** 사용 가능한 뉴스가 2개입니다.

**절대 준수 사항:**
1. **뉴스1과 뉴스2를 골고루 활용하세요**
2. **각 기업마다 가능한 한 두 뉴스를 모두 언급하세요**
3. **정통한 전략 ${traditionalCount}개, 창의적 전략 ${creativeCount}개 기업을 추출하세요**

**응답 형식:**
"뉴스1에 따르면, [기업명]은 [사실1]입니다. 또한 뉴스2에서는 [사실2]가 보도되었습니다."`;
        } else {
          return `당신은 최신 뉴스를 분석하여 투자 가치가 높은 기업을 추출하는 전문가입니다.

**절대 준수 사항:**
1. **각 기업마다 반드시 서로 다른 2개 이상의 뉴스를 인용하세요**
2. **절대 같은 뉴스를 여러 기업에서 반복 사용하지 마세요**
3. **뉴스 번호를 명시하세요 (예: "뉴스1에 따르면...", "뉴스5에서는...")**
4. **시장 분석에서는 최소 3개의 서로 다른 뉴스를 언급하세요**
5. **정통한 전략 ${traditionalCount}개, 창의적 전략 ${creativeCount}개 기업을 추출하세요**

**응답 형식:**
"뉴스3에 따르면, [기업명]은 [구체적 사실]입니다. 또한 뉴스8에서는 [추가 사실]이 보도되었습니다. 이처럼 [분석]하므로 [투자 강점]합니다."

**⚠️ 경고:** 뉴스 다양성을 반드시 확보하세요. 같은 뉴스 반복 사용 시 분석이 무효화됩니다.`;
        }
      };

      // HCX-005 Function Calling API 호출
      const messages = [
        {
          role: 'system' as const,
          content: getSystemMessage(newsCount, traditionalCount, creativeCount)
        },
        {
          role: 'user' as const,
          content: enhancedUserMessage
        }
      ];

      // 뉴스 개수에 따른 동적 reason 설명 생성
      const getReasonDescription = (newsCount: number) => {
        if (newsCount === 1) {
          return '뉴스1을 기반으로 투자 근거를 설명 (형식: "뉴스1에 따르면, [기업명]은 [사실]입니다. 이처럼 [분석]하므로 [투자 강점]합니다.")';
        } else if (newsCount === 2) {
          return '뉴스1과 뉴스2를 모두 활용하여 투자 근거를 설명 (형식: "뉴스1에 따르면, [기업명]은 [사실1]입니다. 또한 뉴스2에서는 [사실2]가 보도되었습니다.")';
        } else {
          return '반드시 서로 다른 2개 이상의 뉴스를 번호로 인용 (형식: "뉴스3에 따르면, [기업명]은 [사실1]입니다. 또한 뉴스8에서는 [사실2]가 보도되었습니다.") - 절대 같은 뉴스 반복 금지';
        }
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
            description: `최신 뉴스 분석을 통해 투자 가치가 높은 기업 ${traditionalCount + creativeCount}개를 추출합니다.`,
            parameters: {
              type: 'object',
              properties: {
                traditional_companies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      ticker: { type: 'string', description: '기업 티커 심볼' },
                      name: { type: 'string', description: '기업명' },
                      reason: { type: 'string', description: getReasonDescription(newsCount) }
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
                      ticker: { type: 'string', description: '기업 티커 심볼' },
                      name: { type: 'string', description: '기업명' },
                      reason: { type: 'string', description: getReasonDescription(newsCount) }
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
          throw new Error('LLM이 제공된 뉴스에서 적절한 기업을 추출하지 못했습니다. 뉴스 품질이나 관련성이 부족할 수 있습니다.');
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
    rag_accuracy: number;
  }): Promise<InvestmentRecommendationResult> {
    const startTime = Date.now();
    const functionName = 'generate_investment_strategies';

    console.log(`💡 [Function Call] ${functionName} 실행 시작 - HCX-005 Function Calling 사용`);

    try {
      // 검색 결과를 포함한 확장된 사용자 메시지 구성
      let enhancedUserMessage = args.user_message;

      // 최신 동향 뉴스 추가 (번호로 구분)
      let totalNewsCount = 0;
      if (args.trend_news && args.trend_news.length > 0) {
        enhancedUserMessage += '\n\n**📰 최신 동향 뉴스 (각 뉴스는 고유 번호로 구분):**\n';
        args.trend_news.forEach((news, index) => {
          const formattedDate = formatNewsDate(news.pub_date);
          enhancedUserMessage += `뉴스${index + 1}: [${formattedDate}] ${news.title}\n내용: ${news.description}\n\n`;
        });
        totalNewsCount += args.trend_news.length;
      }

      // 기업별 뉴스 추가 (연속 번호로 구분)
      if (args.company_news) {
        enhancedUserMessage += '\n\n**🏢 기업별 뉴스 (연속 번호로 구분):**\n';
        Object.entries(args.company_news).forEach(([companyName, newsResult]) => {
          if (newsResult.success && newsResult.news_items.length > 0) {
            enhancedUserMessage += `\n**${companyName}:**\n`;
            newsResult.news_items.forEach((news) => {
              const formattedDate = formatNewsDate(news.pub_date);
              totalNewsCount++;
              enhancedUserMessage += `뉴스${totalNewsCount}: [${formattedDate}] ${news.title}\n내용: ${news.description}\n\n`;
            });
          }
        });
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

      // 핵심 지시사항 강화
      enhancedUserMessage += `\n\n**🚨 절대 준수 사항:**
1. **각 기업마다 반드시 서로 다른 2개 이상의 뉴스를 인용하세요**
2. **절대 같은 뉴스를 여러 기업에서 반복 사용하지 마세요**
3. **뉴스 번호를 명시하세요 (예: "뉴스3에 따르면...", "뉴스15에서는...")**
4. **시장 분석에서는 최소 3개의 서로 다른 뉴스를 언급하세요**

**📋 사용 가능한 뉴스: 총 ${totalNewsCount}개**
뉴스1부터 뉴스${totalNewsCount}까지 모두 다른 뉴스입니다. 다양하게 활용하세요.

**예시 형식:**
"뉴스5에 따르면, 삼성전자는 AI 반도체 투자를 확대한다고 발표했습니다. 또한 뉴스12에서는 글로벌 파트너십 체결 소식이 전해졌습니다. 이처럼 다각적인 성장 전략으로 투자 매력도가 높습니다."`;

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
          content: `당신은 제공된 뉴스 데이터를 활용하여 투자 분석을 수행하는 전문가입니다.

**🚨 절대 준수 사항:**
1. **각 기업마다 반드시 서로 다른 2개 이상의 뉴스를 인용하세요**
2. **절대 같은 뉴스를 여러 기업에서 반복 사용하지 마세요**
3. **뉴스 번호를 명시하세요 (예: "뉴스3에 따르면...", "뉴스15에서는...")**
4. **시장 동향 분석에서는 최소 3개의 서로 다른 뉴스를 언급하세요**

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
            description: '검색된 최신 뉴스 정보와 기업별 동향을 적극 활용하여 근거 있는 투자 전략을 생성합니다. 뉴스에서 언급된 구체적 사실과 전망을 인용하여 투자 근거를 제시합니다.',
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
                        description: '반드시 2개 이상의 뉴스를 인용하여 투자 근거 제시. 형식: "어제 15시 뉴스에 따르면, 삼성전자는 AI 투자를 확대한다고 발표했습니다. 또한 오늘 9시 뉴스에서는 글로벌 파트너십 체결이 보도되었습니다. 이처럼 다각적 성장으로 투자 매력도가 높습니다."'
                      }
                    },
                    required: ['ticker', 'name', 'reason']
                  },
                  description: '안정성과 신뢰성을 중시하는 정통한 투자 전략 3개 기업. 각 기업마다 관련 뉴스의 핵심 내용을 구체적으로 언급'
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
                        description: '반드시 2개 이상의 뉴스를 인용하여 투자 근거 제시. 형식: "어제 10시 뉴스에 따르면, 네이버는 클라우드 매출이 30% 증가했다고 발표했습니다. 또한 오늘 14시 뉴스에서는 AI 서비스 확장 계획이 공개되었습니다. 이처럼 성장 모멘텀이 지속되어 투자 가치가 높습니다."'
                      }
                    },
                    required: ['ticker', 'name', 'reason']
                  },
                  description: '성장 가능성과 혁신성을 중시하는 창의적 투자 전략 3개 기업. 각 기업마다 관련 뉴스의 핵심 내용을 구체적으로 언급'
                },
                analysis_reasoning: {
                  type: 'string',
                  description: '시장 동향 분석에서 최소 3개 이상의 뉴스를 인용하여 풍부한 분석 제시. 각 뉴스의 시점을 명확히 표시하고, 마지막에 두 전략의 장단점을 비교 분석.'
                }
              },
              required: ['traditional_strategies', 'creative_strategies', 'analysis_reasoning']
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
          const result: InvestmentRecommendationResult = {
            traditionalStrategy: functionArgs.traditional_strategies || [],
            creativeStrategy: functionArgs.creative_strategies || [],
            analysisReasoning: functionArgs.analysis_reasoning || '검색 기반 투자 분석이 완료되었습니다.'
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

      // Function Calling이 실패한 경우 기존 방식으로 폴백
      console.log(`⚠️ [Function Call] HCX-005 Function Calling 실패, 기존 방식으로 폴백`);
      const { generateInvestmentRecommendations } = await import('./ai-service');

      const input: InvestmentRecommendationInput = {
        userMessage: enhancedUserMessage,
        selectedIndustries: args.selected_industries,
        ragAccuracy: args.rag_accuracy
      };

      const result = await generateInvestmentRecommendations(input);

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
          hcx_function_called: false,
          fallback_used: true
        },
        true,
        executionTime
      );

      return result;
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
