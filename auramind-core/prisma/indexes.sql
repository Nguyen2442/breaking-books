-- ==============================================================================
-- AuraMind High-Performance PostgreSQL Indexes
-- GIN Index for fast JSONB querying & HNSW Index for sub-millisecond Vector Search
-- ==============================================================================

-- 1. GIN index on Chapter structured JSONB content (jsonb_path_ops optimizes @>, ?, ?& operators)
CREATE INDEX IF NOT EXISTS idx_chapters_content_gin 
ON chapters USING gin (content jsonb_path_ops);

-- 2. HNSW (Hierarchical Navigable Small World) Index on Chapter Embeddings
-- Far superior to IVFFlat: does not require training data and scales up to millions of vectors
CREATE INDEX IF NOT EXISTS idx_chapter_embeddings_hnsw 
ON chapter_embeddings USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 3. Composite index for chapter lookup and ordering
CREATE INDEX IF NOT EXISTS idx_chapters_book_order 
ON chapters (book_id, chapter_number ASC);
