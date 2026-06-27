import React from 'react';
import { usePlatformMetrics } from '../hooks/usePlatformMetrics';
import { useKnowledgeLibrary } from '../hooks/useKnowledgeLibrary';
import { useImprovementData } from '../hooks/useImprovementData';
import SkillScoreCard from '../components/SkillScoreCard';
import ImprovementChart from '../components/ImprovementChart';
import LessonsLearnedList from '../components/LessonsLearnedList';
import ImprovementTargets from '../components/ImprovementTargets';

const LoadingSpinner = () => (
  <div className="loading-spinner-container">
    <div className="loading-spinner">
      <div className="spinner"></div>
      <p>Loading dashboard data...</p>
    </div>
    <style>{`
      .loading-spinner-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background-color: #f5f7fa;
      }
      .loading-spinner {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
      }
      .spinner {
        width: 50px;
        height: 50px;
        border: 4px solid #e0e0e0;
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .loading-spinner p {
        color: #6b7280;
        font-size: 1rem;
        margin: 0;
      }
    `}</style>
  </div>
);

const Dashboard = () => {
  const { metrics, isLoading: metricsLoading, error: metricsError } = usePlatformMetrics();
  const { knowledge, isLoading: knowledgeLoading, error: knowledgeError } = useKnowledgeLibrary();
  const { improvementData, isLoading: improvementLoading, error: improvementError } = useImprovementData();

  const isLoading = metricsLoading || knowledgeLoading || improvementLoading;
  const hasError = metricsError || knowledgeError || improvementError;

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (hasError) {
    return (
      <div className="error-container">
        <div className="error-message">
          <h2>Error Loading Dashboard</h2>
          <p>{metricsError || knowledgeError || improvementError}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
        <style>{`
          .error-container {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background-color: #f5f7fa;
          }
          .error-message {
            text-align: center;
            padding: 2rem;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .error-message h2 {
            color: #ef4444;
            margin-bottom: 1rem;
          }
          .error-message p {
            color: #6b7280;
            margin-bottom: 1.5rem;
          }
          .error-message button {
            padding: 0.75rem 1.5rem;
            background-color: #3b82f6;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
          }
          .error-message button:hover {
            background-color: #2563eb;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>AI Self-Teach Dashboard</h1>
        <p className="dashboard-subtitle">Monitor your learning progress and improvements</p>
      </header>

      <main className="dashboard-grid">
        <div className="grid-item grid-top-left">
          <SkillScoreCard metrics={metrics} />
        </div>

        <div className="grid-item grid-top-right">
          <ImprovementChart data={improvementData} />
        </div>

        <div className="grid-item grid-bottom-left">
          <LessonsLearnedList knowledge={knowledge} />
        </div>

        <div className="grid-item grid-bottom-right">
          <ImprovementTargets data={improvementData} metrics={metrics} />
        </div>
      </main>

      <style>{`
        .dashboard {
          min-height: 100vh;
          background-color: #f5f7fa;
          padding: 1.5rem;
        }

        .dashboard-header {
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .dashboard-header h1 {
          margin: 0;
          font-size: 1.875rem;
          font-weight: 700;
          color: #1f2937;
        }

        .dashboard-subtitle {
          margin: 0.5rem 0 0 0;
          color: #6b7280;
          font-size: 1rem;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 1.5rem;
          min-height: calc(100vh - 150px);
        }

        .grid-item {
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
          padding: 1.5rem;
          overflow: auto;
        }

        .grid-top-left {
          grid-column: 1;
          grid-row: 1;
        }

        .grid-top-right {
          grid-column: 2;
          grid-row: 1;
        }

        .grid-bottom-left {
          grid-column: 1;
          grid-row: 2;
        }

        .grid-bottom-right {
          grid-column: 2;
          grid-row: 2;
        }

        @media (max-width: 1024px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
            grid-template-rows: auto;
          }

          .grid-top-left,
          .grid-top-right,
          .grid-bottom-left,
          .grid-bottom-right {
            grid-column: 1;
            grid-row: auto;
          }

          .grid-item {
            min-height: 300px;
          }
        }

        @media (max-width: 640px) {
          .dashboard {
            padding: 1rem;
          }

          .dashboard-header h1 {
            font-size: 1.5rem;
          }

          .dashboard-grid {
            gap: 1rem;
          }

          .grid-item {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;