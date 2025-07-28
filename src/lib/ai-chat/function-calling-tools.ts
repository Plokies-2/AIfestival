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
// Function Calling 도구 정의
// ============================================================================

/**
 * 투자 전략 생성 도구 정의 (새로운 파이프라인에서 사용)
 */
export const INVESTMENT_STRATEGY_TOOL = {
  type: "function" as const,
  function: {
    name: "generate_investment_strategies",
    description: "검색된 최신 동향 정보와 기업 정보를 바탕으로 정통한 투자 전략과 창의적 투자 전략을 각각 생성합니다.",
    parameters: {
      type: "object",
      properties: {
        user_message: {
          type: "string",
          description: "사용자의 원본 투자 관심사 메시지"
        },
        trend_news: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              link: { type: "string" },
              pub_date: { type: "string" }
            }
          },
          description: "검색된 최신 동향 뉴스 목록"
        },
        company_news: {
          type: "object",
          description: "기업별 최신 동향 뉴스 (기업명을 키로 하는 객체)"
        },
        selected_industries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              industry_ko: { type: "string" },
              sp500_industry: { type: "string" },
              score: { type: "number" },
              companies: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    ticker: { type: "string" },
                    name: { type: "string" },
                    industry: { type: "string" }
                  }
                }
              }
            }
          },
          description: "RAG로 분석된 적합 산업 및 기업 정보"
        },
        rag_accuracy: {
          type: "number",
          description: "RAG 매칭 정확도"
        }
      },
      required: ["user_message", "selected_industries", "rag_accuracy"]
    }
  }
};

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
      sp500_industry: string;
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
  }> {
    const startTime = Date.now();
    const functionName = 'extract_companies_from_news';

    console.log(`📊 [Function Call] ${functionName} 실행 시작 - 뉴스 기반 기업 추출`);

    try {
      // 뉴스 내용을 포함한 사용자 메시지 구성
      let enhancedUserMessage = args.user_message;

      // 최신 동향 뉴스 추가
      if (args.trend_news && args.trend_news.length > 0) {
        enhancedUserMessage += '\n\n**최신 투자 동향 뉴스:**\n';
        args.trend_news.forEach((news, index) => {
          enhancedUserMessage += `${index + 1}. ${news.title}\n   ${news.description}\n\n`;
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

      enhancedUserMessage += `위 뉴스 동향과 산업 정보를 바탕으로 투자 가치가 높은 기업 6개를 추출해주세요.`;

      // HCX-005 Function Calling API 호출
      const messages = [
        {
          role: 'system' as const,
          content: `당신은 최신 뉴스를 분석하여 투자 가치가 높은 기업을 추출하는 전문가입니다.

**중요 지침:**
1. 제공된 최신 뉴스 내용을 면밀히 분석하여 투자 기회를 찾으세요
2. 뉴스에서 언급된 구체적인 사실, 수치, 전망을 바탕으로 기업을 선정하세요
3. 정통한 전략 3개와 창의적 전략 3개로 구분하여 총 6개 기업을 추출하세요
4. 각 기업 선정 이유에는 관련 뉴스의 핵심 내용을 구체적으로 언급하세요
5. 시장 분석에서는 "최근 ~~에 따르면" 형식으로 뉴스를 직접 인용하여 투자 동향을 설명하세요`
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
            name: 'extract_companies_from_news',
            description: '최신 뉴스 분석을 통해 투자 가치가 높은 기업 6개를 추출합니다.',
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
                      reason: { type: 'string', description: '뉴스 기반 선정 이유' }
                    },
                    required: ['ticker', 'name', 'reason']
                  },
                  description: '안정성 중심의 정통한 투자 전략 3개 기업'
                },
                creative_companies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      ticker: { type: 'string', description: '기업 티커 심볼' },
                      name: { type: 'string', description: '기업명' },
                      reason: { type: 'string', description: '뉴스 기반 선정 이유' }
                    },
                    required: ['ticker', 'name', 'reason']
                  },
                  description: '성장성 중심의 창의적 투자 전략 3개 기업'
                },
                market_analysis: {
                  type: 'string',
                  description: '뉴스 기반 시장 동향 분석'
                }
              },
              required: ['traditional_companies', 'creative_companies', 'market_analysis']
            }
          }
        }
      ];

      console.log(`🔧 [Function Call] HCX-005 API 호출 중...`);
      const response = await this.hcxClient.callFunctionCallingAPI(messages, tools, 'auto');

      if (response.status?.code === '20000' && response.result?.message?.toolCalls) {
        const toolCall = response.result.message.toolCalls[0];
        const functionArgs = toolCall.function?.arguments;

        if (functionArgs) {
          const result = {
            traditional_companies: functionArgs.traditional_companies || [],
            creative_companies: functionArgs.creative_companies || [],
            market_analysis: functionArgs.market_analysis || '뉴스 기반 시장 분석이 완료되었습니다.'
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

      throw new Error('HCX-005 Function Calling 응답 처리 실패');
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
      sp500_industry: string;
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

      // 최신 동향 뉴스 추가
      if (args.trend_news && args.trend_news.length > 0) {
        enhancedUserMessage += '\n\n**최신 동향 정보:**\n';
        args.trend_news.forEach((news, index) => {
          enhancedUserMessage += `${index + 1}. ${news.title}\n   ${news.description}\n`;
        });
      }

      // 기업별 뉴스 추가
      if (args.company_news) {
        enhancedUserMessage += '\n\n**기업별 최신 동향:**\n';
        Object.entries(args.company_news).forEach(([companyName, newsResult]) => {
          if (newsResult.success && newsResult.news_items.length > 0) {
            enhancedUserMessage += `\n**${companyName}:**\n`;
            newsResult.news_items.forEach((news, index) => {
              enhancedUserMessage += `${index + 1}. ${news.title}\n   ${news.description}\n`;
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
      enhancedUserMessage += `위 정보를 바탕으로 정통한 전략 3개 기업과 창의적 전략 3개 기업을 추천해주세요.`;

      // HCX-005 Function Calling API 호출
      const messages = [
        {
          role: 'system' as const,
          content: `당신은 최신 뉴스 정보를 정확하게 인용하는 투자 전문가입니다.

**뉴스 인용 지침 (매우 중요):**
1. 뉴스 인용 시 반드시 "~~일보에서는 27일 ~~라고 언급했습니다" 형식으로 구체적인 출처와 날짜를 포함하세요
2. 제공된 뉴스의 title, description, pub_date 정보를 활용하여 정확한 인용을 하세요
3. 각 기업 설명에서 해당 기업과 관련된 뉴스를 직접 인용하여 투자 근거를 제시하세요
4. 일반적인 "최근 뉴스에 따르면" 같은 모호한 표현은 절대 사용하지 마세요

**답변 형식 지침:**
1. 먼저 시장 전체 동향을 구체적인 뉴스 인용으로 분석하세요
2. 기업명은 "티커 (회사명)" 형식으로 1회만 표기하세요 (예: NVDA (NVIDIA))
3. 각 기업마다 관련 뉴스를 구체적으로 인용하여 투자 근거를 제시하세요
4. 뉴스에서 언급된 구체적인 사실, 수치, 전망을 반드시 포함하세요
5. 마지막에 두 전략의 장단점을 뉴스 근거와 함께 설명하세요

정통한 투자 전략과 창의적 투자 전략을 각각 3개씩 추천해주세요.`
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
                        description: '구체적인 출처와 행동주체, 날짜를 포함하여 형식으로 구체적인 출처와 날짜를 포함하여 뉴스를 정확히 인용. 제공된 뉴스의 title, description, pub_date 정보를 활용하여 투자 근거를 서술'
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
                        description: '구체적인 출처와 행동주체, 날짜를 포함하여 구체적인 출처와 날짜를 포함하여 뉴스를 정확히 인용. 제공된 뉴스의 title, description, pub_date 정보를 활용하여 투자 근거를 서술'
                      }
                    },
                    required: ['ticker', 'name', 'reason']
                  },
                  description: '성장 가능성과 혁신성을 중시하는 창의적 투자 전략 3개 기업. 각 기업마다 관련 뉴스의 핵심 내용을 구체적으로 언급'
                },
                analysis_reasoning: {
                  type: 'string',
                  description: '구체적인 출처와 행동주체, 날짜를 포함하여 시장 동향을 먼저 분석을 제시할 것, 마지막에 "💡 두 전략의 장단점"을 뉴스 근거와 함께 설명. 구체적 수치와 전망을 반드시 포함'
                }
              },
              required: ['traditional_strategies', 'creative_strategies', 'analysis_reasoning']
            }
          }
        }
      ];

      console.log(`🔧 [Function Call] HCX-005 API 호출 중...`);
      const response = await this.hcxClient.callFunctionCallingAPI(messages, tools, 'auto');

      if (response.status?.code === '20000' && response.result?.message?.toolCalls) {
        const toolCall = response.result.message.toolCalls[0];
        const functionArgs = toolCall.function?.arguments;

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

  /**
   * Function Calling 로그 조회
   */
  getFunctionCallLogs() {
    return this.logger.getLogs();
  }

  /**
   * Function Calling 로그 초기화
   */
  clearFunctionCallLogs() {
    this.logger.clearLogs();
  }
}

// ============================================================================
// 통합 Function Calling 도구 배열
// ============================================================================

/**
 * HCX-005 모델에서 사용할 모든 function calling 도구들 (새로운 파이프라인용)
 */
export const ALL_FUNCTION_TOOLS = [
  INVESTMENT_STRATEGY_TOOL
] as const;

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

    try {
      const response = await axios.post(
        `${this.baseUrl}/testapp/v3/chat-completions/HCX-005`,
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
