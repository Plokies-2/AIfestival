#!/usr/bin/env python3
"""Simple test script to verify Python execution"""

import sys
import json
from datetime import datetime
from pathlib import Path

print("Python test script starting...")
print(f"Python version: {sys.version}")
print(f"Current working directory: {Path.cwd()}")

# Test basic functionality
data = {
    "test": "success",
    "timestamp": datetime.now().strftime("%Y%m%d_%H%M%S")
}

print(f"Test data: {json.dumps(data, indent=2)}")
print("Python test script completed successfully!")
