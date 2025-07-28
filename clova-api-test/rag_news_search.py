# RAG Reasoning + 네이버 뉴스 검색 통합 시스템
# 사용자의 비정형적 검색 쿼리를 Clova Studio RAG reasoning으로 정제한 후 뉴스 검색

import os
import json
import http.client
import requests
import re
import uuid
from dotenv import load_dotenv
from datetime import datetime

# .env 파일에서 환경변수 로드
load_dotenv()

class ClovaStudioRAGExecutor:
    """Clova Studio RAG Reasoning API 실행기"""
    
    def __init__(self):
        """API 클라이언트 초기화"""
        self.api_key = os.getenv("CLOVA_STUDIO_API_KEY")
        if not self.api_key:
            raise ValueError("CLOVA_STUDIO_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.")
        
        self.host = 'clovastudio.stream.ntruss.com'
        self.request_id = str(uuid.uuid4()).replace('-', '')
    
    def _send_request(self, completion_request):
        """RAG reasoning API 요청 전송"""
        headers = {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': f'Bearer {self.api_key}',
            'X-NCP-CLOVASTUDIO-REQUEST-ID': self.request_id
        }
        
        try:
            conn = http.client.HTTPSConnection(self.host)
            conn.request('POST', '/v1/api-tools/rag-reasoning', json.dumps(completion_request), headers)
            response = conn.getresponse()
            result = json.loads(response.read().decode(encoding='utf-8'))
            conn.close()
            return result
        except Exception as e:
            return {'status': {'code': 'ERROR'}, 'error': str(e)}
    
    def refine_search_query(self, user_query):
        """
        사용자의 비정형적 검색 쿼리를 정제
        
        Args:
            user_query (str): 사용자의 원본 검색 쿼리
            
        Returns:
            str: 정제된 검색 쿼리
        """
        request_data = {
            "messages": [
                {
                    "content": user_query,
                    "role": "user"
                }
            ],
            "tools": [
                {
                    "function": {
                        "description": "사용자의 비정형적인 검색 요청을 분석하여 네이버 뉴스 검색에 최적화된 키워드로 정제하는 도구입니다. 사용자의 의도를 파악하고 핵심 키워드를 추출하여 효과적인 뉴스 검색이 가능하도록 합니다.",
                        "name": "naver_news_query_refiner",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "refined_query": {
                                    "type": "string",
                                    "description": "뉴스 검색에 최적화된 정제된 검색어. 핵심 키워드 중심으로 간결하게 작성하세요."
                                },
                                "search_intent": {
                                    "type": "string",
                                    "description": "사용자의 검색 의도 (예: 최신뉴스, 분석정보, 특정사건, 인물정보 등)"
                                }
                            },
                            "required": ["refined_query", "search_intent"]
                        }
                    }
                }
            ],
            "toolChoice": "auto",
            "topP": 0.8,
            "topK": 0,
            "maxTokens": 1024,
            "temperature": 0.3,  # 일관성을 위해 낮은 temperature 사용
            "repetitionPenalty": 1.1,
            "stop": [],
            "seed": 0,
            "includeAiFilters": False
        }
        
        try:
            response = self._send_request(request_data)
            
            if response.get('status', {}).get('code') == '20000':
                # RAG reasoning 결과에서 정제된 쿼리 추출
                result = response.get('result', {})
                message = result.get('message', {})
                tool_calls = message.get('toolCalls', [])

                # AI의 사고 과정 추출 (thinkingContent)
                thinking_content = message.get('thinkingContent', '')

                if tool_calls:
                    # 첫 번째 tool call에서 arguments 추출
                    function_args = tool_calls[0].get('function', {}).get('arguments', {})
                    refined_query = function_args.get('refined_query', user_query)
                    search_intent = function_args.get('search_intent', '일반검색')

                    return {
                        'success': True,
                        'refined_query': refined_query,
                        'search_intent': search_intent,
                        'original_query': user_query,
                        'thinking_content': thinking_content  # AI의 사고 과정 추가
                    }
                else:
                    # tool call이 없는 경우 원본 쿼리 사용
                    return {
                        'success': True,
                        'refined_query': user_query,
                        'search_intent': '일반검색',
                        'original_query': user_query,
                        'thinking_content': thinking_content  # AI의 사고 과정 추가
                    }
            else:
                # API 오류 시 원본 쿼리 사용
                return {
                    'success': False,
                    'refined_query': user_query,
                    'search_intent': '일반검색',
                    'original_query': user_query,
                    'error': response.get('status', {}).get('message', 'Unknown error'),
                    'thinking_content': ''  # 오류 시 빈 사고 과정
                }
                
        except Exception as e:
            # 예외 발생 시 원본 쿼리 사용
            return {
                'success': False,
                'refined_query': user_query,
                'search_intent': '일반검색',
                'original_query': user_query,
                'error': str(e),
                'thinking_content': ''  # 예외 시 빈 사고 과정
            }

