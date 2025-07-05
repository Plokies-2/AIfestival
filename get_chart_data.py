#!/usr/bin/env python3
import sys
sys.path.append('/opt/.manus/.sandbox-runtime')
from data_api import ApiClient
import json
import argparse

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Fetch stock chart data from Yahoo Finance API.')
    parser.add_argument("--symbol", required=True, help="Stock symbol (e.g., AAPL)")
    parser.add_argument("--interval", default="1d", help="Data interval (e.g., 1d, 1wk, 1mo)")
    parser.add_argument("--range", default="1mo", help="Data range (e.g., 1mo, 3mo, 1y)")
    args = parser.parse_args()

    client = ApiClient()
    try:
        chart_data = client.call_api(
            'YahooFinance/get_stock_chart',
            query={
                'symbol': args.symbol,
                'interval': args.interval,
                'range': args.range,
                'includeAdjustedClose': True
            }
        )
        # Check for API-level errors if the API returns a specific error structure
        if chart_data and isinstance(chart_data, dict) and chart_data.get('chart') and chart_data['chart'].get('error'):
            print(json.dumps({"error": "API returned an error", "details": chart_data['chart']['error']}))
        elif chart_data and isinstance(chart_data, dict) and not (chart_data.get('chart') and chart_data['chart'].get('result')):
             print(json.dumps({"error": "API returned unexpected data structure or no results.", "details": chart_data}))
        else:
            print(json.dumps(chart_data))

    except Exception as e:
        # Catch any other exceptions during the API call or processing
        print(json.dumps({"error": str(e)}))

