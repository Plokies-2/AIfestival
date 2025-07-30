from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import asyncio
import aiohttp
from datetime import datetime

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            # URL 파라미터 파싱
            parsed_url = urllib.parse.urlparse(self.path)
            query_params = urllib.parse.parse_qs(parsed_url.query)
            
            # 심볼 추출
            symbol = query_params.get('symbol', [None])[0]
            if not symbol:
                self.send_error_response(400, "Symbol parameter is required")
                return
            
            symbol = symbol.upper()
            
            # 통합 분석 실행
            result = asyncio.run(self.run_integrated_analysis(symbol))
            
            # 성공 응답
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            self.send_error_response(500, f"Internal server error: {str(e)}")
    
    def do_OPTIONS(self):
        # CORS preflight 요청 처리
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def send_error_response(self, status_code, message):
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        error_response = {"error": message}
        self.wfile.write(json.dumps(error_response).encode())
    
    async def call_analysis_api(self, session, url, symbol):
        """개별 분석 API 호출"""
        try:
            async with session.get(f"{url}?symbol={symbol}") as response:
                if response.status == 200:
                    return await response.json()
                else:
                    return {"error": f"API call failed with status {response.status}"}
        except Exception as e:
            return {"error": str(e)}
    
    async def run_integrated_analysis(self, symbol):
        """통합 분석 실행"""
        # Vercel 배포 시 실제 도메인으로 변경 필요
        base_url = "https://your-vercel-domain.vercel.app/api"
        
        # 로컬 테스트용 (개발 환경)
        if "localhost" in self.headers.get('host', ''):
            base_url = "http://localhost:3000/api"
        
        analysis_endpoints = {
            "mfi": f"{base_url}/mfi_analysis",
            "rsi": f"{base_url}/rsi_analysis", 
            "bollinger": f"{base_url}/bollinger_analysis",
            "capm": f"{base_url}/capm_analysis",
            "garch": f"{base_url}/garch_analysis",
            "industry": f"{base_url}/industry_analysis"
        }
        
        results = {}
        
        async with aiohttp.ClientSession() as session:
            # 모든 분석을 병렬로 실행
            tasks = []
            for analysis_type, url in analysis_endpoints.items():
                task = self.call_analysis_api(session, url, symbol)
                tasks.append((analysis_type, task))
            
            # 결과 수집
            for analysis_type, task in tasks:
                try:
                    result = await task
                    results[analysis_type] = result
                except Exception as e:
                    results[analysis_type] = {"error": str(e)}
        
        # 신호등 상태 결정
        traffic_lights = self.determine_traffic_lights(results)
        
        # 최종 결과 구성
        final_result = {
            "symbol": symbol,
            "timestamp": datetime.now().isoformat(),
            "mfi": results.get("mfi", {}),
            "rsi": results.get("rsi", {}),
            "bollinger": results.get("bollinger", {}),
            "capm": results.get("capm", {}),
            "garch": results.get("garch", {}),
            "industry": results.get("industry", {}),
            "traffic_lights": traffic_lights
        }
        
        return final_result
    
    def determine_traffic_lights(self, results):
        """분석 결과를 바탕으로 신호등 상태 결정"""
        traffic_lights = {
            "technical": "inactive",
            "industry": "inactive", 
            "market": "inactive",
            "risk": "inactive"
        }
        
        # 기술적 분석 (MFI + RSI + Bollinger)
        technical_signals = []
        for analysis in ["mfi", "rsi", "bollinger"]:
            if analysis in results and "traffic_light" in results[analysis]:
                technical_signals.append(results[analysis]["traffic_light"])
        
        if technical_signals:
            traffic_lights["technical"] = self.aggregate_signals(technical_signals)
        
        # 산업 민감도
        if "industry" in results and "traffic_light" in results["industry"]:
            traffic_lights["industry"] = results["industry"]["traffic_light"]
        
        # 시장 민감도 (CAPM)
        if "capm" in results and "traffic_light" in results["capm"]:
            traffic_lights["market"] = results["capm"]["traffic_light"]
        
        # 변동성 리스크 (GARCH)
        if "garch" in results and "traffic_light" in results["garch"]:
            traffic_lights["risk"] = results["garch"]["traffic_light"]
        
        return traffic_lights
    
    def aggregate_signals(self, signals):
        """여러 신호를 집계하여 하나의 신호로 변환"""
        if not signals:
            return "inactive"
        
        # 신호 카운트
        red_count = signals.count("red")
        green_count = signals.count("green")
        yellow_count = signals.count("yellow")
        
        # 다수결 원칙
        if red_count > green_count and red_count > yellow_count:
            return "red"
        elif green_count > red_count and green_count > yellow_count:
            return "green"
        else:
            return "yellow"
