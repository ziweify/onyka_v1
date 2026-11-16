# HTTPS、证书与反向代理说明（结合本机 Onyka）

> 目标：搞清楚「不写端口访问谁」「证书干什么」「多项目怎么分」  
> 本机现状：Onyka 容器在 **3000**；Nginx 在 **80/443** 做入口。

---

## 1. 先记住：地址 = 协议 + 主机 + 端口

| 你写的地址 | 协议 | 主机 | 实际端口 | 含义 |
|-----------|------|------|----------|------|
| `http://172.128.128.128:3000` | HTTP | IP | **3000** | 直连 Docker 里的 Onyka |
| `http://172.128.128.128` | HTTP | IP | **80**（默认） | 进 Nginx 的 HTTP 门 |
| `https://172.128.128.128` | HTTPS | IP | **443**（默认） | 进 Nginx 的 HTTPS 门 |
| `https://172.128.128.128:3000` | HTTPS | IP | **3000** | ❌ 错：3000 上没有 HTTPS |

**不写端口 ≠ 随便进某个项目**，而是：

- `http://` 不写端口 → 固定找 **80**
- `https://` 不写端口 → 固定找 **443**

一台机器上，**80 和 443 各只能有一套「默认」逻辑**。多个项目要共用这两个端口，必须靠「域名 / 路径 / 再开别的端口」来区分。

---

## 2. 访问链路（Onyka 现在怎么走）

### 2.1 推荐：HTTPS（加锁功能需要这个）

```
浏览器
  │  https://172.128.128.128/login
  │  （默认端口 443，TLS 加密）
  ▼
Nginx（本机 :443）
  │  用自签名证书完成 HTTPS
  │  解密后转发到后面的服务
  ▼
Onyka 容器（127.0.0.1:3000，内部仍是 HTTP）
  │
  ▼
返回页面 → Nginx 再加密 → 浏览器
```

公网同理：`https://175.29.22.3/login`

### 2.2 HTTP 不写端口（现已跳转）

```
浏览器  http://172.128.128.128/login   （默认 80）
  ▼
Nginx :80
  │  301 跳转
  ▼
https://172.128.128.128/login         （再走上面的 443 链路）
```

### 2.3 旧方式：带 3000（直连，无加密）

```
浏览器  http://172.128.128.128:3000/login
  ▼
Docker 直接暴露的 3000（不经过 Nginx 证书）
```

能打开页面，但浏览器认为不是「安全上下文」，**端到端加锁不可用**；且当前 Cookie 要求 HTTPS，登录也可能异常。日常请用 `https://IP/`。

---

## 3. 证书是怎么配的（本机自签名 + IP）

### 3.1 证书文件位置

| 文件 | 作用 |
|------|------|
| `/www/wwwroot/onyka/certs/onyka-ip.crt` | 证书（公钥，可公开） |
| `/www/wwwroot/onyka/certs/onyka-ip.key` | 私钥（保密） |

证书里写了这些 IP（SAN）：`175.29.22.3`、`172.128.128.128`、`127.0.0.1`

### 3.2 生成命令（已执行过，续签可再跑）

```bash
openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout /www/wwwroot/onyka/certs/onyka-ip.key \
  -out /www/wwwroot/onyka/certs/onyka-ip.crt \
  -subj "/CN=175.29.22.3/O=Onyka Self-Signed/C=CN" \
  -addext "subjectAltName=IP:175.29.22.3,IP:172.128.128.128,IP:127.0.0.1"
```

- **自签名**：自己签发，浏览器会警告「不受信任」→ 选继续访问即可  
- **Let’s Encrypt**：一般要 **域名**，给纯 IP 不方便；有域名时更推荐  

### 3.3 Nginx 里挂上证书

配置文件：`/www/server/panel/vhost/nginx/onyka-https.conf`

要点：

```nginx
listen 443 ssl;
ssl_certificate     /www/wwwroot/onyka/certs/onyka-ip.crt;
ssl_certificate_key /www/wwwroot/onyka/certs/onyka-ip.key;

location / {
    proxy_pass http://127.0.0.1:3000;   # 反代到 Onyka
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    # WebSocket 等头略
}
```

改完后：`nginx -t && nginx -s reload`

---

## 4. 反向代理是什么（一句话 + 图）

**反向代理**：外面只打 Nginx（80/443），由 Nginx **代替你**去访问后面真正的应用（3000、5000…）。

```
                  ┌─────────────────────────┐
  用户只看见这个口 │  Nginx :443 (HTTPS)     │
                  │  证书在这里              │
                  └───────────┬─────────────┘
                              │ proxy_pass
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         :3000 Onyka     :5000 项目B      :6000 项目C
         （内网 HTTP）    （内网 HTTP）    （内网 HTTP）
```

好处：

1. 证书只配在 Nginx 一处  
2. 后面的服务可以继续用 HTTP，不必每个都懂 HTTPS  
3. 防火墙可以只开 80/443，不一定把 3000/5000 暴露到公网  

