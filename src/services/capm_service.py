"""
CAPM: S&P 500 지수(^GSPC) ↔ 개별 종목 6 개월(126 영업일) Rolling OLS
Newey-West(HAC) 표준오차 + Andrew (1991) maxlags 규칙 적용
JSON :
{
  symbol, date, beta_market, r2_market, tstat_market, traffic_light
}
"""

import sys, json, math, warnings
import pandas as pd
import statsmodels.api as sm
from datetime import datetime, timedelta

# 데이터 캐시 서비스 가져오기
try:
    from data_cache_service import get_cached_data, convert_to_dataframe
    CACHE_SERVICE_AVAILABLE = True
except ImportError:
    CACHE_SERVICE_AVAILABLE = False
    print("Warning: data_cache_service not available, falling back to direct yfinance", file=sys.stderr)

# yfinance 가져오기 시도 (폴백용)
try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False
    print("Warning: yfinance not available", file=sys.stderr)

WIN = 126   # 6 개월(영업일)

def load_cached_data(symbol):
    """
    캐시된 데이터를 사용하여 DataFrame 반환
    """
    if CACHE_SERVICE_AVAILABLE:
        try:
            print(f"📦 Loading cached data for {symbol}...", file=sys.stderr)
            cached_data = get_cached_data(symbol)
            if cached_data:
                df = convert_to_dataframe(cached_data, 'ticker')
                if df is not None and not df.empty:
                    print(f"✅ Loaded {len(df)} days of cached data for {symbol}", file=sys.stderr)
                    return df
        except Exception as e:
            print(f"❌ Error loading cached data: {e}", file=sys.stderr)

    # 캐시 서비스 실패 시 직접 yfinance 사용
    return load_realtime_data_direct(symbol)

def load_realtime_data_direct(symbol):
    """
    직접 yfinance를 사용하여 데이터 로드 (폴백용)
    """
    if not YFINANCE_AVAILABLE:
        return None

    try:
        print(f"🔄 Loading realtime data for {symbol} using yfinance directly...", file=sys.stderr)

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

# ── Newey-West maxlags(Andrews 1991) ──────────────────────────────────
def nw_maxlags(n):
    return int(math.floor(4 * (n / 100) ** (2 / 9)))

# ── CAPM 회귀 함수 ────────────────────────────────────────────────────
def capm_beta(ticker: str):
    # ─ 캐시된 데이터 로드 시도
    df_stk = load_cached_data(ticker)
    df_mkt = load_cached_data("^GSPC")  # S&P 500 지수

    if df_stk is not None and df_mkt is not None:
        print(f"📊 Using data for CAPM analysis", file=sys.stderr)
        # 수익률(%) 계산
        try:
            stk_ret = df_stk['Close'].pct_change().dropna() * 100
            mkt_ret = df_mkt['Close'].pct_change().dropna() * 100
            common = stk_ret.index.intersection(mkt_ret.index)

            if len(common) < WIN:
                raise ValueError(f"Insufficient common data: {len(common)} days")

        except Exception as e:
            print(f"❌ Error processing data: {e}", file=sys.stderr)
            df_stk = None
            df_mkt = None

    if df_stk is None or df_mkt is None:
        print(f"❌ No data available for CAPM analysis", file=sys.stderr)
        sys.exit(1)

    # 수익률(%) 계산
    stk_ret = df_stk['Close'].pct_change().dropna() * 100
    mkt_ret = df_mkt['Close'].pct_change().dropna() * 100
    common = stk_ret.index.intersection(mkt_ret.index)

    y = stk_ret[common]
    x = mkt_ret[common]
    ys = y.iloc[-WIN:]
    xs = sm.add_constant(x.iloc[-WIN:])

    # ─ Newey-West 보정
    maxlags = nw_maxlags(WIN)
    warnings.filterwarnings("ignore", category=RuntimeWarning)
    fit = sm.OLS(ys, xs).fit(cov_type="HAC", cov_kwds={"maxlags": maxlags})

    beta  = float(fit.params.iloc[1])
    r2    = float(fit.rsquared)
    tstat = float(fit.tvalues.iloc[1])

    # ─ 신호등 규칙
    if beta > 1.5 and r2 >= 0.3: 
        light = "red" #시장 충격에 1.5배 이상 반응함.
    elif 0.8 <= beta <= 1.3 and r2 >= 0.3:
        light = "green" #시장과 비슷한 수준
    else:
        light = "yellow" #저베타 방어주거나 R^2 낮음

    return {
        "symbol"       : ticker,
        "date"         : str(common[-1].date()),
        "beta_market"  : round(beta, 2),
        "r2_market"    : round(r2, 2),
        "tstat_market" : round(tstat, 2),
        "traffic_light": light
    }

# ── CLI 실행 ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python capm_service.py <TICKER>")
    try:
        print(json.dumps(capm_beta(sys.argv[1].upper()), ensure_ascii=False))
    except Exception:
        import traceback, sys as _s
        traceback.print_exc()
        _s.exit(1)
