FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY videogen ./videogen
ENV VIDEOGEN_DATA=/data PYTHONUNBUFFERED=1
# Render injects $PORT; locally it defaults to 8000
CMD ["sh", "-c", "uvicorn videogen.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
