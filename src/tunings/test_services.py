#!/usr/bin/env python3
"""Test script to check the exact output format of each service"""

import subprocess
import json
import sys
from pathlib import Path

# Services to test
SERVICES = [
    "rsi_service.py",
    "mfi_service.py", 
    "bollinger_service.py",
    "capm_service.py",
    "garch_service.py",
    "industry_regression_service.py",
    "lstm_service.py"
]

SERV_DIR = Path(__file__).resolve().parents[1] / "services"
TICKER = "AAPL"

print(f"Testing services with ticker: {TICKER}")
print("=" * 50)

for service in SERVICES:
    print(f"\n--- Testing {service} ---")
    try:
        proc = subprocess.run(
            ["python", str(SERV_DIR / service), TICKER],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, 
            check=False, timeout=30
        )
        
        if proc.returncode == 0:
            try:
                output = proc.stdout.decode("utf-8", "replace").strip()
                print(f"Raw output: {output}")
                
                # Try to parse as JSON
                data = json.loads(output)
                print(f"Parsed JSON keys: {list(data.keys())}")
                print(f"JSON data: {json.dumps(data, indent=2)}")
            except json.JSONDecodeError as e:
                print(f"Failed to parse JSON: {e}")
                print(f"Raw output: {output}")
        else:
            print(f"Service failed with return code: {proc.returncode}")
            if proc.stderr:
                print(f"Stderr: {proc.stderr.decode('utf-8', 'replace')}")
                
    except subprocess.TimeoutExpired:
        print(f"Service timed out")
    except Exception as e:
        print(f"Error running service: {e}")

print("\n" + "=" * 50)
print("Service testing completed!")
