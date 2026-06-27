import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="text-sm text-gray-600 mb-1">{label}</p>
        <p className="text-sm font-semibold text-blue-600">
          Success Rate: {payload[0].value.toFixed(1)}%
        </p>
      </div>
    );
  }
  return null;
};

const ImprovementChart = ({ performanceHistory = [] }) => {
  const formattedData = performanceHistory.map((entry) => ({
    date: entry.date,
    success_rate: typeof entry.success_rate === 'number' ? entry.success_rate : 0,
  }));

  if (formattedData.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">No performance data available</p>
      </div>
    );
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={formattedData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 20,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: '#666' }}
            tickLine={{ stroke: '#ccc' }}
            axisLine={{ stroke: '#ccc' }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12, fill: '#666' }}
            tickLine={{ stroke: '#ccc' }}
            axisLine={{ stroke: '#ccc' }}
            tickFormatter={(value) => `${value}%`}
            label={{
              value: 'Success Rate (%)',
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle', fill: '#666', fontSize: 12 },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="success_rate"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: '#1d4ed8', strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ImprovementChart;
