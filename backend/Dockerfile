# ==============================================================================
# BeatAhead Dedicated Production ML Inference Container
# Optimized for Google Cloud Run / Container Runtimes
# ==============================================================================
FROM python:3.11-slim

# Prevent Python from writing bytecode and enable immediate unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    HOST=0.0.0.0

WORKDIR /app

# Create unprivileged application user for container security
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

# Install minimal inference-only dependencies
COPY docker/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy model artifacts and inference engine source
COPY src/ /app/src/
COPY models/ /app/models/

# Verify ownership
RUN chown -R appuser:appuser /app

# Switch to non-root execution
USER appuser

# Expose Cloud Run standard port
EXPOSE 8080

# Health check using standard library urllib
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import os, urllib.request; p = os.environ.get('PORT', '8080'); urllib.request.urlopen(f'http://127.0.0.1:{p}/health')" || exit 1

# Launch inference service
CMD ["python", "src/ml_service.py"]
