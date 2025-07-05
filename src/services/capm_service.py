"""
CAPM: S&P 500 지수(^GSPC) ↔ 개별 종목 6 개월(126 영업일) Rolling OLS
Newey-West(HAC) 표준오차 + Andrew (1991) maxlags 규칙 적용
JSON :
{
  symbol, date, beta_market, r2_market, tstat_market, traffic_light
}
"""

import sys, json, math, warnings
from pathlib import Path
import pandas as pd
import statsmodels.api as sm

# ── 경로 상수 ──────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).resolve().parent             # …/src/services
DATA_DIR   = BASE_DIR.parent / "data"                    # …/src/data
PRICE_FILE = DATA_DIR / "sp500_adj_close_3y.csv"
INDEX_FILE = DATA_DIR / "sp500_index_3y.csv"

WIN = 126   # 6 개월(영업일)

# ── Newey-West maxlags(Andrews 1991) ──────────────────────────────────
def nw_maxlags(n):
    return int(math.floor(4 * (n / 100) ** (2 / 9)))

# ── CAPM 회귀 함수 ────────────────────────────────────────────────────
def capm_beta(ticker: str):
    # ─ 데이터 로드
    df_stk  = pd.read_csv(PRICE_FILE, parse_dates=["Date"], index_col="Date")
    df_mkt  = pd.read_csv(INDEX_FILE, parse_dates=["Date"], index_col="Date")
    if ticker not in df_stk.columns:
        raise KeyError(f"{ticker} 열이 종목 CSV에 없습니다.")
    if "^GSPC" not in df_mkt.columns:
        raise KeyError("^GSPC 열이 지수 CSV에 없습니다.")

    # ─ 수익률(%) 계산
    stk_ret = df_stk[ticker].pct_change().dropna() * 100
    mkt_ret = df_mkt["^GSPC"].pct_change().dropna() * 100
    common  = stk_ret.index.intersection(mkt_ret.index)
    if len(common) < WIN:
        raise ValueError("공통 기간이 126 영업일 미만입니다.")

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
