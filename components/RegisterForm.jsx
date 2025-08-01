import React, { useState } from 'react';
import axios from 'axios';
import './RegisterForm.css';

const RegisterForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    method: 'GET',
    expectedUptime: 99.0,
    headers: {},
    timeout: 5000,
    description: '',
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [testingUrl, setTestingUrl] = useState(false);
  const [urlTestResult, setUrlTestResult] = useState(null);
  const [customHeaders, setCustomHeaders] = useState([{ key: '', value: '' }]);
  const [errors, setErrors] = useState({});

  const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'API name is required';
    } else if (formData.name.length < 3) {
      newErrors.name = 'API name must be at least 3 characters';
    }

    if (!formData.url.trim()) {
      newErrors.url = 'URL is required';
    } else {
      try {
        new URL(formData.url);
      } catch {
        newErrors.url = 'Please enter a valid URL';
      }
    }

    if (formData.expectedUptime < 0 || formData.expectedUptime > 100) {
      newErrors.expectedUptime = 'Expected uptime must be between 0 and 100';
    }

    if (formData.timeout < 1000 || formData.timeout > 30000) {
      newErrors.timeout = 'Timeout must be between 1000ms and 30000ms';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'expectedUptime' || name === 'timeout' ? parseFloat(value) || 0 : value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleHeaderChange = (index, field, value) => {
    const newHeaders = [...customHeaders];
    newHeaders[index][field] = value;
    setCustomHeaders(newHeaders);

    // Update formData headers
    const headersObj = {};
    newHeaders.forEach(header => {
      if (header.key && header.value) {
        headersObj[header.key] = header.value;
      }
    });
    setFormData(prev => ({ ...prev, headers: headersObj }));
  };

  const addHeader = () => {
    setCustomHeaders([...customHeaders, { key: '', value: '' }]);
  };

  const removeHeader = (index) => {
    const newHeaders = customHeaders.filter((_, i) => i !== index);
    setCustomHeaders(newHeaders);
    
    // Update formData headers
    const headersObj = {};
    newHeaders.forEach(header => {
      if (header.key && header.value) {
        headersObj[header.key] = header.value;
      }
    });
    setFormData(prev => ({ ...prev, headers: headersObj }));
  };

  const testUrl = async () => {
    if (!formData.url) {
      setMessage('Please enter a URL to test');
      return;
    }

    try {
      setTestingUrl(true);
      setUrlTestResult(null);
      
      const response = await axios.get(`http://localhost:5000/api/test-url`, {
        params: {
          url: formData.url,
          method: formData.method,
          timeout: formData.timeout
        },
        timeout: formData.timeout + 5000
      });

      setUrlTestResult({
        success: true,
        status: response.data.status,
        responseTime: response.data.responseTime,
        message: 'URL is accessible!'
      });
    } catch (err) {
      setUrlTestResult({
        success: false,
        message: err.response?.data?.message || 'URL test failed',
        error: err.message
      });
    } finally {
      setTestingUrl(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    
    if (!validateForm()) {
      setMessage('Please fix the errors above');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post('http://localhost:5000/api/register', formData);
      setMessage(response.data.message || 'API registered successfully! 🎉');
      
      // Reset form on success
      setFormData({
        name: '',
        url: '',
        method: 'GET',
        expectedUptime: 99.0,
        headers: {},
        timeout: 5000,
        description: '',
      });
      setCustomHeaders([{ key: '', value: '' }]);
      setUrlTestResult(null);
      setErrors({});
    } catch (err) {
      setMessage('Registration failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="register-form-container">
      <div className="form-header">
        <h2>📝 Register New API Endpoint</h2>
        <p>Add a new API endpoint to monitor its performance and availability</p>
      </div>

      <div className="form-card">
        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-section">
            <h3>🔧 Basic Information</h3>
            
            <div className="form-group">
              <label htmlFor="name">API Name *</label>
              <input
                id="name"
                name="name"
                placeholder="e.g., User Authentication API"
                value={formData.name}
                onChange={handleChange}
                required
                className={`form-input ${errors.name ? 'error' : ''}`}
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                placeholder="Brief description of what this API does..."
                value={formData.description}
                onChange={handleChange}
                className="form-textarea"
                rows={3}
              />
            </div>
          </div>

          <div className="form-section">
            <h3>🌐 Endpoint Configuration</h3>
            
            <div className="url-test-group">
              <div className="form-group">
                <label htmlFor="url">API URL *</label>
                <div className="url-input-container">
                  <input
                    id="url"
                    type="url"
                    name="url"
                    placeholder="https://api.example.com/endpoint"
                    value={formData.url}
                    onChange={handleChange}
                    required
                    className={`form-input ${errors.url ? 'error' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={testUrl}
                    disabled={testingUrl || !formData.url}
                    className="test-url-btn"
                  >
                    {testingUrl ? (
                      <>
                        <div className="btn-spinner"></div>
                        Testing...
                      </>
                    ) : (
                      <>🧪 Test</>
                    )}
                  </button>
                </div>
                {errors.url && <span className="error-text">{errors.url}</span>}
              </div>

              {urlTestResult && (
                <div className={`url-test-result ${urlTestResult.success ? 'success' : 'error'}`}>
                  <div className="test-result-header">
                    <span className="test-icon">
                      {urlTestResult.success ? '✅' : '❌'}
                    </span>
                    <span className="test-message">{urlTestResult.message}</span>
                  </div>
                  {urlTestResult.success && (
                    <div className="test-details">
                      <span>Status: {urlTestResult.status}</span>
                      <span>Response Time: {urlTestResult.responseTime}ms</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="method-timeout-group">
              <div className="form-group">
                <label htmlFor="method">HTTP Method</label>
                <select
                  id="method"
                  name="method"
                  value={formData.method}
                  onChange={handleChange}
                  className="form-input method-select"
                >
                  {httpMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
                <div className="method-indicator" style={{ backgroundColor: getMethodColor(formData.method) }}>
                  {formData.method}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="timeout">Timeout (ms)</label>
                <input
                  id="timeout"
                  type="number"
                  name="timeout"
                  min="1000"
                  max="30000"
                  step="1000"
                  value={formData.timeout}
                  onChange={handleChange}
                  className={`form-input ${errors.timeout ? 'error' : ''}`}
                />
                {errors.timeout && <span className="error-text">{errors.timeout}</span>}
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>📋 Headers Configuration</h3>
            <p className="section-description">Add custom headers for your API requests</p>
            
            <div className="headers-container">
              {customHeaders.map((header, index) => (
                <div key={index} className="header-row">
                  <input
                    type="text"
                    placeholder="Header name (e.g., Authorization)"
                    value={header.key}
                    onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
                    className="form-input header-key"
                  />
                  <input
                    type="text"
                    placeholder="Header value (e.g., Bearer token123)"
                    value={header.value}
                    onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                    className="form-input header-value"
                  />
                  {customHeaders.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeHeader(index)}
                      className="remove-header-btn"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addHeader} className="add-header-btn">
                ➕ Add Header
              </button>
            </div>
          </div>

          <div className="form-section">
            <h3>📈 Performance Expectations</h3>
            
            <div className="form-group">
              <label htmlFor="expectedUptime">Expected Uptime (%)</label>
              <div className="uptime-input-container">
                <input
                  id="expectedUptime"
                  type="number"
                  name="expectedUptime"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.expectedUptime}
                  onChange={handleChange}
                  className={`form-input ${errors.expectedUptime ? 'error' : ''}`}
                />
                <div className="uptime-indicator">
                  <div className={`uptime-badge ${formData.expectedUptime >= 99.5 ? 'excellent' : formData.expectedUptime >= 95 ? 'good' : 'poor'}`}>
                    {formData.expectedUptime >= 99.5 ? '🟢 Excellent' : formData.expectedUptime >= 95 ? '🟡 Good' : '🔴 Needs Improvement'}
                  </div>
                </div>
              </div>
              {errors.expectedUptime && <span className="error-text">{errors.expectedUptime}</span>}
            </div>
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? (
              <>
                <div className="btn-spinner"></div>
                Registering API...
              </>
            ) : (
              <>
                🚀 Register API
              </>
            )}
          </button>
        </form>

        {message && (
          <div className={`message ${message.includes('successfully') || message.includes('🎉') ? 'success' : 'error'}`}>
            <span className="message-icon">
              {message.includes('successfully') || message.includes('🎉') ? '✅' : '⚠️'}
            </span>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default RegisterForm;