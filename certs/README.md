# Onyka IP HTTPS（自签名）

- 证书: `onyka-ip.crt` / `onyka-ip.key`
- 覆盖 IP: `175.29.22.3`, `172.128.128.128`, `127.0.0.1`
- 有效期至约 2029-02
- Nginx: `/www/server/panel/vhost/nginx/onyka-https.conf` → 反代 `127.0.0.1:3000`

访问: `https://175.29.22.3`（浏览器会提示证书不受信任，选「继续访问」即可）

续签示例:
```bash
openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout /www/wwwroot/onyka/certs/onyka-ip.key \
  -out /www/wwwroot/onyka/certs/onyka-ip.crt \
  -subj "/CN=175.29.22.3/O=Onyka Self-Signed/C=CN" \
  -addext "subjectAltName=IP:175.29.22.3,IP:172.128.128.128,IP:127.0.0.1"
nginx -s reload
```
