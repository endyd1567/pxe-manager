#!/usr/bin/env bash
# =============================================================================
# PXE / KS Manager — 올인원 설치 스크립트
# OS 신규 설치 직후 상태에서 한 번에 서비스 구성
#
# 사용:
#   chmod +x setup.sh && sudo bash setup.sh
# =============================================================================
set -euo pipefail

RED='\e[1;31m'; GRN='\e[1;32m'; YLW='\e[1;33m'; BLU='\e[1;34m'; CYN='\e[1;36m'; RST='\e[0m'
log()  { echo -e "${GRN}[+]${RST} $*"; }
info() { echo -e "${BLU}[i]${RST} $*"; }
warn() { echo -e "${YLW}[!]${RST} $*"; }
err()  { echo -e "${RED}[✗]${RST} $*" >&2; exit 1; }
step() { echo -e "\n${BLU}━━━ $* ━━━${RST}"; }
ask()  { echo -ne "${CYN}[?]${RST} $*"; }

PROJ_DIR="/srv/pxe-manager"
UI_PORT=8080
FLASK_PORT=5000
NODE_VER=20

while (( "$#" )); do
    case "${1:-}" in
        --proj-dir) PROJ_DIR="${2:-}"; shift 2 ;;
        --port)     UI_PORT="${2:-}";  shift 2 ;;
        -h|--help)  echo "Usage: $0 [--proj-dir /srv/pxe-manager] [--port 8080]"; exit 0 ;;
        *) err "알 수 없는 옵션: $1" ;;
    esac
done

[[ "${EUID:-$(id -u)}" -eq 0 ]] || err "root 권한 필요: sudo bash $0"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

# =============================================================================
# 시작 배너
# =============================================================================
clear
echo ""
echo -e "${BLU}╔══════════════════════════════════════════════════════════╗${RST}"
echo -e "${BLU}║          PXE / KS Manager  설치 시작                    ║${RST}"
echo -e "${BLU}╚══════════════════════════════════════════════════════════╝${RST}"
echo ""
info "소스 경로  : $SRC_DIR"
info "설치 경로  : $PROJ_DIR"
info "Web UI 포트: $UI_PORT"
echo ""

# =============================================================================
# STEP 0. PXE NIC 대화형 설정
# =============================================================================
step "STEP 0  PXE 네트워크 인터페이스 설정"

echo ""
echo -e "  ${YLW}현재 네트워크 인터페이스 목록:${RST}"
echo -e "  ${BLU}──────────────────────────────────────────────────────────────${RST}"
printf "  ${BLU}%-4s  %-14s  %-22s  %-10s  %s${RST}\n" "NO." "인터페이스" "IP 주소" "상태" "MAC"
echo -e "  ${BLU}──────────────────────────────────────────────────────────────${RST}"

declare -a IFACE_LIST=()
IDX=0
while IFS= read -r IFACE; do
    [[ "$IFACE" == "lo" ]] && continue
    IP_ADDR=$(ip addr show "$IFACE" 2>/dev/null | grep "inet " | awk '{print $2}' | head -1 || echo "")
    STATE=$(ip link show "$IFACE" 2>/dev/null | grep -oP "state \K\w+" || echo "UNKNOWN")
    MAC=$(ip link show "$IFACE" 2>/dev/null | awk '/ether/{print $2}' || echo "")
    IDX=$((IDX + 1))
    IFACE_LIST+=("$IFACE")
    if [[ -n "$IP_ADDR" ]]; then
        printf "  ${GRN}[%d]${RST}   %-14s  %-22s  %-10s  %s\n" "$IDX" "$IFACE" "$IP_ADDR" "$STATE" "$MAC"
    else
        printf "  ${YLW}[%d]${RST}   %-14s  %-22s  %-10s  %s\n" "$IDX" "$IFACE" "(IP 없음)" "$STATE" "$MAC"
    fi
done < <(ip link show | grep -oP "^\d+: \K[^:@]+" | grep -v "^lo$")

echo -e "  ${BLU}──────────────────────────────────────────────────────────────${RST}"
echo ""

