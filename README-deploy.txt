Onyka — 本地源码部署（宝塔环境）
================================

【原则】
  - 不依赖 ghcr.io 远程镜像，一律从 ./src 构建
  - 业务数据固定在 /www/wwwroot/onyka/data/

【目录】
  src/                 Git 源码（在此修改、调试）
  data/                全部业务数据（与是否 Docker 无关）
    onyka.db           SQLite（笔记等为密文）
    uploads/           图片（加密）
    .encryption-key    加密主密钥（请与 db 分开备份）
    .jwt-secret        JWT 密钥
    backups/           应用备份
  docker-compose.yml   生产 Docker（本地 build）
  dev.env              开发模式环境变量（共用 data/）
  manage.sh            一键管理脚本

【生产 — Docker】
  cd /www/wwwroot/onyka
  chmod +x manage.sh

  ./manage.sh build      # 首次或改代码后
  ./manage.sh up         # 启动 → http://127.0.0.1:3000

  改代码后重新发布:
  ./manage.sh rebuild

【开发 — 热重载】
  ./manage.sh stop       # 建议先停 Docker，避免混淆
  ./manage.sh dev-install   # 首次
  ./manage.sh dev        # 前端 http://127.0.0.1:5173  后端 :3001

  开发与生产品共用 data/，同一套账号与笔记。

【更新上游源码】
  cd /www/wwwroot/onyka/src
  git pull
  cd .. && ./manage.sh rebuild

【访问地址 — IP + 端口（无域名）】
  公网: http://66.235.111.91:3000
  内网: http://172.128.128.128:3000
  本机: http://127.0.0.1:3000

  若 IP 变更，编辑 host.env 中的 CORS_ORIGIN / FRONTEND_URL 后:
    ./manage.sh restart

  防火墙已放行 3000/tcp（ufw）

【备份】
  日常可只备份 data/onyka.db
  .encryption-key 单独、少人保管
