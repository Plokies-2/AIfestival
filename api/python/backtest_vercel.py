from http.server import BaseHTTPRequestHandler
import json
import sys
import os

# 현재 디렉토리를 Python 경로에 추가
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

# backtest 모듈에서 필요한 함수들 가져오기
try:
    from backtest import handle_backtest_request
except ImportError:
    # 로컬 개발 환경에서는 직접 import
    import backtest
    handle_backtest_request = backtest.handle_backtest_request

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """
        Vercel 서버리스 함수로 POST 요청 처리
        포트폴리오 백테스팅 수행
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

            # 백테스팅 실행
            result = handle_backtest_request(request_data)
            
            # 성공 응답
            response_data = {
                'success': True,
                'data': result,
                'timestamp': result.get('timestamp', '')
            }
            
            self.wfile.write(json.dumps(response_data, ensure_ascii=False).encode('utf-8'))
            
        except Exception as e:
            self.send_error_response(500, f"백테스팅 처리 오류: {str(e)}")

    def do_GET(self):
        """
        GET 요청 처리 (쿼리 파라미터 방식)
        """
        try:
            from urllib.parse import urlparse, parse_qs
            
            # CORS 헤더 설정
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()

            # URL 파싱
            parsed_url = urlparse(self.path)
            query_params = parse_qs(parsed_url.query)
            
            # 쿼리 파라미터에서 데이터 추출
            tickers = query_params.get('tickers', [''])[0].split(',') if query_params.get('tickers') else []
            weights_str = query_params.get('weights', [''])[0]
            weights = [float(w) for w in weights_str.split(',')] if weights_str else []
            start_date = query_params.get('start_date', [''])[0]
            end_date = query_params.get('end_date', [''])[0]
            period = query_params.get('period', [''])[0]
            
            # 요청 데이터 구성
            request_data = {
                'tickers': tickers,
                'weights': weights,
                'start_date': start_date,
                'end_date': end_date,
                'period': period
            }
            
            # 백테스팅 실행
            result = handle_backtest_request(request_data)
            
            # 성공 응답
            response_data = {
                'success': True,
                'data': result,
                'timestamp': result.get('timestamp', '')
            }
            
            self.wfile.write(json.dumps(response_data, ensure_ascii=False).encode('utf-8'))
            
        except Exception as e:
            self.send_error_response(500, f"백테스팅 처리 오류: {str(e)}")

    def do_OPTIONS(self):
        """
        CORS preflight 요청 처리
        """
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def send_error_response(self, status_code, error_message):
        """
        에러 응답 전송
        """
        try:
            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            error_data = {
                'success': False,
                'error': error_message,
                'timestamp': ''
            }
            
            self.wfile.write(json.dumps(error_data, ensure_ascii=False).encode('utf-8'))
        except Exception as e:
            print(f"에러 응답 전송 실패: {e}", file=sys.stderr)

    def log_message(self, format, *args):
        """
        로그 메시지 출력 (Vercel 환경에서는 stderr로)
        """
        print(f"[BACKTEST] {format % args}", file=sys.stderr)
