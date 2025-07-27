# src/services/industry_regression_service.py
"""
산업군 포트폴리오(동일가중) ↔ 개별 종목 OLS 회귀, 신호등 JSON 출력
────────────────────────────────────────────────────────────────────────
필수 파일 2개  ─ 위치 고정
  1) sp500_enriched_final.ts  (티커 ↔ industry 매핑)
  2) sp500_adj_close_3y.csv   (3년치 수정종가, Date 컬럼 포함)
────────────────────────────────────────────────────────────────────────
"""

import sys, json, re
from pathlib import Path
import pandas as pd
import statsmodels.api as sm
from datetime import datetime, timedelta

# yfinance 가져오기 시도
try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False
    print("Warning: yfinance not available, falling back to CSV", file=sys.stderr)

# ――― 경로 상수 ―――
BASE_DIR   = Path(__file__).resolve().parent              # …/src/services
DATA_DIR   = BASE_DIR.parent / "data"                     # …/src/data
MAP_FILE   = DATA_DIR / "sp500_enriched_final.ts"
PRICE_FILE = DATA_DIR / "sp500_adj_close_3y.csv"
WIN = 126  # 6 개월(거래일 21×6)

# ――― 매핑 로드 ―――
def load_mapping() -> dict:
    """
    sp500_enriched_final.ts 전체를 스캔해
    {TICKER: industry} 딕셔너리를 만든다.
    따옴표·줄바꿈 모두 허용.
    """
    if not MAP_FILE.exists():
        raise FileNotFoundError(f"매핑 파일이 없습니다 → {MAP_FILE}")

    txt = MAP_FILE.read_text(encoding="utf-8", errors="ignore")

    # ① "AAPL": { … industry: "Computer …" }  형식 캡처
    #    - 1번 그룹: Ticker  (따옴표 O/X)
    #    - 2번 그룹: Industry 문자열
    pattern = re.compile(
        r'["\']?([A-Z.\-]+)["\']?\s*:'      # Ticker
        r'\s*\{[^{}]*?'                     # 시작 { … }
        r'industry\s*:\s*["\']([^"\']+)["\']',  # industry 필드
        flags=re.S
    )

    mapping = {t.upper(): ind for t, ind in pattern.findall(txt)}
    if not mapping:
        raise ValueError(
            "Ticker-industry 매핑을 추출하지 못했습니다. "
            "파일 형식이 예상과 다른지 확인하십시오."
        )

    return mapping

# ――― 가격 로드 / 수익률 ―――
def load_realtime_data(symbol):
    """
    Load realtime data using yfinance for a single symbol
    Returns DataFrame with OHLCV data for the past 3 years
    """
    if not YFINANCE_AVAILABLE:
        return None

    try:
        print(f"🔄 Loading realtime data for {symbol} using yfinance...", file=sys.stderr)

        # 3년간의 데이터 가져오기
        end_date = datetime.now()
        start_date = end_date - timedelta(days=3*365)

        ticker_obj = yf.Ticker(symbol)
        hist = ticker_obj.history(start=start_date, end=end_date)

        if hist.empty:
            print(f"❌ No realtime data found for {symbol}", file=sys.stderr)
            return None

        # 컬럼명 표준화 및 Close 컬럼 생성
        hist.columns = [col.replace(' ', '').title() for col in hist.columns]
        hist.rename(columns={'Adjclose': 'AdjClose'}, inplace=True)

        # Close 컬럼이 없으면 AdjClose 사용
        if 'Close' not in hist.columns and 'AdjClose' in hist.columns:
            hist['Close'] = hist['AdjClose']

        print(f"✅ Loaded {len(hist)} days of realtime data for {symbol}", file=sys.stderr)
        return hist

    except Exception as e:
        print(f"❌ Error loading realtime data for {symbol}: {e}", file=sys.stderr)
        return None

def load_industry_portfolio_data(target_ticker):
    """
    특정 티커와 같은 산업의 다른 기업들 데이터를 개별적으로 로드
    """
    try:
        # 매핑에서 타겟 티커의 산업 찾기
        mapping = load_mapping()
        if target_ticker not in mapping:
            raise ValueError(f"Ticker {target_ticker} not found in mapping")

        target_industry = mapping[target_ticker]
        print(f"🏭 Target industry for {target_ticker}: {target_industry}", file=sys.stderr)

        # 같은 산업의 다른 기업들 찾기
        industry_tickers = [ticker for ticker, industry in mapping.items()
                          if industry == target_industry and ticker != target_ticker]

        print(f"📊 Found {len(industry_tickers)} other companies in {target_industry} industry", file=sys.stderr)

        # 각 티커별로 개별 데이터 로드 (Rate Limit 방지)
        industry_data = {}
        for ticker in industry_tickers[:10]:  # 최대 10개만 사용하여 Rate Limit 방지
            try:
                data = load_realtime_data(ticker)
                if data is not None and 'Close' in data.columns:
                    industry_data[ticker] = data['Close']
                    print(f"✅ Loaded data for {ticker}", file=sys.stderr)
                else:
                    print(f"⚠️ No data for {ticker}", file=sys.stderr)
            except Exception as e:
                print(f"❌ Error loading {ticker}: {e}", file=sys.stderr)
                continue

        if not industry_data:
            print(f"❌ No industry data loaded", file=sys.stderr)
            return None

        # DataFrame으로 결합
        df = pd.DataFrame(industry_data)
        df = df.dropna(how='all')

        print(f"✅ Created industry portfolio with {len(df.columns)} companies, {len(df)} days", file=sys.stderr)
        return df

    except Exception as e:
        print(f"❌ Error creating industry portfolio: {e}", file=sys.stderr)
        return None