# 인터넷 NIC 안내
INET_IFACE=$(ip route get 1.1.1.1 2>/dev/null | awk '/dev/{for(i=1;i<=NF;i++) if($i=="dev") print $(i+1)}' | head -1 || echo "")
[[ -n "$INET_IFACE" ]] && warn "인터넷 NIC: ${GRN}${INET_IFACE}${RST}  ← 이것은 PXE용으로 선택하지 마세요"
echo ""

# PXE NIC 선택
while true; do
    ask "PXE 전용 인터페이스 번호 또는 이름 입력 (예: 1 또는 eth0): "
    read -r PXE_INPUT

    if [[ "$PXE_INPUT" =~ ^[0-9]+$ ]]; then
        PXE_IDX=$((PXE_INPUT - 1))
        if (( PXE_IDX >= 0 && PXE_IDX < ${#IFACE_LIST[@]} )); then
            PXE_IFACE="${IFACE_LIST[$PXE_IDX]}"
        else
            warn "잘못된 번호입니다."; continue
        fi
    else
        PXE_IFACE="$PXE_INPUT"
    fi

    ip link show "$PXE_IFACE" &>/dev/null && break
    warn "'$PXE_IFACE' 인터페이스가 없습니다."
done
log "PXE 인터페이스 선택: ${GRN}$PXE_IFACE${RST}"

# IP 입력
echo ""
CURRENT_IP=$(ip addr show "$PXE_IFACE" 2>/dev/null | grep "inet " | awk '{print $2}' | head -1 || echo "")

if [[ -n "$CURRENT_IP" ]]; then
    info "현재 $PXE_IFACE IP: ${YLW}$CURRENT_IP${RST}"
    ask "새 IP 입력 (현재값 유지는 Enter) [${CURRENT_IP}]: "
    read -r INPUT_IP
    if [[ -z "$INPUT_IP" ]]; then
        PXE_IP="${CURRENT_IP%/*}"
        PXE_PREFIX="${CURRENT_IP#*/}"
        [[ "$PXE_PREFIX" == "$PXE_IP" ]] && PXE_PREFIX="24"
    else
        PXE_IP="${INPUT_IP%%/*}"
        PXE_PREFIX="${INPUT_IP#*/}"; [[ "$PXE_PREFIX" == "$PXE_IP" ]] && PXE_PREFIX="24"
    fi
else
    ask "PXE IP 주소 입력 (예: 10.0.0.200 또는 10.0.0.200/24): "
    read -r INPUT_IP
    [[ -z "$INPUT_IP" ]] && err "IP를 입력해야 합니다"
    PXE_IP="${INPUT_IP%%/*}"
    PXE_PREFIX="${INPUT_IP#*/}"; [[ "$PXE_PREFIX" == "$PXE_IP" ]] && PXE_PREFIX="24"
fi

# DHCP 범위 입력
IP_BASE=$(echo "$PXE_IP" | cut -d. -f1-3)
DEFAULT_DHCP="${IP_BASE}.100,${IP_BASE}.199,12h"
echo ""
ask "DHCP 범위 입력 [기본값: ${DEFAULT_DHCP}]: "
read -r INPUT_DHCP
DHCP_RANGE="${INPUT_DHCP:-$DEFAULT_DHCP}"

# 설정 확인
echo ""
echo -e "${GRN}  ┌────────────────────────────────────────────┐${RST}"
echo -e "${GRN}  │  설정 확인                                 │${RST}"
echo -e "${GRN}  ├────────────────────────────────────────────┤${RST}"
echo -e "${GRN}  │${RST}  PXE 인터페이스 : ${YLW}${PXE_IFACE}${RST}"
echo -e "${GRN}  │${RST}  PXE IP 주소    : ${YLW}${PXE_IP}/${PXE_PREFIX}${RST}"
echo -e "${GRN}  │${RST}  DHCP 범위      : ${YLW}${DHCP_RANGE}${RST}"
echo -e "${GRN}  │${RST}  Web UI 포트    : ${YLW}${UI_PORT}${RST}"
echo -e "${GRN}  └────────────────────────────────────────────┘${RST}"
echo ""
ask "위 설정으로 진행하시겠습니까? [Y/n]: "
read -r CONFIRM
[[ "${CONFIRM,,}" == "n" ]] && err "설치 취소됨"

# =============================================================================
# STEP 1. 시스템 패키지 설치
# =============================================================================
step "STEP 1  시스템 패키지 설치"

if command -v dnf &>/dev/null; then
    PKG_MGR="dnf"
elif command -v apt-get &>/dev/null; then
    PKG_MGR="apt"
else
    err "패키지 매니저(dnf/apt)를 찾을 수 없습니다"
fi
log "패키지 매니저: $PKG_MGR"

if [[ "$PKG_MGR" == "dnf" ]]; then
    dnf install -y epel-release 2>&1 | tail -3 || true
    dnf install -y \
        python3 python3-pip nginx NetworkManager \
        curl wget rsync \
        xorriso isomd5sum \
        policycoreutils policycoreutils-python-utils \
        firewalld \
        2>&1 | tail -5
    dnf install -y \
        dnsmasq tftp-server \
        grub2-efi-x64 shim-x64 grub2-tools-extra \
        2>&1 | tail -5 || warn "일부 PXE 패키지 실패 — 계속 진행"
else
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        python3 python3-pip nginx network-manager \
        curl wget rsync xorriso dnsmasq ufw \
        2>&1 | tail -5
fi
log "패키지 설치 완료"

# =============================================================================
# STEP 2. PXE NIC IP 설정
# =============================================================================
step "STEP 2  PXE 인터페이스 IP 설정 ($PXE_IFACE → ${PXE_IP}/${PXE_PREFIX})"

# 기존 연결 제거
OLD_CONS=$(nmcli -t -f NAME,DEVICE con show 2>/dev/null | grep ":${PXE_IFACE}$" | cut -d: -f1 || true)
for CON in $OLD_CONS; do
    warn "기존 프로파일 제거: $CON"
    nmcli con delete "$CON" 2>/dev/null || true
done

log "NetworkManager 연결 프로파일 생성..."
nmcli con add \
    type ethernet \
    ifname "$PXE_IFACE" \
    con-name "pxe-${PXE_IFACE}" \
    ipv4.method manual \
    ipv4.addresses "${PXE_IP}/${PXE_PREFIX}" \
    ipv4.gateway "" \
    ipv4.dns "" \
    ipv6.method disabled \
    connection.autoconnect yes

log "인터페이스 활성화..."
nmcli con up "pxe-${PXE_IFACE}"
sleep 1

ASSIGNED=$(ip addr show "$PXE_IFACE" 2>/dev/null | grep "inet " | awk '{print $2}' | head -1 || echo "")
[[ -n "$ASSIGNED" ]] && log "$PXE_IFACE IP 설정 완료: ${GRN}$ASSIGNED${RST}" \
    || warn "IP 할당 확인 실패 — ip addr show $PXE_IFACE 로 확인"

# =============================================================================
# STEP 3. Node.js 설치
# =============================================================================
step "STEP 3  Node.js $NODE_VER 설치"

NODE_OK=false
if command -v node &>/dev/null; then
    VER=$(node --version | sed 's/v//' | cut -d. -f1)
    if (( VER >= 18 )); then
        log "Node.js $(node --version) 이미 설치됨 — 건너뜀"
        NODE_OK=true
    else
        warn "Node.js $(node --version) 낮음 — 업그레이드"
    fi
fi

if [[ "$NODE_OK" == "false" ]]; then
    log "nvm으로 Node.js $NODE_VER 설치..."
    export NVM_DIR="/root/.nvm"
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    # shellcheck disable=SC1091
    source "$NVM_DIR/nvm.sh"
    nvm install "$NODE_VER"
    nvm use "$NODE_VER"
    nvm alias default "$NODE_VER"
    grep -q 'NVM_DIR' /root/.bashrc 2>/dev/null || cat >> /root/.bashrc <<'NVM_INIT'

# nvm
export NVM_DIR="/root/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
NVM_INIT
    log "Node.js $(node --version) 설치 완료"
fi
NODE_BIN=$(command -v node); NPM_BIN=$(command -v npm)
log "node: $NODE_BIN  /  npm: $NPM_BIN"

# =============================================================================
# STEP 4. 프로젝트 디렉터리 구성
# =============================================================================
step "STEP 4  프로젝트 디렉터리 구성"

if [[ "$SRC_DIR" != "$PROJ_DIR" ]]; then
    log "복사: $SRC_DIR → $PROJ_DIR"
    mkdir -p "$PROJ_DIR"
    rsync -av \
        --exclude='.git' --exclude='node_modules' \
        --exclude='__pycache__' --exclude='*.pyc' \
        --exclude='frontend/dist' \
        "$SRC_DIR/" "$PROJ_DIR/" 2>&1 | tail -5
else
    log "이미 설치 경로에 있음 — 복사 건너뜀"
fi
mkdir -p "$PROJ_DIR"/{bin,iso,pxe-scripts}
mkdir -p /var/log/pxe-manager /var/run/pxe-manager

# HTTP 서빙 디렉터리 구조 생성
log "HTTP 서빙 디렉터리 생성..."
mkdir -p /var/www/html/{ks,autoinstall}
# pxelinux 커널 배치 경로
mkdir -p /var/lib/tftpboot/pxelinux
# Diskless rootfs 베이스
mkdir -p /diskless
# NFS KS/repo 베이스 (NFS 서버로 사용 시)
mkdir -p /repos/ks
chmod -R 755 /var/www/html /diskless /repos 2>/dev/null || true
semanage fcontext -a -t httpd_sys_content_t "/var/www/html(/.*)?" 2>/dev/null || \
    semanage fcontext -m -t httpd_sys_content_t "/var/www/html(/.*)?" 2>/dev/null || true
restorecon -RF /var/www/html 2>/dev/null || true
log "디렉터리 생성 완료: /var/www/html, /diskless, /repos, /var/lib/tftpboot/pxelinux"

# ── SELinux 레이블 설정 ────────────────────────────────────────────────────────
# /srv 하위는 기본적으로 var_t 로 레이블되어 systemd/nginx 가 실행·읽기 불가.
# 각 경로 용도에 맞는 레이블을 명시적으로 지정한다.
step "STEP 4-SELinux  프로젝트 경로 SELinux 레이블 설정"

# bin/ : systemd 가 실행할 수 있어야 함 → bin_t
semanage fcontext -a -t bin_t \
    "${PROJ_DIR}/bin(/.*)?" 2>/dev/null || \
semanage fcontext -m -t bin_t \
    "${PROJ_DIR}/bin(/.*)?" 2>/dev/null || true

# backend/ : python 스크립트 실행 → bin_t
semanage fcontext -a -t bin_t \
    "${PROJ_DIR}/backend(/.*)?" 2>/dev/null || \
semanage fcontext -m -t bin_t \
    "${PROJ_DIR}/backend(/.*)?" 2>/dev/null || true

# frontend/dist/ : nginx 가 읽을 수 있어야 함 → httpd_sys_content_t
semanage fcontext -a -t httpd_sys_content_t \
    "${PROJ_DIR}/frontend/dist(/.*)?" 2>/dev/null || \
semanage fcontext -m -t httpd_sys_content_t \
    "${PROJ_DIR}/frontend/dist(/.*)?" 2>/dev/null || true

# 전체 restorecon 한 번에 적용
restorecon -RF "${PROJ_DIR}" 2>/dev/null || true
log "SELinux 레이블 적용 완료"
log "  bin/      → bin_t"
log "  backend/  → bin_t"
log "  dist/     → httpd_sys_content_t"
# ─────────────────────────────────────────────────────────────────────────────

log "디렉터리 구성 완료"

# =============================================================================
# STEP 5. Python 패키지
# =============================================================================
step "STEP 5  Python 패키지 설치"

REQ="$PROJ_DIR/backend/requirements.txt"
[[ -f "$REQ" ]] && pip3 install -r "$REQ" 2>&1 | tail -5 \
    || pip3 install flask flask-cors werkzeug 2>&1 | tail -5
log "Python 패키지 설치 완료"

# =============================================================================
# STEP 6. 프론트엔드 빌드
# =============================================================================
step "STEP 6  프론트엔드 빌드"

cd "$PROJ_DIR/frontend"
log "npm install..."
$NPM_BIN install 2>&1 | tail -5
log "npm run build..."
$NPM_BIN run build 2>&1 | tail -10
[[ -d "$PROJ_DIR/frontend/dist" ]] || err "빌드 실패"
log "빌드 완료: $PROJ_DIR/frontend/dist"
# 빌드로 새로 생성된 파일들에 레이블 재적용 (semanage 정책은 STEP 4에서 등록됨)
restorecon -RF "${PROJ_DIR}/frontend/dist" 2>/dev/null || true
cd "$PROJ_DIR"

# =============================================================================
# STEP 7. bin 스크립트 생성
# =============================================================================
step "STEP 7  서비스 스크립트 생성"

cat > "$PROJ_DIR/bin/start.sh" << STARTSH
#!/usr/bin/env bash
# Type=simple 용 — exec 으로 python3 직접 교체 (포그라운드 실행)
# stdout/stderr 는 systemd journal 로 수집됨
PYTHON=\$(command -v python3 2>/dev/null || command -v python 2>/dev/null)
[[ -z "\$PYTHON" ]] && { echo "[pxe-manager] ERROR: python3 없음" >&2; exit 1; }
echo "[pxe-manager] 시작: \$PYTHON ${PROJ_DIR}/backend/app.py"
exec "\$PYTHON" "${PROJ_DIR}/backend/app.py"
STARTSH

cat > "$PROJ_DIR/bin/stop.sh" << STOPSH
#!/usr/bin/env bash
pkill -f "python3.*app\.py" 2>/dev/null || true
pkill -f "python.*app\.py"  2>/dev/null || true
echo "[pxe-manager] 종료 완료"
STOPSH

chmod +x "$PROJ_DIR/bin/start.sh" "$PROJ_DIR/bin/stop.sh"
# 새로 생성된 스크립트에 bin_t 레이블 재적용 (systemd 실행 허용)
restorecon -RF "${PROJ_DIR}/bin" 2>/dev/null || true
log "bin 스크립트 완료"

# =============================================================================
# STEP 8. dnsmasq 설정
# =============================================================================
step "STEP 8  dnsmasq 설정"

[[ -f /etc/dnsmasq.d/pxe.conf ]] && \
    cp /etc/dnsmasq.d/pxe.conf "/etc/dnsmasq.d/pxe.conf.$(date +%Y%m%d-%H%M%S).bak"

cat > /etc/dnsmasq.d/pxe.conf << DNSCONF
# Auto-generated by setup.sh $(date)
interface=${PXE_IFACE}
bind-interfaces

dhcp-range=${DHCP_RANGE}
dhcp-option=option:tftp-server,${PXE_IP}

enable-tftp
tftp-root=/var/lib/tftpboot

dhcp-match=set:efi-x86_64,option:client-arch,7
dhcp-boot=tag:efi-x86_64,grubx64.efi

# BIOS (필요 시 주석 해제)
# dhcp-match=set:bios,option:client-arch,0
# dhcp-boot=tag:bios,undionly.kpxe
DNSCONF

log "dnsmasq 설정: /etc/dnsmasq.d/pxe.conf"

# grubx64.efi 배치
mkdir -p /var/lib/tftpboot
for EFI in \
    /boot/efi/EFI/rocky/grubx64.efi \
    /boot/efi/EFI/redhat/grubx64.efi \
    /boot/efi/EFI/centos/grubx64.efi \
    /usr/lib/grub/x86_64-efi-signed/grubx64.efi; do
    if [[ -f "$EFI" ]]; then
        cp -v "$EFI" /var/lib/tftpboot/grubx64.efi
        log "grubx64.efi 배치 완료: $EFI"; break
    fi
done
[[ -f /var/lib/tftpboot/grubx64.efi ]] || warn "grubx64.efi 없음 — 수동 배치 필요"

# TFTP 퍼미션/SELinux
chmod 755 /var/lib/tftpboot
find /var/lib/tftpboot -type f -exec chmod 644 {} + 2>/dev/null || true
chown -R dnsmasq:dnsmasq /var/lib/tftpboot 2>/dev/null || true
semanage fcontext -a -t tftpdir_t "/var/lib/tftpboot(/.*)?" 2>/dev/null || \
    semanage fcontext -m -t tftpdir_t "/var/lib/tftpboot(/.*)?" 2>/dev/null || true
restorecon -RF /var/lib/tftpboot 2>/dev/null || true

systemctl enable dnsmasq
systemctl restart dnsmasq && log "dnsmasq 시작 완료" || \
    warn "dnsmasq 시작 실패 — journalctl -u dnsmasq 확인"

# =============================================================================
# STEP 9. systemd 서비스
# =============================================================================
step "STEP 9  systemd 서비스 등록"

cat > /etc/systemd/system/pxe-manager.service << SVCEOF
[Unit]
Description=PXE / Kickstart Manager Web UI
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${PROJ_DIR}
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
Environment="WWW_ROOT=/var/www/html"
Environment="TFTP_ROOT=/var/lib/tftpboot"
Environment="FLASK_ENV=production"
Environment="NFS_DISKLESS_BASE=/diskless"
Environment="NFS_REPO_BASE=/repos"
Environment="NFS_KS_BASE=/repos/ks"
ExecStart=${PROJ_DIR}/bin/start.sh
ExecStop=${PROJ_DIR}/bin/stop.sh
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pxe-manager

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable pxe-manager
log "pxe-manager 서비스 등록 및 enable 완료"

# =============================================================================
# STEP 10. Nginx 설정
# =============================================================================
step "STEP 10  Nginx 설정"

for f in /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/welcome.conf /etc/nginx/conf.d/pxe.conf; do
    [[ -f "$f" ]] && mv -f "$f" "${f}.disabled" && warn "비활성화: $f" || true
done

# ISO/KS 파일 서빙 (포트 80)
cat > /etc/nginx/conf.d/pxe-www.conf << WWWEOF
server {
    listen 80 default_server;
    server_name _;
    root /var/www/html;
    autoindex on;

    # ISO / KS / OS repo 파일 서빙
    location / {
        try_files \$uri \$uri/ =404;
    }

    # pxelinux 커널/initrd HTTP 서빙 (grub (http)// 방식 폴백)
    location /pxelinux/ {
        alias /var/lib/tftpboot/pxelinux/;
        autoindex on;
    }

    # Diskless rootfs 접근 (필요 시)
    location /diskless/ {
        alias /diskless/;
        autoindex on;
    }

    access_log /var/log/nginx/pxe-www.access.log;
    error_log  /var/log/nginx/pxe-www.error.log;
}
WWWEOF

# Web UI (포트 $UI_PORT)
cat > /etc/nginx/conf.d/pxe-manager.conf << UIEOF
server {
    listen ${UI_PORT};
    server_name _;
    root ${PROJ_DIR}/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }
    location /api/ {
        proxy_pass         http://127.0.0.1:${FLASK_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        client_max_body_size 0;
    }
    location /health {
        proxy_pass http://127.0.0.1:${FLASK_PORT};
    }
    access_log /var/log/nginx/pxe-manager.access.log;
    error_log  /var/log/nginx/pxe-manager.error.log;
}
UIEOF

setsebool -P httpd_can_network_connect 1 2>/dev/null || true
# frontend/dist SELinux 레이블은 STEP 4/6 에서 이미 적용됨
# 재확인 restorecon (혹시 누락된 파일 대비)
restorecon -RF "${PROJ_DIR}/frontend/dist" 2>/dev/null || true

nginx -t && log "Nginx 설정 OK" || err "Nginx 설정 오류"
systemctl enable nginx
systemctl restart nginx
log "Nginx 설정 완료"

# =============================================================================
# STEP 11. 방화벽
# =============================================================================
step "STEP 11  방화벽 설정"

if systemctl is-active --quiet firewalld 2>/dev/null; then
    firewall-cmd --add-port="${UI_PORT}/tcp" --permanent
    firewall-cmd --add-service=http   --permanent
    firewall-cmd --add-service=tftp   --permanent
    firewall-cmd --add-service=dhcp   --permanent
    firewall-cmd --add-service=nfs    --permanent
    firewall-cmd --add-service=mountd --permanent
    firewall-cmd --add-service=rpc-bind --permanent
    firewall-cmd --reload
    log "방화벽 개방: ${UI_PORT}/tcp, http(80), tftp(69), dhcp(67), nfs"
elif command -v ufw &>/dev/null; then
    ufw allow "${UI_PORT}/tcp"
    ufw allow 80/tcp
    ufw allow 69/udp
    ufw allow 67/udp
    log "ufw 포트 개방 완료"
else
    warn "방화벽 없음 — 수동 설정 필요"
fi

# =============================================================================
# STEP 12. 서비스 시작
# =============================================================================
step "STEP 12  서비스 시작"

pkill -f "python3.*app.py" 2>/dev/null || true
sleep 1
systemctl start pxe-manager
sleep 2

HEALTH_OK=false
for i in 1 2 3 4 5; do
    curl -sf "http://localhost:$FLASK_PORT/health" &>/dev/null && HEALTH_OK=true && break
    sleep 1
done
[[ "$HEALTH_OK" == "true" ]] && log "Flask 헬스체크 ✓" || \
    warn "Flask 응답 없음 — journalctl -u pxe-manager -f 확인"

# =============================================================================
# STEP 13. NFS 서버 설정 (Diskless용)
# =============================================================================
step "STEP 13  NFS 서버 설정 (Diskless rootfs)"

if [[ "$PKG_MGR" == "dnf" ]]; then
    dnf install -y nfs-utils 2>&1 | tail -3 || warn "nfs-utils 설치 실패"
else
    DEBIAN_FRONTEND=noninteractive apt-get install -y nfs-kernel-server 2>&1 | tail -3 || true
fi

# /diskless 기본 exports 설정
if [[ ! -f /etc/exports ]]; then
    touch /etc/exports
fi

# NFS 서버 활성화
systemctl enable nfs-server 2>/dev/null || systemctl enable nfs-kernel-server 2>/dev/null || true
systemctl start  nfs-server 2>/dev/null || systemctl start  nfs-kernel-server 2>/dev/null || true
log "NFS 서버 활성화 완료"
log "Diskless rootfs는 Web UI → Diskless 탭에서 자동 구성합니다"

# =============================================================================
# 완료 요약
# =============================================================================
MGMT_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '/src/{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -1 || hostname -I | awk '{print $1}')

echo ""
echo -e "${GRN}╔══════════════════════════════════════════════════════════════╗${RST}"
echo -e "${GRN}║            PXE Manager 설치 완료 ✓                           ║${RST}"
echo -e "${GRN}╠══════════════════════════════════════════════════════════════╣${RST}"
echo -e "${GRN}║${RST}  ${BLU}[ 웹 접속 ]${RST}"
echo -e "${GRN}║${RST}    Web UI     :  ${CYN}http://${MGMT_IP}:${UI_PORT}${RST}"
echo -e "${GRN}║${RST}    ISO/KS 서빙:  http://${MGMT_IP}/  (Nginx 80)"
echo -e "${GRN}║${RST}"
echo -e "${GRN}║${RST}  ${BLU}[ PXE 네트워크 ]${RST}"
echo -e "${GRN}║${RST}    인터페이스 :  $PXE_IFACE"
echo -e "${GRN}║${RST}    PXE 서버   :  ${PXE_IP}/${PXE_PREFIX}"
echo -e "${GRN}║${RST}    DHCP 범위  :  $DHCP_RANGE"
echo -e "${GRN}║${RST}"
echo -e "${GRN}║${RST}  ${BLU}[ 서비스 관리 ]${RST}"
echo -e "${GRN}║${RST}    systemctl {start|stop|restart|status} pxe-manager"
echo -e "${GRN}║${RST}    systemctl enable  pxe-manager   # 부팅 자동시작"
echo -e "${GRN}║${RST}    journalctl -u pxe-manager -f    # 실시간 로그"
echo -e "${GRN}║${RST}"
echo -e "${GRN}║${RST}  ${BLU}[ HTTP 파일 서빙 ]${RST}"
echo -e "${GRN}║${RST}    ISO/KS 파일    :  /var/www/html/  → http://${PXE_IP}/"
echo -e "${GRN}║${RST}    pxelinux 커널  :  /var/lib/tftpboot/pxelinux/{os}/{ver}/"
echo -e "${GRN}║${RST}    Diskless rootfs:  /diskless/{os}/{ver}/root/  (NFS 자동 구성)"
echo -e "${GRN}╚══════════════════════════════════════════════════════════════╝${RST}"
echo ""
