#!/usr/bin/env python3
"""
Direct test of LSTM service core functions.
"""

import numpy as np
import pandas as pd

print("Testing LSTM service core functions...")
print("-" * 50)

# Test 1: Technical Indicators
print("\n1. Testing compute_technical_indicators...")
from src.services.lstm_service_clean import compute_technical_indicators

# Create sample data
np.random.seed(42)
df = pd.DataFrame({
    'close': np.cumprod(1 + np.random.normal(0.001, 0.02, 100)) * 100,
    'volume': np.abs(np.random.normal(1000000, 200000, 100)).astype(int)
})

# Compute indicators
df = compute_technical_indicators(df)
print("✅ compute_technical_indicators test passed")
print(f"Result columns: {df.columns.tolist()}")

# Test 2: Traffic Light Classification
print("\n2. Testing get_traffic_light...")
from src.services.lstm_service_clean import get_traffic_light

assert get_traffic_light(0.6) == 'GREEN', "Should be GREEN"
assert get_traffic_light(0.4) == 'RED', "Should be RED"
assert get_traffic_light(0.5) == 'YELLOW', "Should be YELLOW"
print("✅ get_traffic_light test passed")

print("\nAll core function tests passed!")
