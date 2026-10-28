mod chunker;
mod reranker;
mod sm2;

use axum::{
    extract::Json,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "auramind_engine=info,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/chunk", post(handle_chunk))
        .route("/api/rerank", post(handle_rerank))
        .route("/api/sm2", post(handle_sm2))
        .layer(cors);

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("🦀 AuraMind High-Performance Rust Engine listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "status": "online",
            "service": "auramind-engine",
            "version": "0.1.0",
            "engine": "Rust (axum + rayon SIMD)",
        })),
    )
}

async fn handle_chunk(Json(payload): Json<chunker::ChunkRequest>) -> impl IntoResponse {
    let res = chunker::process_chunks(payload);
    (StatusCode::OK, Json(res))
}

async fn handle_rerank(Json(payload): Json<reranker::RerankRequest>) -> impl IntoResponse {
    let res = reranker::process_rerank(payload);
    (StatusCode::OK, Json(res))
}

async fn handle_sm2(Json(payload): Json<sm2::BatchSm2Request>) -> impl IntoResponse {
    let res = sm2::process_batch_sm2(payload);
    (StatusCode::OK, Json(res))
}

