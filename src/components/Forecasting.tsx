import { format, subDays, addDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import {
  TrendingUp,
  Brain,
  Calendar,
  Target,
  AlertTriangle,
  CheckCircle,
  Info,
  BarChart3,
  Activity,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area, AreaChart, ReferenceLine } from 'recharts';

import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface ForecastData {
  date: string;
  actual?: number;
  predicted?: number;
  confidenceMin?: number;
  confidenceMax?: number;
  seasonality?: number;
  trend?: number;
}

interface TrendAnalysis {
  metric: string;
  current: number;
  predicted: number;
  change: number;
  confidence: number;
  trend: 'upward' | 'downward' | 'stable';
  seasonality: 'high' | 'medium' | 'low';
  recommendation: string;
}

interface ForecastingProps {
  data: {
    sales: any[];
    products: any[];
    customers: any[];
  };
}

export default function Forecasting({ data }: ForecastingProps) {
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'orders' | 'customers' | 'products'>('revenue');
  const [forecastPeriod, setForecastPeriod] = useState<'30d' | '60d' | '90d'>('30d');
  const [confidenceLevel, setConfidenceLevel] = useState<'80' | '90' | '95'>('90');

  // Generate forecast data using simple linear regression and seasonality
  const forecastData = useMemo(() => {
    const sales = data.sales.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const daysBack = 90; // Use last 90 days for training
    const forecastDays = forecastPeriod === '30d' ? 30 : forecastPeriod === '60d' ? 60 : 90;

    // Get historical data
    const historicalData = sales.slice(-daysBack);
    const values = historicalData.map(s => {
      switch (selectedMetric) {
        case 'revenue': return s.total || 0;
        case 'orders': return 1; // Each sale is an order
        case 'customers': return s.customerId ? 1 : 0;
        case 'products': return (s.items || []).length;
        default: return s.total || 0;
      }
    });

    // Simple linear regression for trend
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * values[i], 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate seasonality (simple 7-day pattern)
    const seasonalityPattern = Array.from({ length: 7 }, () => 0);
    historicalData.forEach((sale, i) => {
      const dayOfWeek = new Date(sale.date).getDay();
      seasonalityPattern[dayOfWeek] += values[i];
    });

    // Normalize seasonality
    const avgSeasonality = seasonalityPattern.reduce((a, b) => a + b, 0) / 7;
    const normalizedSeasonality = seasonalityPattern.map(s => s / avgSeasonality);

    // Generate forecast
    const forecast: ForecastData[] = [];
    const now = new Date();

    // Add historical data with predictions
    historicalData.forEach((sale, i) => {
      const predicted = slope * i + intercept;
      const seasonalFactor = normalizedSeasonality[new Date(sale.date).getDay()];
      const seasonalPredicted = predicted * (seasonalFactor || 1);

      forecast.push({
        date: format(new Date(sale.date), 'MMM dd'),
        actual: values[i],
        predicted: seasonalPredicted,
        trend: predicted,
        seasonality: seasonalFactor,
      });
    });

    // Add future predictions
    for (let i = 0; i < forecastDays; i++) {
      const futureDate = addDays(now, i + 1);
      const xValue = n + i;
      const predicted = slope * xValue + intercept;
      const seasonalFactor = normalizedSeasonality[futureDate.getDay()];
      const seasonalPredicted = predicted * (seasonalFactor || 1);

      // Calculate confidence intervals (simplified)
      const confidence = confidenceLevel === '80' ? 1.28 : confidenceLevel === '90' ? 1.64 : 1.96;
      const stdError = Math.sqrt(values.reduce((acc, val) => acc + Math.pow(val - (slope * values.indexOf(val) + intercept), 2), 0) / n);
      const margin = confidence * stdError * Math.sqrt(1 + 1 / n + Math.pow(xValue - sumX / n, 2) / (sumX2 - sumX * sumX / n));

      forecast.push({
        date: format(futureDate, 'MMM dd'),
        predicted: seasonalPredicted,
        confidenceMin: Math.max(0, seasonalPredicted - margin),
        confidenceMax: seasonalPredicted + margin,
        trend: predicted,
        seasonality: seasonalFactor,
      });
    }

    return forecast;
  }, [data.sales, selectedMetric, forecastPeriod, confidenceLevel]);

  // Generate trend analysis
  const trendAnalysis = useMemo(() => {
    const analyses: TrendAnalysis[] = [];
    const metrics = ['revenue', 'orders', 'customers', 'products'] as const;

    metrics.forEach(metric => {
      const recentData = data.sales.slice(-30);
      const olderData = data.sales.slice(-60, -30);

      const recentValue = recentData.reduce((sum, s) => {
        switch (metric) {
          case 'revenue': return sum + (s.total || 0);
          case 'orders': return sum + 1;
          case 'customers': return sum + (s.customerId ? 1 : 0);
          case 'products': return sum + (s.items || []).length;
          default: return sum + (s.total || 0);
        }
      }, 0);

      const olderValue = olderData.reduce((sum, s) => {
        switch (metric) {
          case 'revenue': return sum + (s.total || 0);
          case 'orders': return sum + 1;
          case 'customers': return sum + (s.customerId ? 1 : 0);
          case 'products': return sum + (s.items || []).length;
          default: return sum + (s.total || 0);
        }
      }, 0);

      const change = olderValue > 0 ? ((recentValue - olderValue) / olderValue) * 100 : 0;
      const trend = change > 5 ? 'upward' : change < -5 ? 'downward' : 'stable';

      // Simple confidence calculation based on variance
      const values = data.sales.slice(-90).map(s => {
        switch (metric) {
          case 'revenue': return s.total || 0;
          case 'orders': return 1;
          case 'customers': return s.customerId ? 1 : 0;
          case 'products': return (s.items || []).length;
          default: return s.total || 0;
        }
      });

      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
      const confidence = Math.max(0, Math.min(100, 100 - (Math.sqrt(variance) / mean) * 100));

      // Seasonality detection (simplified)
      const weeklyPattern = Array.from({ length: 7 }, () => 0);
      data.sales.slice(-56).forEach((sale, i) => {
        const dayOfWeek = new Date(sale.date).getDay();
        const value = metric === 'revenue' ? sale.total || 0 :
          metric === 'orders' ? 1 :
            metric === 'customers' ? (sale.customerId ? 1 : 0) :
              (sale.items || []).length;
        weeklyPattern[dayOfWeek] += value;
      });

      const avgWeekly = weeklyPattern.reduce((a, b) => a + b, 0) / 7;
      const seasonalityVariance = weeklyPattern.reduce((acc, val) => acc + Math.pow(val - avgWeekly, 2), 0) / 7;
      const seasonality = seasonalityVariance > avgWeekly * 0.5 ? 'high' :
        seasonalityVariance > avgWeekly * 0.2 ? 'medium' : 'low';

      const recommendations = {
        revenue: trend === 'upward' ? 'Consider scaling operations and marketing efforts' :
          trend === 'downward' ? 'Review pricing strategy and customer acquisition' :
            'Maintain current strategy and monitor for changes',
        orders: trend === 'upward' ? 'Ensure inventory and staffing can handle increased volume' :
          trend === 'downward' ? 'Investigate conversion funnel and user experience' :
            'Optimize order processing and customer service',
        customers: trend === 'upward' ? 'Focus on customer retention and upselling' :
          trend === 'downward' ? 'Enhance marketing and improve customer experience' :
            'Implement loyalty programs and gather feedback',
        products: trend === 'upward' ? 'Expand product line and optimize inventory' :
          trend === 'downward' ? 'Review product mix and pricing' :
            'Analyze product performance and customer preferences',
      };

      analyses.push({
        metric: metric.charAt(0).toUpperCase() + metric.slice(1),
        current: recentValue,
        predicted: recentValue * (1 + change / 100),
        change,
        confidence,
        trend,
        seasonality,
        recommendation: recommendations[metric],
      });
    });

    return analyses;
  }, [data.sales]);

  // Generate insights
  const insights = useMemo(() => {
    const forecast = forecastData.filter(d => d.predicted && !d.actual);
    const historical = forecastData.filter(d => d.actual);

    if (forecast.length === 0 || historical.length === 0) return [];

    const avgHistorical = historical.reduce((sum, d) => sum + (d.actual || 0), 0) / historical.length;
    const avgForecast = forecast.reduce((sum, d) => sum + (d.predicted || 0), 0) / forecast.length;
    const growth = ((avgForecast - avgHistorical) / avgHistorical) * 100;

    const insights = [];

    if (growth > 10) {
      insights.push({
        type: 'positive',
        title: 'Strong Growth Expected',
        description: `Forecast shows ${growth.toFixed(1)}% growth in ${selectedMetric}. Prepare for increased demand.`,
        icon: TrendingUp,
        color: 'text-emerald-600',
      });
    } else if (growth < -10) {
      insights.push({
        type: 'warning',
        title: 'Decline Forecasted',
        description: `Forecast shows ${Math.abs(growth).toFixed(1)}% decline in ${selectedMetric}. Consider intervention strategies.`,
        icon: AlertTriangle,
        color: 'text-amber-600',
      });
    }

    // Check for seasonality
    const seasonalVariation = Math.max(...forecast.map(d => d.seasonality || 1)) -
                             Math.min(...forecast.map(d => d.seasonality || 1));
    if (seasonalVariation > 0.3) {
      insights.push({
        type: 'info',
        title: 'Strong Seasonality Detected',
        description: `${selectedMetric} shows significant weekly patterns. Plan accordingly.`,
        icon: Calendar,
        color: 'text-blue-600',
      });
    }

    // Confidence check
    const avgConfidence = trendAnalysis.reduce((sum, t) => sum + t.confidence, 0) / trendAnalysis.length;
    if (avgConfidence < 70) {
      insights.push({
        type: 'warning',
        title: 'Low Forecast Confidence',
        description: 'High variability in data. Consider collecting more data or using different models.',
        icon: Info,
        color: 'text-amber-600',
      });
    }

    return insights;
  }, [forecastData, selectedMetric, trendAnalysis]);

  const formatValue = (value: number) => {
    switch (selectedMetric) {
      case 'revenue':
        return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
      case 'orders':
      case 'customers':
      case 'products':
        return Math.round(value).toLocaleString();
      default:
        return value.toFixed(0);
    }
  };

  const getTrendColor = (trend: 'upward' | 'downward' | 'stable') => {
    switch (trend) {
      case 'upward': return 'text-emerald-600 bg-emerald-50';
      case 'downward': return 'text-rose-600 bg-rose-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSeasonalityColor = (seasonality: 'high' | 'medium' | 'low') => {
    switch (seasonality) {
      case 'high': return 'text-purple-600 bg-purple-50';
      case 'medium': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Forecasting & Trend Analysis</h2>
        <div className="flex gap-3">
          <Select value={selectedMetric} onValueChange={(value: any) => setSelectedMetric(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="orders">Orders</SelectItem>
              <SelectItem value="customers">Customers</SelectItem>
              <SelectItem value="products">Products</SelectItem>
            </SelectContent>
          </Select>

          <Select value={forecastPeriod} onValueChange={(value: any) => setForecastPeriod(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="60d">60 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={confidenceLevel} onValueChange={(value: any) => setConfidenceLevel(value)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="80">80%</SelectItem>
              <SelectItem value="90">90%</SelectItem>
              <SelectItem value="95">95%</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.map((insight, index) => {
            const Icon = insight.icon;
            return (
              <Card key={index} className="p-4 bg-white/50 backdrop-blur-sm border-white/20">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${insight.color} bg-opacity-10`}>
                    <Icon className={`h-5 w-5 ${insight.color}`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Forecast Chart */}
      <Card className="p-6 bg-white/50 backdrop-blur-sm border-white/20">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)} Forecast
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={forecastData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis tickFormatter={(value) => formatValue(value)} />
            <Tooltip formatter={(value) => formatValue(value as number)} />
            <Legend />

            {/* Actual values */}
            <Area
              type="monotone"
              dataKey="actual"
              stroke="#4F46E5"
              fill="#4F46E5"
              fillOpacity={0.6}
              name="Actual"
            />

            {/* Predicted values */}
            <Area
              type="monotone"
              dataKey="predicted"
              stroke="#10B981"
              fill="#10B981"
              fillOpacity={0.4}
              strokeDasharray="5 5"
              name="Predicted"
            />

            {/* Confidence intervals */}
            <Area
              type="monotone"
              dataKey="confidenceMax"
              stroke="transparent"
              fill="#10B981"
              fillOpacity={0.1}
              name="Upper Bound"
            />
            <Area
              type="monotone"
              dataKey="confidenceMin"
              stroke="transparent"
              fill="#ffffff"
              fillOpacity={0.8}
              name="Lower Bound"
            />

            {/* Reference line for today */}
            <ReferenceLine
              x={forecastData.find(d => d.actual)?.date}
              stroke="#EF4444"
              strokeDasharray="5 5"
              label="Today"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Trend Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-white/50 backdrop-blur-sm border-white/20">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Trend Analysis</h3>
          <div className="space-y-4">
            {trendAnalysis.map((analysis, index) => (
              <div key={index} className="border-b border-gray-200 pb-4 last:border-0">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900">{analysis.metric}</h4>
                  <Badge className={getTrendColor(analysis.trend)}>
                    {analysis.trend}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Current: </span>
                    <span className="font-medium">{formatValue(analysis.current)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Predicted: </span>
                    <span className="font-medium">{formatValue(analysis.predicted)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Change: </span>
                    <span className={`font-medium ${analysis.change > 0 ? 'text-emerald-600' : analysis.change < 0 ? 'text-rose-600' : 'text-gray-600'}`}>
                      {analysis.change > 0 ? '+' : ''}{analysis.change.toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Confidence: </span>
                    <span className="font-medium">{analysis.confidence.toFixed(0)}%</span>
                  </div>
                </div>

                <div className="mt-2">
                  <Badge variant="outline" className={getSeasonalityColor(analysis.seasonality)}>
                    Seasonality: {analysis.seasonality}
                  </Badge>
                </div>

                <p className="text-sm text-gray-600 mt-2">{analysis.recommendation}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Seasonality Pattern */}
        <Card className="p-6 bg-white/50 backdrop-blur-sm border-white/20">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Seasonality Pattern</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={forecastData.slice(0, 7).map((d, i) => ({
              day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i],
              actual: d.actual || 0,
              predicted: d.predicted || 0,
              seasonality: (d.seasonality || 1) * 100,
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="actual" fill="#4F46E5" name="Actual" />
              <Bar dataKey="predicted" fill="#10B981" name="Predicted" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Model Information */}
      <Card className="p-6 bg-white/50 backdrop-blur-sm border-white/20">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Model Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Model Type</h4>
            <p className="text-sm text-gray-600">Linear Regression with Seasonality Adjustment</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Training Data</h4>
            <p className="text-sm text-gray-600">Last 90 days of historical data</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Confidence Level</h4>
            <p className="text-sm text-gray-600">{confidenceLevel}% confidence intervals</p>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">About this forecast</p>
              <p>This forecast uses historical data patterns to predict future values. The confidence intervals show the range where actual values are likely to fall. Consider multiple factors when making business decisions.</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
