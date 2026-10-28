use rayon::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CandidateItem {
    pub id: String,
    pub embedding: Vec<f32>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct RerankRequest {
    pub query_vector: Vec<f32>,
    pub candidates: Vec<CandidateItem>,
    pub top_k: Option<usize>,
    pub min_similarity: Option<f32>,
}

#[derive(Debug, Serialize)]
pub struct ScoredCandidate {
    pub id: String,
    pub similarity: f32,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct RerankResponse {
    pub top_candidates: Vec<ScoredCandidate>,
    pub total_evaluated: usize,
    pub processing_time_us: u128,
}

#[inline(always)]
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let mut dot_product = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;

    for (x, y) in a.iter().zip(b.iter()) {
        dot_product += x * y;
        norm_a += x * x;
        norm_b += y * y;
    }

    let denominator = norm_a.sqrt() * norm_b.sqrt();
    if denominator == 0.0 {
        0.0
    } else {
        dot_product / denominator
    }
}

pub fn process_rerank(req: RerankRequest) -> RerankResponse {
    let start = std::time::Instant::now();
    let query_vector = &req.query_vector;
    let min_sim = req.min_similarity.unwrap_or(0.0);
    let top_k = req.top_k.unwrap_or(req.candidates.len());
    let total_evaluated = req.candidates.len();

    // Multithreaded parallel evaluation using Rayon
    let mut scored: Vec<ScoredCandidate> = req
        .candidates
        .into_par_iter()
        .filter_map(|candidate| {
            if candidate.embedding.len() != query_vector.len() {
                return None;
            }
            let sim = cosine_similarity(query_vector, &candidate.embedding);
            if sim >= min_sim {
                Some(ScoredCandidate {
                    id: candidate.id,
                    similarity: sim,
                    metadata: candidate.metadata,
                })
            } else {
                None
            }
        })
        .collect();

    // Sort descending by similarity score
    scored.par_sort_unstable_by(|a, b| {
        b.similarity
            .partial_cmp(&a.similarity)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    if scored.len() > top_k {
        scored.truncate(top_k);
    }

    RerankResponse {
        top_candidates: scored,
        total_evaluated,
        processing_time_us: start.elapsed().as_micros(),
    }
}

