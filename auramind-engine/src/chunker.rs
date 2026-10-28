use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Deserialize)]
pub struct ChunkRequest {
    pub text: String,
    pub max_words_per_chunk: Option<usize>,
    pub overlap_words: Option<usize>,
}

#[derive(Debug, Serialize)]
pub struct TextChunk {
    pub index: usize,
    pub text: String,
    pub word_count: usize,
    pub estimated_tokens: usize,
    pub sha256: String,
}

#[derive(Debug, Serialize)]
pub struct ChunkResponse {
    pub total_words: usize,
    pub total_chunks: usize,
    pub global_content_hash: String,
    pub chunks: Vec<TextChunk>,
    pub processing_time_us: u128,
}

pub fn process_chunks(req: ChunkRequest) -> ChunkResponse {
    let start = std::time::Instant::now();
    let max_words = req.max_words_per_chunk.unwrap_or(450);
    let overlap = req.overlap_words.unwrap_or(80);

    // Compute global content SHA-256
    let mut hasher = Sha256::new();
    hasher.update(req.text.trim().as_bytes());
    let global_content_hash = format!("{:x}", hasher.finalize());

    // Tokenize text into words with boundary indices
    let words: Vec<&str> = req.text.split_whitespace().collect();
    let total_words = words.len();

    let mut chunks = Vec::new();
    let mut start_idx = 0;
    let mut chunk_idx = 0;

    while start_idx < total_words {
        let end_idx = (start_idx + max_words).min(total_words);
        let slice = &words[start_idx..end_idx];
        let chunk_text = slice.join(" ");

        let mut chunk_hasher = Sha256::new();
        chunk_hasher.update(chunk_text.as_bytes());
        let chunk_hash = format!("{:x}", chunk_hasher.finalize());

        let word_count = slice.len();
        // Estimated tokens ~ 1.33 tokens per English word / ~2 per Vietnamese word
        let estimated_tokens = (word_count as f64 * 1.4) as usize;

        chunks.push(TextChunk {
            index: chunk_idx,
            text: chunk_text,
            word_count,
            estimated_tokens,
            sha256: chunk_hash,
        });

        chunk_idx += 1;
        if end_idx >= total_words {
            break;
        }

        // Advance with overlap
        let step = if max_words > overlap {
            max_words - overlap
        } else {
            max_words
        };
        start_idx += step;
    }

    ChunkResponse {
        total_words,
        total_chunks: chunks.len(),
        global_content_hash,
        chunks,
        processing_time_us: start.elapsed().as_micros(),
    }
}

