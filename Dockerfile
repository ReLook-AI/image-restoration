FROM python:3.9-slim
RUN apt-get update && apt-get install -y libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# L?NH QUAN TR?NG: Mang qu?n t? UI v?o trong relook_ai_project
RUN cp -r UI/* relook_ai_project/

ENV PYTHONPATH=/app
# Nh?y v?o trong th? m?c project ?? ch?y
CMD ["gunicorn", "--bind", "0.0.0.0:10000", "--chdir", "relook_ai_project", "app:app"]
