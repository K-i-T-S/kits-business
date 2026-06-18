import { format, addDays } from 'date-fns';
import {
  TrendingUp,
  Calendar,
  AlertTriangle,
  Info,
  BarChart3,
  Users,
  TrendingDown,
  Award,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area, AreaChart, ReferenceLine, Cell } from 'recharts';

import type { Sale, Product, Customer } from '../context/AppContext';

import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

// ── Lebanese Public Holiday Calendar ─────────────────────────────────────────
// Format: 'MM-DD' → { name, multiplier }
// multiplier > 1 = sales spike (e.g. Christmas), < 1 = sales dip (closures)
const LEBANESE_HOLIDAYS: Record<string, { name: string; multiplier: number }> = {
  '01-01': { name: "New Year's Day", multiplier: 0.7 },
  '02-09': { name: "St. Maroun's Day", multiplier: 1.1 },
  '03-25': { name: 'Annunciation Day', multiplier: 0.8 },
  '05-01': { name: 'Labour Day', multiplier: 0.6 },
  '05-06': { name: "Martyrs' Day", multiplier: 0.7 },
  '08-15': { name: 'Assumption of Mary', multiplier: 0.8 },
  '11-22': { name: 'Independence Day', multiplier: 0.6 },
  '12-25': { name: 'Christmas Day', multiplier: 1.5 },
  // Ramadan and Eid: dynamic, skip (require lunar calendar)
};

function getHolidayKey(date: Date): string {
  return format(date, 'MM-dd');
}

interface ForecastData {
  date: string;
  actual?: number;
  predicted?: number;
  confidenceMin?: number;
  confidenceMax?: number;
  seasonality?: number;
  trend?: number;
  holiday?: string;
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
    sales: Sale[];
    products: Product[];
    customers: Customer[];
  };
}

