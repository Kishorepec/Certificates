import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import SummaryCard from './SummaryCard';
import './ProxyTester.css';

const ProxyTester = () => {
  const [apis, setApis] = useState([]);
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState({});
  const [summaryLoading, setSummaryLoading] = useState({});
  const [error, setError] = useState('');
  const [selectedApis, setSelectedApis] = useState(new Set());
  const [batchTesting, setBatchTesting] = useState(false);
  const [batchResults, setBatchResults] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchApis = useCallback(async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/all');
      setApis(res.data);
      setError('');
    } catch (err) {
      setError('Failed to fetch APIs. Please check your connection.');
      console.error('Failed to fetch APIs:', err);
    }
  }, []);

  useEffect(() => {
    fetchApis();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchApis, 30000);
    return () => clearInterval(interval);
  }, [fetchApis]);

  const handleTest = async (apiId, apiName) => {
    setResult(null);
    setLoading(prev => ({ ...prev, [apiId]: true }));
    
    try {
      const res = await axios.get(`http://localhost:5000/api/proxy/${apiId}`, {
        timeout: 30000
      });
      
      const testResult = { 
        success: true, 
        apiId,
        apiName,
        timestamp: new Date().toISOString(),
        ...res.data 
      };
      
      setResult(testResult);
      setBatchResults(prev => ({ ...prev, [apiId]: testResult }));
    } catch (err) {
      const testResult = { 
        success: false, 
        apiId,
        apiName,
        timestamp: new Date().toISOString(),
        message: err.response?.data?.message || 'Test failed',
        error: err.message
      };
      
      setResult(testResult);
      setBatchResults(prev => ({ ...prev, [apiId]: testResult }));
    } finally {
      setLoading(prev => ({ ...prev, [apiId]: false }));
    }
  };

  const handleSummary = async (apiId) => {
    setSummary(null);
    setSummaryLoading(prev => ({ ...prev, [apiId]: true }));
    
    try {
      const res = await axios.get(`http://localhost:5000/api/logs/${apiId}/summary`);
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to fetch summary:', err);
      setError('Failed to fetch summary data');
    } finally {
      setSummaryLoading(prev => ({ ...prev, [apiId]: false }));
    }
  };

  const handleBatchTest = async () => {
    if (selectedApis.size === 0) {
      setError('Please select at least one API to test');
      return;
    }

    setBatchTesting(true);
    setBatchResults({});
    setError('');

    const apiList = Array.from(selectedApis);
    
    try {
      // Test APIs in parallel with a limit of 3 concurrent requests
      const batchSize = 3;
      for (let i = 0; i < apiList.length; i += batchSize) {
        const batch = apiList.slice(i, i + batchSize);
        const promises = batch.map(apiId => {
          const api = apis.find(a => a.id === apiId);
          return handleTest(apiId, api?.name || 'Unknown API');
        });
        
        await Promise.allSettled(promises);
        
        // Small delay between batches to prevent overwhelming the server
        if (i + batchSize < apiList.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (err) {
      setError('Batch testing encountered an error');
    } finally {
      setBatchTesting(false);
    }
  };

  const toggleApiSelection = (apiId) => {
    setSelectedApis(prev => {
      const newSet = new Set(prev);
      if (newSet.has(apiId)) {
        newSet.delete(apiId);
      } else {
        newSet.add(apiId);
      }
      return newSet;
    });
  };

  const selectAllApis = () => {
    const filteredApiIds = getFilteredAndSortedApis().map(api => api.id);
    setSelectedApis(new Set(filteredApiIds));
  };

  const deselectAllApis = () => {
    setSelectedApis(new Set());
  };

  const getFilteredAndSortedApis = () => {
    let filtered = apis.filter(api => {
      const matchesSearch = api.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           api.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           api.method.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;
      
      if (filterStatus === 'all') return true;
      
      const lastResult = batchResults[api.id];
      if (filterStatus === 'success') return lastResult?.success === true;
      if (filterStatus === 'error') return lastResult?.success === false;
      if (filterStatus === 'untested') return !lastResult;
      
      return true;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'method':
          return a.method.localeCompare(b.method);
        case 'url':
          return a.url.localeCompare(b.url);
        case 'lastTest':
          const aResult = batchResults[a.id];
          const bResult = batchResults[b.id];
          if (!aResult && !bResult) return 0;
          if (!aResult) return 1;
          if (!bResult) return -1;
          return new Date(bResult.timestamp) - new Date(aResult.timestamp);
        default:
          return 0;
      }
    });
  };

  const getApiStatusIcon = (api) => {
    const result = batchResults[api.id];
    if (!result) return '⚪';
    return result.success ? '🟢' : '🔴';
  };

  const getApiStatusClass = (api) => {
    const result = batchResults[api.id];
    if (!result) return '';
    return result.success ? 'success' : 'error';
  };

  const getMethodColor = (method) => {
    const colors = {
      GET: '#10b981',
      POST: '#3b82f6',
      PUT: '#f59e0b',
      DELETE: '#ef4444',
      PATCH: '#8b5cf6',
      HEAD: '#6b7280',
      OPTIONS: '#06b6d4'
    };
    return colors[method] || '#6b7280';
  };

  const exportResults = () => {
    const data = {
      timestamp: new Date().toISOString(),
      totalApis: apis.length,
      testedApis: Object.keys(batchResults).length,
      results: batchResults
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `api-test-results-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredApis = getFilteredAndSortedApis();
  const testResults = Object.values(batchResults);
  const successCount = testResults.filter(r => r.success).length;
  const errorCount = testResults.filter(r => !r.success).length;

  return (
    <div className="proxy-tester-container">
      <div className="tester-header">
        <h2>🔌 API Proxy Tester</h2>
        <p>Test your registered APIs and analyze their performance</p>
      </div>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          {error}
          <button onClick={() => setError('')} className="dismiss-btn">✕</button>
        </div>
      )}

      <div className="controls-section">
        <div className="search-filter-controls">
          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 Search APIs by name, URL, or method..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-controls">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="name">Sort by Name</option>
              <option value="method">Sort by Method</option>
              <option value="url">Sort by URL</option>
              <option value="lastTest">Sort by Last Test</option>
            </select>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">All APIs</option>
              <option value="success">✅ Successful</option>
              <option value="error">❌ Failed</option>
              <option value="untested">⚪ Untested</option>
            </select>
          </div>
        </div>

        <div className="batch-controls">
          <div className="selection-info">
            <span>{selectedApis.size} of {filteredApis.length} selected</span>
            <div className="selection-buttons">
              <button onClick={selectAllApis} className="select-btn">Select All</button>
              <button onClick={deselectAllApis} className="select-btn">Deselect All</button>
            </div>
          </div>
          
          <div className="batch-actions">
            <button
              onClick={handleBatchTest}
              disabled={batchTesting || selectedApis.size === 0}
              className="batch-test-btn"
            >
              {batchTesting ? (
                <>
                  <div className="btn-spinner"></div>
                  Testing {selectedApis.size} APIs...
                </>
              ) : (
                <>
                  🚀 Test Selected ({selectedApis.size})
                </>
              )}
            </button>
            
            {Object.keys(batchResults).length > 0 && (
              <button onClick={exportResults} className="export-btn">
                💾 Export Results
              </button>
            )}
          </div>
        </div>

        {testResults.length > 0 && (
          <div className="test-summary">
            <div className="summary-stats">
              <div className="stat-item success">
                <span className="stat-icon">✅</span>
                <span className="stat-value">{successCount}</span>
                <span className="stat-label">Successful</span>
              </div>
              <div className="stat-item error">
                <span className="stat-icon">❌</span>
                <span className="stat-value">{errorCount}</span>
                <span className="stat-label">Failed</span>
              </div>
              <div className="stat-item">
                <span className="stat-icon">📊</span>
                <span className="stat-value">{((successCount / testResults.length) * 100).toFixed(1)}%</span>
                <span className="stat-label">Success Rate</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="apis-section">
        {filteredApis.length === 0 ? (
          <div className="empty-state">
            {apis.length === 0 ? (
              <>
                <div className="empty-icon">📭</div>
                <h3>No APIs registered yet</h3>
                <p>Register your first API to start monitoring and testing</p>
              </>
            ) : (
              <>
                <div className="empty-icon">🔍</div>
                <h3>No APIs match your search</h3>
                <p>Try adjusting your search terms or filters</p>
              </>
            )}
          </div>
        ) : (
          <div className="api-grid">
            {filteredApis.map((api) => (
              <div key={api.id} className={`api-card ${getApiStatusClass(api)}`}>
                <div className="api-card-header">
                  <div className="api-selection">
                    <input
                      type="checkbox"
                      checked={selectedApis.has(api.id)}
                      onChange={() => toggleApiSelection(api.id)}
                      className="api-checkbox"
                    />
                    <span className="api-status">{getApiStatusIcon(api)}</span>
                  </div>
                  <div className="api-info">
                    <h3 className="api-name">{api.name}</h3>
                    <div className="api-meta">
                      <span 
                        className="api-method" 
                        style={{ backgroundColor: getMethodColor(api.method) }}
                      >
                        {api.method}
                      </span>
                      <span className="api-uptime">
                        Target: {api.expectedUptime}% uptime
                      </span>
                    </div>
                  </div>
                </div>

                <div className="api-url">
                  <code>{api.url}</code>
                </div>

                {api.description && (
                  <div className="api-description">
                    {api.description}
                  </div>
                )}

                <div className="api-actions">
                  <button
                    onClick={() => handleTest(api.id, api.name)}
                    disabled={loading[api.id]}
                    className="test-btn"
                  >
                    {loading[api.id] ? (
                      <>
                        <div className="btn-spinner"></div>
                        Testing...
                      </>
                    ) : (
                      <>▶️ Test</>
                    )}
                  </button>
                  
                  <button
                    onClick={() => handleSummary(api.id)}
                    disabled={summaryLoading[api.id]}
                    className="summary-btn"
                  >
                    {summaryLoading[api.id] ? (
                      <>
                        <div className="btn-spinner"></div>
                        Loading...
                      </>
                    ) : (
                      <>📈 Analysis</>
                    )}
                  </button>
                </div>

                {batchResults[api.id] && (
                  <div className="test-result-preview">
                    <div className="result-header">
                      <span className="result-status">
                        {batchResults[api.id].success ? '✅ Success' : '❌ Failed'}
                      </span>
                      <span className="result-time">
                        {new Date(batchResults[api.id].timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {batchResults[api.id].success && batchResults[api.id].responseTime && (
                      <div className="result-details">
                        Response: {batchResults[api.id].responseTime}ms
                      </div>
                    )}
                    {!batchResults[api.id].success && (
                      <div className="result-error">
                        {batchResults[api.id].message}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {result && (
        <div className="detailed-result">
          <div className="result-header">
            <h4>🧪 Detailed Test Result</h4>
            <button onClick={() => setResult(null)} className="close-btn">✕</button>
          </div>
          <div className="result-content">
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        </div>
      )}

      {summary && (
        <SummaryCard 
          summary={summary} 
          loading={false}
          error={null}
        />
      )}
    </div>
  );
};

export default ProxyTester;