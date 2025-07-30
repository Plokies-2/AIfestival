from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import urllib.request
import os

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            parsed_url = urllib.parse.urlparse(self.path)
            query_params = urllib.parse.parse_qs(parsed_url.query)
            symbol = query_params.get("symbol", [None])[0]
            if not symbol:
                self.send_error_response(400, "Symbol parameter is required")
                return
            
            # 환경변수를 사용하여 동적으로 URL 결정
            base_url = self.headers.get("host", "localhost:3000")
            
            # Vercel 환경에서는 HTTPS 사용
            if "vercel.app" in base_url or "localhost" not in base_url:
                protocol = "https"
            else:
                protocol = "http"
            
            api_url = f"{protocol}://{base_url}/api/unified_analysis?type=industry&symbol={symbol}"
            
            req = urllib.request.Request(api_url)
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode())
            
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            self.send_error_response(500, f"Internal server error: {str(e)}")
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
    
    def send_error_response(self, status_code, message):
        self.send_response(status_code)
        self.send_header("Content-type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        error_response = {"error": message}
        self.wfile.write(json.dumps(error_response).encode())