export default function Forecasting({ data }: ForecastingProps) {
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'orders' | 'customers' | 'products'>('revenue');
  const [forecastPeriod, setForecastPeriod] = useState<'30d' | '60d' | '90d'>('30d');
  const [confidenceLevel, setConfidenceLevel] = useState<'80' | '90' | '95'>('90');

  // Generate forecast data using simple linear regression and seasonality
  const forecastData = useMemo(() => {
    if (data.sales.length < 7) return [];

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
    const sumXY = x.reduce((acc, xi, i) => acc + xi * (values[i] ?? 0), 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate seasonality (simple 7-day pattern)
    const seasonalityPattern = Array.from({ length: 7 }, () => 0);
    historicalData.forEach((sale, i) => {
      const dayOfWeek = new Date(sale.date).getDay();
      seasonalityPattern[dayOfWeek] = (seasonalityPattern[dayOfWeek] ?? 0) + (values[i] ?? 0);
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

    // Add future predictions with Lebanese holiday adjustments
    for (let i = 0; i < forecastDays; i++) {
      const futureDate = addDays(now, i + 1);
      const xValue = n + i;
      const predicted = slope * xValue + intercept;
      const seasonalFactor = normalizedSeasonality[futureDate.getDay()];

      // Apply Lebanese holiday multiplier if applicable
      const holidayKey = getHolidayKey(futureDate);
      const holiday = LEBANESE_HOLIDAYS[holidayKey];
      const holidayMultiplier = holiday ? holiday.multiplier : 1;

      const seasonalPredicted = predicted * (seasonalFactor || 1) * holidayMultiplier;

      // Calculate confidence intervals (simplified)
      const confidence = confidenceLevel === '80' ? 1.28 : confidenceLevel === '90' ? 1.64 : 1.96;
      const stdError = Math.sqrt(values.reduce((acc, val) => acc + Math.pow(val - (slope * values.indexOf(val) + intercept), 2), 0) / n);
      const margin = confidence * stdError * Math.sqrt(1 + 1 / n + Math.pow(xValue - sumX / n, 2) / (sumX2 - sumX * sumX / n));

      forecast.push({
        date: format(futureDate, 'MMM dd'),
        predicted: Math.max(0, seasonalPredicted),
        confidenceMin: Math.max(0, seasonalPredicted - margin),
        confidenceMax: seasonalPredicted + margin,
        trend: predicted,
        seasonality: seasonalFactor,
        holiday: holiday?.name,
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
        weeklyPattern[dayOfWeek] = (weeklyPattern[dayOfWeek] ?? 0) + value;
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

  // ── Margin Analysis ───────────────────────────────────────────────────────
  const marginAnalysis = useMemo(() => {
    const marginData = data.products
      .filter(p => {
        // Use first variant's cost/price if available
        const variant = p.variants[0];
        return variant && variant.cost > 0 && variant.price > 0;
      })
      .map(p => {
        const variant = p.variants[0]!;
        const margin = ((variant.price - variant.cost) / variant.price) * 100;
        return {
          name: p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name,
          margin: parseFloat(margin.toFixed(1)),
          price: variant.price,
        };
      })
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 5);

    const productsWithMargin = data.products.filter(p => {
      const variant = p.variants[0];
      return variant && variant.cost > 0 && variant.price > 0;
    });

    const healthyCount = productsWithMargin.filter(p => {
      const variant = p.variants[0]!;
      return ((variant.price - variant.cost) / variant.price) * 100 > 30;
    }).length;

    const marginHealth = productsWithMargin.length > 0
      ? Math.round((healthyCount / productsWithMargin.length) * 100)
      : 0;

    return { marginData, marginHealth, total: productsWithMargin.length };
  }, [data.products]);

  // ── Customer Lifetime Value ────────────────────────────────────────────────
  const clvData = useMemo(() => {
    // Aggregate sales per customer
    const customerSpend: Record<string, { total: number; count: number }> = {};

    data.sales.forEach(sale => {
      if (!sale.customerId) return;
      if (!customerSpend[sale.customerId]) {
        customerSpend[sale.customerId] = { total: 0, count: 0 };
      }
      customerSpend[sale.customerId]!.total += sale.total || 0;
      customerSpend[sale.customerId]!.count += 1;
    });

    // Determine observation period in months (use date range of sales)
    const saleDates = data.sales.map(s => new Date(s.date).getTime());
    const minDate = saleDates.length > 0 ? Math.min(...saleDates) : Date.now();
    const maxDate = saleDates.length > 0 ? Math.max(...saleDates) : Date.now();
    const observationMonths = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24 * 30));

    return data.customers
      .filter(c => customerSpend[c.id])
      .map(c => {
        const spend = customerSpend[c.id]!;
        const avgOrder = spend.count > 0 ? spend.total / spend.count : 0;
        const monthlyVisits = spend.count / observationMonths;
        const estimatedCLV = avgOrder * monthlyVisits * 12;
        return {
          name: c.name,
          totalSpend: spend.total,
          visitCount: spend.count,
          avgOrder,
          estimatedCLV,
        };
      })
      .sort((a, b) => b.estimatedCLV - a.estimatedCLV)
      .slice(0, 5);
  }, [data.sales, data.customers]);

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

  if (data.sales.length < 7) {
    return (
      <div className="py-20 text-center">
        <BarChart3 className="h-12 w-12 text-white/30 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-white mb-2">Forecasting & Trend Analysis</h2>
        <p className="text-white/60 max-w-md mx-auto">Need at least 7 days of sales data for forecasting. Make more sales and check back later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Forecasting & Trend Analysis</h2>
        <div className="flex gap-3">
          <Select value={selectedMetric} onValueChange={(value: 'revenue' | 'orders' | 'customers' | 'products') => setSelectedMetric(value)}>
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

          <Select value={forecastPeriod} onValueChange={(value: '30d' | '60d' | '90d') => setForecastPeriod(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="60d">60 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={confidenceLevel} onValueChange={(value: '80' | '90' | '95') => setConfidenceLevel(value)}>
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

            {/* Lebanese holiday reference lines */}
            {forecastData
              .filter(d => d.holiday && !d.actual)
              .map((d, i) => (
                <ReferenceLine
                  key={i}
                  x={d.date}
                  stroke="#F59E0B"
                  strokeDasharray="3 3"
                  label={{ value: '🎉', position: 'top', fontSize: 10 }}
                />
              ))}
          </AreaChart>
        </ResponsiveContainer>

        {/* Holiday legend */}
        {forecastData.some(d => d.holiday && !d.actual) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {forecastData
              .filter(d => d.holiday && !d.actual)
              .map((d, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs text-amber-300">
                  <span>📅</span>
                  {d.date} — {d.holiday}
                </span>
              ))}
          </div>
        )}
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
              <p>This forecast uses historical data patterns to predict future values. The confidence intervals show the range where actual values are likely to fall. Lebanese public holidays are factored in with adjusted multipliers. Consider multiple factors when making business decisions.</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Margin Analysis */}
      {marginAnalysis.marginData.length > 0 && (
        <Card className="p-6 bg-white/5 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <h3 className="text-lg font-semibold text-white">Margin Analysis</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/60">Margin Health</span>
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                marginAnalysis.marginHealth >= 60
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : marginAnalysis.marginHealth >= 30
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {marginAnalysis.marginHealth}% of products &gt;30% margin
              </span>
            </div>
          </div>

          <p className="text-sm text-white/50 mb-4">Top 5 products by gross margin (based on first variant)</p>

          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={marginAnalysis.marginData}
              layout="vertical"
              margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
              />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Margin']}
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: 'rgba(255,255,255,0.8)' }}
                itemStyle={{ color: '#10B981' }}
              />
              <Bar dataKey="margin" radius={[0, 4, 4, 0]}>
                {marginAnalysis.marginData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.margin >= 30 ? '#10B981' : entry.margin >= 15 ? '#F59E0B' : '#EF4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Customer Lifetime Value */}
      {clvData.length > 0 && (
        <Card className="p-6 bg-white/5 border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-indigo-400" />
            <h3 className="text-lg font-semibold text-white">Top Customers by Lifetime Value</h3>
          </div>
          <p className="text-sm text-white/50 mb-4">
            Estimated annual CLV = avg order × monthly visit rate × 12
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-4 text-white/50 font-medium">#</th>
                  <th className="text-left py-2 pr-4 text-white/50 font-medium">Customer</th>
                  <th className="text-right py-2 pr-4 text-white/50 font-medium">Total Spend</th>
                  <th className="text-right py-2 pr-4 text-white/50 font-medium">Visits</th>
                  <th className="text-right py-2 pr-4 text-white/50 font-medium">Avg Order</th>
                  <th className="text-right py-2 text-white/50 font-medium">Est. Annual CLV</th>
                </tr>
              </thead>
              <tbody>
                {clvData.map((customer, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 pr-4 text-white/40">
                      {i === 0 ? <Award className="h-4 w-4 text-amber-400" /> : i + 1}
                    </td>
                    <td className="py-3 pr-4 text-white font-medium">{customer.name}</td>
                    <td className="py-3 pr-4 text-right text-white/80">
                      ${customer.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 pr-4 text-right text-white/80">{customer.visitCount}</td>
                    <td className="py-3 pr-4 text-right text-white/80">
                      ${customer.avgOrder.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 text-right font-semibold text-emerald-400">
                      ${customer.estimatedCLV.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {clvData.length === 0 && (
            <div className="flex flex-col items-center py-8 text-white/40">
              <TrendingDown className="h-8 w-8 mb-2" />
              <p className="text-sm">No customer purchase data available yet.</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
