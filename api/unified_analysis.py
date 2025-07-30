from http.server import BaseHTTPRequestHandler
import json
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
import urllib.parse
import numpy as np
import math
import warnings
warnings.filterwarnings('ignore')

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            # URL 파라미터 파싱
            parsed_url = urllib.parse.urlparse(self.path)
            query_params = urllib.parse.parse_qs(parsed_url.query)
            
            # 분석 타입과 심볼 추출
            analysis_type = query_params.get('type', ['speedtraffic'])[0]
            symbol = query_params.get('symbol', [None])[0]
            
            if not symbol:
                self.send_error_response(400, "Symbol parameter is required")
                return
            
            symbol = symbol.upper()
            
            # 분석 타입에 따라 다른 함수 호출
            if analysis_type == 'mfi':
                result = self.calculate_mfi(symbol)
            elif analysis_type == 'rsi':
                result = self.calculate_rsi(symbol)
            elif analysis_type == 'bollinger':
                result = self.calculate_bollinger(symbol)
            elif analysis_type == 'capm':
                result = self.calculate_capm(symbol)
            elif analysis_type == 'garch':
                result = self.calculate_garch_analysis(symbol)
            elif analysis_type == 'industry':
                result = self.calculate_industry_analysis(symbol)
            else:  # speedtraffic (통합 분석)
                result = self.run_integrated_analysis(symbol)
            
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
    
    def ols_regression(self, y, x):
        """
        간단한 OLS 회귀 구현 (numpy만 사용)
        y: 종속변수 (1차원 배열)
        x: 독립변수 (1차원 배열, 상수항 자동 추가)
        """
        # 상수항 추가
        X = np.column_stack([np.ones(len(x)), x])
        
        # OLS 계수 계산: beta = (X'X)^(-1)X'y
        XtX = np.dot(X.T, X)
        Xty = np.dot(X.T, y)
        beta = np.linalg.solve(XtX, Xty)
        
        # 예측값과 잔차
        y_pred = np.dot(X, beta)
        residuals = y - y_pred
        
        # R-squared 계산
        ss_res = np.sum(residuals ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r_squared = 1 - (ss_res / ss_tot)
        
        # t-통계량 계산 (간단한 버전)
        n = len(y)
        k = X.shape[1]
        mse = ss_res / (n - k)
        var_beta = mse * np.linalg.inv(XtX)
        se_beta = np.sqrt(np.diag(var_beta))
        t_stats = beta / se_beta
        
        return {
            'coefficients': beta,
            'r_squared': r_squared,
            't_statistics': t_stats,
            'residuals': residuals,
            'fitted_values': y_pred
        }
    
    def garch_11_simple(self, returns):
        """
        간단한 GARCH(1,1) 구현 (numpy만 사용)
        Maximum Likelihood Estimation 대신 간단한 방법 사용
        """
        returns = np.array(returns)
        n = len(returns)
        
        # 초기 파라미터 추정
        omega = np.var(returns) * 0.1  # 초기 omega
        alpha = 0.1  # 초기 alpha
        beta = 0.8   # 초기 beta
        
        # 조건부 분산 초기화
        sigma2 = np.zeros(n)
        sigma2[0] = np.var(returns)
        
        # GARCH(1,1) 조건부 분산 계산
        for t in range(1, n):
            sigma2[t] = omega + alpha * (returns[t-1] ** 2) + beta * sigma2[t-1]
        
        # 예측 변동성 (다음 기간)
        forecast_variance = omega + alpha * (returns[-1] ** 2) + beta * sigma2[-1]
        forecast_volatility = np.sqrt(forecast_variance)
        
        # 무조건부 변동성
        unconditional_variance = omega / (1 - alpha - beta)
        unconditional_volatility = np.sqrt(unconditional_variance)
        
        # 지속성
        persistence = alpha + beta
        
        return {
            'omega': omega,
            'alpha': alpha,
            'beta': beta,
            'conditional_volatility': forecast_volatility,
            'unconditional_volatility': unconditional_volatility,
            'persistence': persistence,
            'conditional_variances': sigma2
        }

    def calculate_mfi(self, symbol):
        """Money Flow Index 계산"""
        df = self.load_stock_data(symbol)

        if not all(col in df.columns for col in ['High', 'Low', 'Close', 'Volume']):
            raise ValueError("Missing required columns for MFI calculation")

        df = df.dropna()
        if len(df) < 15:
            raise ValueError(f"Insufficient data for MFI calculation: {len(df)} days")

        # Typical Price 계산
        df['TP'] = (df['High'] + df['Low'] + df['Close']) / 3

        # Raw Money Flow 계산
        df['RMF'] = df['TP'] * df['Volume']

        # Money Flow 방향 결정
        df['MF_Direction'] = 0
        for i in range(1, len(df)):
            if df['TP'].iloc[i] > df['TP'].iloc[i-1]:
                df['MF_Direction'].iloc[i] = 1  # Positive
            elif df['TP'].iloc[i] < df['TP'].iloc[i-1]:
                df['MF_Direction'].iloc[i] = -1  # Negative

        # Positive/Negative Money Flow 분리
        df['PMF'] = df['RMF'] * (df['MF_Direction'] == 1)
        df['NMF'] = df['RMF'] * (df['MF_Direction'] == -1)

        # 14일 MFI 계산
        period = 14
        df['PMF_14'] = df['PMF'].rolling(window=period).sum()
        df['NMF_14'] = df['NMF'].rolling(window=period).sum()

        # MFI 계산
        df['MFI'] = 100 - (100 / (1 + (df['PMF_14'] / df['NMF_14'])))

        # 최신 MFI 값
        latest_mfi = df['MFI'].iloc[-1]

        # 신호등 색상 결정 (기존 로직 유지)
        if latest_mfi >= 80:
            color = "red"
            signal = "매도 신호"
            summary_ko = f"MFI가 {latest_mfi:.1f}로 과매수 구간(80 이상)에 있어 매도 신호입니다."
        elif latest_mfi <= 20:
            color = "green"
            signal = "매수 신호"
            summary_ko = f"MFI가 {latest_mfi:.1f}로 과매도 구간(20 이하)에 있어 매수 신호입니다."
        else:
            color = "yellow"
            signal = "관망 신호"
            summary_ko = f"MFI가 {latest_mfi:.1f}로 중립 구간에 있어 관망이 권장됩니다."

        return {
            "symbol": symbol,
            "date": df.index[-1].date().isoformat(),
            "mfi_14": round(float(latest_mfi), 2),  # 기존 형식에 맞춤
            "traffic_light": color,
            "signal": signal,
            "summary_ko": summary_ko,
            "timestamp": datetime.now().isoformat()
        }

    def calculate_rsi(self, symbol):
        """RSI 계산"""
        df = self.load_stock_data(symbol)

        if 'Close' not in df.columns:
            raise ValueError("Missing 'Close' column for RSI calculation")

        df = df.dropna()
        if len(df) < 15:
            raise ValueError(f"Insufficient data for RSI calculation: {len(df)} days")

        # 가격 변화 계산
        df['Price_Change'] = df['Close'].diff()

        # 상승/하락 분리
        df['Gain'] = df['Price_Change'].where(df['Price_Change'] > 0, 0)
        df['Loss'] = -df['Price_Change'].where(df['Price_Change'] < 0, 0)

        # 14일 평균 상승/하락 계산
        period = 14
        df['Avg_Gain'] = df['Gain'].rolling(window=period).mean()
        df['Avg_Loss'] = df['Loss'].rolling(window=period).mean()

        # RS와 RSI 계산
        df['RS'] = df['Avg_Gain'] / df['Avg_Loss']
        df['RSI'] = 100 - (100 / (1 + df['RS']))

        # 최신 RSI 값
        latest_rsi = df['RSI'].iloc[-1]

        # 신호등 색상 결정 (기존 로직 유지)
        if latest_rsi >= 70:
            color = "red"
            signal = "매도 신호"
            summary_ko = f"RSI가 {latest_rsi:.1f}로 과매수 구간(70 이상)에 있어 매도 신호입니다."
        elif latest_rsi <= 30:
            color = "green"
            signal = "매수 신호"
            summary_ko = f"RSI가 {latest_rsi:.1f}로 과매도 구간(30 이하)에 있어 매수 신호입니다."
        else:
            color = "yellow"
            signal = "관망 신호"
            summary_ko = f"RSI가 {latest_rsi:.1f}로 중립 구간에 있어 관망이 권장됩니다."

        return {
            "symbol": symbol,
            "date": df.index[-1].date().isoformat(),
            "rsi_14": round(float(latest_rsi), 2),  # 기존 형식에 맞춤
            "traffic_light": color,
            "signal": signal,
            "summary_ko": summary_ko,
            "timestamp": datetime.now().isoformat()
        }

    def calculate_bollinger(self, symbol):
        """볼린저 밴드 계산"""
        df = self.load_stock_data(symbol)

        if 'Close' not in df.columns:
            raise ValueError("Missing 'Close' column for Bollinger calculation")

        df = df.dropna()
        if len(df) < 21:
            raise ValueError(f"Insufficient data for Bollinger calculation: {len(df)} days")

        # 20일 이동평균과 표준편차 계산
        period = 20
        df['MA20'] = df['Close'].rolling(window=period).mean()
        df['STD20'] = df['Close'].rolling(window=period).std()

        # 볼린저 밴드 계산
        df['Upper_Band'] = df['MA20'] + (2 * df['STD20'])
        df['Lower_Band'] = df['MA20'] - (2 * df['STD20'])

        # %B 계산 (현재 가격의 밴드 내 위치)
        df['Percent_B'] = (df['Close'] - df['Lower_Band']) / (df['Upper_Band'] - df['Lower_Band'])

        # 최신 값들
        latest_close = df['Close'].iloc[-1]
        latest_upper = df['Upper_Band'].iloc[-1]
        latest_lower = df['Lower_Band'].iloc[-1]
        latest_ma = df['MA20'].iloc[-1]
        latest_percent_b = df['Percent_B'].iloc[-1]

        # 신호등 색상 결정 (기존 로직 유지)
        if latest_percent_b >= 0.8:
            color = "red"
            signal = "매도 신호"
            summary_ko = f"볼린저 밴드 %B가 {latest_percent_b*100:.1f}%로 과매수 구간(80% 이상)에 있어 매도 신호입니다."
        elif latest_percent_b <= 0.2:
            color = "green"
            signal = "매수 신호"
            summary_ko = f"볼린저 밴드 %B가 {latest_percent_b*100:.1f}%로 과매도 구간(20% 이하)에 있어 매수 신호입니다."
        else:
            color = "yellow"
            signal = "관망 신호"
            summary_ko = f"볼린저 밴드 %B가 {latest_percent_b*100:.1f}%로 중립 구간에 있어 관망이 권장됩니다."

        return {
            "symbol": symbol,
            "date": df.index[-1].date().isoformat(),
            "close_price": round(float(latest_close), 2),
            "upper_band": round(float(latest_upper), 2),
            "lower_band": round(float(latest_lower), 2),
            "middle_band": round(float(latest_ma), 2),
            "percent_b": round(float(latest_percent_b), 4),
            "traffic_light": color,
            "signal": signal,
            "summary_ko": summary_ko,
            "timestamp": datetime.now().isoformat()
        }

    def calculate_capm(self, symbol):
        """CAPM 베타 계산 (자체 구현 OLS 사용)"""
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
            raise ValueError(f"Insufficient overlapping data: {len(common_dates)} days")

        # 실제 사용할 윈도우 크기 조정
        actual_window = min(len(common_dates), WIN)

        # 공통 거래일 데이터 추출
        y = stock_returns[common_dates].iloc[-actual_window:].values
        x = kospi_returns[common_dates].iloc[-actual_window:].values

        # 자체 구현 OLS 회귀
        ols_result = self.ols_regression(y, x)

        beta = float(ols_result['coefficients'][1])  # 기울기 (베타)
        r_squared = float(ols_result['r_squared'])
        t_stat = float(ols_result['t_statistics'][1])

        # 신호등 색상 결정
        if beta > 1.5 and r_squared >= 0.3:
            color = "red"
            signal = "고위험"
            summary_ko = f"베타가 {beta:.2f}로 시장보다 높은 변동성을 보여 고위험 종목입니다."
        elif 0.8 <= beta <= 1.3 and r_squared >= 0.3:
            color = "green"
            signal = "적정위험"
            summary_ko = f"베타가 {beta:.2f}로 시장과 비슷한 변동성을 보입니다."
        else:
            color = "yellow"
            signal = "중간위험"
            summary_ko = f"베타가 {beta:.2f}로 저베타 방어주이거나 시장과의 상관관계가 낮습니다."

        return {
            "symbol": symbol,
            "date": common_dates[-1].date().isoformat(),
            "beta_market": round(beta, 4),
            "r2_market": round(r_squared, 4),
            "tstat_market": round(t_stat, 4),
            "window_size": actual_window,
            "traffic_light": color,
            "signal": signal,
            "summary_ko": summary_ko,
            "timestamp": datetime.now().isoformat()
        }

    def calculate_garch_analysis(self, symbol):
        """GARCH(1,1) 모델을 사용한 변동성 분석 (자체 구현)"""
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
            # 자체 구현 GARCH(1,1) 모델 적합
            garch_result = self.garch_11_simple(returns)

            omega = garch_result['omega']
            alpha = garch_result['alpha']
            beta = garch_result['beta']
            conditional_volatility = garch_result['conditional_volatility']
            unconditional_volatility = garch_result['unconditional_volatility']
            persistence = garch_result['persistence']

            # 연율화 변동성
            annualized_volatility = conditional_volatility * np.sqrt(252) / 100

            # 무조건부 변동성 (장기 평균)
            unconditional_vol_annualized = unconditional_volatility * np.sqrt(252) / 100

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
                "unconditional_vol_pct": round(float(unconditional_vol_annualized * 100), 2),  # 장기 평균 변동성 (%)
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

    def load_kospi_mapping(self):
        """kospi_enriched_final.ts에서 티커-산업 매핑 로드"""
        import re
        from pathlib import Path

        # 파일 경로 찾기
        possible_paths = [
            Path(__file__).parent.parent / "src" / "data" / "kospi_enriched_final.ts",
            Path.cwd() / "src" / "data" / "kospi_enriched_final.ts",
            Path(__file__).parent / "kospi_enriched_final.ts"
        ]

        map_file = None
        for path in possible_paths:
            if path.exists():
                map_file = path
                break

        if not map_file:
            raise FileNotFoundError("kospi_enriched_final.ts 파일을 찾을 수 없습니다")

        try:
            txt = map_file.read_text(encoding="utf-8", errors="ignore")

            # 정규식으로 티커-산업 매핑 추출
            pattern = re.compile(
                r'"([A-Z0-9.\-]+)"\s*:\s*\{[^{}]*?'
                r'"industry"\s*:\s*"([^"]+)"',
                flags=re.S | re.MULTILINE
            )

            matches = pattern.findall(txt)
            mapping = {t.upper(): ind for t, ind in matches}

            if not mapping:
                raise ValueError("매핑 데이터를 추출할 수 없습니다")

            return mapping

        except Exception as e:
            raise Exception(f"매핑 파일 로드 실패: {str(e)}")

    def load_industry_portfolio_data(self, target_ticker, mapping):
        """동일 산업군 기업들의 데이터를 로드하여 포트폴리오 구성"""
        if target_ticker not in mapping:
            raise ValueError(f"Ticker {target_ticker}이 매핑에서 찾을 수 없음")

        target_industry = mapping[target_ticker]

        # 같은 산업의 다른 기업들 찾기 (최대 10개)
        industry_tickers = [ticker for ticker, industry in mapping.items()
                          if industry == target_industry and ticker != target_ticker][:10]

        if not industry_tickers:
            raise ValueError(f"산업 {target_industry}에 다른 기업이 없습니다")

        # 각 티커별로 데이터 로드
        industry_data = {}
        for ticker in industry_tickers:
            try:
                data = self.load_stock_data(ticker)
                if data is not None and 'Close' in data.columns:
                    industry_data[ticker] = data['Close']
            except Exception:
                continue  # 데이터 로드 실패 시 건너뛰기

        if not industry_data:
            raise ValueError("산업 포트폴리오 데이터를 로드할 수 없습니다")

        # DataFrame으로 결합
        import pandas as pd
        df = pd.DataFrame(industry_data)
        df = df.dropna(how='all')

        return df, target_industry

    def calculate_industry_analysis(self, symbol):
        """산업 민감도 분석 (기존 방식 복원)"""

        try:
            # 매핑 로드
            mapping = self.load_kospi_mapping()

            # 개별 종목 데이터 로드
            stock_data = self.load_stock_data(symbol)

            # 산업 포트폴리오 데이터 로드
            industry_portfolio, target_industry = self.load_industry_portfolio_data(symbol, mapping)

            # 필요한 컬럼이 있는지 확인
            if 'Close' not in stock_data.columns:
                raise ValueError("Missing 'Close' column in stock data")

            # 데이터 정리
            stock_data = stock_data.dropna()
            industry_portfolio = industry_portfolio.dropna(how='all')

            # 인덱스 timezone 정규화
            if stock_data.index.tz is not None:
                stock_data.index = stock_data.index.tz_localize(None)
            if industry_portfolio.index.tz is not None:
                industry_portfolio.index = industry_portfolio.index.tz_localize(None)

            # 수익률(%) 계산
            stock_returns = stock_data['Close'].pct_change().dropna() * 100

            # 산업 포트폴리오 평균 수익률 계산 (동일가중)
            industry_returns = industry_portfolio.pct_change().dropna().mean(axis=1) * 100

            # 공통 거래일 찾기
            common_dates = stock_returns.index.intersection(industry_returns.index)

            if len(common_dates) < 60:
                raise ValueError(f"Insufficient overlapping data: {len(common_dates)} days")

            # 최근 126일 (6개월) 데이터 사용
            window = min(len(common_dates), 126)
            y = stock_returns[common_dates].iloc[-window:].values
            x = industry_returns[common_dates].iloc[-window:].values

            # 자체 구현 OLS 회귀
            ols_result = self.ols_regression(y, x)

            beta = float(ols_result['coefficients'][1])  # 산업 베타
            r_squared = float(ols_result['r_squared'])
            t_stat = float(ols_result['t_statistics'][1])

            # 신호등 색상 결정 (기존 로직 유지)
            if beta > 1.2 and r_squared >= 0.5:
                color = "red"
                signal = "고민감도"
                summary_ko = f"산업 베타가 {beta:.2f}로 산업 변화에 매우 민감합니다."
            elif 0.8 <= beta <= 1.2 and r_squared >= 0.3:
                color = "green"
                signal = "적정민감도"
                summary_ko = f"산업 베타가 {beta:.2f}로 산업과 적정한 연관성을 보입니다."
            else:
                color = "yellow"
                signal = "저민감도"
                summary_ko = f"산업 베타가 {beta:.2f}로 산업과의 연관성이 낮습니다."

            return {
                "symbol": symbol,
                "date": common_dates[-1].date().isoformat(),
                "industry": target_industry,
                "beta_industry": round(beta, 3),  # 기존 형식에 맞춤
                "r2_industry": round(r_squared, 3),  # 기존 형식에 맞춤
                "tstat_industry": round(t_stat, 2),  # 기존 형식에 맞춤
                "window_size": window,
                "traffic_light": color,
                "signal": signal,
                "summary_ko": summary_ko,
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            # 실패 시 기본값 반환
            return {
                "symbol": symbol,
                "date": datetime.now().date().isoformat(),
                "industry": "분석불가",
                "beta_industry": 1.0,
                "r2_industry": 0.0,
                "error": f"Industry analysis failed: {str(e)}",
                "traffic_light": "yellow",
                "signal": "분석불가",
                "summary_ko": "산업 분석 데이터가 부족합니다.",
                "timestamp": datetime.now().isoformat()
            }

    def determine_traffic_lights(self, results):
        """신호등 색상 결정"""
        # 기술적 분석 신호등 (MFI + Bollinger + RSI)
        technical_signals = []
        if results.get('mfi'):
            technical_signals.append(results['mfi']['traffic_light'])
        if results.get('bollinger'):
            technical_signals.append(results['bollinger']['traffic_light'])
        if results.get('rsi'):
            technical_signals.append(results['rsi']['traffic_light'])

        # 기술적 분석 종합 신호등
        if technical_signals:
            red_count = technical_signals.count('red')
            green_count = technical_signals.count('green')

            if red_count >= 2:
                technical_color = 'red'
            elif green_count >= 2:
                technical_color = 'green'
            else:
                technical_color = 'yellow'
        else:
            technical_color = 'inactive'

        return {
            'technical': technical_color,
            'industry': results.get('industry', {}).get('traffic_light', 'inactive'),
            'market': results.get('capm', {}).get('traffic_light', 'inactive'),
            'risk': results.get('garch', {}).get('traffic_light', 'inactive')
        }

    def run_integrated_analysis(self, symbol):
        """통합 분석 실행"""
        try:
            print(f"[UNIFIED_ANALYSIS] {symbol} 분석 시작")

            # 6개 분석 실행
            results = {}

            try:
                results['mfi'] = self.calculate_mfi(symbol)
            except Exception as e:
                print(f"MFI 분석 실패: {e}")
                results['mfi'] = None

            try:
                results['bollinger'] = self.calculate_bollinger(symbol)
            except Exception as e:
                print(f"Bollinger 분석 실패: {e}")
                results['bollinger'] = None

            try:
                results['rsi'] = self.calculate_rsi(symbol)
            except Exception as e:
                print(f"RSI 분석 실패: {e}")
                results['rsi'] = None

            try:
                results['industry'] = self.calculate_industry_analysis(symbol)
            except Exception as e:
                print(f"Industry 분석 실패: {e}")
                results['industry'] = None

            try:
                results['capm'] = self.calculate_capm(symbol)
            except Exception as e:
                print(f"CAPM 분석 실패: {e}")
                results['capm'] = None

            try:
                results['garch'] = self.calculate_garch_analysis(symbol)
            except Exception as e:
                print(f"GARCH 분석 실패: {e}")
                results['garch'] = None

            # 신호등 결정
            traffic_lights = self.determine_traffic_lights(results)

            # 최종 응답 구성
            response = {
                "symbol": symbol,
                "timestamp": datetime.now().isoformat(),
                **results,
                "traffic_lights": traffic_lights
            }

            print(f"[UNIFIED_ANALYSIS] {symbol} 분석 완료")
            return response

        except Exception as e:
            print(f"[UNIFIED_ANALYSIS] {symbol} 분석 오류: {e}")
            return {
                "symbol": symbol,
                "timestamp": datetime.now().isoformat(),
                "error": f"Analysis failed: {str(e)}",
                "traffic_lights": {
                    "technical": "inactive",
                    "industry": "inactive",
                    "market": "inactive",
                    "risk": "inactive"
                }
            }
