from http.server import BaseHTTPRequestHandler
import json
import sys
import os

# 현재 디렉토리를 Python 경로에 추가
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

# unified_analysis 모듈에서 필요한 함수들 가져오기
try:
    from unified_analysis import handle_vercel_request
except ImportError:
    # 로컬 개발 환경에서는 직접 import
    import unified_analysis
    handle_vercel_request = unified_analysis.handle_vercel_request

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """
        Vercel 서버리스 함수로 POST 요청 처리
        실제 시장 데이터만 사용하며 모의 데이터 생성 금지
        """
        try:
            # CORS 헤더 설정
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()

            # 요청 본문 읽기
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            # JSON 파싱
            try:
                request_data = json.loads(post_data.decode('utf-8'))
            except json.JSONDecodeError as e:
                self.send_error_response(400, f"Invalid JSON: {str(e)}")
                return

            # 분석 실행
            result = handle_vercel_request(request_data)
            
            # 결과 반환
            response_json = json.dumps(result, ensure_ascii=False)
            self.wfile.write(response_json.encode('utf-8'))

        except Exception as e:
            self.send_error_response(500, f"Analysis failed: {str(e)}")

    def do_OPTIONS(self):
        """CORS preflight 요청 처리"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def send_error_response(self, status_code: int, message: str):
        """오류 응답 전송"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        error_response = {
            "error": message,
            "timestamp": json.dumps({"$date": {"$numberLong": str(int(1000 * 1000))}}),
            "status": status_code
        }
        
        self.wfile.write(json.dumps(error_response, ensure_ascii=False).encode('utf-8'))

    def log_message(self, format, *args):
        """로그 메시지 출력 (Vercel 환경에서 stderr로)"""
        sys.stderr.write(f"[PYTHON_API] {format % args}\n")
