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
            
            # MFI 계산
            result = self.calculate_mfi(symbol)
            
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
    
    def calculate_mfi(self, symbol):
        """MFI-14 계산"""
        # 데이터 로드
        df = self.load_stock_data(symbol)
        
        # 필요한 컬럼들이 있는지 확인
        required_cols = ['High', 'Low', 'Close', 'Volume']
        if not all(col in df.columns for col in required_cols):
            raise ValueError(f"Missing required columns in data: {required_cols}")
        
        # 데이터 정리
        df = df.dropna()
        if len(df) < 14:
            raise ValueError(f"Insufficient data for MFI calculation: {len(df)} days")
        
        period = 14
        
        # 데이터 처리
        df = df.sort_index()
        
        # Typical Price와 Money Flow
        tp = (df["High"] + df["Low"] + df["Close"]) / 3
        rmf = tp * df["Volume"]
        
        pos_flow = rmf.where(tp.diff() > 0, 0.0)  # 상승일
        neg_flow = rmf.where(tp.diff() <= 0, 0.0) # 하락일
        
        # 14일 합계로 Money Flow Ratio → MFI
        pos_sum = pos_flow.rolling(period).sum()
        neg_sum = neg_flow.rolling(period).sum()
        mfi = 100 - (100 / (1 + pos_sum / neg_sum))
        df["MFI_14"] = mfi
        
        # 최근값 판정
        latest_val = df["MFI_14"].iloc[-1]
        
        # 신호등 색상 결정
        if latest_val >= 80:
            color = "red"          # 과매수
            signal = "매도 신호"
            summary_ko = f"MFI가 {latest_val:.1f}로 과매수 구간(80 이상)에 있어 매도 신호입니다."
        elif latest_val <= 20:
            color = "green"        # 과매도
            signal = "매수 신호"
            summary_ko = f"MFI가 {latest_val:.1f}로 과매도 구간(20 이하)에 있어 매수 신호입니다."
        else:
            color = "yellow"       # 중립
            signal = "관망 신호"
            summary_ko = f"MFI가 {latest_val:.1f}로 중립 구간에 있어 관망이 권장됩니다."
        
        return {
            "symbol": symbol,
            "date": df.index[-1].date().isoformat(),
            "mfi_14": round(float(latest_val), 2),
            "traffic_light": color,
            "signal": signal,
            "summary_ko": summary_ko,
            "timestamp": datetime.now().isoformat()
        }
