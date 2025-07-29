/**
 * 뉴스 검색 서비스 (TypeScript 버전)
 * RAG Reasoning + 네이버 뉴스 검색 통합 시스템
 * 실제 네이버 뉴스 API 사용
 */

import axios from 'axios';
import { ENV_CONFIG } from './config';

// ============================================================================
// 타입 정의
// ============================================================================

export interface NewsSearchResult {
  success: boolean;
  original_query: string;
  refined_query: string;
  search_intent: string;
  total_found: number;
  items_returned: number;
  news_items: NewsItem[];
  refinement_success: boolean;
  thinking_content: string;
  error?: string;
}

export interface NewsItem {
  title: string;
  description: string;
  link: string;
  pub_date: string;
}

// ============================================================================
// Clova Studio RAG Executor
// ============================================================================

/**
 * Clova Studio RAG Reasoning API 실행기
 */
export class ClovaStudioRAGExecutor {
  private apiKey: string;
  private host: string;
  private requestId: string;

  constructor() {
    this.apiKey = ENV_CONFIG.openaiApiKey;
    if (!this.apiKey) {
      throw new Error('CLOVA_STUDIO_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.');
    }

    this.host = 'clovastudio.stream.ntruss.com';
    this.requestId = Math.random().toString(36).substring(2, 15);
  }

  /**
   * RAG reasoning API 요청 전송
   */
  private async _sendRequest(completionRequest: any): Promise<any> {
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-NCP-CLOVASTUDIO-REQUEST-ID': this.requestId
    };

