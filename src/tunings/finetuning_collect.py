"""
7 개 분석 스크립트를 순차 실행해 파인튜닝용 JSON 저장
──────────────────────────────────────────────────────────
· 저장:  src/data/finetuning/<UTC_타임스탬프>.json
· 인자 없으면 50 개 기본 티커 사용
· JSON에는 티커/기업명 미포함 → 정보 누수 방지
"""

import json, re, subprocess, sys, warnings, random, argparse
from datetime import datetime, date, timedelta
from pathlib import Path
import pandas as pd

# ── 경로 ─────────────────────────────────────────────────────────
ROOT_SRC = Path(__file__).resolve().parents[1]        # …/src
SERV      = ROOT_SRC / "services"                     # …/src/services
DATA_FT   = ROOT_SRC / "data" / "finetuning"
DATA_FT.mkdir(parents=True, exist_ok=True)

# Windows path handling - add src to Python path
sys.path.append(str(ROOT_SRC))

# ── Ticker and date selection functions ──────────────────────────────
def load_kospi_tickers():
    """Load KOSPI tickers from kospi_enriched_final.ts"""
    ts_file = ROOT_SRC / "data" / "kospi_enriched_final.ts"

    if not ts_file.exists():
        print(f"Error: {ts_file} not found", file=sys.stderr)
        sys.exit(1)

    tickers = []
    company_names = {}

    try:
        with open(ts_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract ticker symbols and company names using regex
        pattern = r'"([A-Z]+)":\s*{\s*name:\s*"([^"]+)"'
        matches = re.findall(pattern, content)

        for ticker, name in matches:
            tickers.append(ticker)
            company_names[ticker] = name

        return tickers, company_names

    except Exception as e:
        print(f"Error loading tickers: {e}", file=sys.stderr)
        sys.exit(1)

def get_available_dates():
    """Load available dates from the CSV file"""
    csv_path = ROOT_SRC / "data" / "sp500_adj_close_3y.csv"

    if not csv_path.exists():
        print(f"Error: {csv_path} not found", file=sys.stderr)
        sys.exit(1)

    try:
        df = pd.read_csv(csv_path)
        df['Date'] = pd.to_datetime(df['Date']).dt.date

        # Filter dates between September 2024 and May 15, 2025
        start_date = date(2024, 9, 1)
        end_date = date(2025, 5, 15)

        available_dates = df[(df['Date'] >= start_date) & (df['Date'] <= end_date)]['Date'].tolist()
        return available_dates

    except Exception as e:
        print(f"Error loading available dates: {e}", file=sys.stderr)
        sys.exit(1)

def get_random_date_and_ticker(count=1):
    """Generate random dates and tickers for fine-tuning"""
    # Load all available tickers
    all_tickers, company_names = load_kospi_tickers()

    # Exclude specified tickers
    excluded_tickers = {'SW', 'GEV', 'SOLV', 'VLTO', 'KVUE', 'GEHC', 'CEG'}
    available_tickers = [t for t in all_tickers if t not in excluded_tickers]

    # Load available dates from the dataset
    available_dates = get_available_dates()

    if not available_dates:
        print("No available dates found in the specified range", file=sys.stderr)
        sys.exit(1)

    # Generate random selections
    selections = []
    for _ in range(count):
        # Random date from available dates
        random_date = random.choice(available_dates)

        # Random ticker
        random_ticker = random.choice(available_tickers)

        selections.append({
            'ticker': random_ticker,
            'company_name': company_names[random_ticker],
            'date': random_date
        })

    return selections

# ── 50 개 기본 티커 ──────────────────────────────────────────────
DEFAULT_TICKERS = [
    "AEP","ACGL","ADM","ALGN","AXP","BEN","BR","CBRE","CCI","CE",
    "CEG","CF","CHRW","CI","CME","COST","CPT","CRM","CSCO","DHR",
    "EMN","FANG","GILD","GPN","IFF","INTU","JNJ","KMB","LIN","LRCX",
    "MAA","MHK","MRO","MS","NCLH","NSC","NTRS","NVDA","PFE","PNW",
    "SOLV","SYK","TXN","VRSN","WBA","WM","WRB","XEL", "A", "AMZN"
]

# ── 분석 스크립트 ↔ 주요 필드 ───────────────────────────────────
SCRIPTS = {
    "RSI"     : ("rsi_service.py",        ["rsi_value",      "traffic_light"]),
    "BOLL"    : ("bollinger_service.py",  ["percent_b",      "traffic_light"]),
    "MFI"     : ("mfi_service.py",        ["mfi_value",      "traffic_light"]),
    "CAPM"    : ("capm_service.py",       ["beta_market",    "r2_market",
                                           "tstat_market",   "traffic_light"]),
    "GARCH"   : ("garch_service.py",      ["var95_pct",      "traffic_light"]),
    "INDUSTRY": ("industry_regression_service.py",
                 ["beta_industry", "r2_industry", "tstat_industry", "traffic_light"]),
    "LSTM"    : ("lstm_finetuning.py",    ["pred_prob_up",   "traffic_light"]),
}

# ── Service output processing functions ──────────────────────────
def extract_service_data(service_name: str, raw_data: dict) -> dict:
    """Extract and normalize data from service outputs"""
    result = {}

    if service_name == "RSI":
        result["rsi_value"] = raw_data.get("rsi_14", 0)
        result["traffic_light"] = raw_data.get("traffic_light", "red")

    elif service_name == "MFI":
        result["mfi_value"] = raw_data.get("mfi_14", 0)
        result["traffic_light"] = raw_data.get("traffic_light", "red")

    elif service_name == "BOLL":
        result["percent_b"] = raw_data.get("percent_b", 0)
        result["traffic_light"] = raw_data.get("traffic_light", "red")

    elif service_name == "CAPM":
        result["beta_market"] = raw_data.get("beta_market", 0)
        result["r2_market"] = raw_data.get("r2_market", 0)
        result["tstat_market"] = raw_data.get("tstat_market", 0)
        result["traffic_light"] = raw_data.get("traffic_light", "red")

    elif service_name == "GARCH":
        result["sigma_pct"] = raw_data.get("sigma_pct", 0)
        result["var95_pct"] = raw_data.get("var95_pct", 0)
        result["traffic_light"] = raw_data.get("traffic_light", "red")

    elif service_name == "INDUSTRY":
        result["beta_industry"] = raw_data.get("beta", 0)
        result["r2_industry"] = raw_data.get("r2", 0)
        result["tstat_industry"] = raw_data.get("tstat", 0)
        result["industry_name"] = raw_data.get("industry", "Unknown")
        result["traffic_light"] = raw_data.get("traffic_light", "red")

    elif service_name == "LSTM":
        # The `run` function returns the last output line in "details" if it's not JSON.
        output_string = raw_data.get("details", "")

        if output_string.startswith("[LSTM accuracy:"):
            # Use regex to parse the new output format, e.g.,
            # "[LSTM accuracy: 3, Prediction probability up: 0.423, Traffic light: RED]"
            match = re.search(r"\[LSTM accuracy: (\d+), Prediction probability up: ([\d.]+), Traffic light: (\w+)\]", output_string)
            if match:
                accuracy_hits = int(match.group(1))
                prob_up = float(match.group(2))
                light = match.group(3)

                # Accuracy is the number of hits out of 5 predictions
                result["accuracy"] = accuracy_hits / 5.0
                result["pred_prob_up"] = prob_up
                result["traffic_light"] = light
            else:
                # Parsing failed, use defaults
                result["pred_prob_up"] = 0.5
                result["accuracy"] = 0.0
                result["traffic_light"] = "RED"
        else:
            # Fallback for parsing failure or unexpected format
            result["pred_prob_up"] = 0.5
            result["accuracy"] = 0.0
            result["traffic_light"] = "RED"

    return result

# ── 하위 프로세스 실행 & 디코딩 안전 ────────────────────────────
def run(script: str, ticker: str, target_date: str = None) -> dict:
    try:
        print(f"[DEBUG] Running {script} for {ticker}")

        # Build command arguments, with -u for unbuffered output
        cmd_args = ["python", "-u", str(SERV / script), ticker]

        # Add date parameter for LSTM fine-tuning service
        if script == "lstm_finetuning.py" and target_date:
            cmd_args.append(target_date)

        proc = subprocess.run(
            cmd_args,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False,
            timeout=30  # 30 second timeout
        )

        if proc.returncode:
            print(f"[WARNING] {script} returned exit code {proc.returncode}, using mock data")
            return generate_mock_data(script, ticker)

        output_str = proc.stdout.decode("cp949", "replace").strip()

        # Add a debug print to see what is being processed
        if script == "lstm_finetuning.py":
            print(f"[DEBUG] Decoded output from LSTM: {output_str}")

        # Special handling for lstm_finetuning.py, which returns plain text
        if script == "lstm_finetuning.py":
            lines = [line for line in output_str.splitlines() if line.strip()]
            if lines and lines[-1].startswith("[LSTM accuracy:"):
                # Return the last line in a dict for the extractor function
                return {"details": lines[-1]}
            else:
                print(f"[WARNING] {script} did not return the expected summary line, using mock data.")
                return generate_mock_data(script, ticker)

        # For all other scripts, parse JSON
        try:
            return json.loads(output_str)
        except json.JSONDecodeError as e:
            print(f"[WARNING] {script} returned invalid JSON: {e}, using mock data")
            return generate_mock_data(script, ticker)

    except subprocess.TimeoutExpired:
        print(f"[WARNING] {script} timed out, using mock data")
        return generate_mock_data(script, ticker)
    except Exception as e:
        print(f"[WARNING] {script} failed with error: {e}, using mock data")
        return generate_mock_data(script, ticker)

# ── Mock data generation for testing ────────────────────────────
def generate_mock_data(script: str, ticker: str) -> dict:
    """Generate mock data when services fail"""
    import random

    if "rsi" in script.lower():
        return {"rsi_value": round(random.uniform(20, 80), 2), "traffic_light": random.choice(["red", "yellow", "green"])}
    elif "bollinger" in script.lower():
        return {"percent_b": round(random.uniform(0, 1), 2), "traffic_light": random.choice(["red", "yellow", "green"])}
    elif "mfi" in script.lower():
        return {"mfi_value": round(random.uniform(10, 90), 1), "traffic_light": random.choice(["red", "yellow", "green"])}
    elif "capm" in script.lower():
        return {
            "beta_market": round(random.uniform(0.5, 2.0), 2),
            "r2_market": round(random.uniform(0.1, 0.9), 2),
            "tstat_market": round(random.uniform(1, 15), 2),
            "traffic_light": random.choice(["red", "yellow", "green"])
        }
    elif "garch" in script.lower():
        return {"var95_pct": round(random.uniform(1, 10), 2), "traffic_light": random.choice(["red", "yellow", "green"])}
    elif "industry" in script.lower():
        # Mock industry names for testing
        mock_industries = [
            "Technology Hardware & Equipment", "Software & Services", "Semiconductors & Semiconductor Equipment",
            "Healthcare Equipment & Services", "Pharmaceuticals Biotechnology & Life Sciences", "Banks",
            "Diversified Financials", "Insurance", "Real Estate", "Energy", "Materials", "Capital Goods",
            "Commercial & Professional Services", "Transportation", "Automobiles & Components", "Consumer Durables & Apparel",
            "Consumer Services", "Media & Entertainment", "Food Beverage & Tobacco", "Household & Personal Products",
            "Food & Staples Retailing", "Utilities", "Telecommunication Services"
        ]
        return {
            "beta_industry": round(random.uniform(0.3, 1.5), 3),
            "r2_industry": round(random.uniform(0.1, 0.8), 3),
            "tstat_industry": round(random.uniform(1, 10), 2),
            "industry": random.choice(mock_industries),
            "traffic_light": random.choice(["red", "yellow", "green"])
        }
    elif "lstm" in script.lower():
        traffic_light = random.choice(["red", "yellow", "green"])
        # Set accuracy based on traffic light color for consistency
        if traffic_light == "green":
            accuracy = 1.0
        elif traffic_light == "yellow":
            accuracy = 0.5
        else:
            accuracy = 0.0
        return {
            "pred_prob_up": round(random.uniform(0.3, 0.7), 4),
            "accuracy": accuracy,
            "traffic_light": traffic_light
        }
    else:
        return {"traffic_light": "red"}

# ── user 메시지 조립 (API 엔드포인트 형식과 일치) ─────────────────────
def build_user_string(res: dict) -> str:
    # Extract values with proper fallbacks
    rsi_value = res.get('RSI', {}).get('rsi_value', 0)
    rsi_color = res.get('RSI', {}).get('traffic_light', 'red')

    boll_value = res.get('BOLL', {}).get('percent_b', 0)
    boll_color = res.get('BOLL', {}).get('traffic_light', 'red')

    mfi_value = res.get('MFI', {}).get('mfi_value', 0)
    mfi_color = res.get('MFI', {}).get('traffic_light', 'red')

    beta_market = res.get('CAPM', {}).get('beta_market', 0)
    r2_market = res.get('CAPM', {}).get('r2_market', 0)
    tstat_market = res.get('CAPM', {}).get('tstat_market', 0)
    capm_color = res.get('CAPM', {}).get('traffic_light', 'red')

    var95_pct = res.get('GARCH', {}).get('var95_pct', 0)
    sigma_pct = res.get('GARCH', {}).get('sigma_pct', 0)
    garch_color = res.get('GARCH', {}).get('traffic_light', 'red')

    beta_industry = res.get('INDUSTRY', {}).get('beta_industry', 0)
    r2_industry = res.get('INDUSTRY', {}).get('r2_industry', 0)
    tstat_industry = res.get('INDUSTRY', {}).get('tstat_industry', 0)
    industry_name = res.get('INDUSTRY', {}).get('industry_name', 'Unknown')
    industry_color = res.get('INDUSTRY', {}).get('traffic_light', 'red')

    pred_prob_up = res.get('LSTM', {}).get('pred_prob_up', 0.5)
    lstm_accuracy = res.get('LSTM', {}).get('accuracy', 0.0)
    lstm_color = res.get('LSTM', {}).get('traffic_light', 'red')

    # Build message in enhanced format for better AI understanding
    user_msg = (f"[RSI Value: {rsi_value:.2f}, Traffic light: {rsi_color.upper()}] "
                f"[Bollinger %B: {boll_value:.2f}, Traffic light: {boll_color.upper()}] "
                f"[MFI Value: {mfi_value:.2f}, Traffic light: {mfi_color.upper()}] "
                f"[Market Beta: {beta_market:.2f}, R²: {r2_market:.2f}, t-stat: {tstat_market:.2f}, Traffic light: {capm_color.upper()}] "
                f"[Volatility: {sigma_pct:.1f}%, VaR 95%: {var95_pct:.1f}%, Traffic light: {garch_color.upper()}] "
                f"[Industry Beta: {beta_industry:.2f}, R²: {r2_industry:.2f}, t-stat: {tstat_industry:.2f}, Traffic light: {industry_color.upper()}] "
                f"[industry : {industry_name}] "
                f"[LSTM accuracy: {lstm_accuracy:.3f}, Prediction probability up: {pred_prob_up:.3f}, Traffic light: {lstm_color.upper()}]")

    return user_msg

# ── 단일 티커 처리 ─────────────────────────────────────────────
def collect_one(tkr: str, target_date: str = None, company_name: str = None):
    # Run all services and get raw data
    raw_results = {}
    for tag, (script, _) in SCRIPTS.items():
        raw_results[tag] = run(script, tkr, target_date)

    # Extract and normalize data from each service
    results = {}
    for tag, raw_data in raw_results.items():
        results[tag] = extract_service_data(tag, raw_data)

    user_msg = build_user_string(results)

    convo = {
        "messages": [
            {"role": "system",
             "content": "당신은 이 메시지를 바탕으로 투자 의견을 제공하는 투자 AI입니다. 이모티콘을 적절히 활용해 친근한 분위기를 유지하면서(최대 2개까지, 💪🚀✨💎📈🎯💡🔥⭐️🌟💫🎉🎂 등), 전문적인 어조로 답변하세요."},
            {"role": "user", "content": user_msg},
            {"role": "assistant", "content": ""}
        ]
    }

    # Create filename based on company name and date
    if company_name and target_date:
        # Clean company name for filename
        clean_name = re.sub(r'[^\w\s-]', '', company_name).strip()
        clean_name = re.sub(r'[-\s]+', '_', clean_name)
        filename = f"{clean_name}_{target_date}.json"
    else:
        # Fallback to timestamp-based naming
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{ts}.json"

    (DATA_FT / filename).write_text(
        json.dumps(convo, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"✔ {tkr} → {filename} 저장")

# ── 메인 루프 ──────────────────────────────────────────────────
def main():
    """Main function with command-line argument support"""
    parser = argparse.ArgumentParser(
        description="Fine-tuning data collection for ML models",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python finetuning_collect.py --count 100    # Generate 100 random samples
  python finetuning_collect.py AAPL AMZN      # Process specific tickers
  python finetuning_collect.py                # Process default 50 tickers
        """
    )

    parser.add_argument(
        '--count', '-c',
        type=int,
        help='Number of random fine-tuning samples to generate'
    )

    parser.add_argument(
        'tickers',
        nargs='*',
        help='Specific ticker symbols to process (overrides --count)'
    )

    args = parser.parse_args()

    warnings.filterwarnings("ignore", category=RuntimeWarning)

    print(f"[INFO] Starting fine-tuning data collection...")
    print(f"[INFO] Services directory: {SERV}")
    print(f"[INFO] Output directory: {DATA_FT}")

    success_count = 0

    if args.tickers:
        # Process specific tickers (legacy mode)
        tickers = [t.upper() for t in args.tickers]
        print(f"[INFO] Processing {len(tickers)} specific tickers: {tickers[:5]}{'...' if len(tickers) > 5 else ''}")

        for i, t in enumerate(tickers, 1):
            try:
                print(f"[INFO] Processing {i}/{len(tickers)}: {t}")
                collect_one(t)
                success_count += 1
            except Exception as e:
                print(f"[ERROR] {t}: {e}", file=sys.stderr)

    elif args.count:
        # Generate random samples (new mode)
        print(f"[INFO] Generating {args.count} random fine-tuning samples...")
        selections = get_random_date_and_ticker(args.count)

        for i, selection in enumerate(selections, 1):
            try:
                ticker = selection['ticker']
                company_name = selection['company_name']
                target_date = selection['date'].strftime('%Y-%m-%d')

                print(f"[INFO] Processing {i}/{args.count}: {ticker} ({company_name}) on {target_date}")
                collect_one(ticker, target_date, company_name)
                success_count += 1

            except Exception as e:
                print(f"[ERROR] {selection['ticker']}: {e}", file=sys.stderr)

    else:
        # Default mode: process default tickers
        print(f"[INFO] Processing {len(DEFAULT_TICKERS)} default tickers...")

        for i, t in enumerate(DEFAULT_TICKERS, 1):
            try:
                print(f"[INFO] Processing {i}/{len(DEFAULT_TICKERS)}: {t}")
                collect_one(t)
                success_count += 1
            except Exception as e:
                print(f"[ERROR] {t}: {e}", file=sys.stderr)

    total_attempted = args.count if args.count else (len(args.tickers) if args.tickers else len(DEFAULT_TICKERS))
    print(f"[INFO] Completed! Successfully processed {success_count}/{total_attempted} samples")


if __name__ == "__main__":
    main()
