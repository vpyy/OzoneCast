FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Thư mục lưu model .pkl (persist qua restart nếu mount volume)
RUN mkdir -p /app/models

COPY app/ ./app/

# Không expose port — service này không có HTTP API
CMD ["python", "-m", "app.main"]