    try {
      const response = await axios.post(
        `https://${this.host}/v1/api-tools/rag-reasoning`,
        completionRequest,
        { headers, timeout: 30000 }
      );

      return response.data;
    } catch (error: any) {
      return {
        status: { code: 'ERROR' },
        error: error.response ? error.response.data : error.message
      };
    }
  }

  /**
   * 사용자의 비정형적 검색 쿼리를 정제
   */
  async refineSearchQuery(userQuery: string): Promise<{
    success: boolean;
    refined_query: string;
    search_intent: string;
    original_query: string;
    thinking_content: string;
    error?: string;
  }> {
    const startTime = Date.now();
    console.log(`🔍 [RAG Reasoning] 검색어 정제 시작: "${userQuery}"`);

    const requestData = {
      messages: [
        {
          content: `다음 사용자 질문을 투자 동향 뉴스 검색에 최적화된 검색어로 정제해주세요. 특히 정부 정책, 국제 정세, 규제 변화에 초점을 맞춰 검색어를 생성해주세요.

사용자 질문: ${userQuery}`,
          role: "user"
        }
      ],
      tools: [
        {
          function: {
            description: "사용자의 투자 관련 비정형적 질문을 분석하여 투자 동향 뉴스 검색에 최적화된 키워드로 정제하는 도구입니다. 투자 의도를 파악하고 관련 산업, 기업, 기술 키워드를 추출하여 효과적인 투자 동향 뉴스 검색이 가능하도록 합니다.",
            name: "investment_news_query_refiner",
            parameters: {
              type: "object",
              properties: {
                refined_query: {
                  type: "string",
                  description: "뉴스 검색에 효과적인 간단하고 일반적인 검색어. 너무 구체적이지 않고 최근 뉴스를 찾을 수 있는 키워드 중심으로 작성하세요. 예: '휴대폰 제조업 이슈', 'AI 반도체', '전기차 배터리', '바이오 제약', '게임 엔터테인먼트'"
                },
                search_intent: {
                  type: "string",
                  description: "사용자의 투자 검색 의도 (예: 투자동향, 시장분석, 기업실적, 산업전망, 기술혁신 등)"
                },
                investment_keywords: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  description: "추출된 투자 관련 핵심 키워드들 (산업명, 기업명, 기술명 등)"
                }
              },
              required: ["refined_query", "search_intent", "investment_keywords"]
            }
          }
        }
      ],
      toolChoice: "auto",
      topP: 0.8,
      topK: 0,
      maxTokens: 1024,
      temperature: 0.3,
      repetitionPenalty: 1.1,
      stop: [],
      seed: 0,
      includeAiFilters: false
    };

    try {
      const response = await this._sendRequest(requestData);
      const processingTime = Date.now() - startTime;

      if (response.status?.code === '20000') {
        const result = response.result || {};
        const message = result.message || {};
        const toolCalls = message.toolCalls || [];
        const thinkingContent = message.thinkingContent || '';

        if (toolCalls.length > 0) {
          const functionArgs = toolCalls[0].function?.arguments || {};
          const refinedQuery = functionArgs.refined_query || userQuery;
          const searchIntent = functionArgs.search_intent || '투자동향';
          const investmentKeywords = functionArgs.investment_keywords || [];

          console.log(`✅ [RAG Reasoning] 성공 (${processingTime}ms):`);
          console.log(`   원본: "${userQuery}"`);
          console.log(`   정제: "${refinedQuery}"`);
          console.log(`   의도: ${searchIntent}`);
          console.log(`   투자키워드: [${investmentKeywords.join(', ')}]`);

          return {
            success: true,
            refined_query: refinedQuery,
            search_intent: searchIntent,
            original_query: userQuery,
            thinking_content: thinkingContent
          };
        } else {
          console.log(`⚠️ [RAG Reasoning] Tool call 없음, 간단한 기본 검색어 사용 (${processingTime}ms)`);
          // 간단하고 효과적인 기본 검색어로 폴백
          const fallbackQuery = userQuery.includes('휴대폰') || userQuery.includes('스마트폰')
            ? '휴대폰 제조업 이슈'
            : userQuery.includes('AI') || userQuery.includes('인공지능')
            ? 'AI 반도체'
            : userQuery.includes('반도체')
            ? '반도체 이슈'
            : userQuery.includes('전기차') || userQuery.includes('배터리')
            ? '전기차 배터리'
            : userQuery.includes('바이오') || userQuery.includes('제약')
            ? '바이오 제약'
            : userQuery.includes('게임') || userQuery.includes('엔터')
            ? '게임 엔터테인먼트'
            : '주식 시장';

          return {
            success: true,
            refined_query: fallbackQuery,
            search_intent: '투자동향',
            original_query: userQuery,
            thinking_content: thinkingContent
          };
        }
      } else {
        console.error(`❌ [RAG Reasoning] 실패 (${processingTime}ms):`, response.status?.message);
        return {
          success: false,
          refined_query: userQuery,
          search_intent: '일반검색',
          original_query: userQuery,
          error: response.status?.message || 'Unknown error',
          thinking_content: ''
        };
      }
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ [RAG Reasoning] 예외 발생 (${processingTime}ms):`, error.message);
      return {
        success: false,
        refined_query: userQuery,
        search_intent: '일반검색',
        original_query: userQuery,
        error: error.message,
        thinking_content: ''
      };
    }
  }
}

// ============================================================================
// 네이버 뉴스 검색기
// ============================================================================

/**
 * 네이버 뉴스 검색 API 클래스
 */
export class NaverNewsSearcher {
  private clientId: string;
  private clientSecret: string;
  private apiUrl: string;

  constructor() {
    this.clientId = process.env.NAVER_CLIENT_ID || '';
    this.clientSecret = process.env.NAVER_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      throw new Error('네이버 API 키가 설정되지 않았습니다. .env 파일을 확인해주세요.');
    }

    this.apiUrl = 'https://openapi.naver.com/v1/search/news.json';
    console.log('📰 [Naver API] 네이버 뉴스 검색기 초기화 완료');
  }

  /**
   * 뉴스 검색 함수
   */
  async searchNews(query: string, display: number = 10, sort: string = 'sim'): Promise<{
    success: boolean;
    data: any;
    total: number;
    items: any[];
    error?: string;
  }> {
    const startTime = Date.now();
    const requestedCount = display;
    const actualRequestCount = Math.min(display, 100); // Naver API 최대 100개 제한

    console.log(`📰 [Naver API] 뉴스 검색 시작: "${query}" (요청: ${requestedCount}개, 실제: ${actualRequestCount}개, ${sort} 정렬)`);

    const headers = {
      'X-Naver-Client-Id': this.clientId,
      'X-Naver-Client-Secret': this.clientSecret
    };

    const params = {
      query: query,
      display: actualRequestCount,
      start: 1,
      sort: ['sim', 'date'].includes(sort) ? sort : 'sim'
    };

    try {
      const response = await axios.get(this.apiUrl, {
        headers: headers,
        params: params,
        timeout: 10000
      });

      const processingTime = Date.now() - startTime;
      const total = response.data.total || 0;
      const items = response.data.items || [];

      // 요청한 개수와 실제 반환된 개수가 다른 경우 명시적으로 표시
      if (requestedCount > 100) {
        console.log(`✅ [Naver API] 검색 성공 (${processingTime}ms): 총 ${total}개 중 ${items.length}개 반환 (요청 ${requestedCount}개 → API 제한으로 ${actualRequestCount}개)`);
      } else {
        console.log(`✅ [Naver API] 검색 성공 (${processingTime}ms): 총 ${total}개 중 ${items.length}개 반환`);
      }

      return {
        success: true,
        data: response.data,
        total: total,
        items: items
      };
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ [Naver API] 검색 실패 (${processingTime}ms):`, error.message);

      return {
        success: false,
        error: `뉴스 검색 오류: ${error.message}`,
        data: null,
        total: 0,
        items: []
      };
    }
  }

  /**
   * HTML 태그 제거
   */
  cleanHtmlTags(text: string): string {
    return text.replace(/<[^>]*>/g, '');
  }

  /**
   * 최근 N일 이내의 뉴스만 필터링
   */
  filterRecentNews(newsItems: any[], daysBack: number = 3): any[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    return newsItems.filter(item => {
      try {
        const pubDate = new Date(item.pubDate);
        return pubDate >= cutoffDate;
      } catch (error) {
        // 날짜 파싱 실패 시 포함 (안전장치)
        console.warn(`날짜 파싱 실패: ${item.pubDate}`);
        return true;
      }
    });
  }

  /**
   * 뉴스 아이템 포맷팅
   */
  formatNewsItem(item: any): NewsItem {
    const title = this.cleanHtmlTags(item.title || '제목 없음');
    const description = this.cleanHtmlTags(item.description || '설명 없음');
    const link = item.link || '';
    const pubDate = item.pubDate || '';

    return {
      title: title,
      description: description,
      link: link,
      pub_date: pubDate
    };
  }
}

