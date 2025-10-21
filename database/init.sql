-- Create database schema for Canner application
-- This script initializes the PostgreSQL database with the required tables

-- Create responses table
CREATE TABLE IF NOT EXISTS responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    tags JSONB DEFAULT '[]'::jsonb,
    usage_count INTEGER DEFAULT 0,
    custom_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on title for faster searches
CREATE INDEX IF NOT EXISTS idx_responses_title ON responses USING gin(to_tsvector('english', title));

-- Create index on content for faster searches
CREATE INDEX IF NOT EXISTS idx_responses_content ON responses USING gin(to_tsvector('english', content));

-- Create index on tags for faster tag-based searches
CREATE INDEX IF NOT EXISTS idx_responses_tags ON responses USING gin(tags);

-- Create index on created_at for chronological queries
CREATE INDEX IF NOT EXISTS idx_responses_created_at ON responses (created_at DESC);

-- Create a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_responses_updated_at 
    BEFORE UPDATE ON responses 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON TABLE responses TO developer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO developer;