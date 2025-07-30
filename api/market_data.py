"""
Vercel 서버리스 함수: 실시간 시장 데이터 (KOSPI, VIX, 환율, 국채)
"""

import json
import yfinance as yf
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            # 시장 데이터 심볼들
            symbols = {
                '^KS11': 'KOSPI',
                '^KQ11': '한국 VIX',  # 실제로는 VIX 대용으로 KOSDAQ 사용
                'KRW=X': '원/달러',
                '^TNX': '미국 10년 국채'
            }
            
            market_data = []
            
            for symbol, name in symbols.items():
                try:
                    # yfinance로 데이터 가져오기
                    ticker = yf.Ticker(symbol)
                    
                    # 최근 2일 데이터 (현재가와 전일 대비 계산용)
                    hist = ticker.history(period="2d")
                    
                    if not hist.empty and len(hist) >= 1:
                        current_price = hist['Close'].iloc[-1]
                        
                        # 전일 대비 계산
                        if len(hist) >= 2:
                            prev_price = hist['Close'].iloc[-2]
                            change = current_price - prev_price
                            change_percent = (change / prev_price) * 100
                        else:
                            change = 0
                            change_percent = 0
                        
                        market_data.append({
                            'symbol': symbol,
                            'name': name,
                            'value': round(float(current_price), 2),
                            'change': round(float(change), 2),
                            'changePercent': round(float(change_percent), 2),
                            'lastUpdate': datetime.now().strftime('%H:%M:%S')
                        })
                    else:
                        # 데이터가 없는 경우 기본값
                        market_data.append({
                            'symbol': symbol,
                            'name': name,
                            'value': 0.0,
                            'change': 0.0,
                            'changePercent': 0.0,
                            'lastUpdate': datetime.now().strftime('%H:%M:%S')
                        })
                        
                except Exception as e:
                    print(f"Error fetching {symbol}: {e}")
                    # 오류 발생 시 기본값
                    market_data.append({
                        'symbol': symbol,
                        'name': name,
                        'value': 0.0,
                        'change': 0.0,
                        'changePercent': 0.0,
                        'lastUpdate': datetime.now().strftime('%H:%M:%S')
                    })
            
            # 성공 응답
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {
                'success': True,
                'data': market_data,
                'timestamp': datetime.now().isoformat()
            }
            
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
            
        except Exception as e:
            # 오류 응답
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            error_response = {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            
            self.wfile.write(json.dumps(error_response).encode())
    
    def do_OPTIONS(self):
        # CORS preflight 요청 처리
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
