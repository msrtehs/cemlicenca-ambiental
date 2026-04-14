#!/bin/bash
# CemLicença Ambiental - Desenvolvimento Local (sem Docker para backend/frontend)
# ================================================================================

set -e

echo "=================================================="
echo "  CemLicença Ambiental - Modo Desenvolvimento"
echo "=================================================="
echo ""

# 1. Subir apenas o PostgreSQL
echo "[1/5] Subindo PostgreSQL via Docker..."
docker compose up -d postgres
sleep 3

# 2. Instalar dependências
echo ""
echo "[2/5] Instalando dependências do backend..."
cd backend
npm install
cd ..

echo ""
echo "[3/5] Instalando dependências do frontend..."
cd frontend
npm install
cd ..

# 3. Prisma
echo ""
echo "[4/5] Configurando banco de dados..."
cd backend
npx prisma generate
npx prisma db push
npx prisma db seed 2>/dev/null || echo "  (seed já executado)"
cd ..

# 4. Iniciar em paralelo
echo ""
echo "[5/5] Iniciando servidores..."
echo ""
echo "  Backend:  http://localhost:3001"
echo "  Frontend: http://localhost:5173"
echo ""
echo "  Credenciais demo:"
echo "    Email: admin@cemlicenca.com.br"
echo "    Senha: demo2026"
echo ""

# Rodar backend e frontend em paralelo
cd backend && npm run dev &
BACKEND_PID=$!

cd frontend && npm run dev &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID | Frontend PID: $FRONTEND_PID"
echo "Pressione Ctrl+C para parar ambos."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
