#!/usr/bin/env python3
"""
Simple test script to verify LSTM service functionality.
"""

import sys
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

def test_compute_technical_indicators():
    """Test the technical indicators calculation."""
    print("Testing technical indicators...")
    
    # Create sample data
    np.random.seed(42)
    dates = pd.date_range(end='2025-06-05', periods=100, freq='B')
    df = pd.DataFrame({
        'close': np.cumprod(1 + np.random.normal(0.001, 0.02, 100)) * 100,
        'volume': np.abs(np.random.normal(1000000, 200000, 100)).astype(int)
    }, index=dates)
    
    # Import the function
    from src.services.lstm_service_clean import compute_technical_indicators
    
    # Compute indicators
    df = compute_technical_indicators(df)
    
    # Check that all expected columns are present
    expected_cols = ['close', 'volume', 'rsi', 'bb_upper_pct', 'bb_lower_pct', 
                    'bb_width_pct', 'volatility_30d', 'log_return']
    
    for col in expected_cols:
        assert col in df.columns, f"Missing column: {col}"
    
    print("✅ Technical indicators test passed")
    return df

def test_traffic_light():
    """Test traffic light classification."""
    print("\nTesting traffic light classification...")
    
    from src.services.lstm_service_clean import get_traffic_light
    
    # Test cases
    assert get_traffic_light(0.6) == 'GREEN', "Should be GREEN"
    assert get_traffic_light(0.4) == 'RED', "Should be RED"
    assert get_traffic_light(0.5) == 'YELLOW', "Should be YELLOW"
    
    print("✅ Traffic light classification test passed")

if __name__ == "__main__":
    print("Running LSTM service tests...")
    print("=" * 60)
    
    try:
        test_compute_technical_indicators()
        test_traffic_light()
        print("\n✅ All tests passed!")
    except Exception as e:
        print(f"\n❌ Test failed: {str(e)}")
