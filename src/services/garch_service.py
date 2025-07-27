# src/services/garch_service.py
import sys, json
import pandas as pd
from arch import arch_model
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

def gjr_var(ticker: str):
    # 먼저 캐시된 데이터 시도
    df = load_cached_data(ticker)

    if df is not None:
        print(f"📊 Using data for {ticker}", file=sys.stderr)
        # 데이터 사용
        try:
            # Close 컬럼 확인
            if 'Close' not in df.columns:
                raise ValueError(f"Missing Close column in data")

            close = df['Close'].dropna()
            ret = close.pct_change().dropna() * 100  # % 단위
        except Exception as e:
            print(f"❌ Error processing data: {e}", file=sys.stderr)
            df = None

    if df is None:
        print(f"❌ No data available for {ticker}", file=sys.stderr)
        sys.exit(1)

    # 데이터가 있는 경우 처리
    close = df['Close'].dropna()
    ret = close.pct_change().dropna() * 100  # % 단위

    fit = arch_model(ret, p=1, o=1, q=1, dist="t").fit(update_freq=0, disp="off")
    fcst = fit.forecast(horizon=1, reindex=False)  # 버그 회피
    sigma_pct = (fcst.variance.values[-1, 0] ** 0.5)        # %
    var95_pct = 1.65 * sigma_pct                              # %

    #red: 내일 95% 신뢰구간 손실 3% 이상 가능 - 단기 고위험
    #yellow: 2% <= var95 < 3% -> 중간 위험
    #green: var95 < 2% -> 단기 안정
    light = "red" if var95_pct > 3 else "yellow" if var95_pct > 2 else "green"
    return {
        "symbol": ticker,
        "date": str(close.index[-1].date()),
        "sigma_pct": round(sigma_pct, 2),     # 하루 σ (%)
        "var95_pct": round(var95_pct, 2),     # VaR95 (%)
        "traffic_light": light
    }

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python garch_service.py <TICKER>")
    try:
        print(json.dumps(gjr_var(sys.argv[1].upper()), ensure_ascii=False))
    except Exception:
        import traceback, sys as _s
        traceback.print_exc()
        _s.exit(1)
