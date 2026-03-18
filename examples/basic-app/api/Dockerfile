FROM python:3.12-slim

RUN pip install uv

WORKDIR /app
COPY requirements.txt .
RUN uv pip install --system -r requirements.txt

COPY main.py .

EXPOSE 8010
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010"]
