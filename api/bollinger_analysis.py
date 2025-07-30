from http.server import BaseHTTPRequestHandler
import json
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
import urllib.parse

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
            
            # 볼린저 밴드 계산
            result = self.calculate_bollinger(symbol)
            
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
    
    def load_stock_data(self, symbol):
        """주식 데이터 로드"""
        try:
            # 3년간의 데이터 가져오기
            end_date = datetime.now()
            start_date = end_date - timedelta(days=3*365)
            
            ticker_obj = yf.Ticker(symbol)
            hist = ticker_obj.history(start=start_date, end=end_date)
            
            if hist.empty:
                raise ValueError(f"No data available for {symbol}")
            
            # 컬럼명 표준화
            hist.columns = [col.replace(' ', '').title() for col in hist.columns]
            hist.rename(columns={'Adjclose': 'AdjClose'}, inplace=True)
            
            return hist
            
        except Exception as e:
            raise Exception(f"Failed to load data for {symbol}: {str(e)}")
    
    def calculate_bollinger(self, symbol, period=20, k=2.0):
        """볼린저 밴드 계산"""
        # 데이터 로드
        df = self.load_stock_data(symbol)
        
        # 필요한 컬럼이 있는지 확인
        if 'Close' not in df.columns:
            raise ValueError("Missing 'Close' column in data")
        
        # 데이터 정리
        df = df.dropna()
        if len(df) < period:
            raise ValueError(f"Insufficient data for Bollinger calculation: {len(df)} days")
        
        # 데이터 처리
        df = df.sort_index()
        price = df['Close']
        
        # 볼린저 밴드 계산
        sma = price.rolling(window=period, min_periods=period).mean()
        std = price.rolling(window=period, min_periods=period).std()
        upper = sma + k * std
        lower = sma - k * std
        
        # %B (가격 위치: 0=하단, 1=상단)
        percent_b = (price - lower) / (upper - lower)
        
        # DataFrame에 percent_b 추가
        df["percent_b"] = percent_b
        val = df["percent_b"].iloc[-1]
        
        # 신호등 색상 결정
        if val >= 1:          # 상단 돌파 → 과매수
            color = "red"
            signal = "매도 신호"
            summary_ko = f"볼린저 밴드 %B가 {val:.2f}로 상단 밴드를 돌파하여 과매수 상태입니다."
        elif val <= 0:        # 하단 돌파 → 과매도
            color = "green"
            signal = "매수 신호"
            summary_ko = f"볼린저 밴드 %B가 {val:.2f}로 하단 밴드를 이탈하여 과매도 상태입니다."
        else:                 # 밴드 내부 → 중립
            color = "yellow"
            signal = "관망 신호"
            summary_ko = f"볼린저 밴드 %B가 {val:.2f}로 밴드 내부에 있어 중립 상태입니다."
        
        return {
            "symbol": symbol,
            "date": df.index[-1].date().isoformat(),
            "percent_b": round(float(val), 4),
            "traffic_light": color,
            "signal": signal,
            "summary_ko": summary_ko,
            "timestamp": datetime.now().isoformat()
        }