// ============================================================================
// RAG 뉴스 검색 시스템
// ============================================================================

/**
 * RAG Reasoning + 네이버 뉴스 검색 통합 시스템
 */
export class RAGNewsSearchSystem {
  private ragExecutor: ClovaStudioRAGExecutor;
  private newsSearcher: NaverNewsSearcher;

  constructor() {
    console.log('🔍 [RAG News System] RAG 뉴스 검색 시스템 초기화');
    this.ragExecutor = new ClovaStudioRAGExecutor();
    this.newsSearcher = new NaverNewsSearcher();
  }

  /**
   * 지능형 뉴스 검색 - RAG reasoning으로 쿼리 정제 후 최신 뉴스 우선 검색
   */
  async intelligentNewsSearch(userQuery: string, maxResults: number = 5): Promise<NewsSearchResult> {
    const overallStartTime = Date.now();
    console.log(`🔍 [Intelligent Search] 지능형 뉴스 검색 시작: "${userQuery}"`);

    // 1단계: RAG reasoning으로 쿼리 정제
    const refinementResult = await this.ragExecutor.refineSearchQuery(userQuery);

    const refinedQuery = refinementResult.refined_query;
    const searchIntent = refinementResult.search_intent;
    const thinkingContent = refinementResult.thinking_content || '';

    // 2단계: 최신 뉴스 우선 검색 (더 많은 결과를 가져온 후 필터링)
    const searchResult = await this.newsSearcher.searchNews(
      refinedQuery,
      Math.min(maxResults * 3, 100), // API 최대 제한인 100개까지 가져와서 필터링
      'date' // 최신순 정렬
    );

    const overallTime = Date.now() - overallStartTime;

    if (searchResult.success) {
      // 최근 3일 뉴스만 필터링
      const recentItems = this.newsSearcher.filterRecentNews(searchResult.items, 3);

      // 필요한 개수만큼 선택
      const selectedItems = recentItems.slice(0, maxResults);

      const formattedItems = selectedItems.map(item =>
        this.newsSearcher.formatNewsItem(item)
      );

      console.log(`✅ [Intelligent Search] 완료 (${overallTime}ms): 전체 ${searchResult.items.length}개 중 최근 3일 ${recentItems.length}개, 최종 ${formattedItems.length}개 뉴스 반환`);

      return {
        success: true,
        original_query: userQuery,
        refined_query: refinedQuery,
        search_intent: searchIntent,
        total_found: searchResult.total,
        items_returned: formattedItems.length,
        news_items: formattedItems,
        refinement_success: refinementResult.success,
        thinking_content: thinkingContent
      };
    } else {
      console.error(`❌ [Intelligent Search] 실패 (${overallTime}ms):`, searchResult.error);

      return {
        success: false,
        original_query: userQuery,
        refined_query: refinedQuery,
        search_intent: searchIntent,
        total_found: 0,
        items_returned: 0,
        news_items: [],
        refinement_success: refinementResult.success,
        thinking_content: thinkingContent,
        error: searchResult.error
      };
    }
  }

