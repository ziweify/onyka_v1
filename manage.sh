#!/usr/bin/env bash
# Onyka 本地源码部署管理脚本
set -euo pipefail

ROOT="/www/wwwroot/onyka"
SRC="${ROOT}/src"
DATA="${ROOT}/data"
COMPOSE="docker compose -f ${ROOT}/docker-compose.yml"
NODE_BIN="${NODE_BIN:-/www/server/nodejs/v20.20.0/bin}"
export PATH="${NODE_BIN%/*}:${PATH}"

cd "${ROOT}"

ensure_data_perms() {
  mkdir -p "${DATA}"
  chown -R 1001:1001 "${DATA}" 2>/dev/null || chown -R www:www "${DATA}" 2>/dev/null || true
  chmod 750 "${DATA}"
}

cmd="${1:-}"

case "${cmd}" in
  build)
    echo "==> 从本地源码构建镜像 onyka:local ..."
    ${COMPOSE} build
    echo "==> 完成。修改代码后请再次执行: ./manage.sh build && ./manage.sh restart"
    ;;
  up|start)
    ensure_data_perms
    ${COMPOSE} up -d
    echo "==> 生产模式: http://127.0.0.1:3000"
    ;;
  down|stop)
    ${COMPOSE} down
    ;;
  restart)
    ${COMPOSE} restart
    ;;
  logs)
    ${COMPOSE} logs -f --tail=100
    ;;
  status)
    ${COMPOSE} ps
    curl -sf "http://127.0.0.1:3000/health" && echo " health OK" || echo " health FAIL"
    ;;
  rebuild)
    echo "==> 停止 → 构建 → 启动 ..."
    ${COMPOSE} down
    ${COMPOSE} build
    ensure_data_perms
    ${COMPOSE} up -d
    sleep 3
    ${COMPOSE} ps
    ;;
  dev)
    echo "==> 开发模式（热重载，前后端分离）"
    echo "    前端: http://127.0.0.1:5173"
    echo "    后端: http://127.0.0.1:3001"
    echo "    数据: ${DATA}"
    if ${COMPOSE} ps -q onyka 2>/dev/null | grep -q .; then
      echo "    提示: Docker 生产容器仍在运行(3000)。调试时建议: ./manage.sh stop"
    fi
    if [[ ! -d "${SRC}/node_modules" ]]; then
      echo "==> 首次开发，安装依赖 ..."
      cd "${SRC}" && pnpm install
    fi
    # 同步 dev.env → server .env（保留已有密钥行）
    if [[ ! -f "${SRC}/apps/server/.env" ]]; then
      cp "${ROOT}/dev.env" "${SRC}/apps/server/.env"
      echo "    已创建 ${SRC}/apps/server/.env"
    fi
    set -a
    source "${ROOT}/dev.env"
    set +a
    cd "${SRC}" && exec pnpm dev
    ;;
  dev-install)
    cd "${SRC}" && pnpm install
    ;;
  shell)
    ${COMPOSE} exec onyka sh
    ;;
  backup)
    ${COMPOSE} exec onyka node scripts/backup.js
    echo "==> 备份输出目录: ${DATA}/backups/"
    ;;
  *)
    cat <<'EOF'
用法: ./manage.sh <命令>

  build        从 ./src 本地构建 Docker 镜像（不拉远程）
  up|start     启动生产容器 (127.0.0.1:3000)
  down|stop    停止容器
  restart      重启容器
  rebuild      停止 + 重新构建 + 启动（改代码后常用）
  logs         查看日志
  status       状态与健康检查
  dev          本地 pnpm dev 热重载调试（5173+3001，共用 data/）
  dev-install  仅安装源码依赖
  shell        进入运行中容器
  backup       在容器内执行备份

源码: /www/wwwroot/onyka/src
数据: /www/wwwroot/onyka/data
EOF
    exit 1
    ;;
esac
