from http.server import BaseHTTPRequestHandler
import json
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
import urllib.parse
import numpy as np
from arch import arch_model
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
            
            # GARCH 분석 계산
            result = self.calculate_garch_analysis(symbol)
            
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
    
    def calculate_garch_analysis(self, symbol):
        """GARCH(1,1) 모델을 사용한 변동성 분석"""
        # 데이터 로드
        df = self.load_stock_data(symbol)

        # 필요한 컬럼이 있는지 확인
        if 'Close' not in df.columns:
            raise ValueError("Missing 'Close' column in data")

        # 데이터 정리
        df = df.dropna()
        if len(df) < 100:  # GARCH 모델을 위해 최소 100일 데이터 필요
            raise ValueError(f"Insufficient data for GARCH calculation: {len(df)} days")

        # 데이터 처리
        df = df.sort_index()
        prices = df['Close']

        # 일일 수익률 계산 (백분율로 변환)
        returns = prices.pct_change().dropna() * 100

        if len(returns) < 50:
            raise ValueError(f"Insufficient return data: {len(returns)} days")

        try:
            # GARCH(1,1) 모델 적합
            model = arch_model(returns, vol='Garch', p=1, q=1, dist='normal')
            fitted_model = model.fit(disp='off')

            # 모델 결과 추출
            params = fitted_model.params
            omega = params['omega']
            alpha = params['alpha[1]']
            beta = params['beta[1]']

            # 조건부 변동성 예측 (1일 앞)
            forecast = fitted_model.forecast(horizon=1)
            conditional_volatility = np.sqrt(forecast.variance.iloc[-1, 0])

            # 연율화 변동성
            annualized_volatility = conditional_volatility * np.sqrt(252) / 100

            # 무조건부 변동성 (장기 평균)
            unconditional_volatility = np.sqrt(omega / (1 - alpha - beta)) * np.sqrt(252) / 100

            # 변동성 지속성 (alpha + beta)
            persistence = alpha + beta

            # VaR 계산 (정규분포 가정)
            var_95 = -1.645 * conditional_volatility / 100  # 5% VaR
            var_99 = -2.326 * conditional_volatility / 100  # 1% VaR

            # 최근 실현 변동성과 비교
            recent_returns = returns.tail(30)
            recent_volatility = recent_returns.std() * np.sqrt(252) / 100

            # 신호등 색상 결정
            if annualized_volatility > 0.4:  # 40% 이상
                color = "red"
                signal = "고위험"
                summary_ko = f"GARCH 모델 예측 변동성이 {annualized_volatility*100:.1f}%로 매우 높아 고위험 종목입니다."
            elif annualized_volatility < 0.2:  # 20% 미만
                color = "green"
                signal = "저위험"
                summary_ko = f"GARCH 모델 예측 변동성이 {annualized_volatility*100:.1f}%로 낮아 안정적인 종목입니다."
            else:
                color = "yellow"
                signal = "중간위험"
                summary_ko = f"GARCH 모델 예측 변동성이 {annualized_volatility*100:.1f}%로 보통 수준입니다."

            return {
                "symbol": symbol,
                "date": df.index[-1].date().isoformat(),
                "sigma_pct": round(float(annualized_volatility * 100), 2),  # 예측 변동성 (%)
                "unconditional_vol_pct": round(float(unconditional_volatility * 100), 2),  # 장기 평균 변동성 (%)
                "persistence": round(float(persistence), 4),  # 변동성 지속성
                "omega": round(float(omega), 6),  # GARCH 파라미터
                "alpha": round(float(alpha), 4),  # ARCH 효과
                "beta": round(float(beta), 4),   # GARCH 효과
                "var95_pct": round(float(var_95 * 100), 2),  # 95% VaR (%)
                "var99_pct": round(float(var_99 * 100), 2),  # 99% VaR (%)
                "recent_volatility_pct": round(float(recent_volatility * 100), 2),  # 최근 실현 변동성 (%)
                "traffic_light": color,
                "signal": signal,
                "summary_ko": summary_ko,
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            # GARCH 모델 적합 실패 시 간단한 변동성 계산으로 대체
            daily_volatility = returns.std() / 100
            annualized_volatility = daily_volatility * np.sqrt(252)

            var_95 = np.percentile(returns, 5) / 100
            var_99 = np.percentile(returns, 1) / 100

            recent_returns = returns.tail(30)
            recent_volatility = recent_returns.std() * np.sqrt(252) / 100

            if annualized_volatility > 0.4:
                color = "red"
                signal = "고위험"
                summary_ko = f"변동성이 {annualized_volatility*100:.1f}%로 매우 높아 고위험 종목입니다."
            elif annualized_volatility < 0.2:
                color = "green"
                signal = "저위험"
                summary_ko = f"변동성이 {annualized_volatility*100:.1f}%로 낮아 안정적인 종목입니다."
            else:
                color = "yellow"
                signal = "중간위험"
                summary_ko = f"변동성이 {annualized_volatility*100:.1f}%로 보통 수준입니다."

            return {
                "symbol": symbol,
                "date": df.index[-1].date().isoformat(),
                "sigma_pct": round(float(annualized_volatility * 100), 2),
                "var95_pct": round(float(var_95 * 100), 2),
                "var99_pct": round(float(var_99 * 100), 2),
                "recent_volatility_pct": round(float(recent_volatility * 100), 2),
                "error": f"GARCH model fitting failed: {str(e)}",
                "traffic_light": color,
                "signal": signal,
                "summary_ko": summary_ko,
                "timestamp": datetime.now().isoformat()
            }