def load_target_and_industry_data(target_ticker):
    """
    타겟 티커와 산업 포트폴리오 데이터 로드
    """
    # 타겟 티커 데이터 로드
    target_data = load_realtime_data(target_ticker)
    if target_data is None or 'Close' not in target_data.columns:
        print(f"❌ Failed to load target ticker data for {target_ticker}", file=sys.stderr)
        return None, None

    # 산업 포트폴리오 데이터 로드
    industry_data = load_industry_portfolio_data(target_ticker)
    if industry_data is None:
        print(f"❌ Failed to load industry portfolio data for {target_ticker}", file=sys.stderr)
        return None, None

    return target_data['Close'], industry_data

def pct(df: pd.DataFrame) -> pd.DataFrame:
    return df.pct_change().dropna(how="all")

# ――― 최근 WIN일 OLS ―――
def recent_ols(y: pd.Series, x: pd.Series, win: int = WIN):
    if len(y) < win or len(x) < win:
        raise ValueError(f"데이터 {win} 개 미만")
    ys = y.iloc[-win:]
    xs = sm.add_constant(x.iloc[-win:])
    fit = sm.OLS(ys, xs).fit(cov_type="HAC", cov_kwds={"maxlags": 5})

    # ── 여기부터 변경 ──
    beta   = float(fit.params.iloc[1])    # 두 번째 요소(독립변수 계수)
    tstat  = float(fit.tvalues.iloc[1])   # 대응 t-통계량
    r2     = float(fit.rsquared)
    return beta, r2, tstat


# ――― 신호등 분류 ―――
def traffic(beta: float, r2: float) -> str:
    if beta > 1.2 and r2 >= 0.5:
        return "red"
    if 0.8 <= beta <= 1.2 and r2 >= 0.3:
        return "green"
    return "yellow"

# ――― 메인 ―――
def main(ticker: str):
    ticker = ticker.upper()
    mapping = load_mapping()
    if ticker not in mapping:
        raise KeyError(f"{ticker} ➜ 매핑 파일에 존재하지 않습니다.")

    industry = mapping[ticker]

    # 타겟 티커와 산업 데이터 로드
    target_prices, industry_prices = load_target_and_industry_data(ticker)

    if target_prices is None or industry_prices is None:
        print(f"📁 Falling back to CSV data for industry regression", file=sys.stderr)
        # CSV 폴백
        try:
            if not PRICE_FILE.exists():
                raise FileNotFoundError(f"가격 파일 없음 → {PRICE_FILE}")
            prices = pd.read_csv(PRICE_FILE)
            if "Date" not in prices.columns:
                raise ValueError("'Date' 컬럼이 없습니다 → CSV 형식 확인")
            prices["Date"] = pd.to_datetime(prices["Date"])
            prices.set_index("Date", inplace=True)
            prices = prices.apply(pd.to_numeric, errors="coerce")

            if ticker not in prices.columns:
                raise KeyError(f"{ticker} ➜ 가격 CSV에 열이 없습니다.")

            peers = [t for t, ind in mapping.items() if ind == industry]
            # 종목-산업군 수익률
            ind_ret = pct(prices[peers]).mean(axis=1)
            stk_ret = pct(prices[[ticker]])[ticker]

        except Exception as e:
            print(f"Error with CSV fallback: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        # yfinance 데이터 사용
        print(f"📊 Using realtime data for industry regression", file=sys.stderr)
        # 산업 포트폴리오 평균 수익률 계산
        ind_ret = pct(industry_prices).mean(axis=1)
        stk_ret = pct(pd.DataFrame({ticker: target_prices}))[ticker]

    common = stk_ret.index.intersection(ind_ret.index)
    ind_ret, stk_ret = ind_ret[common], stk_ret[common]

    beta, r2, tstat = recent_ols(stk_ret, ind_ret)

    out = {
        "symbol"  : ticker,
        "industry": industry,
        "date"    : str(common[-1].date()),
        "beta"    : round(beta, 3),
        "r2"      : round(r2, 3),
        "tstat"   : round(tstat, 2),
        "traffic_light": traffic(beta, r2)
    }
    # Fix Unicode encoding for Windows backend compatibility
    try:
        print(json.dumps(out, ensure_ascii=True))
    except UnicodeEncodeError:
        # Fallback: sanitize industry name and retry
        out["industry"] = out["industry"].encode('ascii', 'ignore').decode('ascii')
        print(json.dumps(out, ensure_ascii=True))

# ――― 실행 ―――
if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python industry_regression_service.py <TICKER>")
    try:
        main(sys.argv[1])
    except Exception as e:
        # 어떤 오류로 종료되는지 콘솔에 바로 보여줌
        import traceback, sys as _s
        traceback.print_exc()
        _s.exit(1)
