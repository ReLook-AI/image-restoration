FROM python:3.9-slim
RUN apt-get update && apt-get install -y libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# CHI?U CU?I: T?o th? m?c templates v? static ngay trong relook_ai_project
RUN mkdir -p relook_ai_project/templates relook_ai_project/static
# Copy file html v?o templates, c?c file c?n l?i v?o static
RUN cp UI/index.html relook_ai_project/templates/
RUN cp UI/*.js relook_ai_project/static/ 2>/dev/null || :
RUN cp UI/*.css relook_ai_project/static/ 2>/dev/null || :

ENV PYTHONPATH=/app
CMD ["gunicorn", "--bind", "0.0.0.0:10000", "--chdir", "relook_ai_project", "app:app"]
