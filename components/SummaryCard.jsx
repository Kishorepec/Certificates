import React from 'react';
import './SummaryCard.css';

const SummaryCard = ({ summary, loading = false, error = null }) => {
  if (loading) {
    return (
      <div className="summary-card loading">
        <div className="loading-spinner"></div>
        <p>Loading summary data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="summary-card error">
        <h3>❌ Error Loading Summary</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!summary) return null;

  const uptime = ((summary.successCount / summary.totalRequests) * 100).toFixed(2);
  const downtime = (100 - uptime).toFixed(2);
  const errorRate = ((summary.errorCount / summary.totalRequests) * 100).toFixed(2);

  // Determine health status
  const getHealthStatus = (uptimePercent) => {
    if (uptimePercent >= 99.5) return { status: 'excellent', color: '#10b981', icon: '🟢' };
    if (uptimePercent >= 95) return { status: 'good', color: '#f59e0b', icon: '🟡' };
    return { status: 'poor', color: '#ef4444', icon: '🔴' };
  };

  const health = getHealthStatus(parseFloat(uptime));

  // Format response time with appropriate units
  const formatResponseTime = (ms) => {
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  };

  // Get status code category
  const getStatusCategory = (code) => {
    const statusCode = parseInt(code);
    if (statusCode >= 200 && statusCode < 300) return { category: 'success', icon: '✅' };
    if (statusCode >= 300 && statusCode < 400) return { category: 'redirect', icon: '↩️' };
    if (statusCode >= 400 && statusCode < 500) return { category: 'client-error', icon: '⚠️' };
    if (statusCode >= 500) return { category: 'server-error', icon: '❌' };
    return { category: 'unknown', icon: '❓' };
  };

  return (
    <div className="summary-card">
      <div className="card-header">
        <h3>📊 API Performance Summary</h3>
        <div className={`health-badge ${health.status}`}>
          {health.icon} {health.status.toUpperCase()}
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-item">
          <div className="metric-icon">📈</div>
          <div className="metric-content">
            <span className="metric-label">Total Requests</span>
            <span className="metric-value">{summary.totalRequests.toLocaleString()}</span>
          </div>
        </div>

        <div className="metric-item success">
          <div className="metric-icon">✅</div>
          <div className="metric-content">
            <span className="metric-label">Success Count</span>
            <span className="metric-value">{summary.successCount.toLocaleString()}</span>
          </div>
        </div>

        <div className="metric-item error">
          <div className="metric-icon">❌</div>
          <div className="metric-content">
            <span className="metric-label">Error Count</span>
            <span className="metric-value">{summary.errorCount.toLocaleString()}</span>
          </div>
        </div>

        <div className="metric-item">
          <div className="metric-icon">⚡</div>
          <div className="metric-content">
            <span className="metric-label">Avg Response Time</span>
            <span className="metric-value">{formatResponseTime(summary.averageResponseTime)}</span>
          </div>
        </div>
      </div>

      <div className="uptime-section">
        <div className="uptime-bar-container">
          <div className="uptime-labels">
            <span>📈 Uptime: {uptime}%</span>
            <span>📉 Downtime: {downtime}%</span>
          </div>
          <div className="uptime-bar">
            <div 
              className="uptime-fill" 
              style={{ 
                width: `${uptime}%`,
                backgroundColor: health.color 
              }}
            ></div>
          </div>
        </div>
        
        <div className="error-rate">
          <span>🚨 Error Rate: {errorRate}%</span>
        </div>
      </div>

      <div className="status-breakdown">
        <h4>📋 Status Code Breakdown</h4>
        <div className="status-list">
          {Object.entries(summary.statusBreakdown).map(([code, count]) => {
            const { category, icon } = getStatusCategory(code);
            const percentage = ((count / summary.totalRequests) * 100).toFixed(1);
            
            return (
              <div key={code} className={`status-item ${category}`}>
                <span className="status-code">
                  {icon} {code}
                </span>
                <span className="status-count">{count.toLocaleString()}</span>
                <span className="status-percentage">({percentage}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card-footer">
        <small>Last updated: {new Date().toLocaleString()}</small>
      </div>
    </div>
  );
};

export default SummaryCard;