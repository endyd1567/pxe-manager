#!/usr/bin/env bash
# Type=simple 용 — exec 으로 python3 직접 교체 (포그라운드 실행)
# stdout/stderr 는 systemd journal 로 수집됨
PYTHON=$(command -v python3 2>/dev/null || command -v python 2>/dev/null)
[[ -z "$PYTHON" ]] && { echo "[pxe-manager] ERROR: python3 없음" >&2; exit 1; }
echo "[pxe-manager] 시작: $PYTHON /srv/pxe-manager/backend/app.py"
exec "$PYTHON" "/srv/pxe-manager/backend/app.py"
