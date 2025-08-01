import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import './SlaReport.css';

const SlaReport = () => {
  const [apis, setApis] = useState([]);
  const [apiId, setApiId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [apisLoading, setApisLoading] = useState(true);

  // Set default date range (last 24 hours)
  useEffect(() => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    setEnd(formatDateTimeLocal(now));
    setStart(formatDateTimeLocal(yesterday));
  }, []);

  const formatDateTimeLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const fetchApis = useCallback(async () => {
    try {
      setApisLoading(true);
      const res = await axios.get('http://localhost:5000/api/all');
      setApis(res.data);
      setError('');
    } catch (err) {
      setError('Failed to load APIs. Please check your connection.');
      console.error('Failed to fetch APIs:', err);
    } finally {
      setApisLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApis();
  }, [fetchApis]);

  const validateForm = () => {
    if (!apiId) {
      setError('Please select an API');
      return false;
    }
    if (!start || !end) {
      setError('Please select both start and end dates');
      return false;
    }
    if (new Date(start) >= new Date(end)) {
      setError('End date must be after start date');
      return false;
    }
    if (new Date(end) > new Date()) {
      setError('End date cannot be in the future');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setReport(null);
    setError('');

    if (!validateForm()) return;

    try {
      setLoading(true);
      const res = await axios.get(`http://localhost:5000/api/sla-report/${apiId}`, { 
        params: { start, end },
        timeout: 30000 // 30 second timeout
      });
      setReport(res.data);
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        setError('Request timed out. Please try again.');
      } else {
        setError(err.response?.data?.message || 'Error generating SLA report');
      }
      console.error('SLA Report Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = (hours) => {
    const now = new Date();
    const past = new Date(now.getTime() - hours * 60 * 60 * 1000);
    setStart(formatDateTimeLocal(past));
    setEnd(formatDateTimeLocal(now));
  };

  const exportReport = () => {
    if (!report) return;
    
    const reportData = {
      ...report,
      generatedAt: new Date().toISOString(),
      apiName: apis.find(api => api.id === apiId)?.name || 'Unknown API'
    };
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sla-report-${apiId}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getSelectedApiInfo = () => {
    return apis.find(api => api.id === apiId);
  };

  const getSlaStatus = (uptime) => {
    if (uptime >= 99.9) return { status: 'excellent', color: '#10b981', icon: '🟢' };
    if (uptime >= 99.5) return { status: 'good', color: '#f59e0b', icon: '🟡' };
    if (uptime >= 95) return { status: 'warning', color: '#f97316', icon: '🟠' };
    return { status: 'critical', color: '#ef4444', icon: '🔴' };
  };

  return (
    <div className="sla-report-container">
      <div className="sla-header">
        <h2>📋 SLA Performance Report</h2>
        <p>Generate detailed Service Level Agreement reports for your APIs</p>
      </div>

      <div className="report-form-card">
        <form onSubmit={handleSubmit} className="sla-form">
          <div className="form-group">
            <label htmlFor="api-select">Select API</label>
            {apisLoading ? (
              <div className="loading-select">Loading APIs...</div>
            ) : (
              <select 
                id="api-select"
                value={apiId} 
                onChange={(e) => setApiId(e.target.value)} 
                required 
                className="form-input"
              >
                <option value="">Choose an API to analyze</option>
                {apis.map((api) => (
                  <option key={api.id} value={api.id}>
                    {api.name} ({api.method}) - {api.url}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="date-range-section">
            <h4>📅 Time Range</h4>
            <div className="quick-select-buttons">
              <button type="button" onClick={() => handleQuickSelect(1)} className="quick-btn">
                Last Hour
              </button>
              <button type="button" onClick={() => handleQuickSelect(24)} className="quick-btn">
                Last 24h
              </button>
              <button type="button" onClick={() => handleQuickSelect(168)} className="quick-btn">
                Last Week
              </button>
              <button type="button" onClick={() => handleQuickSelect(720)} className="quick-btn">
                Last Month
              </button>
            </div>
            
            <div className="date-inputs">
              <div className="form-group">
                <label htmlFor="start-date">Start Date & Time</label>
                <input 
                  id="start-date"
                  type="datetime-local" 
                  value={start} 
                  onChange={(e) => setStart(e.target.value)} 
                  required 
                  className="form-input"
                  max={formatDateTimeLocal(new Date())}
                />
              </div>
              <div className="form-group">
                <label htmlFor="end-date">End Date & Time</label>
                <input 
                  id="end-date"
                  type="datetime-local" 
                  value={end} 
                  onChange={(e) => setEnd(e.target.value)} 
                  required 
                  className="form-input"
                  max={formatDateTimeLocal(new Date())}
                />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading || apisLoading} className="submit-btn">
            {loading ? (
              <>
                <div className="btn-spinner"></div>
                Generating Report...
              </>
            ) : (
              <>
                📊 Generate SLA Report
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
            {error.includes('connection') && (
              <button onClick={fetchApis} className="retry-btn">
                🔄 Retry
              </button>
            )}
          </div>
        )}
      </div>

      {report && (
        <div className="report-results">
          <div className="report-header">
            <div className="report-title">
              <h3>📊 SLA Report Results</h3>
              {getSelectedApiInfo() && (
                <div className="api-info">
                  <strong>{getSelectedApiInfo().name}</strong> ({getSelectedApiInfo().method})
                  <br />
                  <span className="api-url">{getSelectedApiInfo().url}</span>
                </div>
              )}
            </div>
            <button onClick={exportReport} className="export-btn">
              💾 Export Report
            </button>
          </div>

          <div className="report-period">
            <div className="period-info">
              <span>📅 <strong>Period:</strong> {new Date(report.start).toLocaleString()} - {new Date(report.end).toLocaleString()}</span>
            </div>
            <div className="duration-info">
              <span>⏱️ <strong>Duration:</strong> {Math.round((new Date(report.end) - new Date(report.start)) / (1000 * 60 * 60))} hours</span>
            </div>
          </div>

          <div className="sla-status-banner">
            {(() => {
              const slaStatus = getSlaStatus(parseFloat(report.uptime));
              return (
                <div className={`sla-banner ${slaStatus.status}`}>
                  {slaStatus.icon} SLA Status: {slaStatus.status.toUpperCase()} ({report.uptime}% uptime)
                </div>
              );
            })()}
          </div>

          <div className="report-metrics">
            <div className="metric-card">
              <div className="metric-icon">📈</div>
              <div className="metric-content">
                <span className="metric-label">Total Requests</span>
                <span className="metric-value">{report.totalRequests.toLocaleString()}</span>
              </div>
            </div>

            <div className="metric-card success">
              <div className="metric-icon">✅</div>
              <div className="metric-content">
                <span className="metric-label">Successful</span>
                <span className="metric-value">{report.successCount.toLocaleString()}</span>
                <span className="metric-percentage">({((report.successCount / report.totalRequests) * 100).toFixed(1)}%)</span>
              </div>
            </div>

            <div className="metric-card error">
              <div className="metric-icon">❌</div>
              <div className="metric-content">
                <span className="metric-label">Failed</span>
                <span className="metric-value">{report.errorCount.toLocaleString()}</span>
                <span className="metric-percentage">({((report.errorCount / report.totalRequests) * 100).toFixed(1)}%)</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon">⚡</div>
              <div className="metric-content">
                <span className="metric-label">Avg Response Time</span>
                <span className="metric-value">{report.averageResponseTime} ms</span>
              </div>
            </div>

            <div className="metric-card uptime">
              <div className="metric-icon">📈</div>
              <div className="metric-content">
                <span className="metric-label">Uptime</span>
                <span className="metric-value">{report.uptime}%</span>
              </div>
            </div>

            <div className="metric-card downtime">
              <div className="metric-icon">📉</div>
              <div className="metric-content">
                <span className="metric-label">Downtime</span>
                <span className="metric-value">{report.downtime}%</span>
              </div>
            </div>
          </div>

          <div className="status-breakdown-section">
            <h4>🔍 HTTP Status Code Analysis</h4>
            <div className="status-grid">
              {Object.entries(report.statusBreakdown).map(([code, count]) => {
                const percentage = ((count / report.totalRequests) * 100).toFixed(1);
                const getStatusInfo = (statusCode) => {
                  const code = parseInt(statusCode);
                  if (code >= 200 && code < 300) return { category: 'success', icon: '✅', label: 'Success' };
                  if (code >= 300 && code < 400) return { category: 'redirect', icon: '↩️', label: 'Redirect' };
                  if (code >= 400 && code < 500) return { category: 'client-error', icon: '⚠️', label: 'Client Error' };
                  if (code >= 500) return { category: 'server-error', icon: '❌', label: 'Server Error' };
                  return { category: 'unknown', icon: '❓', label: 'Unknown' };
                };
                
                const statusInfo = getStatusInfo(code);
                
                return (
                  <div key={code} className={`status-card ${statusInfo.category}`}>
                    <div className="status-header">
                      <span className="status-icon">{statusInfo.icon}</span>
                      <span className="status-code">HTTP {code}</span>
                    </div>
                    <div className="status-details">
                      <span className="status-count">{count.toLocaleString()}</span>
                      <span className="status-percentage">{percentage}%</span>
                    </div>
                    <div className="status-label">{statusInfo.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlaReport;