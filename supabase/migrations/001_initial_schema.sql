-- Migration: 001_initial_schema.sql
-- Description: Initial schema for AI-SelfTeach-v1
-- Creates tables for task executions, performance metrics, knowledge library, and improvement plans

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table: task_executions
-- Stores individual task execution records
-- ============================================
CREATE TABLE IF NOT EXISTS task_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_type VARCHAR(255) NOT NULL,
    input JSONB NOT NULL DEFAULT '{}',
    output JSONB,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for task_executions
CREATE INDEX idx_task_executions_task_type ON task_executions(task_type);
CREATE INDEX idx_task_executions_success ON task_executions(success);
CREATE INDEX idx_task_executions_created_at ON task_executions(created_at DESC);
CREATE INDEX idx_task_executions_task_type_created ON task_executions(task_type, created_at DESC);

-- ============================================
-- Table: performance_metrics
-- Aggregated performance statistics by task type and time period
-- ============================================
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_type VARCHAR(255) NOT NULL,
    success_rate DECIMAL(5, 4) NOT NULL CHECK (success_rate >= 0 AND success_rate <= 1),
    total_attempts INTEGER NOT NULL DEFAULT 0 CHECK (total_attempts >= 0),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT check_period_valid CHECK (period_end > period_start)
);

-- Indexes for performance_metrics
CREATE INDEX idx_performance_metrics_task_type ON performance_metrics(task_type);
CREATE INDEX idx_performance_metrics_period ON performance_metrics(period_start, period_end);
CREATE UNIQUE INDEX idx_performance_metrics_unique_period ON performance_metrics(task_type, period_start, period_end);

-- ============================================
-- Table: knowledge_library
-- Stores learned solutions indexed by problem hash
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    problem_hash VARCHAR(64) NOT NULL,
    solution JSONB NOT NULL,
    task_type VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for knowledge_library
CREATE UNIQUE INDEX idx_knowledge_library_problem_hash ON knowledge_library(problem_hash);
CREATE INDEX idx_knowledge_library_task_type ON knowledge_library(task_type);
CREATE INDEX idx_knowledge_library_created_at ON knowledge_library(created_at DESC);

-- ============================================
-- Table: improvement_plans
-- Tracks areas for improvement and targeted learning
-- ============================================
CREATE TABLE IF NOT EXISTS improvement_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    weak_area VARCHAR(255) NOT NULL,
    target_prompts JSONB NOT NULL DEFAULT '[]',
    baseline_score DECIMAL(5, 4) CHECK (baseline_score >= 0 AND baseline_score <= 1),
    current_score DECIMAL(5, 4) CHECK (current_score >= 0 AND current_score <= 1),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for improvement_plans
CREATE INDEX idx_improvement_plans_weak_area ON improvement_plans(weak_area);
CREATE INDEX idx_improvement_plans_status ON improvement_plans(status);
CREATE INDEX idx_improvement_plans_created_at ON improvement_plans(created_at DESC);

-- ============================================
-- Trigger function to auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to knowledge_library
CREATE TRIGGER trigger_knowledge_library_updated_at
    BEFORE UPDATE ON knowledge_library
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to improvement_plans
CREATE TRIGGER trigger_improvement_plans_updated_at
    BEFORE UPDATE ON improvement_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE task_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE improvement_plans ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access (full access)
CREATE POLICY "Service role full access on task_executions" ON task_executions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on performance_metrics" ON performance_metrics
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on knowledge_library" ON knowledge_library
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on improvement_plans" ON improvement_plans
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE task_executions IS 'Records of individual AI task executions with inputs, outputs, and success status';
COMMENT ON TABLE performance_metrics IS 'Aggregated performance statistics by task type over time periods';
COMMENT ON TABLE knowledge_library IS 'Repository of learned solutions indexed by problem hash for quick retrieval';
COMMENT ON TABLE improvement_plans IS 'Tracks identified weak areas and targeted improvement strategies';

COMMENT ON COLUMN task_executions.input IS 'JSON input data for the task';
COMMENT ON COLUMN task_executions.output IS 'JSON output/result from the task execution';
COMMENT ON COLUMN task_executions.error_log IS 'Error message or stack trace if task failed';

COMMENT ON COLUMN performance_metrics.success_rate IS 'Decimal between 0 and 1 representing success percentage';
COMMENT ON COLUMN performance_metrics.total_attempts IS 'Total number of task attempts in the period';

COMMENT ON COLUMN knowledge_library.problem_hash IS 'SHA-256 hash of the problem for deduplication and lookup';
COMMENT ON COLUMN knowledge_library.solution IS 'JSON containing the solution and metadata';

COMMENT ON COLUMN improvement_plans.target_prompts IS 'JSON array of prompts designed to improve the weak area';
COMMENT ON COLUMN improvement_plans.baseline_score IS 'Initial performance score before improvement efforts';
COMMENT ON COLUMN improvement_plans.current_score IS 'Current performance score after improvement efforts';