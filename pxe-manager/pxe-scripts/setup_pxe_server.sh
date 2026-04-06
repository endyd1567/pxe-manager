#!/usr/bin/env bash
# Rocky Linux - PXE 준비 자동화(1~6단계)
# 패키지, Nginx, dnsmasq(인터페이스 바인드), TFTP, SELinux, 방화벽
# 사용:
#   sudo ./setup_pxe_server.sh --iface enp1s0 --server-ip 10.0.0.254 --dhcp-range "10.0.0.100,10.0.0.200,12h"

set -euo pipefail

### ---- 기본값 ----
WWW_ROOT="/var/www/html"
TFTP_ROOT="/var/lib/tftpboot"
NGINX_SITE="/etc/nginx/conf.d/pxe.conf"
DNSMASQ_CONF="/etc/dnsmasq.d/pxe.conf"

IFACE=""
SERVER_IP=""
DHCP_RANGE=""

usage() {
  cat <<USG
Usage:
  $0 --iface IFACE --server-ip IP --dhcp-range "START,END,LEASE"

Examples:
  $0 --iface enp1s0 --server-ip 10.0.0.254 --dhcp-range "10.0.0.100,10.0.0.200,12h"
  $0 --iface eno1   --server-ip 192.168.10.1 --dhcp-range "192.168.10.100,192.168.10.200,8h"
USG
}

### ---- 인자 파싱 ----
while (( "$#" )); do
  case "${1:-}" in
    --iface)       IFACE="${2:-}"; shift 2;;
    --server-ip)   SERVER_IP="${2:-}"; shift 2;;
    --dhcp-range)  DHCP_RANGE="${2:-}"; shift 2;;
    --www-root)    WWW_ROOT="${2:-}"; shift 2;;
    --tftp-root)   TFTP_ROOT="${2:-}"; shift 2;;
    -h|--help)     usage; exit 0;;
    *) echo "Unknown arg: $1"; usage; exit 1;;
  esac
done

### ---- 검증 ----
[[ -n "$IFACE" && -n "$SERVER_IP" && -n "$DHCP_RANGE" ]] || { echo "ERROR: --iface, --server-ip, --dhcp-range 는 필수입니다."; usage; exit 1; }

log()  { echo -e "\e[1;32m[+] $*\e[0m"; }
warn() { echo -e "\e[1;33m[!] $*\e[0m"; }
err()  { echo -e "\e[1;31m[✗] $*\e[0m" >&2; exit 1; }

### ---- root 체크 ----
[[ "${EUID:-$(id -u)}" -eq 0 ]] || err "root 권한으로 실행하세요."

### ---- 인터페이스 존재 확인 ----
ip link show "$IFACE" &>/dev/null || err "인터페이스 ${IFACE} 를 찾을 수 없습니다. 'ip a'로 확인하세요."

### ---- 1) 패키지 설치 ----
log "패키지 설치: nginx dnsmasq tftp-server rsync selinux 툴..."
dnf -y install nginx dnsmasq tftp-server rsync policycoreutils policycoreutils-python-utils setools-console

# (선택) GRUB EFI 바이너리 설치(소스 경로 확보 목적)
dnf -y install grub2-efi-x64 grub2-efi-x64-modules shim-x64 grub2-tools-extra || true

### ---- 2) 디렉터리 구조 준비 ----
log "디렉터리 생성: ${WWW_ROOT}, ${TFTP_ROOT} ..."
mkdir -p "${WWW_ROOT}"/{ubuntu,rocky,rhel,centos,almalinux,ol,oraclelinux,ks,autoinstall}
mkdir -p "${TFTP_ROOT}"
mkdir -p /etc/nginx/conf.d /etc/dnsmasq.d

### ---- 3) Nginx 설정 ----
log "Nginx 설정 작성: ${NGINX_SITE}"
if [[ -f "${NGINX_SITE}" ]]; then cp -a "${NGINX_SITE}" "${NGINX_SITE}.$(date +%Y%m%d-%H%M%S).bak"; fi
cat >"${NGINX_SITE}" <<NG
server {
    listen 80 default_server;
    server_name _;
    root ${WWW_ROOT};
    autoindex on;

    location / {
        try_files \$uri \$uri/ =404;
    }
}
NG

# 기본 conf 비활성화(있으면)
for f in /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/welcome.conf; do
  [[ -f "$f" ]] && mv -f "$f" "${f}.bak.$(date +%s)"
done

log "Nginx 기동/자동시작"
systemctl enable --now nginx

