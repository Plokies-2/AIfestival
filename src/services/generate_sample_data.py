#!/usr/bin/env python3
"""
Generate sample stock price and volume data for testing the LSTM service.
"""

import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path

def generate_sample_data(ticker='AAPL', days=500):
    """
    Generate sample stock price and volume data.
    
    Args:
        ticker (str): Stock ticker symbol
        days (int): Number of trading days to generate
        
    Returns:
        tuple: (price_df, volume_df) DataFrames
    """
    print(f"Generating {days} days of sample data for {ticker}...")
    
    # Generate date range (business days only)
    end_date = datetime(2025, 6, 5)  # Reference date
    start_date = end_date - timedelta(days=days*1.5)  # Extra days to account for weekends
    dates = pd.bdate_range(start=start_date, end=end_date)[-days:]
    
    # Generate random walk for prices
    np.random.seed(42)
    returns = np.random.normal(0.0005, 0.02, size=len(dates))
    prices = 100 * np.exp(np.cumsum(returns))
    
    # Generate volume data (correlated with price movement)
    volume = np.abs(np.random.normal(1000000, 200000, size=len(dates))) * (1 + returns * 10)
    volume = np.maximum(volume, 100000)  # Ensure minimum volume
    
    # Create DataFrames
    price_df = pd.DataFrame({
        'date': dates,
        'close': prices
    })
    
    volume_df = pd.DataFrame({
        'date': dates,
        'volume': volume.astype(int)
    })
    
    # Ensure data is sorted by date
    price_df = price_df.sort_values('date')
    volume_df = volume_df.sort_values('date')
    
    return price_df, volume_df

def save_sample_data(ticker='AAPL', days=500, output_dir='data'):
    """Generate and save sample data to CSV files."""
    # Create output directory if it doesn't exist
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate data
    price_df, volume_df = generate_sample_data(ticker, days)
    
    # Save to CSV
    price_file = output_dir / f'{ticker}_prices.csv'
    volume_file = output_dir / f'{ticker}_volume.csv'
    
    price_df.to_csv(price_file, index=False)
    volume_df.to_csv(volume_file, index=False)
    
    print(f"Sample data saved to:\n- {price_file}\n- {volume_file}")
    return price_file, volume_file

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate sample stock data for testing')
    parser.add_argument('--ticker', type=str, default='AAPL', help='Stock ticker symbol')
    parser.add_argument('--days', type=int, default=500, help='Number of trading days to generate')
    parser.add_argument('--output-dir', type=str, default='data', help='Output directory')
    
    args = parser.parse_args()
    
    save_sample_data(
        ticker=args.ticker,
        days=args.days,
        output_dir=args.output_dir
    )
