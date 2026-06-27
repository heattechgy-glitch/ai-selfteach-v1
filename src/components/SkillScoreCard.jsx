import React from 'react';
import PropTypes from 'prop-types';

const SkillScoreCard = ({ task_type, success_rate, trend = 'up' }) => {
  // Determine color based on success rate
  const getColor = (rate) => {
    if (rate < 50) return '#ef4444'; // red
    if (rate <= 80) return '#eab308'; // yellow
    return '#22c55e'; // green
  };

  const color = getColor(success_rate);
  
  // Calculate circle progress
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (success_rate / 100) * circumference;

  // Trend arrow component
  const TrendArrow = ({ direction }) => {
    if (direction === 'up') {
      return (
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="#22c55e" 
          strokeWidth="2"
          aria-label="Trending up"
        >
          <path d="M23 6l-9.5 9.5-5-5L1 18" />
          <path d="M17 6h6v6" />
        </svg>
      );
    } else if (direction === 'down') {
      return (
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="#ef4444" 
          strokeWidth="2"
          aria-label="Trending down"
        >
          <path d="M23 18l-9.5-9.5-5 5L1 6" />
          <path d="M17 18h6v-6" />
        </svg>
      );
    }
    return (
      <svg 
        width="16" 
        height="16" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="#6b7280" 
        strokeWidth="2"
        aria-label="No change"
      >
        <path d="M5 12h14" />
      </svg>
    );
  };

  return (
    <div 
      className="skill-score-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        minWidth: '160px',
      }}
    >
      {/* Category Heading */}
      <h3 
        style={{
          margin: '0 0 16px 0',
          fontSize: '14px',
          fontWeight: '600',
          color: '#374151',
          textTransform: 'capitalize',
          textAlign: 'center',
        }}
      >
        {task_type}
      </h3>

      {/* Circular Progress Indicator */}
      <div 
        style={{ 
          position: 'relative', 
          width: '100px', 
          height: '100px',
        }}
      >
        <svg 
          width="100" 
          height="100" 
          viewBox="0 0 100 100"
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: 'stroke-dashoffset 0.5s ease-in-out, stroke 0.3s ease',
            }}
          />
        </svg>
        {/* Percentage text in center */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '20px',
              fontWeight: '700',
              color: color,
            }}
          >
            {Math.round(success_rate)}%
          </span>
        </div>
      </div>

      {/* Trend Arrow */}
      <div 
        style={{ 
          marginTop: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <TrendArrow direction={trend} />
        <span 
          style={{ 
            fontSize: '12px', 
            color: '#6b7280',
          }}
        >
          {trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Stable'}
        </span>
      </div>
    </div>
  );
};

SkillScoreCard.propTypes = {
  task_type: PropTypes.string.isRequired,
  success_rate: PropTypes.number.isRequired,
  trend: PropTypes.oneOf(['up', 'down', 'stable']),
};

SkillScoreCard.defaultProps = {
  trend: 'stable',
};

export default SkillScoreCard;
