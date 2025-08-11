// Performance monitoring utilities

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      renderTimes: new Map(),
      apiCalls: new Map(),
      memoryUsage: []
    };
    this.isEnabled = process.env.NODE_ENV === 'development';
  }

  // Track component render time
  trackRender(componentName, renderTime) {
    if (!this.isEnabled) return;

    if (!this.metrics.renderTimes.has(componentName)) {
      this.metrics.renderTimes.set(componentName, []);
    }
    
    this.metrics.renderTimes.get(componentName).push(renderTime);
    
    // Keep only last 100 measurements
    if (this.metrics.renderTimes.get(componentName).length > 100) {
      this.metrics.renderTimes.get(componentName).shift();
    }
  }

  // Track API call performance
  trackAPICall(endpoint, duration, success = true) {
    if (!this.isEnabled) return;

    const key = `${endpoint}_${success ? 'success' : 'error'}`;
    if (!this.metrics.apiCalls.has(key)) {
      this.metrics.apiCalls.set(key, []);
    }
    
    this.metrics.apiCalls.get(key).push(duration);
    
    // Keep only last 50 measurements
    if (this.metrics.apiCalls.get(key).length > 50) {
      this.metrics.apiCalls.get(key).shift();
    }
  }

  // Track memory usage
  trackMemoryUsage() {
    if (!this.isEnabled || !performance.memory) return;

    this.metrics.memoryUsage.push({
      timestamp: Date.now(),
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit
    });

    // Keep only last 100 measurements
    if (this.metrics.memoryUsage.length > 100) {
      this.metrics.memoryUsage.shift();
    }
  }

  // Get performance summary
  getSummary() {
    if (!this.isEnabled) return null;

    const summary = {
      renderTimes: {},
      apiCalls: {},
      memoryUsage: null
    };

    // Calculate render time averages
    for (const [component, times] of this.metrics.renderTimes) {
      const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
      const max = Math.max(...times);
      const min = Math.min(...times);
      
      summary.renderTimes[component] = {
        average: avg.toFixed(2),
        max: max.toFixed(2),
        min: min.toFixed(2),
        count: times.length
      };
    }

    // Calculate API call averages
    for (const [endpoint, durations] of this.metrics.apiCalls) {
      const avg = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
      const max = Math.max(...durations);
      const min = Math.min(...durations);
      
      summary.apiCalls[endpoint] = {
        average: avg.toFixed(2),
        max: max.toFixed(2),
        min: min.toFixed(2),
        count: durations.length
      };
    }

    // Calculate memory usage
    if (this.metrics.memoryUsage.length > 0) {
      const latest = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
      summary.memoryUsage = {
        used: (latest.used / 1024 / 1024).toFixed(2) + ' MB',
        total: (latest.total / 1024 / 1024).toFixed(2) + ' MB',
        limit: (latest.limit / 1024 / 1024).toFixed(2) + ' MB',
        percentage: ((latest.used / latest.limit) * 100).toFixed(1) + '%'
      };
    }

    return summary;
  }

  // Log performance summary to console
  logSummary() {
    if (!this.isEnabled) return;

    const summary = this.getSummary();
    if (!summary) return;

    console.group('🚀 Performance Summary');
    
    if (Object.keys(summary.renderTimes).length > 0) {
      console.group('📊 Component Render Times');
      for (const [component, stats] of Object.entries(summary.renderTimes)) {
        console.log(`${component}: ${stats.average}ms avg (${stats.min}ms - ${stats.max}ms) [${stats.count} renders]`);
      }
      console.groupEnd();
    }

    if (Object.keys(summary.apiCalls).length > 0) {
      console.group('🌐 API Call Performance');
      for (const [endpoint, stats] of Object.entries(summary.apiCalls)) {
        console.log(`${endpoint}: ${stats.average}ms avg (${stats.min}ms - ${stats.max}ms) [${stats.count} calls]`);
      }
      console.groupEnd();
    }

    if (summary.memoryUsage) {
      console.group('💾 Memory Usage');
      console.log(`Used: ${summary.memoryUsage.used}`);
      console.log(`Total: ${summary.memoryUsage.total}`);
      console.log(`Limit: ${summary.memoryUsage.limit}`);
      console.log(`Usage: ${summary.memoryUsage.percentage}`);
      console.groupEnd();
    }

    console.groupEnd();
  }

  // Clear all metrics
  clear() {
    this.metrics.renderTimes.clear();
    this.metrics.apiCalls.clear();
    this.metrics.memoryUsage = [];
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Performance tracking HOC
export const withPerformanceTracking = (WrappedComponent, componentName) => {
  return React.memo((props) => {
    const startTime = performance.now();
    
    const result = <WrappedComponent {...props} />;
    
    const endTime = performance.now();
    performanceMonitor.trackRender(componentName, endTime - startTime);
    
    return result;
  });
};

// API performance tracking wrapper
export const trackAPICall = async (apiCall, endpoint) => {
  const startTime = performance.now();
  
  try {
    const result = await apiCall();
    const endTime = performance.now();
    performanceMonitor.trackAPICall(endpoint, endTime - startTime, true);
    return result;
  } catch (error) {
    const endTime = performance.now();
    performanceMonitor.trackAPICall(endpoint, endTime - startTime, false);
    throw error;
  }
};

// Memory usage tracking
export const startMemoryTracking = (intervalMs = 30000) => {
  if (process.env.NODE_ENV !== 'development') return;

  const interval = setInterval(() => {
    performanceMonitor.trackMemoryUsage();
  }, intervalMs);

  return () => clearInterval(interval);
};

// Export the monitor instance
export default performanceMonitor; 