-- Create database schema for Canner application
-- This script initializes the PostgreSQL database with the required tables

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,  -- 'google' or 'github'
    provider_id VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Create index on provider and provider_id for faster OAuth lookups
CREATE INDEX IF NOT EXISTS idx_users_provider ON users (provider, provider_id);

-- Create responses table
CREATE TABLE IF NOT EXISTS responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    tags JSONB DEFAULT '[]'::jsonb,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on user_id for faster user-specific queries
CREATE INDEX IF NOT EXISTS idx_responses_user_id ON responses (user_id);

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

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON TABLE users TO developer;
GRANT ALL PRIVILEGES ON TABLE responses TO developer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO developer;