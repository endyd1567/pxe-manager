#!/usr/bin/env bash
pkill -f "python3.*app\.py" 2>/dev/null || true
pkill -f "python.*app\.py"  2>/dev/null || true
echo "[pxe-manager] 종료 완료"
