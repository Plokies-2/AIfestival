// src/pages/test-lstm.tsx
import React, { useState } from 'react';
import SpeedTraffic from '../components/SpeedTraffic';
import { fetchLSTMPrediction, isValidSymbol, DEFAULT_SYMBOLS } from '../utils/lstm_client';

const TestLSTMPage: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('AAPL');
  const [customSymbol, setCustomSymbol] = useState<string>('');
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSymbolChange = (symbol: string) => {
    setSelectedSymbol(symbol);
    setCustomSymbol('');
  };

  const handleCustomSymbolSubmit = () => {
    if (isValidSymbol(customSymbol)) {
      setSelectedSymbol(customSymbol.toUpperCase());
    } else {
      alert('Invalid symbol format. Please use 1-5 uppercase letters.');
    }
  };

  const testLSTMDirectly = async () => {
    setLoading(true);
    try {
      const result = await fetchLSTMPrediction(selectedSymbol);
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, error: 'Test failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          LSTM Integration Test Page
        </h1>

        {/* Symbol Selection */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Select Stock Symbol</h2>
          
          {/* Predefined Symbols */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Popular Symbols:
            </label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_SYMBOLS.map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => handleSymbolChange(symbol)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    selectedSymbol === symbol
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Symbol Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Symbol:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value.toUpperCase())}
                placeholder="Enter symbol (e.g., TSLA)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={5}
              />
              <button
                onClick={handleCustomSymbolSubmit}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                Use
              </button>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            Currently selected: <span className="font-semibold">{selectedSymbol}</span>
          </div>
        </div>

        {/* SpeedTraffic Component Test */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">SpeedTraffic™ Component</h2>
          <div className="max-w-md mx-auto">
            <SpeedTraffic symbol={selectedSymbol} />
          </div>
        </div>

        {/* Direct LSTM API Test */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Direct LSTM API Test</h2>
          
          <button
            onClick={testLSTMDirectly}
            disabled={loading}
            className="mb-4 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'Testing...' : `Test LSTM API for ${selectedSymbol}`}
          </button>

          {testResult && (
            <div className="bg-gray-50 rounded-md p-4">
              <h3 className="font-semibold mb-2">API Response:</h3>
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">
            Testing Instructions
          </h2>
          <div className="text-blue-800 space-y-2">
            <p>1. <strong>Select a symbol</strong> from the predefined list or enter a custom one</p>
            <p>2. <strong>Observe the SpeedTraffic component</strong> - only the last light (유동성) should show LSTM results</p>
            <p>3. <strong>Test the API directly</strong> to see raw LSTM prediction data</p>
            <p>4. <strong>Check the browser console</strong> for any errors or debug information</p>
            <p>5. <strong>Wait 30 seconds</strong> to see automatic updates in the SpeedTraffic component</p>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded">
            <p className="text-yellow-800 text-sm">
              <strong>Note:</strong> If Python/TensorFlow is not available, the system will use fallback predictions.
              This is normal and the integration will still work with mock data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestLSTMPage;
