#!/bin/bash
# 개발 환경 전체 실행 스크립트

echo "🚀 소음영향 평가 시스템 - 개발 환경 시작"
echo ""

# .env 파일 생성
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ .env 파일 생성됨"
fi

# Docker (PostgreSQL + Redis)
echo "🐳 Docker 서비스 시작 (PostgreSQL + Redis)..."
docker-compose up -d postgres redis
sleep 5
echo "✅ DB 준비 완료"

# Python Calculator
echo "🐍 Python FastAPI 서버 시작..."
cd calculator
pip install -r requirements.txt -q
python -m uvicorn src.main:app --reload --port 8000 &
CALC_PID=$!
cd ..
echo "✅ Calculator API: http://localhost:8000"
echo "📚 Swagger UI: http://localhost:8000/docs"

# Node.js Backend
echo "📦 Node.js 백엔드 시작..."
cd backend
npm install -q
npm run dev &
BACK_PID=$!
cd ..
echo "✅ Backend API: http://localhost:3001"

# React Frontend
echo "⚛️  React 프론트엔드 시작..."
cd frontend
npm install -q
npm run dev &
FRONT_PID=$!
cd ..
echo "✅ Frontend: http://localhost:3000"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Frontend:   http://localhost:3000"
echo "🔧 Backend:    http://localhost:3001"
echo "🐍 Calculator: http://localhost:8000/docs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "종료: Ctrl+C"

wait $CALC_PID $BACK_PID $FRONT_PID