class NaverNewsSearcher:
    """네이버 뉴스 검색 API 클래스"""
    
    def __init__(self):
        """API 클라이언트 초기화"""
        self.client_id = os.getenv("NAVER_CLIENT_ID")
        self.client_secret = os.getenv("NAVER_CLIENT_SECRET")
        
        if not self.client_id or not self.client_secret:
            raise ValueError("네이버 API 키가 설정되지 않았습니다. .env 파일을 확인해주세요.")
        
        self.headers = {
            "X-Naver-Client-Id": self.client_id,
            "X-Naver-Client-Secret": self.client_secret
        }
        
        self.news_api_url = "https://openapi.naver.com/v1/search/news.json"
    
    def search_news(self, query, display=10, sort="date"):
        """
        뉴스 검색 함수
        
        Args:
            query (str): 검색어
            display (int): 검색 결과 출력 건수 (1~100)
            sort (str): 정렬 옵션 ("sim": 정확도순, "date": 날짜순)
        
        Returns:
            dict: API 응답 결과
        """
        params = {
            "query": query,
            "display": min(display, 100),
            "start": 1,
            "sort": sort if sort in ["sim", "date"] else "date"
        }
        
        try:
            response = requests.get(
                self.news_api_url,
                headers=self.headers,
                params=params,
                timeout=10
            )
            
            response.raise_for_status()
            result = response.json()
            
            return {
                "success": True,
                "data": result,
                "total": result.get("total", 0),
                "items": result.get("items", [])
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"뉴스 검색 오류: {str(e)}",
                "data": None,
                "total": 0,
                "items": []
            }
    
    def clean_html_tags(self, text):
        """HTML 태그 제거"""
        clean = re.compile('<.*?>')
        return re.sub(clean, '', text)
    
    def format_news_item(self, item):
        """뉴스 아이템 포맷팅"""
        title = self.clean_html_tags(item.get("title", "제목 없음"))
        description = self.clean_html_tags(item.get("description", "설명 없음"))
        link = item.get("link", "")
        pub_date = item.get("pubDate", "")
        
        return {
            "title": title,
            "description": description,
            "link": link,
            "pub_date": pub_date
        }

