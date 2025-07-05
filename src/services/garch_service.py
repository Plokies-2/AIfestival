# src/services/garch_service.py
import sys, json
from pathlib import Path
import pandas as pd
from arch import arch_model

BASE_DIR   = Path(__file__).resolve().parent
DATA_DIR   = BASE_DIR.parent / "data"
PRICE_FILE = DATA_DIR / "sp500_adj_close_3y.csv"

def gjr_var(ticker: str):
    df = pd.read_csv(PRICE_FILE, parse_dates=["Date"], index_col="Date")
    if ticker not in df.columns:
        raise KeyError(f"{ticker} 열이 CSV에 없습니다.")
    close = df[ticker].dropna()
    ret   = close.pct_change().dropna() * 100      # % 단위

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
