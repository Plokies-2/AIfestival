from http.server import BaseHTTPRequestHandler
import json
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
import urllib.parse
import numpy as np
import statsmodels.api as sm
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
            
            # 산업 분석 계산
            result = self.calculate_industry_analysis(symbol)
            
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
    
    def get_industry_peers(self, symbol):
        """산업 동종 기업들 반환 (간단한 매핑)"""
        # 한국 주요 기업들의 산업별 분류
        industry_mapping = {
            # 반도체
            '000660': ['000660', '005930', '042700'],  # SK하이닉스, 삼성전자, 한미반도체
            '005930': ['005930', '000660', '042700'],  # 삼성전자, SK하이닉스, 한미반도체

            # 조선업
            '329180': ['329180', '042660', '010140'],  # HD현대중공업, 한화오션, 삼성중공업
            '042660': ['042660', '329180', '010140'],  # 한화오션, HD현대중공업, 삼성중공업

            # 자동차
            '005380': ['005380', '000270', '012330'],  # 현대차, 기아, 현대모비스
            '000270': ['000270', '005380', '012330'],  # 기아, 현대차, 현대모비스

            # 화학
            '051910': ['051910', '009830', '011170'],  # LG화학, 한화솔루션, 롯데케미칼
            '009830': ['009830', '051910', '011170'],  # 한화솔루션, LG화학, 롯데케미칼

            # 금융
            '055550': ['055550', '086790', '316140'],  # 신한지주, 하나금융지주, 우리금융지주
            '086790': ['086790', '055550', '316140'],  # 하나금융지주, 신한지주, 우리금융지주

            # 바이오
            '207940': ['207940', '068270', '326030'],  # 삼성바이오로직스, 셀트리온, 에스케이바이오팜
            '068270': ['068270', '207940', '326030'],  # 셀트리온, 삼성바이오로직스, 에스케이바이오팜
        }

        # 6자리 숫자로 변환
        clean_symbol = symbol.replace('.KS', '')

        # 매핑에서 찾기
        if clean_symbol in industry_mapping:
            return industry_mapping[clean_symbol]

        # 매핑에 없으면 KOSPI 대표 종목들 사용
        return ['005930', '000660', '005380', '051910']  # 삼성전자, SK하이닉스, 현대차, LG화학
    
    def load_industry_portfolio_data(self, symbol):
        """산업 동종 기업들의 포트폴리오 데이터 로드"""
        peers = self.get_industry_peers(symbol)
        industry_data = {}

        for peer in peers:
            try:
                # .KS 확장자 추가
                peer_symbol = f"{peer}.KS" if not peer.endswith('.KS') else peer
                peer_data = self.load_stock_data(peer_symbol)

                if peer_data is not None and 'Close' in peer_data.columns:
                    industry_data[peer] = peer_data['Close']

            except Exception as e:
                print(f"Warning: Failed to load data for {peer}: {e}")
                continue

        if not industry_data:
            raise ValueError("No industry peer data available")

        # DataFrame으로 결합하고 동일가중 평균 계산
        df = pd.DataFrame(industry_data)
        df = df.dropna(how='all')

        # 동일가중 평균 수익률
        industry_portfolio = df.mean(axis=1)

        return industry_portfolio

    def calculate_industry_analysis(self, symbol):
        """산업 분석 계산 (동종업계 포트폴리오 대비)"""
        WIN = 126  # 6개월 (영업일)

        # 개별 종목 데이터 로드
        stock_data = self.load_stock_data(symbol)

        # 산업 포트폴리오 데이터 로드
        try:
            industry_portfolio = self.load_industry_portfolio_data(symbol)
        except Exception as e:
            # 산업 포트폴리오 로드 실패 시 KOSPI 지수 사용
            print(f"Warning: Industry portfolio load failed, using KOSPI: {e}")
            kospi_data = self.load_stock_data("^KS11")
            industry_portfolio = kospi_data['Close']

        # 필요한 컬럼이 있는지 확인
        if 'Close' not in stock_data.columns:
            raise ValueError("Missing 'Close' column in stock data")

        # 데이터 정리 및 정렬
        stock_data = stock_data.dropna()

        # 인덱스 timezone 정규화
        if stock_data.index.tz is not None:
            stock_data.index = stock_data.index.tz_localize(None)
        if industry_portfolio.index.tz is not None:
            industry_portfolio.index = industry_portfolio.index.tz_localize(None)

        # 수익률(%) 계산
        stock_returns = stock_data['Close'].pct_change().dropna() * 100
        industry_returns = industry_portfolio.pct_change().dropna() * 100

        # 공통 거래일 찾기
        common_dates = stock_returns.index.intersection(industry_returns.index)

        # 최소 데이터 요구사항 확인
        min_required = min(WIN, 60)
        if len(common_dates) < min_required:
            raise ValueError(f"Insufficient overlapping data: {len(common_dates)} days")

        # 실제 사용할 윈도우 크기 조정
        actual_window = min(len(common_dates), WIN)

        # 공통 거래일 데이터 추출
        y = stock_returns[common_dates]
        x = industry_returns[common_dates]

        # 실제 윈도우 크기에 맞춰 최근 데이터 추출
        ys = y.iloc[-actual_window:]
        xs = sm.add_constant(x.iloc[-actual_window:])

        # Newey-West HAC 표준오차로 OLS 회귀
        maxlags = min(5, actual_window // 10)  # 적절한 maxlags 설정
        fit = sm.OLS(ys, xs).fit(cov_type="HAC", cov_kwds={"maxlags": maxlags})

        beta = float(fit.params.iloc[1])
        r_squared = float(fit.rsquared)
        t_stat = float(fit.tvalues.iloc[1])

        # 신호등 색상 결정 (원본 로직 적용)
        if beta > 1.2 and r_squared >= 0.5:
            color = "red"          # 산업 대비 고위험
            signal = "산업 대비 고위험"
            summary_ko = f"산업 베타가 {beta:.2f}로 동종업계보다 높은 변동성을 보여 고위험입니다."
        elif 0.8 <= beta <= 1.2 and r_squared >= 0.3:
            color = "green"        # 산업 평균
            signal = "산업 평균"
            summary_ko = f"산업 베타가 {beta:.2f}로 동종업계와 비슷한 변동성을 보입니다."
        else:
            color = "yellow"       # 저베타 또는 낮은 상관관계
            signal = "산업 대비 저위험"
            summary_ko = f"산업 베타가 {beta:.2f}로 동종업계보다 낮은 변동성을 보이거나 상관관계가 낮습니다."

        return {
            "symbol": symbol,
            "date": common_dates[-1].date().isoformat(),
            "beta": round(beta, 4),
            "r2": round(r_squared, 4),
            "tstat": round(t_stat, 4),
            "window_size": actual_window,
            "maxlags": maxlags,
            "traffic_light": color,
            "signal": signal,
            "summary_ko": summary_ko,
            "timestamp": datetime.now().isoformat()
        }
