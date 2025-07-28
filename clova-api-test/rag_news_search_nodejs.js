// RAG Reasoning + 네이버 뉴스 검색 통합 시스템 (Node.js 버전)
// 사용자의 비정형적 검색 쿼리를 Clova Studio RAG reasoning으로 정제한 후 뉴스 검색

const https = require('https');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

/**
 * Clova Studio RAG Reasoning API 실행기
 */
class ClovaStudioRAGExecutor {
    constructor() {
        this.apiKey = process.env.CLOVA_STUDIO_API_KEY;
        if (!this.apiKey) {
            throw new Error('CLOVA_STUDIO_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.');
        }
        
        this.host = 'clovastudio.stream.ntruss.com';
        this.requestId = uuidv4().replace(/-/g, '');
    }
    
    /**
     * RAG reasoning API 요청 전송
     */
    async _sendRequest(completionRequest) {
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
        } catch (error) {
            return {
                status: { code: 'ERROR' },
                error: error.response ? error.response.data : error.message
            };
        }
    }
    
    /**
     * 사용자의 비정형적 검색 쿼리를 정제
     */
    async refineSearchQuery(userQuery) {
        const requestData = {
            messages: [
                {
                    content: userQuery,
                    role: "user"
                }
            ],
            tools: [
                {
                    function: {
                        description: "사용자의 비정형적인 검색 요청을 분석하여 네이버 뉴스 검색에 최적화된 키워드로 정제하는 도구입니다. 사용자의 의도를 파악하고 핵심 키워드를 추출하여 효과적인 뉴스 검색이 가능하도록 합니다.",
                        name: "naver_news_query_refiner",
                        parameters: {
                            type: "object",
                            properties: {
                                refined_query: {
                                    type: "string",
                                    description: "뉴스 검색에 최적화된 정제된 검색어. 핵심 키워드 중심으로 간결하게 작성하세요."
                                },
                                search_intent: {
                                    type: "string",
                                    description: "사용자의 검색 의도 (예: 최신뉴스, 분석정보, 특정사건, 인물정보 등)"
                                }
                            },
                            required: ["refined_query", "search_intent"]
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
            
            if (response.status?.code === '20000') {
                const result = response.result || {};
                const message = result.message || {};
                const toolCalls = message.toolCalls || [];

                // AI의 사고 과정 추출 (thinkingContent)
                const thinkingContent = message.thinkingContent || '';

                if (toolCalls.length > 0) {
                    const functionArgs = toolCalls[0].function?.arguments || {};
                    const refinedQuery = functionArgs.refined_query || userQuery;
                    const searchIntent = functionArgs.search_intent || '일반검색';

                    return {
                        success: true,
                        refined_query: refinedQuery,
                        search_intent: searchIntent,
                        original_query: userQuery,
                        thinking_content: thinkingContent  // AI의 사고 과정 추가
                    };
                } else {
                    return {
                        success: true,
                        refined_query: userQuery,
                        search_intent: '일반검색',
                        original_query: userQuery,
                        thinking_content: thinkingContent  // AI의 사고 과정 추가
                    };
                }
            } else {
                return {
                    success: false,
                    refined_query: userQuery,
                    search_intent: '일반검색',
                    original_query: userQuery,
                    error: response.status?.message || 'Unknown error',
                    thinking_content: ''  // 오류 시 빈 사고 과정
                };
            }
        } catch (error) {
            return {
                success: false,
                refined_query: userQuery,
                search_intent: '일반검색',
                original_query: userQuery,
                error: error.message,
                thinking_content: ''  // 예외 시 빈 사고 과정
            };
        }
    }
}

/**
 * 네이버 뉴스 검색 API 클래스
 */
class NaverNewsSearcher {
    constructor() {
        this.clientId = process.env.NAVER_CLIENT_ID;
        this.clientSecret = process.env.NAVER_CLIENT_SECRET;
        
        if (!this.clientId || !this.clientSecret) {
            throw new Error('네이버 API 키가 설정되지 않았습니다. .env 파일을 확인해주세요.');
        }
        
        this.apiUrl = 'https://openapi.naver.com/v1/search/news.json';
    }
    
    /**
     * 뉴스 검색 함수
     */
    async searchNews(query, display = 10, sort = 'date') {
        const headers = {
            'X-Naver-Client-Id': this.clientId,
            'X-Naver-Client-Secret': this.clientSecret
        };
        
        const params = {
            query: query,
            display: Math.min(display, 100),
            start: 1,
            sort: ['sim', 'date'].includes(sort) ? sort : 'date'
        };
        
        try {
            const response = await axios.get(this.apiUrl, {
                headers: headers,
                params: params,
                timeout: 10000
            });
            
            return {
                success: true,
                data: response.data,
                total: response.data.total || 0,
                items: response.data.items || []
            };
        } catch (error) {
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
    cleanHtmlTags(text) {
        return text.replace(/<[^>]*>/g, '');
    }
    
    /**
     * 뉴스 아이템 포맷팅
     */
    formatNewsItem(item) {
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

/**
 * RAG Reasoning + 네이버 뉴스 검색 통합 시스템
 */
class RAGNewsSearchSystem {
    constructor() {
        this.ragExecutor = new ClovaStudioRAGExecutor();
        this.newsSearcher = new NaverNewsSearcher();
    }
    
    /**
     * 지능형 뉴스 검색 - RAG reasoning으로 쿼리 정제 후 뉴스 검색
     */
    async intelligentNewsSearch(userQuery, maxResults = 5) {
        console.log(`🔍 원본 검색 쿼리: '${userQuery}'`);
        
        // 1단계: RAG reasoning으로 쿼리 정제
        console.log('📝 검색 쿼리 정제 중...');
        const refinementResult = await this.ragExecutor.refineSearchQuery(userQuery);
        
        const refinedQuery = refinementResult.refined_query;
        const searchIntent = refinementResult.search_intent;
        const thinkingContent = refinementResult.thinking_content || '';

        console.log(`✨ 정제된 검색어: '${refinedQuery}'`);
        console.log(`🎯 검색 의도: ${searchIntent}`);

        // AI의 사고 과정 출력 (thinkingContent가 있는 경우)
        if (thinkingContent) {
            console.log(`🧠 AI의 사고 과정:`);
            console.log(`   ${thinkingContent}`);
        } else {
            console.log('🧠 AI의 사고 과정: (사고 과정 정보 없음)');
        }
        
        // 2단계: 정제된 쿼리로 뉴스 검색
        console.log('📰 뉴스 검색 중...');
        const searchResult = await this.newsSearcher.searchNews(
            refinedQuery,
            maxResults,
            'date'
        );
        
        if (searchResult.success) {
            const formattedItems = searchResult.items.map(item => 
                this.newsSearcher.formatNewsItem(item)
            );
            
            return {
                success: true,
                original_query: userQuery,
                refined_query: refinedQuery,
                search_intent: searchIntent,
                total_found: searchResult.total,
                items_returned: formattedItems.length,
                news_items: formattedItems,
                refinement_success: refinementResult.success,
                thinking_content: thinkingContent  // AI의 사고 과정 추가
            };
        } else {
            return {
                success: false,
                original_query: userQuery,
                refined_query: refinedQuery,
                search_intent: searchIntent,
                error: searchResult.error,
                refinement_success: refinementResult.success,
                thinking_content: thinkingContent  // AI의 사고 과정 추가
            };
        }
    }
    
    /**
     * 챗봇용 간단한 뉴스 검색 (최대 3개 결과)
     */
    async searchNewsForChatbot(userQuery) {
        try {
            const result = await this.intelligentNewsSearch(userQuery, 3);
            
            if (result.success && result.news_items.length > 0) {
                return {
                    success: true,
                    message: `'${result.original_query}' 관련 최신 뉴스 ${result.news_items.length}개를 찾았습니다.`,
                    refined_query: result.refined_query,
                    search_intent: result.search_intent,
                    items: result.news_items
                };
            } else {
                return {
                    success: false,
                    message: result.error || `'${userQuery}' 관련 뉴스를 찾을 수 없습니다.`,
                    items: []
                };
            }
        } catch (error) {
            return {
                success: false,
                message: '뉴스 검색 중 오류가 발생했습니다.',
                error: error.message,
                items: []
            };
        }
    }
}

/**
 * 테스트 함수
 */
async function testRAGNewsSearch() {
    console.log('🤖 RAG Reasoning + 네이버 뉴스 검색 시스템 (Node.js)');
    console.log('='.repeat(60));
    
    try {
        const searchSystem = new RAGNewsSearchSystem();
        
        // 테스트 쿼리들
        const testQueries = [
            '요즘 AI 관련해서 어떤 일들이 일어나고 있어?',
            '트럼프가 대통령이 되면서 경제에 어떤 영향을 주고 있나?',
            '최근에 기술 분야에서 주목할 만한 소식이 있을까?'
        ];
        
        for (const query of testQueries) {
            console.log('\n' + '='.repeat(60));
            const result = await searchSystem.intelligentNewsSearch(query, 2);
            
            if (result.success) {
                console.log(`✅ 검색 완료! 총 ${result.total_found}개 중 ${result.items_returned}개 표시`);
                console.log(`🔧 RAG 정제 ${result.refinement_success ? '성공' : '실패'}`);
                
                result.news_items.forEach((item, index) => {
                    console.log(`\n📰 뉴스 ${index + 1}:`);
                    console.log(`제목: ${item.title}`);
                    console.log(`요약: ${item.description.substring(0, 100)}...`);
                    console.log(`링크: ${item.link}`);
                });
            } else {
                console.log(`❌ 검색 실패: ${result.error}`);
            }
        }
        
    } catch (error) {
        console.error('❌ 테스트 실행 중 오류:', error.message);
    }
}

// 챗봇에서 사용할 수 있는 간단한 함수 예시
async function getIntelligentNewsForChatbot(userMessage) {
    try {
        const searchSystem = new RAGNewsSearchSystem();
        const result = await searchSystem.searchNewsForChatbot(userMessage);
        return result;
    } catch (error) {
        return {
            success: false,
            message: '뉴스 검색 중 오류가 발생했습니다.',
            error: error.message
        };
    }
}

// 모듈 내보내기
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        RAGNewsSearchSystem,
        getIntelligentNewsForChatbot,
        ClovaStudioRAGExecutor,
        NaverNewsSearcher
    };
}

// 테스트 실행 (직접 실행 시)
if (require.main === module) {
    testRAGNewsSearch();
}