---

## 5. 多个项目怎么访问？（你问的 5000）

### 5.1 核心结论

**不能**指望：

- Onyka 用 `http://172.128.128.128`（不写端口）  
- 另一个项目 **也** 用同一个 `http://172.128.128.128`（不写端口）  

因为不写端口都进 **同一个 80/443**。一台入口要服务两个项目，必须再加「区分条件」。

### 5.2 三种常见分法

#### 方法 A：不同对外端口（最直观）

| 项目 | 内部端口 | 用户怎么访问 |
|------|----------|--------------|
| Onyka | 3000 | `https://172.128.128.128/`（443→3000） |
| 项目 B | 5000 | `https://172.128.128.128:8443/`（8443→5000） |

Nginx 再写一个 `server { listen 8443 ssl; ... proxy_pass http://127.0.0.1:5000; }`  
用户访问时 **必须带 :8443**，否则还是打到 443 的 Onyka。

#### 方法 B：不同域名（生产最常用）

| 项目 | 用户怎么访问 |
|------|--------------|
| Onyka | `https://notes.example.com` → 3000 |
| 项目 B | `https://app.example.com` → 5000 |

两边都是 443，Nginx 看 **Host（域名）** 决定转给谁。  
（纯 IP、没有域名时用不了这招。）

#### 方法 C：不同路径

| 项目 | 用户怎么访问 |
|------|--------------|
| Onyka | `https://172.128.128.128/` → 3000 |
| 项目 B | `https://172.128.128.128/app-b/` → 5000 |

同一 443，靠 URL 路径分流。应用自己要支持「跑在子路径下」，有的项目不好配。

### 5.3 直接访问内部端口（不做反代）

| 项目 | 地址 |
|------|------|
| Onyka | `http://172.128.128.128:3000` |
| 项目 B | `http://172.128.128.128:5000` |

这时 **必须写端口**，系统靠端口区分。  
缺点：没有统一 HTTPS；要给 5000 也加密，得再给 5000 配证书或再走一层 Nginx。

---

## 6. 「不加端口」到底进谁？一张表

假设只有下面这些在听：

| 端口 | 是谁 |
|------|------|
| 80 | Nginx（跳转到 HTTPS） |
| 443 | Nginx → **目前只转给 Onyka 3000** |
| 3000 | Onyka 直连 |
| 5000 | 假设的项目 B 直连 |

则：

| 你输入的 | 进谁 |
|----------|------|
| `http://172.128.128.128` | 80 → 跳到 HTTPS → **Onyka** |
| `https://172.128.128.128` | 443 → **Onyka** |
| `http://172.128.128.128:3000` | **Onyka** 直连 |
| `http://172.128.128.128:5000` | **项目 B** 直连 |
| `https://172.128.128.128`（想开项目 B） | ❌ 仍然是 Onyka，除非你再配分流 |

所以：**不是「不加端口系统会自动找到 5000」**；不加端口只会进 80/443 上你配置好的那一个（或按域名/路径分）。

---

## 7. 若要给 5000 也做「IP + HTTPS」示例

例如对外用 **8443**，内部仍是 5000：

```nginx
# /www/server/panel/vhost/nginx/project-b-https.conf
server {
    listen 8443 ssl;
    server_name 175.29.22.3 172.128.128.128;

    ssl_certificate     /www/wwwroot/onyka/certs/onyka-ip.crt;   # 可复用同一张 IP 证书
    ssl_certificate_key /www/wwwroot/onyka/certs/onyka-ip.key;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
    }
}
```

访问：`https://172.128.128.128:8443/`  
（必须写 **:8443**，因为 443 已经给 Onyka 用了。）

---

## 8. 本机相关文件速查

| 路径 | 用途 |
|------|------|
| `/www/wwwroot/onyka/certs/` | 自签名证书 |
| `/www/server/panel/vhost/nginx/onyka-https.conf` | 443 → 3000 |
| `/www/server/panel/vhost/nginx/onyka-http-redirect.conf` | 80 → HTTPS |
| `/www/wwwroot/onyka/host.env` | CORS / FRONTEND_URL / COOKIE_SECURE |
| `/www/wwwroot/onyka/docker-compose.yml` | 容器映射 `3000:3000` |

常用命令：

```bash
nginx -t && nginx -s reload          # 检查并重载反代
docker compose -f /www/wwwroot/onyka/docker-compose.yml up -d --force-recreate
```

---

## 9. 一句话总结

1. **不写端口 = 走 80 或 443**，不是「自动找 3000/5000」。  
2. **3000/5000** 是应用自己的门；**80/443** 是 Nginx 大门。  
3. **证书**挂在大门（Nginx）上；里面可以继续 HTTP。  
4. **两个项目**要都能「好看地」访问：换端口（如 8443）、换域名、或换路径——三选一（或组合）。  
5. Onyka 现在请用：`https://172.128.128.128/` 或 `https://175.29.22.3/`。
