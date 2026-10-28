# ==============================================================================
# AuraMind Rust Engine Multi-Stage Production Dockerfile
# ==============================================================================

# Build Stage
FROM rust:1.78-alpine AS builder

WORKDIR /usr/src/auramind-engine

# Install build dependencies
RUN apk add --no-cache musl-dev

# Copy source manifests
COPY Cargo.toml ./

# Create dummy source to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src

# Copy real source code
COPY src ./src

# Build release binary with optimizations
RUN cargo build --release

# Runtime Stage (Minimal Alpine container ~10MB)
FROM alpine:3.19

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /usr/src/auramind-engine/target/release/auramind-engine ./auramind-engine

ENV PORT=8080
EXPOSE 8080

CMD ["./auramind-engine"]

