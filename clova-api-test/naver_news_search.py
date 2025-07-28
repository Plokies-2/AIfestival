# 네이버 뉴스 검색 API 테스트
# 네이버 개발자 센터 블로그 검색 API 문서를 참고하여 작성
# https://developers.naver.com/docs/serviceapi/search/blog/blog.md

import os
import requests
import json
from dotenv import load_dotenv
from datetime import datetime

# .env 파일에서 환경변수 로드
load_dotenv()

class NaverNewsSearcher:
    """네이버 뉴스 검색 API 클래스"""
    
    def __init__(self):
        """API 클라이언트 초기화"""
        self.client_id = os.getenv("NAVER_CLIENT_ID")
        self.client_secret = os.getenv("NAVER_CLIENT_SECRET")
        
        if not self.client_id or not self.client_secret:
            raise ValueError("네이버 API 키가 설정되지 않았습니다. .env 파일을 확인해주세요.")
        
        # API 요청 헤더 설정
        self.headers = {
            "X-Naver-Client-Id": self.client_id,
            "X-Naver-Client-Secret": self.client_secret
        }
        
        # 네이버 뉴스 검색 API 엔드포인트
        self.news_api_url = "https://openapi.naver.com/v1/search/news.json"
    
    def search_news(self, query, display=10, start=1, sort="sim"):
        """
        뉴스 검색 함수
        
        Args:
            query (str): 검색어
            display (int): 검색 결과 출력 건수 (1~100, 기본값: 10)
            start (int): 검색 시작 위치 (1~1000, 기본값: 1)
            sort (str): 정렬 옵션 ("sim": 정확도순, "date": 날짜순, 기본값: "sim")
        
        Returns:
            dict: API 응답 결과
        """
        # 요청 파라미터 설정
        params = {
            "query": query,
            "display": min(display, 100),  # 최대 100개로 제한
            "start": max(1, min(start, 1000)),  # 1~1000 범위로 제한
            "sort": sort if sort in ["sim", "date"] else "sim"
        }
        
        try:
            # API 요청
            response = requests.get(
                self.news_api_url,
                headers=self.headers,
                params=params,
                timeout=10
            )
            
            # HTTP 상태 코드 확인
            response.raise_for_status()
            
            # JSON 응답 파싱
            result = response.json()
            
            return {
                "success": True,
                "data": result,
                "total": result.get("total", 0),
                "start": result.get("start", 1),
                "display": result.get("display", 0),
                "items": result.get("items", [])
            }
            
        except requests.exceptions.RequestException as e:
            return {
                "success": False,
                "error": f"API 요청 오류: {str(e)}",
                "data": None
            }
        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"JSON 파싱 오류: {str(e)}",
                "data": None
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"예상치 못한 오류: {str(e)}",
                "data": None
            }
    
    def format_news_item(self, item):
        """
        뉴스 아이템을 보기 좋게 포맷팅
        
        Args:
            item (dict): 뉴스 아이템
            
        Returns:
            str: 포맷팅된 뉴스 정보
        """
        # HTML 태그 제거 함수
        import re
        def remove_html_tags(text):
            clean = re.compile('<.*?>')
            return re.sub(clean, '', text)
        
        title = remove_html_tags(item.get("title", "제목 없음"))
        description = remove_html_tags(item.get("description", "설명 없음"))
        link = item.get("link", "")
        pub_date = item.get("pubDate", "")
        
        # 날짜 포맷팅 (RFC 2822 형식을 읽기 쉬운 형식으로 변환)
        try:
            if pub_date:
                # RFC 2822 형식 파싱 시도
                from email.utils import parsedate_to_datetime
                dt = parsedate_to_datetime(pub_date)
                formatted_date = dt.strftime("%Y년 %m월 %d일 %H시 %M분")
            else:
                formatted_date = "날짜 정보 없음"
        except:
            formatted_date = pub_date
        
        return f"""
제목: {title}
설명: {description}
발행일: {formatted_date}
링크: {link}
{'='*50}
"""

def main():
    """메인 함수 - 뉴스 검색 테스트"""
    print("네이버 뉴스 검색 API 테스트")
    print("="*50)
    
    try:
        # 뉴스 검색 객체 생성
        searcher = NaverNewsSearcher()
        
        # 테스트 검색어들
        test_queries = [
            "인공지능",
            "경제 뉴스", 
            "기술 트렌드",
            "코로나19"
        ]
        
        for query in test_queries:
            print(f"\n🔍 검색어: '{query}'")
            print("-" * 30)
            
            # 뉴스 검색 (최신순으로 5개)
            result = searcher.search_news(
                query=query,
                display=5,
                sort="date"
            )
            
            if result["success"]:
                print(f"✅ 검색 성공! 총 {result['total']}개의 결과 중 {len(result['items'])}개 표시")
                
                # 검색 결과 출력
                for i, item in enumerate(result["items"], 1):
                    print(f"\n📰 뉴스 {i}:")
                    print(searcher.format_news_item(item))
            else:
                print(f"❌ 검색 실패: {result['error']}")
            
            print("\n" + "="*70)
        
        # 대화형 검색 모드
        print("\n🎯 대화형 검색 모드 (종료하려면 'quit' 입력)")
        while True:
            user_query = input("\n검색어를 입력하세요: ").strip()
            
            if user_query.lower() in ['quit', 'exit', '종료', 'q']:
                print("검색을 종료합니다.")
                break
            
            if not user_query:
                print("검색어를 입력해주세요.")
                continue
            
            # 사용자 입력으로 뉴스 검색
            result = searcher.search_news(
                query=user_query,
                display=3,  # 3개만 표시
                sort="date"  # 최신순
            )
            
            if result["success"]:
                print(f"\n✅ '{user_query}' 검색 결과 (총 {result['total']}개 중 {len(result['items'])}개):")
                
                for i, item in enumerate(result["items"], 1):
                    print(f"\n📰 뉴스 {i}:")
                    print(searcher.format_news_item(item))
            else:
                print(f"❌ 검색 실패: {result['error']}")
    
    except Exception as e:
        print(f"❌ 프로그램 실행 중 오류 발생: {str(e)}")

if __name__ == "__main__":
    main()
