use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct Sm2Input {
    pub card_id: String,
    pub quality: u8, // 0 to 5 (0: Blackout, 3: Pass with effort, 5: Perfect recall)
    pub current_repetitions: u32,
    pub current_interval_days: u32,
    pub current_ease_factor: f32,
}

#[derive(Debug, Serialize)]
pub struct Sm2Output {
    pub card_id: String,
    pub next_repetitions: u32,
    pub next_interval_days: u32,
    pub next_ease_factor: f32,
    pub review_status: String, // "RELEARNING" | "GRADUATED" | "REVIEWING"
}

#[derive(Debug, Deserialize)]
pub struct BatchSm2Request {
    pub reviews: Vec<Sm2Input>,
}

#[derive(Debug, Serialize)]
pub struct BatchSm2Response {
    pub results: Vec<Sm2Output>,
    pub processing_time_us: u128,
}

/// Core SuperMemo-2 (SM-2) Algorithm implementation
/// Formula: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
/// Constraints: EF >= 1.3
pub fn calculate_sm2(input: &Sm2Input) -> Sm2Output {
    let q = input.quality.min(5) as f32;
    let mut ef = input.current_ease_factor;
    let mut reps = input.current_repetitions;
    let mut interval = input.current_interval_days;
    let status;

    if input.quality >= 3 {
        // Successful recall
        if reps == 0 {
            interval = 1;
            status = "GRADUATED";
        } else if reps == 1 {
            interval = 3; // Adaptive second interval
            status = "REVIEWING";
        } else {
            interval = ((interval as f32) * ef).round() as u32;
            status = "REVIEWING";
        }
        reps += 1;

        // Update Ease Factor
        ef = ef + (0.1 - (5.0 - q) * (0.08 + (5.0 - q) * 0.02));
        if ef < 1.3 {
            ef = 1.3;
        }
    } else {
        // Failed recall (Forgot or Blackout) -> Reset repetition cycle
        reps = 0;
        interval = 1;
        status = "RELEARNING";
        // Do not alter EF aggressively on failure
    }

    Sm2Output {
        card_id: input.card_id.clone(),
        next_repetitions: reps,
        next_interval_days: interval,
        next_ease_factor: (ef * 100.0).round() / 100.0,
        review_status: status.to_string(),
    }
}

pub fn process_batch_sm2(req: BatchSm2Request) -> BatchSm2Response {
    let start = std::time::Instant::now();
    let results: Vec<Sm2Output> = req.reviews.iter().map(calculate_sm2).collect();

    BatchSm2Response {
        results,
        processing_time_us: start.elapsed().as_micros(),
    }
}

