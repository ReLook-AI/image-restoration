FROM python:3.9-slim
RUN apt-get update && apt-get install -y libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Copy n?i dung UI v?o th?ng relook_ai_project
RUN cp -rf UI/* relook_ai_project/
ENV PYTHONPATH=/app
CMD ["gunicorn", "--bind", "0.0.0.0:10000", "--chdir", "relook_ai_project", "app:app"]
