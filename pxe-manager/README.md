# PXE / KS Manager

PXE + Kickstart 설정을 웹 UI로 관리하는 툴.

## 아키텍처

```
Browser (React)  ←→  Flask API
                          │
              ┌───────────┴──────────────┐
              │                          │
   setup_pxe_server.sh       generate_grub_cfg.sh
   (nginx/dnsmasq/tftp)      (grub.cfg 자동 생성)
              │                          │
        /var/www/html              /var/lib/tftpboot
          └── ks/                    └── grub.cfg
          └── rocky/9.6/             └── grubx64.efi
          └── ubuntu/24.04/
```

## 빠른 시작

### 1. 스크립트 배치
```bash
mkdir -p /opt/pxe-scripts
cp setup_pxe_server.sh /opt/pxe-scripts/
cp generate_grub_cfg.sh /opt/pxe-scripts/
chmod +x /opt/pxe-scripts/*.sh
```

### 2. 백엔드 실행
```bash
cd pxe-manager/backend
pip3 install -r requirements.txt
python3 app.py &
```

### 3. 프론트엔드 실행
```bash
cd pxe-manager/frontend
npm install
npm run dev -- --host
# → http://192.168.2.21:3000
```

## 탭 기능

| 탭 | 기능 |
|---|---|
| **대시보드** | nginx/dnsmasq 상태, 서버 설정 요약, 통계 |
| **PXE 셋업** | setup_pxe_server.sh 실행 (초기 1회) |
| **Kickstart** | ks.cfg 생성/편집/저장 — UI 빌더 포함 |
| **grub.cfg** | ISO 선택 → generate_grub_cfg.sh 실행 → 미리보기 |
| **ISO 목록** | /opt/iso NFS 마운트 목록 조회 |

## PXE 부팅 흐름

```
클라이언트 PXE 부팅
  → dnsmasq DHCP (10.0.0.0/24 전용 네트워크)
  → grubx64.efi 전달
  → grub.cfg 로드 → 메뉴 표시
  → vmlinuz + initrd.img 로드
  → inst.repo=http://10.0.0.200/rocky/9.6
  → inst.ks=http://10.0.0.200/ks/9.6/server.ks   ← 웹UI에서 관리
  → Kickstart 자동 설치
```

## Kickstart URL 형태

```
inst.ks=http://10.0.0.200/ks/9.6/server.ks
inst.ks=http://10.0.0.200/ks/9.4/minimal.ks
```

grub.cfg에서 Kickstart 항목은 `/var/www/html/ks/{version}/*.ks` 파일을 자동 감지합니다.

## 환경변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `WWW_ROOT` | `/var/www/html` | Nginx 웹루트 |
| `TFTP_ROOT` | `/var/lib/tftpboot` | TFTP 루트 |
| `ISO_DIR` | `/opt/iso` | NFS ISO 디렉터리 |
| `SCRIPT_DIR` | `/opt/pxe-scripts` | 쉘 스크립트 경로 |
