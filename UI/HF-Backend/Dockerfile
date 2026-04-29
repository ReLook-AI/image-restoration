FROM node:20-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=7860 \
    MODEL_PORT=5000 \
    MODEL_ENDPOINT=http://127.0.0.1:5000/colorize

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip python3-venv libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY Model/requirements.txt /app/Model/requirements.txt
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install -r /app/Model/requirements.txt

COPY backend/package.json /app/backend/package.json
RUN cd /app/backend && npm install --omit=dev

COPY backend /app/backend
COPY Model /app/Model
COPY start-space.sh /app/start-space.sh

RUN chmod +x /app/start-space.sh

ENV PATH="/opt/venv/bin:${PATH}"

EXPOSE 7860

CMD ["/app/start-space.sh"]
