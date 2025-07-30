from http.server import BaseHTTPRequestHandler
import json
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
import urllib.parse
import numpy as np
import statsmodels.api as sm
import math
import warnings
warnings.filterwarnings('ignore')

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
            
            # CAPM 계산
            result = self.calculate_capm(symbol)
            
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
            # 1년간의 데이터 가져오기
            end_date = datetime.now()
            start_date = end_date - timedelta(days=365)
            
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
    
    def nw_maxlags(self, n):
        """Newey-West maxlags (Andrews 1991) 규칙"""
        return int(math.floor(4 * (n / 100) ** (2 / 9)))

    def calculate_capm(self, symbol):
        """CAPM 베타 계산 (Newey-West HAC 표준오차 적용)"""
        WIN = 126  # 6개월 (영업일)

        # 개별 종목 데이터 로드
        stock_data = self.load_stock_data(symbol)

        # KOSPI 지수 데이터 로드
        kospi_data = self.load_stock_data("^KS11")

        # 필요한 컬럼이 있는지 확인
        if 'Close' not in stock_data.columns or 'Close' not in kospi_data.columns:
            raise ValueError("Missing 'Close' column in data")

        # 데이터 정리 및 정렬
        stock_data = stock_data.dropna()
        kospi_data = kospi_data.dropna()

        # 인덱스 timezone 정규화
        if stock_data.index.tz is not None:
            stock_data.index = stock_data.index.tz_localize(None)
        if kospi_data.index.tz is not None:
            kospi_data.index = kospi_data.index.tz_localize(None)

        # 수익률(%) 계산
        stock_returns = stock_data['Close'].pct_change().dropna() * 100
        kospi_returns = kospi_data['Close'].pct_change().dropna() * 100

        # 공통 거래일 찾기
        common_dates = stock_returns.index.intersection(kospi_returns.index)

        # 최소 데이터 요구사항 확인
        min_required = min(WIN, 60)  # 최소 60일 또는 WIN일 중 작은 값
        if len(common_dates) < min_required:
            raise ValueError(f"Insufficient overlapping data: {len(common_dates)} days (minimum {min_required} required)")

        # 실제 사용할 윈도우 크기 조정
        actual_window = min(len(common_dates), WIN)

        # 공통 거래일 데이터 추출
        y = stock_returns[common_dates]
        x = kospi_returns[common_dates]

        # 실제 윈도우 크기에 맞춰 최근 데이터 추출
        ys = y.iloc[-actual_window:]
        xs = sm.add_constant(x.iloc[-actual_window:])

        # Newey-West HAC 표준오차로 OLS 회귀
        maxlags = self.nw_maxlags(actual_window)
        fit = sm.OLS(ys, xs).fit(cov_type="HAC", cov_kwds={"maxlags": maxlags})

        beta = float(fit.params.iloc[1])
        r_squared = float(fit.rsquared)
        t_stat = float(fit.tvalues.iloc[1])

        # 신호등 색상 결정 (원본 로직 유지)
        if beta > 1.5 and r_squared >= 0.3:
            color = "red"          # 시장 충격에 1.5배 이상 반응
            signal = "고위험"
            summary_ko = f"베타가 {beta:.2f}로 시장보다 높은 변동성을 보여 고위험 종목입니다."
        elif 0.8 <= beta <= 1.3 and r_squared >= 0.3:
            color = "green"        # 시장과 비슷한 수준
            signal = "적정위험"
            summary_ko = f"베타가 {beta:.2f}로 시장과 비슷한 변동성을 보입니다."
        else:
            color = "yellow"       # 저베타 방어주거나 R^2 낮음
            signal = "중간위험"
            summary_ko = f"베타가 {beta:.2f}로 저베타 방어주이거나 시장과의 상관관계가 낮습니다."

        return {
            "symbol": symbol,
            "date": common_dates[-1].date().isoformat(),
            "beta_market": round(beta, 4),
            "r2_market": round(r_squared, 4),
            "tstat_market": round(t_stat, 4),
            "window_size": actual_window,
            "maxlags": maxlags,
            "traffic_light": color,
            "signal": signal,
            "summary_ko": summary_ko,
            "timestamp": datetime.now().isoformat()
        }