  /**
   * 투자 동향 뉴스 대량 검색 (새로운 파이프라인용)
   * RAG reasoning으로 정제된 쿼리로 최신 뉴스를 우선 검색
   */
  async searchInvestmentTrendNews(userQuery: string): Promise<NewsSearchResult> {
    const overallStartTime = Date.now();
    console.log(`📈 [Investment Trend Search] 투자 동향 뉴스 대량 검색 시작: "${userQuery}"`);

    // 1단계: RAG reasoning으로 투자 관련 쿼리 정제
    const refinementResult = await this.ragExecutor.refineSearchQuery(userQuery);

    const refinedQuery = refinementResult.refined_query;
    const searchIntent = refinementResult.search_intent;
    const thinkingContent = refinementResult.thinking_content || '';

    console.log(`📈 [Investment Trend Search] RAG reasoning 완료:`);
    console.log(`   정제된 쿼리: "${refinedQuery}"`);
    console.log(`   검색 의도: ${searchIntent}`);

    // 2단계: 최신 뉴스 우선 검색 (API 최대 제한인 100개 가져와서 최근 3일 필터링)
    const searchResult = await this.newsSearcher.searchNews(
      refinedQuery,
      100, // API 최대 제한인 100개로 수정 (Naver API 제한)
      'date' // 최신순 정렬
    );

    const overallTime = Date.now() - overallStartTime;

    if (searchResult.success) {
      // 최근 7일 뉴스부터 시작 (정부 정책, 국제 정세 중심)
      let recentItems = this.newsSearcher.filterRecentNews(searchResult.items, 7);
      let dayRange = 7;

      // 최근 7일 뉴스가 부족하면 점진적으로 범위 확대
      if (recentItems.length === 0) {
        console.log(`⚠️ [Investment Trend Search] 최근 7일 뉴스 ${recentItems.length}개 부족 - 범위 확대`);

        // 14일로 확대
        recentItems = this.newsSearcher.filterRecentNews(searchResult.items, 14);
        dayRange = 14;

        if (recentItems.length === 0) {
          console.log(`⚠️ [Investment Trend Search] 최근 14일 뉴스 ${recentItems.length}개 부족 - 30일로 확대`);
          // 30일로 확대
          recentItems = this.newsSearcher.filterRecentNews(searchResult.items, 30);
          dayRange = 30;

          if (recentItems.length === 0) {
            console.log(`⚠️ [Investment Trend Search] 최근 30일 뉴스도 없음 - 모든 뉴스 사용`);
            // 모든 뉴스 사용
            recentItems = searchResult.items.map(item => this.newsSearcher.formatNewsItem(item));
            dayRange = 999;
          }
        }
      }

      // 최대 30개까지 선택
      const selectedItems = recentItems.slice(0, 30);

      const formattedItems = selectedItems.map(item =>
        this.newsSearcher.formatNewsItem(item)
      );

      console.log(`✅ [Investment Trend Search] 투자 동향 뉴스 검색 완료 (${overallTime}ms)`);
      console.log(`   전체 ${searchResult.items.length}개 중 최근 ${dayRange}일 ${recentItems.length}개, 최종 ${formattedItems.length}개 선택`);

      return {
        success: true,
        original_query: userQuery,
        refined_query: refinedQuery,
        search_intent: searchIntent,
        total_found: searchResult.total,
        items_returned: formattedItems.length,
        news_items: formattedItems,
        refinement_success: refinementResult.success,
        thinking_content: thinkingContent + ` (최근 ${dayRange}일 뉴스 사용)`
      };
    } else {
      console.error(`❌ [Investment Trend Search] 실패 (${overallTime}ms):`, searchResult.error);

      return {
        success: false,
        original_query: userQuery,
        refined_query: refinedQuery,
        search_intent: searchIntent,
        total_found: 0,
        items_returned: 0,
        news_items: [],
        refinement_success: refinementResult.success,
        thinking_content: thinkingContent,
        error: searchResult.error
      };
    }
  }

