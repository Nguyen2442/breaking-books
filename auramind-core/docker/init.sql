-- Enable pgvector extension for high-dimensional semantic search
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Log confirmation
DO $$
BEGIN
    RAISE NOTICE 'pgvector and uuid-ossp extensions initialized successfully in AuraMind database.';
END $$;
