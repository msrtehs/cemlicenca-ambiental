#!/bin/bash
# CemLicença Ambiental - Script de Inicialização
# ==================================================

set -e

echo "=================================================="
echo "  CemLicença Ambiental - Inicialização"
echo "  Sistema de Licenciamento Ambiental de Cemitérios"
echo "=================================================="
echo ""

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "[ERRO] Docker não encontrado. Instale: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo "[ERRO] Docker Compose não encontrado."
    exit 1
fi

echo "[1/4] Subindo containers..."
docker compose up -d --build

echo ""
echo "[2/4] Aguardando banco de dados..."
sleep 5

echo ""
echo "[3/4] Executando migrations do Prisma..."
docker compose exec backend npx prisma migrate deploy 2>/dev/null || echo "  (migrations já aplicadas ou em modo dev)"

echo ""
echo "[4/4] Populando dados iniciais (seed)..."
docker compose exec backend npx prisma db seed 2>/dev/null || echo "  (seed já executado anteriormente)"

echo ""
echo "=================================================="
echo "  Sistema pronto!"
echo ""
echo "  Frontend:  http://localhost"
echo "  API:       http://localhost:3001/api/health"
echo ""
echo "  Credenciais demo:"
echo "    Email: admin@cemlicenca.com.br"
echo "    Senha: demo2026"
echo ""
echo "  Prefeitura demo: Custódia/PE"
echo "    CNPJ: 11.222.333/0001-81"
echo "=================================================="
