# Onyka 自建部署（ziweify）

基于 [karl-cta/onyka](https://github.com/karl-cta/onyka) 的本地源码部署，含 Docker 与宝塔/IP 访问配置。

## 目录

| 路径 | 说明 |
|------|------|
| `src/` | Onyka 应用源码（可修改、汉化） |
| `data/` | 运行时数据（**不纳入 Git**，见 `.gitignore`） |
| `docker-compose.yml` | 生产 Docker（本地构建） |
| `manage.sh` | 构建/启动/开发脚本 |
| `dev.env` | 开发模式环境变量 |
| `host.env` | 生产访问 IP/CORS（复制 `host.env.example`） |

## 快速开始

```bash
cp host.env.example host.env   # 编辑 IP
./manage.sh build
./manage.sh up
```

详见 `README-deploy.txt`。

## 上游

- 上游仓库: https://github.com/karl-cta/onyka
- 本仓库: 部署定制 + 汉化工作区
