FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Tạo thư mục chứa mô hình .pkl
RUN mkdir -p /app/models
COPY models/ ./models/

COPY app/ ./app/

CMD ["python", "-m", "app.main"]
