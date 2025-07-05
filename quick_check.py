#!/usr/bin/env python3
"""
Quick check of LSTM service imports and basic functionality.
"""

print("Testing LSTM service imports...")
print("-" * 50)

try:
    # Test basic imports
    import numpy as np
    import pandas as pd
    import tensorflow as tf
    
    print("✅ Basic imports successful")
    print(f"NumPy version: {np.__version__}")
    print(f"Pandas version: {pd.__version__}")
    print(f"TensorFlow version: {tf.__version__}")
    
    # Test LSTM service imports
    from src.services.lstm_service_clean import (
        compute_technical_indicators,
        get_traffic_light,
        REFERENCE_DATE
    )
    
    print("\n✅ LSTM service imports successful")
    print(f"Reference date: {REFERENCE_DATE}")
    
    # Quick test of traffic light function
    print("\nTesting traffic light function:")
    print(f"0.6 -> {get_traffic_light(0.6)} (should be GREEN)")
    print(f"0.4 -> {get_traffic_light(0.4)} (should be RED)")
    print(f"0.5 -> {get_traffic_light(0.5)} (should be YELLOW)")
    
    print("\n✅ All tests passed!")
    
except Exception as e:
    print(f"\n❌ Test failed: {str(e)}")
    raise