  /**
   * 기업별 최신 동향 검색 (더 많은 뉴스를 가져와서 최근 7일 필터링)
   */
  async searchCompanyNews(companyName: string, maxResults: number = 3): Promise<NewsSearchResult> {
    const startTime = Date.now();
    const fixedQuery = `${companyName}`;
    console.log(`🏢 [Company Search] 기업 뉴스 검색 시작: "${fixedQuery}"`);

    // 더 많은 뉴스를 가져와서 최근 7일 필터링 후 관련성 높은 뉴스 선택
    const searchResult = await this.newsSearcher.searchNews(
      fixedQuery,
      100, // API 최대 제한인 100개 가져와서 필터링 (뉴스 다양성 확보)
      'date' // 최신순으로 변경
    );

    const processingTime = Date.now() - startTime;

    if (searchResult.success) {
      // 최근 7일 뉴스만 필터링
      const recentItems = this.newsSearcher.filterRecentNews(searchResult.items, 7);

      // 필요한 개수만큼 선택
      const selectedItems = recentItems.slice(0, maxResults);

      const formattedItems = selectedItems.map(item =>
        this.newsSearcher.formatNewsItem(item)
      );

      console.log(`✅ [Company Search] 완료 (${processingTime}ms): 전체 ${searchResult.items.length}개 중 최근 7일 ${recentItems.length}개, 최종 ${formattedItems.length}개 뉴스 반환`);

      return {
        success: true,
        original_query: companyName,
        refined_query: fixedQuery,
        search_intent: '기업동향',
        total_found: searchResult.total,
        items_returned: formattedItems.length,
        news_items: formattedItems,
        refinement_success: true,
        thinking_content: `기업명 '${companyName}'에 대한 최근 7일 뉴스 필터링 적용`
      };
    } else {
      console.error(`❌ [Company Search] 실패 (${processingTime}ms):`, searchResult.error);

      return {
        success: false,
        original_query: companyName,
        refined_query: fixedQuery,
        search_intent: '기업동향',
        total_found: 0,
        items_returned: 0,
        news_items: [],
        refinement_success: false,
        thinking_content: `기업명 '${companyName}'에 대한 검색 실패`,
        error: searchResult.error
      };
    }
  }

  /**
   * 챗봇용 간단한 뉴스 검색 (최대 3개 결과)
   */
  async searchNewsForChatbot(userQuery: string): Promise<{
    success: boolean;
    message: string;
    refined_query?: string;
    search_intent?: string;
    items: NewsItem[];
    error?: string;
  }> {
    console.log(`🤖 [Chatbot Search] 챗봇용 뉴스 검색: "${userQuery}"`);

    try {
      const result = await this.intelligentNewsSearch(userQuery, 3);

      if (result.success && result.news_items.length > 0) {
        console.log(`✅ [Chatbot Search] 성공: ${result.news_items.length}개 뉴스 반환`);
        return {
          success: true,
          message: `'${result.original_query}' 관련 최신 뉴스 ${result.news_items.length}개를 찾았습니다.`,
          refined_query: result.refined_query,
          search_intent: result.search_intent,
          items: result.news_items
        };
      } else {
        console.log(`⚠️ [Chatbot Search] 뉴스 없음: ${result.error || '검색 결과 없음'}`);
        return {
          success: false,
          message: result.error || `'${userQuery}' 관련 뉴스를 찾을 수 없습니다.`,
          items: []
        };
      }
    } catch (error: any) {
      console.error(`❌ [Chatbot Search] 예외 발생:`, error.message);
      return {
        success: false,
        message: '뉴스 검색 중 오류가 발생했습니다.',
        error: error.message,
        items: []
      };
    }
  }
}
