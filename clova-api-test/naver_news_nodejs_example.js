// Node.js 챗봇용 네이버 뉴스 검색 API 예시 코드
// Python 테스트 코드를 기반으로 작성

const axios = require('axios');
require('dotenv').config();

/**
 * 네이버 뉴스 검색 클래스
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
     * @param {string} query - 검색어
     * @param {number} display - 검색 결과 개수 (1~100)
     * @param {number} start - 검색 시작 위치 (1~1000)
     * @param {string} sort - 정렬 방식 ('sim' 또는 'date')
     * @returns {Promise<Object>} 검색 결과
     */
    async searchNews(query, display = 10, start = 1, sort = 'date') {
        try {
            const headers = {
                'X-Naver-Client-Id': this.clientId,
                'X-Naver-Client-Secret': this.clientSecret
            };
            
            const params = {
                query: query,
                display: Math.min(display, 100),
                start: Math.max(1, Math.min(start, 1000)),
                sort: ['sim', 'date'].includes(sort) ? sort : 'sim'
            };
            
            const response = await axios.get(this.apiUrl, {
                headers: headers,
                params: params,
                timeout: 10000
            });
            
            return {
                success: true,
                total: response.data.total || 0,
                start: response.data.start || 1,
                display: response.data.display || 0,
                items: response.data.items || []
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.response ? 
                    `HTTP ${error.response.status}: ${error.response.statusText}` : 
                    error.message,
                total: 0,
                items: []
            };
        }
    }
    
    /**
     * HTML 태그 제거 함수
     * @param {string} text - HTML이 포함된 텍스트
     * @returns {string} HTML 태그가 제거된 텍스트
     */
    removeHtmlTags(text) {
        return text.replace(/<[^>]*>/g, '');
    }
    
    /**
     * 뉴스 아이템 포맷팅
     * @param {Object} item - 뉴스 아이템
     * @returns {Object} 포맷팅된 뉴스 정보
     */
    formatNewsItem(item) {
        return {
            title: this.removeHtmlTags(item.title || '제목 없음'),
            description: this.removeHtmlTags(item.description || '설명 없음'),
            link: item.link || '',
            pubDate: item.pubDate || '',
            originalTitle: item.originallink || ''
        };
    }
    
    /**
     * 챗봇용 간단한 뉴스 검색 (최대 3개 결과)
     * @param {string} query - 검색어
     * @returns {Promise<Object>} 챗봇용 검색 결과
     */
    async searchNewsForChatbot(query) {
        const result = await this.searchNews(query, 3, 1, 'date');
        
        if (result.success && result.items.length > 0) {
            const formattedItems = result.items.map(item => this.formatNewsItem(item));
            
            return {
                success: true,
                message: `'${query}' 관련 최신 뉴스 ${formattedItems.length}개를 찾았습니다.`,
                items: formattedItems
            };
        } else {
            return {
                success: false,
                message: result.error || `'${query}' 관련 뉴스를 찾을 수 없습니다.`,
                items: []
            };
        }
    }
}

/**
 * 테스트 함수
 */
async function testNaverNewsSearch() {
    console.log('🔍 네이버 뉴스 검색 API 테스트 (Node.js)');
    console.log('='.repeat(50));
    
    try {
        const searcher = new NaverNewsSearcher();
        
        // 테스트 검색어
        const testQueries = ['인공지능', '경제 뉴스', '기술 트렌드'];
        
        for (const query of testQueries) {
            console.log(`\n🔍 검색어: '${query}'`);
            console.log('-'.repeat(30));
            
            const result = await searcher.searchNewsForChatbot(query);
            
            if (result.success) {
                console.log(`✅ ${result.message}`);
                
                result.items.forEach((item, index) => {
                    console.log(`\n📰 뉴스 ${index + 1}:`);
                    console.log(`제목: ${item.title}`);
                    console.log(`요약: ${item.description}`);
                    console.log(`발행일: ${item.pubDate}`);
                    console.log(`링크: ${item.link}`);
                });
            } else {
                console.log(`❌ ${result.message}`);
            }
            
            console.log('\n' + '='.repeat(50));
        }
        
    } catch (error) {
        console.error('❌ 테스트 실행 중 오류:', error.message);
    }
}

// 챗봇에서 사용할 수 있는 간단한 함수 예시
async function getNewsForChatbot(userMessage) {
    try {
        const searcher = new NaverNewsSearcher();
        
        // 사용자 메시지에서 검색어 추출 (실제로는 더 정교한 처리 필요)
        const query = userMessage.replace(/뉴스|검색|찾아|알려줘|보여줘/g, '').trim();
        
        if (!query) {
            return {
                success: false,
                message: '검색어를 입력해주세요. 예: "AI 뉴스 검색"'
            };
        }
        
        const result = await searcher.searchNewsForChatbot(query);
        return result;
        
    } catch (error) {
        return {
            success: false,
            message: '뉴스 검색 중 오류가 발생했습니다.'
        };
    }
}

// 모듈 내보내기 (Node.js 환경에서 사용)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        NaverNewsSearcher,
        getNewsForChatbot
    };
}

// 테스트 실행 (직접 실행 시)
if (require.main === module) {
    testNaverNewsSearch();
}
