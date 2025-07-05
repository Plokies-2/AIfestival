#!/usr/bin/env python3
"""Simple test for LSTM fine-tuning service"""

import subprocess
import json
import sys
from pathlib import Path

def test_lstm_service():
    """Test the LSTM fine-tuning service with a known date"""
    
    # Test with a known working date
    ticker = "AAPL"
    test_date = "2024-12-31"
    
    print(f"Testing LSTM service with {ticker} on {test_date}")
    
    try:
        # Run the LSTM service
        serv_dir = Path(__file__).resolve().parents[1] / "services"
        lstm_script = serv_dir / "lstm_finetuning.py"
        
        proc = subprocess.run(
            ["python", str(lstm_script), ticker, test_date],
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE, 
            check=False,
            timeout=120
        )
        
        print(f"Return code: {proc.returncode}")
        
        if proc.stderr:
            stderr_output = proc.stderr.decode("utf-8", "replace")
            print(f"Stderr: {stderr_output}")
        
        if proc.returncode == 0:
            stdout_output = proc.stdout.decode("utf-8", "replace")
            print(f"Stdout: {stdout_output}")
            
            try:
                result = json.loads(stdout_output)
                pred_prob = result.get("predictions", [{}])[0].get("pred_prob_up", 0.5)
                print(f"✅ LSTM prediction: {pred_prob}")
                
                if pred_prob != 0.5:
                    print("✅ SUCCESS: Real prediction generated!")
                    return True
                else:
                    print("❌ FAILURE: Default prediction (0.5)")
                    return False
                    
            except json.JSONDecodeError as e:
                print(f"❌ JSON decode error: {e}")
                return False
        else:
            print(f"❌ LSTM service failed with return code {proc.returncode}")
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ LSTM service timed out")
        return False
    except Exception as e:
        print(f"❌ Error running LSTM service: {e}")
        return False

if __name__ == "__main__":
    success = test_lstm_service()
    sys.exit(0 if success else 1)
