# BeatAhead — Machine Learning & Inference Backend

Production-ready machine learning inference service for the **BeatAhead Ischemic Stress Index (ISI)** platform.

---

## 🔬 Model Architecture & Provenance

| Metric / Specification | Value / Description |
| :--- | :--- |
| **Model Type** | Frozen XGBoost Gradient-Boosted Decision Trees (Phase 5) |
| **Model Artifact** | `models/beatahead_phase5_model.joblib` |
| **Feature Matrix** | 26-feature multimodal physiological Matrix A (`models/feature_schema.json`) |
| **Decision Threshold ($\tau$)** | **`0.156742`** (Optimized for Early Ischemic Warning F1 maximization) |
| **Window Parameters** | 300s observation window + 300s buffer + 300s prediction horizon |
| **Inputs** | Multimodal signal features: ECG (HRV, SDNN, RMSSD, pNN50, QRS), PPG, Pulse Arrival Time (PAT), SpO₂, and ST-segment deviations |
| **Artifact SHA-256** | `528ff3f8f5edac6f3baf5aef8715d5e86f478462d76ac574b9f0ec60e8640808` |

---

## 📁 Directory Structure

```
backend/
├── Dockerfile                  # Container definition for Cloud Run / Docker deployment
├── requirements.txt            # Minimal runtime inference dependencies
├── docker/
│   └── requirements.txt
├── docs/
│   ├── ISI_DATA_FLOW.md        # Comprehensive data flow specification
│   └── ISI_SPECIFICATION.md   # Mathematical specification of the ISI engine
├── models/
│   ├── beatahead_phase5_model.joblib # Frozen trained XGBoost model
│   ├── feature_schema.json     # 26-feature bounds and schema validation
│   ├── MODEL_MANIFEST.json     # Model hash, creation timestamp & metrics
│   └── model_metadata.json     # Clinical training parameters & performance
├── src/
│   ├── ml_service.py           # HTTP inference microservice daemon
│   ├── inference.py            # Core feature vector validation & model prediction
│   ├── train_and_evaluate_models.py # Model training and cross-validation pipeline
│   ├── process_100_cohort.py   # Cohort preprocessing and feature extraction
│   └── ...                     # Dataset audit and validation utilities
└── tests/
    ├── test_container_service.py      # Microservice endpoint test suite
    ├── test_end_to_end_validation.py  # End-to-end signal-to-score validation
    ├── test_inference.py              # Unit tests for prediction logic
    └── test_website_ml_integration.py # Integration tests with Next.js frontend
```

---

## 🚀 Quick Start

### 1. Local Environment Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Run Inference Daemon

```bash
python src/ml_service.py
```
The service will start on `http://127.0.0.1:8080` (or the port defined by `$PORT`).

### 3. Health Check & Prediction Endpoints

- **Health Check:**
  ```bash
  curl http://127.0.0.1:8080/health
  ```
- **Prediction Request:**
  ```bash
  curl -X POST http://127.0.0.1:8080/predict \
    -H "Content-Type: application/json" \
    -d @models/feature_schema.json
  ```

---

## 🐳 Docker Deployment

```bash
# Build container
docker build -t beatahead-ml-backend .

# Run container
docker run -p 8080:8080 beatahead-ml-backend
```

---

## 🧪 Running Automated Tests

```bash
pytest tests/
```
