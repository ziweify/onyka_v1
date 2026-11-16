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

【传输加密 HTTPS — 推荐】
  你要的效果 = 浏览器与服务器之间 TLS 加密，浏览器自动解密后显示正文。
  不需要改 Onyka 代码，也不需要「端到端加密」；配置 HTTPS 即可。

  前提：有一个域名解析到本机公网 IP（Let's Encrypt 不能给裸 IP:3000 发免费证书）。

  1) 宝塔 → 网站 → 添加站点 → 域名（如 notes.example.com）→ 只建纯静态/反向代理均可
  2) 站点 → SSL → Let's Encrypt → 申请并开启「强制 HTTPS」
  3) 站点 → 反向代理 → 目标 URL: http://127.0.0.1:3000
     或 Nginx 配置里 location / 增加:
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
  4) 编辑 host.env（示例）:
       ONYKA_PUBLIC_URL=https://notes.example.com
       FRONTEND_URL=https://notes.example.com
       CORS_ORIGIN=https://notes.example.com
       COOKIE_SECURE=true
     可选（反代后建议）在 docker-compose 或 host.env 增加:
       TRUST_PROXY=1
  5) ./manage.sh restart
  6) 以后用 https://域名 访问，不要再用 http://IP:3000

  传输路径: 浏览器 ←TLS 密文→ Nginx(443) ←内网明文→ Docker:3000
  公网段已加密；服务器上解密是正常且必要的（否则无法编辑、搜索）。

  若只有 IP、没有域名: 可买域名并 A 记录指向 IP，或 Cloudflare Tunnel 提供 HTTPS；
  自签证书给 IP 浏览器会报不安全，不适合日常使用。

【自签 HTTPS + 导入设备信任（仅自己用，无域名）】

  流程总览:
    服务器生成自签证书 → Nginx 443 反代 3000 → 导出 .crt
    → 在你自己的电脑/手机「受信任的根证书」里导入
    → 浏览器只信这一张证，不再每次点「继续访问」

  ── 一、服务器（宝塔）──

  1) 网站 → 添加站点
     - 域名填: 66.235.111.91（你的公网 IP，或内网 IP）
     - 若宝塔要求不能纯 IP，可填 IP 并勾选，或建任意名后用 IP 访问

  2) 站点 → SSL → 自签名证书 → 申请（或「其他证书」里生成）
     - 证书域名 / SAN 必须包含你访问用的 IP，否则浏览器仍报警
     - 申请成功后开启「强制 HTTPS」

  3) 站点 → 反向代理 → 目标: http://127.0.0.1:3000
     勾选 WebSocket（协作/实时需要）
     保存后重载 Nginx

  4) 防火墙: 开放 443/tcp；建议关闭或限制公网 3000（只经 443 进）

  5) 导出证书文件（在服务器 SSH）:
     宝塔证书一般在:
       /www/server/panel/vhost/cert/站点目录/fullchain.pem
       /www/server/panel/vhost/cert/站点目录/privkey.pem
     把 fullchain.pem 复制到本机，改名为 onyka.crt

  6) 查看指纹（核对用，防第一次连到假服务器）:
     openssl x509 -in fullchain.pem -noout -fingerprint -sha256

  7) 编辑 host.env:
       ONYKA_PUBLIC_URL=https://66.235.111.91
       FRONTEND_URL=https://66.235.111.91
       CORS_ORIGIN=https://66.235.111.91
       COOKIE_SECURE=true
     docker-compose 或 host.env 增加: TRUST_PROXY=1
     cd /www/wwwroot/onyka && ./manage.sh restart

  ── 二、导入信任（在哪操作）──

  导入的是「根/站点证书」到系统的「受信任的根证书颁发机构」
  （不是 Onyka 登录里，也不是浏览器书签里）

  Windows 10/11:
    1. 把 onyka.crt 拷到电脑
    2. 双击 onyka.crt → 「安装证书」
    3. 存储位置: 「本地计算机」（需管理员）或「当前用户」
    4. 选择: 「将所有证书放入下列存储」→ 浏览
    5. 选「受信任的根证书颁发机构」→ 确定 → 完成
    6. 重启 Chrome/Edge，访问 https://66.235.111.91

  macOS:
    1. 双击 onyka.crt → 钥匙串访问 打开
    2. 添加到「系统」或「登录」钥匙串
    3. 双击该证书 → 信任 → 「使用此证书时」选「始终信任」
    4. Safari/Chrome 访问 https://IP

  Android:
    1. 将 onyka.crt 传到手机
    2. 设置 → 安全 → 加密与凭据 → 安装证书 / 从存储设备安装
    3. 类型选「CA 证书」或「VPN和应用」依系统而定
    4. Chrome 访问 https://IP

  iPhone/iPad:
    1. AirDrop/邮件把 .crt 发到手机，安装描述文件
    2. 设置 → 通用 → 关于本机 → 证书信任设置
    3. 对刚装的根证书开启「完全信任」
    4. Safari 访问 https://IP

  ── 三、核对指纹（可选，更安全）──

  第一次导入前，在服务器执行 openssl 命令得到 SHA256 指纹。
  在浏览器警告页 → 证书详情 → 指纹，应完全一致。
  一致再导入信任；不一致不要继续（可能有中间人）。

  ── 四、日常访问 ──

  用 https://66.235.111.91（不要 :3000）
  地址栏应显示锁标志且无「不安全」警告（已信任自签后）。

【备份】
  日常可只备份 data/onyka.db
  .encryption-key 单独、少人保管