### ---- 4) dnsmasq(DHCP+TFTP) 설정 ----
log "dnsmasq 설정 작성: ${DNSMASQ_CONF}"
if [[ -f "${DNSMASQ_CONF}" ]]; then cp -a "${DNSMASQ_CONF}" "${DNSMASQ_CONF}.$(date +%Y%m%d-%H%M%S).bak"; fi
cat >"${DNSMASQ_CONF}" <<DQ
# ---- PXE/DHCP/TFTP 기본 설정 ----
# 지정 인터페이스 바인드
interface=${IFACE}
bind-interfaces

# 환경에 맞게 DHCP 범위를 조정하세요.
dhcp-range=${DHCP_RANGE}

# 클라이언트에게 TFTP 서버(옵션 66) 통지
dhcp-option=option:tftp-server,${SERVER_IP}

# TFTP 활성화
enable-tftp
tftp-root=${TFTP_ROOT}

# UEFI x86_64 식별(arch 7) → grubx64.efi 제공
dhcp-match=set:efi-x86_64,option:client-arch,7
dhcp-boot=tag:efi-x86_64,grubx64.efi

# (BIOS 클라이언트가 필요하면 아래 주석 해제)
# dhcp-match=set:bios,option:client-arch,0
# dhcp-boot=tag:bios,undionly.kpxe
DQ

# grubx64.efi 배치 시도(환경별 경로 상이)
log "grubx64.efi 배치 시도"
set +e
cp -av /boot/efi/EFI/rocky/grubx64.efi "${TFTP_ROOT}/" 2>/dev/null || \
cp -av /usr/lib/grub/x86_64-efi-signed/grubx64.efi "${TFTP_ROOT}/" 2>/dev/null || \
cp -av /usr/lib/grub/x86_64-efi/monolithic/grubx64.efi "${TFTP_ROOT}/" 2>/dev/null
rc=$?
set -e
if [[ "$rc" -ne 0 ]]; then
  warn "grubx64.efi 자동 복사 실패. 나중에 수동으로 ${TFTP_ROOT}/grubx64.efi 를 배치하세요."
fi

### ---- 4.5) TFTP 퍼미션/SELinux 보정 ----
log "TFTP 퍼미션/소유권/SELinux 라벨 보정"
chmod 755 "${TFTP_ROOT}" || true
find "${TFTP_ROOT}" -type d -exec chmod 755 {} + || true
find "${TFTP_ROOT}" -type f -exec chmod 644 {} + || true
# dnsmasq 사용자/그룹으로 소유권(필수는 아니지만 안전)
chown -R dnsmasq:dnsmasq "${TFTP_ROOT}" || true

# SELinux 라벨(tftpdir_t) 지정 및 적용
semanage fcontext -a -t tftpdir_t "${TFTP_ROOT}(/.*)?" || true
restorecon -RF "${TFTP_ROOT}" || true

log "dnsmasq 재시작"
systemctl enable dnsmasq
systemctl restart dnsmasq

### ---- 5) SELinux (HTTP 루트) ----
log "SELinux 라벨(HTTP 루트)"
semanage fcontext -a -t httpd_sys_content_t "${WWW_ROOT}(/.*)?" || true
restorecon -RF "${WWW_ROOT}" || true

### ---- 6) 방화벽 개방 ----
log "방화벽(HTTP/TFTP/DHCP) 오픈"
if systemctl is-active --quiet firewalld; then
  firewall-cmd --add-service=http  --permanent || true
  firewall-cmd --add-service=tftp  --permanent || true
  firewall-cmd --add-service=dhcp  --permanent || true
  firewall-cmd --reload || true
else
  warn "firewalld 비활성 상태. 방화벽 규칙은 건너뜁니다."
fi

### ---- 요약 ----
cat <<EOF

============================================================
[완료] PXE 준비(1~6단계) 기본 셋업
------------------------------------------------------------
Interface    : ${IFACE} (bind-interfaces)
Server IP    : ${SERVER_IP}
HTTP Root    : ${WWW_ROOT}
TFTP Root    : ${TFTP_ROOT}
DHCP Range   : ${DHCP_RANGE}

확인:
  - systemctl status nginx
  - systemctl status dnsmasq
  - curl -I http://${SERVER_IP}/
  - ls -l ${TFTP_ROOT}/grubx64.efi (644 / SELinux tftpdir_t)
  - grep denied /var/log/audit/audit.log | tail -n 20

다음:
  - generate_grub_cfg.sh 실행 → /var/lib/tftpboot/grub.cfg 생성
  - ISO/리포 트리 업로드 후 부팅 테스트
============================================================
EOF
