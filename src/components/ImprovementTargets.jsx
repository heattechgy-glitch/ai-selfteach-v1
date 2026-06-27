import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './ImprovementTargets.css';

const ImprovementCard = ({ plan }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'score-high';
    if (score >= 60) return 'score-medium';
    if (score >= 40) return 'score-low';
    return 'score-critical';
  };

  return (
    <div className={`improvement-card ${isExpanded ? 'expanded' : ''}`}>
      <div className="card-header" onClick={toggleExpand}>
        <div className="card-main-info">
          <h3 className="weak-area-name">{plan.weak_area}</h3>
          <div className="card-metrics">
            <div className={`baseline-score ${getScoreColor(plan.baseline_score)}`}>
              <span className="score-label">Baseline</span>
              <span className="score-value">{plan.baseline_score}%</span>
            </div>
            <div className="target-prompts-badge">
              <span className="badge-count">{plan.target_prompts?.length || 0}</span>
              <span className="badge-label">prompts</span>
            </div>
          </div>
        </div>
        <button 
          className="expand-toggle"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse prompts' : 'Expand prompts'}
        >
          <svg 
            className={`chevron-icon ${isExpanded ? 'rotated' : ''}`}
            width="20" 
            height="20" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path 
              fillRule="evenodd" 
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" 
              clipRule="evenodd" 
            />
          </svg>
        </button>
      </div>
      
      {isExpanded && (
        <div className="card-expanded-content">
          <h4 className="prompts-heading">Generated Prompt Examples</h4>
          {plan.target_prompts && plan.target_prompts.length > 0 ? (
            <ul className="prompts-list">
              {plan.target_prompts.map((prompt, index) => (
                <li key={index} className="prompt-item">
                  <span className="prompt-number">{index + 1}</span>
                  <p className="prompt-text">{prompt}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-prompts-message">No prompts generated yet for this area.</p>
          )}
        </div>
      )}
    </div>
  );
};

ImprovementCard.propTypes = {
  plan: PropTypes.shape({
    weak_area: PropTypes.string.isRequired,
    baseline_score: PropTypes.number.isRequired,
    target_prompts: PropTypes.arrayOf(PropTypes.string)
  }).isRequired
};

const ImprovementTargets = ({ improvement_plans = [] }) => {
  if (!improvement_plans || improvement_plans.length === 0) {
    return (
      <div className="improvement-targets-container">
        <div className="empty-state">
          <svg 
            className="empty-icon" 
            width="48" 
            height="48" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <h3>No Improvement Plans</h3>
          <p>There are no improvement targets to display at this time.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="improvement-targets-container">
      <div className="targets-header">
        <h2 className="targets-title">Improvement Targets</h2>
        <span className="targets-count">{improvement_plans.length} areas identified</span>
      </div>
      <div className="improvement-cards-grid">
        {improvement_plans.map((plan, index) => (
          <ImprovementCard key={plan.weak_area || index} plan={plan} />
        ))}
      </div>
    </div>
  );
};

ImprovementTargets.propTypes = {
  improvement_plans: PropTypes.arrayOf(
    PropTypes.shape({
      weak_area: PropTypes.string.isRequired,
      baseline_score: PropTypes.number.isRequired,
      target_prompts: PropTypes.arrayOf(PropTypes.string)
    })
  )
};

ImprovementTargets.defaultProps = {
  improvement_plans: []
};

export default ImprovementTargets;
