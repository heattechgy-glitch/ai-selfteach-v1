import React from 'react';
import PropTypes from 'prop-types';

/**
 * Formats a timestamp into a relative time string (e.g., '2 hours ago')
 * @param {string|Date|number} timestamp - The timestamp to format
 * @returns {string} Relative time string
 */
const formatRelativeTime = (timestamp) => {
  if (!timestamp) return 'Unknown';
  
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 0) return 'Just now';
  if (diffInSeconds < 60) return 'Just now';
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks !== 1 ? 's' : ''} ago`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`;
  }
  
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} year${diffInYears !== 1 ? 's' : ''} ago`;
};

/**
 * Truncates text to a specified length with ellipsis
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} Truncated text
 */
const truncateText = (text, maxLength = 100) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

/**
 * Returns badge color based on task type
 * @param {string} taskType - The type of task
 * @returns {object} Style object for the badge
 */
const getBadgeStyle = (taskType) => {
  const baseStyle = {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };
  
  const colors = {
    bug_fix: { backgroundColor: '#fee2e2', color: '#dc2626' },
    feature: { backgroundColor: '#dbeafe', color: '#2563eb' },
    optimization: { backgroundColor: '#d1fae5', color: '#059669' },
    refactor: { backgroundColor: '#fef3c7', color: '#d97706' },
    documentation: { backgroundColor: '#e0e7ff', color: '#4f46e5' },
    testing: { backgroundColor: '#f3e8ff', color: '#9333ea' },
    default: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  };
  
  const typeKey = taskType?.toLowerCase().replace(/[\s-]/g, '_') || 'default';
  const colorScheme = colors[typeKey] || colors.default;
  
  return { ...baseStyle, ...colorScheme };
};

/**
 * Individual lesson item component
 */
const LessonItem = ({ entry }) => {
  const { problem_summary, solution, task_type, timestamp, id } = entry;
  
  return (
    <div
      style={{
        padding: '16px',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
        transition: 'background-color 0.2s ease',
      }}
      className="lesson-item"
      data-testid={`lesson-item-${id || 'unknown'}`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <span style={getBadgeStyle(task_type)}>
          {task_type || 'General'}
        </span>
        <span style={{ fontSize: '12px', color: '#9ca3af' }}>
          {formatRelativeTime(timestamp)}
        </span>
      </div>
      
      <h4 style={{
        margin: '0 0 8px 0',
        fontSize: '14px',
        fontWeight: '600',
        color: '#1f2937',
        lineHeight: '1.4',
      }}>
        {truncateText(problem_summary, 120)}
      </h4>
      
      <p style={{
        margin: 0,
        fontSize: '13px',
        color: '#6b7280',
        lineHeight: '1.5',
      }}>
        {truncateText(solution, 150)}
      </p>
    </div>
  );
};

LessonItem.propTypes = {
  entry: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    problem_summary: PropTypes.string,
    solution: PropTypes.string,
    task_type: PropTypes.string,
    timestamp: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.instanceOf(Date)]),
  }).isRequired,
};

/**
 * LessonsLearnedList Component
 * Displays a scrollable list of knowledge library entries
 */
const LessonsLearnedList = ({
  entries = [],
  maxHeight = '400px',
  emptyMessage = 'No lessons learned yet.',
  title = 'Lessons Learned',
  showTitle = true,
}) => {
  if (!Array.isArray(entries)) {
    console.warn('LessonsLearnedList: entries prop must be an array');
    return null;
  }
  
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}
      className="lessons-learned-list"
      data-testid="lessons-learned-list"
    >
      {showTitle && (
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
          }}
        >
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: '#1f2937',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span role="img" aria-label="lightbulb">💡</span>
            {title}
            <span style={{
              fontSize: '12px',
              fontWeight: '400',
              color: '#9ca3af',
              marginLeft: 'auto',
            }}>
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </span>
          </h3>
        </div>
      )}
      
      <div
        style={{
          maxHeight,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
        className="lessons-list-scroll"
      >
        {entries.length === 0 ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: '14px',
            }}
          >
            <span role="img" aria-label="empty" style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>
              📚
            </span>
            {emptyMessage}
          </div>
        ) : (
          entries.map((entry, index) => (
            <LessonItem
              key={entry.id || `lesson-${index}`}
              entry={entry}
            />
          ))
        )}
      </div>
    </div>
  );
};

LessonsLearnedList.propTypes = {
  /** Array of knowledge library entries to display */
  entries: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      problem_summary: PropTypes.string,
      solution: PropTypes.string,
      task_type: PropTypes.string,
      timestamp: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.instanceOf(Date)]),
    })
  ),
  /** Maximum height of the scrollable list */
  maxHeight: PropTypes.string,
  /** Message to display when entries array is empty */
  emptyMessage: PropTypes.string,
  /** Title displayed at the top of the component */
  title: PropTypes.string,
  /** Whether to show the title header */
  showTitle: PropTypes.bool,
};

LessonsLearnedList.defaultProps = {
  entries: [],
  maxHeight: '400px',
  emptyMessage: 'No lessons learned yet.',
  title: 'Lessons Learned',
  showTitle: true,
};

export default LessonsLearnedList;