class RAGNewsSearchSystem:
    """RAG Reasoning + 네이버 뉴스 검색 통합 시스템"""
    
    def __init__(self):
        """시스템 초기화"""
        self.rag_executor = ClovaStudioRAGExecutor()
        self.news_searcher = NaverNewsSearcher()
    
    def intelligent_news_search(self, user_query, max_results=5):
        """
        지능형 뉴스 검색 - RAG reasoning으로 쿼리 정제 후 뉴스 검색
        
        Args:
            user_query (str): 사용자의 비정형적 검색 쿼리
            max_results (int): 최대 결과 개수
            
        Returns:
            dict: 검색 결과
        """
        print(f"🔍 원본 검색 쿼리: '{user_query}'")
        
        # 1단계: RAG reasoning으로 쿼리 정제
        print("📝 검색 쿼리 정제 중...")
        refinement_result = self.rag_executor.refine_search_query(user_query)
        
        refined_query = refinement_result['refined_query']
        search_intent = refinement_result['search_intent']
        thinking_content = refinement_result.get('thinking_content', '')

        print(f"✨ 정제된 검색어: '{refined_query}'")
        print(f"🎯 검색 의도: {search_intent}")

        # AI의 사고 과정 출력 (thinkingContent가 있는 경우)
        if thinking_content:
            print(f"🧠 AI의 사고 과정:")
            print(f"   {thinking_content}")
        else:
            print("🧠 AI의 사고 과정: (사고 과정 정보 없음)")
        
        # 2단계: 정제된 쿼리로 뉴스 검색
        print("📰 뉴스 검색 중...")
        search_result = self.news_searcher.search_news(
            query=refined_query,
            display=max_results,
            sort="date"
        )
        
        if search_result["success"]:
            formatted_items = []
            for item in search_result["items"]:
                formatted_items.append(self.news_searcher.format_news_item(item))
            
            return {
                "success": True,
                "original_query": user_query,
                "refined_query": refined_query,
                "search_intent": search_intent,
                "total_found": search_result["total"],
                "items_returned": len(formatted_items),
                "news_items": formatted_items,
                "refinement_success": refinement_result['success'],
                "thinking_content": thinking_content  # AI의 사고 과정 추가
            }
        else:
            return {
                "success": False,
                "original_query": user_query,
                "refined_query": refined_query,
                "search_intent": search_intent,
                "error": search_result["error"],
                "refinement_success": refinement_result['success'],
                "thinking_content": thinking_content  # AI의 사고 과정 추가
            }

def main():
    """메인 함수 - RAG 뉴스 검색 테스트"""
    print("🤖 RAG Reasoning + 네이버 뉴스 검색 시스템")
    print("=" * 60)
    
    try:
        # 시스템 초기화
        search_system = RAGNewsSearchSystem()
        
        # 테스트 쿼리들 (비정형적인 검색 요청)
        test_queries = [
            "요즘 AI 관련해서 어떤 일들이 일어나고 있어?",
            "트럼프가 대통령이 되면서 경제에 어떤 영향을 주고 있나?",
            "최근에 기술 분야에서 주목할 만한 소식이 있을까?",
            "코로나19 상황이 어떻게 되고 있는지 알고 싶어"
        ]
        
        for query in test_queries:
            print(f"\n{'='*60}")
            result = search_system.intelligent_news_search(query, max_results=3)
            
            if result["success"]:
                print(f"✅ 검색 완료! 총 {result['total_found']}개 중 {result['items_returned']}개 표시")
                print(f"🔧 RAG 정제 {'성공' if result['refinement_success'] else '실패'}")
                
                for i, item in enumerate(result["news_items"], 1):
                    print(f"\n📰 뉴스 {i}:")
                    print(f"제목: {item['title']}")
                    print(f"요약: {item['description']}")
                    print(f"발행일: {item['pub_date']}")
                    print(f"링크: {item['link']}")
            else:
                print(f"❌ 검색 실패: {result['error']}")
        
        # 대화형 모드
        print(f"\n{'='*60}")
        print("🎯 대화형 검색 모드 (종료하려면 'quit' 입력)")
        
        while True:
            user_input = input("\n자연스럽게 검색하고 싶은 내용을 말해주세요: ").strip()
            
            if user_input.lower() in ['quit', 'exit', '종료', 'q']:
                print("검색을 종료합니다.")
                break
            
            if not user_input:
                print("검색 내용을 입력해주세요.")
                continue
            
            result = search_system.intelligent_news_search(user_input, max_results=3)
            
            if result["success"]:
                print(f"\n✅ 검색 완료! (총 {result['total_found']}개 발견)")
                
                for i, item in enumerate(result["news_items"], 1):
                    print(f"\n📰 뉴스 {i}:")
                    print(f"제목: {item['title']}")
                    print(f"요약: {item['description'][:100]}...")
                    print(f"링크: {item['link']}")
            else:
                print(f"❌ 검색 실패: {result['error']}")
    
    except Exception as e:
        print(f"❌ 시스템 오류: {str(e)}")

if __name__ == "__main__":
    main()
