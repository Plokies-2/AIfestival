# ─── getindex.py  (VIX 다운로드 & 저장) ──────────────────────────────
import pandas as pd, requests, pathlib
from io import StringIO
from datetime import date, timedelta

# 1) 날짜 범위 (정확히 5년)
END   = date(2025, 6, 5)
START = END - timedelta(days=5 * 365)           # 2020-06-06

# 2) Stooq CSV URL (VIX = vi.c, 일봉)
URL = (
    "https://stooq.com/q/d/l/"
    f"?s=vi.c&i=d&d1={START:%Y%m%d}&d2={END:%Y%m%d}"
)

csv_txt = requests.get(URL, timeout=10).text
if not csv_txt.strip():
    raise RuntimeError("⚠ Stooq 응답이 비어 있습니다. URL·날짜 범위를 확인하세요.")

# 3) 구분자·열 갯수 판별
sep = ';' if ';' in csv_txt.splitlines()[0] else ','
first_row_fields = csv_txt.splitlines()[0].split(sep)
n_cols = len(first_row_fields)

#   Stooq VIX 는 경우에 따라 Volume 열이 없어서 5컬럼이 될 수 있음
if n_cols == 6:
    names = ["date","open","high","low","close","volume"]
else:  # 5 columns (no volume)
    names = ["date","open","high","low","close"]

# 4) 읽기
df = pd.read_csv(
    StringIO(csv_txt), sep=sep, header=0, names=names,
    parse_dates=["date"]
)

# 5) 날짜 오름차순 정렬
df = df.sort_values("date").reset_index(drop=True)

# 6) 저장 (5년치 그대로, 규칙상 _3y.csv 파일명 사용)
save_path = pathlib.Path(
    r"C:\Users\song7\Desktop\home\ubuntu\financial_dashboard\src\data\vix_index_3y.csv"
)
save_path.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(save_path, index=False, encoding="utf-8")
print(f"✔ Saved {len(df)} rows → {save_path}")
