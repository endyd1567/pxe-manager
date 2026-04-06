#!/usr/bin/env python3
"""
PXE Manager Backend
- PXE 서버 초기 셋업 (setup_pxe_server.sh 실행)
- Kickstart 파일 생성/편집/삭제
- grub.cfg 재생성 (generate_grub_cfg.sh 실행)
- 서버 상태 조회 (nginx/dnsmasq/tftp)
- ISO 목록 조회
"""

import calendar
import datetime
import json
import os
import posixpath
import re
import secrets
import shutil
import subprocess
import threading
import time
import uuid
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ── 경로 상수 ────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent  # /srv/pxe-manager

WWW_ROOT    = Path(os.environ.get("WWW_ROOT",  "/var/www/html"))
TFTP_ROOT   = Path(os.environ.get("TFTP_ROOT", "/var/lib/tftpboot"))
KS_DIR      = WWW_ROOT / "ks"
AUTO_DIR    = WWW_ROOT / "autoinstall"
ISO_DIR     = Path(os.environ.get("ISO_DIR",    str(PROJECT_ROOT / "iso")))
SCRIPT_DIR  = Path(os.environ.get("SCRIPT_DIR", str(PROJECT_ROOT / "pxe-scripts")))

# ── Diskless 부팅 설정 ────────────────────────────────────────────────────────
# server-world.info 방식 기준:
#   root=/dev/nfs  nfsroot=<srv>:<path>  ip=dhcp
# (구형 root=nfs:<srv>:<path> 방식 대신 표준 nfsroot= 사용)
NFS_DISKLESS_BASE = os.environ.get("NFS_DISKLESS_BASE", "/diskless")
PXELINUX_DIR      = TFTP_ROOT / "pxelinux"

# initrd 단계: 네트워크 + NFS 마운트에 필요한 파라미터
DISKLESS_NET_ARGS = "ip=dhcp rd.neednet=1 rd.net.timeout.carrier=30"
# 커널: SELinux 비활성, IPv6 불필요
DISKLESS_KERN_ARGS = "selinux=0 ipv6.disable=1"


def _get_nfs_server() -> str:
    conf = Path("/etc/dnsmasq.d/pxe.conf")
    if conf.exists():
        for line in conf.read_text().splitlines():
            if "tftp-server" in line:
                m = re.search(r"tftp-server[,=:]([^\s,]+)", line)
                if m:
                    return m.group(1)
    return "192.168.200.254"


def _detect_os_from_iso(iso_name: str):
    name = iso_name.lower()
    patterns = [
        (r"rocky-(\d+\.\d+)",           "rocky"),
        (r"rhel-(\d+\.\d+)",            "rhel"),
        (r"centos-stream-(\d+)",          "centos"),
        (r"centos-(\d+)",                 "centos"),
        (r"ubuntu-(\d+\.\d+)",         "ubuntu"),
        (r"almalinux-(\d+\.\d+)",      "almalinux"),
        (r"oraclelinux-r(\d+)-u(\d+)",  "oraclelinux"),
        (r"ol-(\d+)-u(\d+)",            "oraclelinux"),
    ]
    for pat, osn in patterns:
        m = re.search(pat, name)
        if m:
            ver = f"{m.group(1)}.{m.group(2)}" if len(m.groups()) >= 2 else m.group(1)
            return osn, ver
    return None, None


def _ver_to_dir(ver: str) -> str:
    if "x64" in ver:
        return ver
    return ver.replace(".", "_") + ".x64"


def _dir_to_ver(d: str) -> str:
    return d.removesuffix(".x64").replace("_", ".")

# ── 백그라운드 작업 ───────────────────────────────────────────────────────────
jobs: dict = {}
jobs_lock = threading.Lock()

STAGE_HINTS = {
    "패키지":   10, "Package":  10,
    "디렉터리": 20, "mkdir":    20,
    "Nginx":    35, "nginx":    35,
    "dnsmasq":  55,
    "grubx64":  65,
    "SELinux":  75, "semanage": 75, "restorecon": 75,
    "방화벽":   88, "firewall": 88,
    "완료":    100, "EOF":      100,
}

def _progress_from_log(log: list) -> int:
    pct = 5
    for line in log:
        for kw, p in STAGE_HINTS.items():
            if kw in line and p > pct:
                pct = p
    return min(pct, 100)

def _run_job(job_id: str, cmd: list, env=None, post_hook=None):
    """Run a shell command, stream output to job log."""
    log = []
    def emit(line):
        log.append(line)
        with jobs_lock:
            jobs[job_id]["log"] = log[:]
            jobs[job_id]["progress"] = _progress_from_log(log)

    try:
        run_env = os.environ.copy()
        if env:
            run_env.update(env)
        proc = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, env=run_env
        )
        for line in proc.stdout:
            emit(line.rstrip())
        proc.wait()
        if proc.returncode == 0:
            # post_hook: grub.cfg에 KS 항목 추가 등
            if post_hook:
                try:
                    msgs = post_hook()
                    for m in (msgs or []):
                        emit(m)
                except Exception as exc:
                    emit(f"[!] post_hook 오류: {exc}")
            emit("✅ 완료")
            with jobs_lock:
                jobs[job_id]["status"]   = "done"
                jobs[job_id]["progress"] = 100
        else:
            emit(f"❌ 종료코드: {proc.returncode}")
            with jobs_lock:
                jobs[job_id]["status"] = "failed"
    except Exception as exc:
        with jobs_lock:
            jobs[job_id]["log"].append(f"ERROR: {exc}")
            jobs[job_id]["status"] = "failed"


def start_job(cmd: list, env=None, post_hook=None) -> str:
    job_id = uuid.uuid4().hex
    with jobs_lock:
        jobs[job_id] = {"status": "running", "log": [], "progress": 0}
    t = threading.Thread(target=_run_job, args=(job_id, cmd, env, post_hook), daemon=True)
    t.start()
    return job_id


def _make_ks_hook(ks_path: str, server_ip: str):
    """generate_grub_cfg.sh 실행 후 KS 메뉴 항목을 grub.cfg에 추가하는 hook."""
    def hook():
        cfg_file = TFTP_ROOT / "grub.cfg"
        if not cfg_file.exists():
            return ["[!] grub.cfg 없음 — KS 항목 추가 건너뜀"]
        content = cfg_file.read_text()
        ks_url = f"http://{server_ip}/ks/{ks_path}"
        # 이미 해당 KS URL이 있으면 스킵
        if ks_url in content:
            return [f"[+] KS 항목 이미 존재: {ks_url}"]
        # 기존 menuentry 블록을 찾아 KS 버전 복사 추가
        # linuxefi 라인에 inst.ks= 가 없는 일반 항목 찾기
        new_entries = []
        for block in re.findall(r'(menuentry "[^"]*" \{[^}]+\})', content, re.DOTALL):
            if "inst.ks=" not in block and "linuxefi" in block:
                # KS 버전 항목 생성
                ks_block = re.sub(
                    r'menuentry "([^"]*)"',
                    f'menuentry "\\1 (Kickstart: {ks_path})"',
                    block
                )
                ks_block = re.sub(
                    r'(linuxefi\s+\S+)',
                    f'\\1 inst.ks={ks_url}',
                    ks_block
                )
                new_entries.append(ks_block)
        if new_entries:
            cfg_file.write_text(content + "\n# ---- Kickstart entries ----\n" + "\n\n".join(new_entries) + "\n")
            _restorecon(cfg_file)
            return [f"[+] KS 메뉴 항목 {len(new_entries)}개 추가: {ks_url}"]
        return ["[!] 추가할 일반 menuentry 없음 — grub.cfg를 확인하세요"]
    return hook


def svc_status(name: str) -> str:
    try:
        r = subprocess.run(
            ["systemctl", "is-active", name],
            capture_output=True, text=True
        )
        return r.stdout.strip()   # active / inactive / failed / unknown
    except Exception:
        return "unknown"

def _sanitize(s: str, pat: str = r"[^a-zA-Z0-9_.\-/]") -> str:
    return re.sub(pat, "", s)

def _sanitize_path(s: str) -> str:
    """셸 f-string에 삽입되는 경로 검증: 절대경로만 허용, 위험 문자 제거."""
    cleaned = re.sub(r"[^a-zA-Z0-9_.\-/]", "", s)
    if not cleaned.startswith("/"):
        cleaned = "/" + cleaned
    normalized = posixpath.normpath(cleaned)
    return normalized if normalized.startswith("/") else "/"

def _restorecon(*paths, recursive: bool = False) -> None:
    """restorecon이 없는 환경(SELinux 비활성)에서는 조용히 스킵."""
    if not shutil.which("restorecon"):
        return
    cmd = ["restorecon"] + (["-RF"] if recursive else []) + [str(p) for p in paths]
    subprocess.run(cmd, capture_output=True)


# ── Health ────────────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return jsonify({"ok": True})


# ── 상태 대시보드 ─────────────────────────────────────────────────────────────

@app.route("/api/status")
def api_status():
    services = {s: svc_status(s) for s in ["nginx", "dnsmasq"]}
    # dnsmasq config 읽어서 서버 IP / DHCP 범위 추출
    cfg_info = {"iface": "", "server_ip": "10.0.0.200", "dhcp_range": "10.0.0.100,10.0.0.199,12h"}
    dnsmasq_conf = Path("/etc/dnsmasq.d/pxe.conf")
    if dnsmasq_conf.exists():
        txt = dnsmasq_conf.read_text()
        for line in txt.splitlines():
            line = line.strip()
            if line.startswith("interface="):
                cfg_info["iface"] = line.split("=", 1)[1]
            elif "tftp-server" in line:
                m = re.search(r"tftp-server[,=:]([^\s,]+)", line)
                if m:
                    cfg_info["server_ip"] = m.group(1)
            elif line.startswith("dhcp-range="):
                cfg_info["dhcp_range"] = line.split("=", 1)[1]
    # grubx64.efi 존재여부
    grub_ok = (TFTP_ROOT / "grubx64.efi").exists()
    # grub.cfg 존재여부
    grubcfg_ok = (TFTP_ROOT / "grub.cfg").exists()
    # KS 파일 수
    ks_count = len(list(KS_DIR.rglob("*.ks"))) if KS_DIR.exists() else 0
    # ISO 수
    iso_count = len(list(ISO_DIR.glob("*.iso"))) if ISO_DIR.exists() else 0

    return jsonify({
        "services":    services,
        "cfg":         cfg_info,
        "grub_efi":    grub_ok,
        "grub_cfg":    grubcfg_ok,
        "ks_count":    ks_count,
        "iso_count":   iso_count,
    })


# ── PXE 초기 셋업 ─────────────────────────────────────────────────────────────

@app.route("/api/setup", methods=["POST"])
def api_setup():
    d = request.json or {}
    iface      = _sanitize(d.get("iface", ""), r"[^a-zA-Z0-9_.\-]")
    server_ip  = _sanitize(d.get("server_ip", ""), r"[^0-9.]")
    dhcp_range = _sanitize(d.get("dhcp_range", ""), r"[^0-9.,h]")
    # 경로는 셸 f-string에 삽입되므로 반드시 검증
    www_root   = _sanitize_path(d.get("www_root",  str(WWW_ROOT)))
    tftp_root  = _sanitize_path(d.get("tftp_root", str(TFTP_ROOT)))

    if not all([iface, server_ip, dhcp_range]):
        return jsonify({"error": "iface, server_ip, dhcp_range 필수"}), 400

    script = SCRIPT_DIR / "setup_pxe_server.sh"
    if script.exists():
        cmd = [
            "bash", str(script),
            "--iface",      iface,
            "--server-ip",  server_ip,
            "--dhcp-range", dhcp_range,
            "--www-root",   www_root,
            "--tftp-root",  tftp_root,
        ]
        job_id = start_job(cmd)
    else:
        # 스크립트 없을 때 직접 실행
        job_id = start_job(["bash", "-c", _build_setup_script(
            iface, server_ip, dhcp_range, www_root, tftp_root
        )])
    return jsonify({"job_id": job_id})


def _build_setup_script(iface, server_ip, dhcp_range, www_root, tftp_root):
    return f"""
set -e

log() {{ echo "[+] $*"; }}
warn() {{ echo "[!] $*"; }}

log "패키지 설치 중..."
dnf -y install nginx dnsmasq tftp-server rsync \
    policycoreutils policycoreutils-python-utils 2>&1 || true
dnf -y install grub2-efi-x64 shim-x64 grub2-tools-extra 2>&1 || true

log "디렉터리 생성..."
mkdir -p {www_root}/{{rocky,rhel,centos,almalinux,ubuntu,ol,ks,autoinstall}}
mkdir -p {tftp_root}
mkdir -p /etc/nginx/conf.d /etc/dnsmasq.d

log "Nginx 설정..."
cat > /etc/nginx/conf.d/pxe.conf <<'NG'
server {{
    listen 80 default_server;
    server_name _;
    root {www_root};
    autoindex on;
    location / {{ try_files $uri $uri/ =404; }}
}}
NG
for f in /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/welcome.conf; do
  [ -f "$f" ] && mv -f "$f" "${{f}}.bak" || true
done
systemctl enable --now nginx
log "Nginx 기동 완료"

log "dnsmasq 설정..."
cat > /etc/dnsmasq.d/pxe.conf <<DQ
interface={iface}
bind-interfaces
dhcp-range={dhcp_range}
dhcp-option=option:tftp-server,{server_ip}
enable-tftp
tftp-root={tftp_root}
dhcp-match=set:efi-x86_64,option:client-arch,7
dhcp-boot=tag:efi-x86_64,grubx64.efi
DQ

log "grubx64.efi 배치 시도..."
cp -av /boot/efi/EFI/rocky/grubx64.efi {tftp_root}/ 2>/dev/null || \
cp -av /boot/efi/EFI/redhat/grubx64.efi {tftp_root}/ 2>/dev/null || \
cp -av /usr/lib/grub/x86_64-efi-signed/grubx64.efi {tftp_root}/ 2>/dev/null || \
warn "grubx64.efi 자동 복사 실패 — 수동 배치 필요"

log "TFTP 퍼미션 설정..."
chmod 755 {tftp_root}
find {tftp_root} -type d -exec chmod 755 {{}} + 2>/dev/null || true
find {tftp_root} -type f -exec chmod 644 {{}} + 2>/dev/null || true
chown -R dnsmasq:dnsmasq {tftp_root} 2>/dev/null || true

log "SELinux 설정..."
semanage fcontext -a -t tftpdir_t "{tftp_root}(/.*)?" 2>/dev/null || true
restorecon -RF {tftp_root} 2>/dev/null || true
semanage fcontext -a -t httpd_sys_content_t "{www_root}(/.*)?" 2>/dev/null || true
restorecon -RF {www_root} 2>/dev/null || true

log "dnsmasq 재시작..."
systemctl enable dnsmasq
systemctl restart dnsmasq
log "dnsmasq 기동 완료"

log "방화벽 설정..."
if systemctl is-active --quiet firewalld; then
  firewall-cmd --add-service=http  --permanent 2>/dev/null || true
  firewall-cmd --add-service=tftp  --permanent 2>/dev/null || true
  firewall-cmd --add-service=dhcp  --permanent 2>/dev/null || true
  firewall-cmd --reload 2>/dev/null || true
  log "방화벽 규칙 적용 완료"
else
  warn "firewalld 비활성 — 방화벽 규칙 건너뜀"
fi

log "================================================================"
log "PXE 셋업 완료!"
log "Interface : {iface}  /  Server IP : {server_ip}"
log "DHCP Range: {dhcp_range}"
log "HTTP Root : {www_root}"
log "TFTP Root : {tftp_root}"
log "================================================================"
"""


# ── grub.cfg 재생성 ───────────────────────────────────────────────────────────

@app.route("/api/grub/preview")
def api_grub_preview():
    cfg = TFTP_ROOT / "grub.cfg"
    if not cfg.exists():
        return jsonify({"content": "# grub.cfg 없음\n"})
    return jsonify({"content": cfg.read_text()})





@app.route("/api/grub/build", methods=["POST"])
def api_grub_build():
    d = request.json or {}
    iso_path   = d.get("iso_path", "")
    ks_entries = d.get("ks_entries", [])   # [{path, label}, ...]

    if not iso_path or not os.path.exists(iso_path):
        return jsonify({"error": f"ISO 없음: {iso_path}"}), 400

    # os_name / os_ver — ISO 파일명에서 자동 감지
    iso_name  = Path(iso_path).name.lower()
    os_name   = _sanitize(d.get("os_name", ""), r"[^a-zA-Z0-9_.\-]")
    os_ver    = _sanitize(d.get("os_ver",  ""), r"[^0-9.]")
    if not os_name or not os_ver:
        _det_name, _det_ver = _detect_os_from_iso(iso_name)
        if not os_name: os_name = _det_name or ""
        if not os_ver:  os_ver  = _det_ver  or ""

    # server_ip — dnsmasq 설정에서 자동 읽기
    server_ip = _sanitize(d.get("server_ip", ""), r"[^0-9.]")
    if not server_ip:
        dnsmasq_conf = Path("/etc/dnsmasq.d/pxe.conf")
        if dnsmasq_conf.exists():
            for line in dnsmasq_conf.read_text().splitlines():
                line = line.strip()
                if "tftp-server" in line:
                    m = re.search(r"tftp-server[,=:]([^\s,]+)", line)
                    if m: server_ip = m.group(1); break
    if not server_ip: server_ip = "10.0.0.200"

    # www_root — 환경변수 또는 기본값
    www_root = d.get("www_root", str(WWW_ROOT))

    script = SCRIPT_DIR / "generate_grub_cfg.sh"
    if script.exists():
        cmd = ["bash", str(script), iso_path,
               "--server-ip", server_ip, "--www-root", www_root]
        if os_name: cmd += ["--os", os_name]
        if os_ver:  cmd += ["--version", os_ver]
        hook = _make_ks_entries_hook(ks_entries, server_ip, os_name, os_ver) if ks_entries else None
        job_id = start_job(cmd, post_hook=hook)
    else:
        job_id = start_job(["bash", "-c",
            _build_grub_script(iso_path, os_name, os_ver, server_ip, www_root, ks_entries)
        ])
    return jsonify({"job_id": job_id})


def _make_ks_entries_hook(ks_entries, server_ip, os_name, os_ver):
    """KS/autoinstall menuentry를 grub.cfg 맨 앞에 삽입, default=0, timeout=5 적용"""
    def hook():
        cfg_file = TFTP_ROOT / "grub.cfg"
        msgs = []
        if not cfg_file.exists():
            msgs.append("[!] grub.cfg 없음 — KS 항목 추가 건너뜀")
            return msgs

        content  = cfg_file.read_text()
        is_ubuntu = (os_name == "ubuntu")
        new_entries = []

        for entry in ks_entries:
            ks_path  = entry.get("path", "")
            ks_label = entry.get("label", ks_path.split("/")[-1].replace(".ks",""))
            if not ks_path: continue
            pretty = f"Ubuntu {os_ver}" if is_ubuntu else f"{os_name.capitalize()} {os_ver}"

            if is_ubuntu:
                ud_dir = ks_path.replace(".ks", "")
                ds_url = f"http://{server_ip}/ks/{ud_dir}/"
                if ds_url in content:
                    msgs.append(f"[+] 이미 존재: {ds_url}"); continue
                iso_glob = list(Path(WWW_ROOT / "ubuntu" / os_ver).glob("*.iso"))
                iso_name_str = iso_glob[0].name if iso_glob else f"ubuntu-{os_ver}-live-server-amd64.iso"
                entry_text = (
                    f'menuentry "{pretty} — {ks_label} [AUTO]" {{\n'
                    f'    linuxefi (http)/ubuntu/{os_ver}/casper/vmlinuz \\\n'
                    f'        ip=dhcp url=http://{server_ip}/ubuntu/{os_ver}/{iso_name_str} \\\n'
                    f'        autoinstall ds=nocloud-net\\;s={ds_url} \\\n'
                    f'        quiet splash ---\n'
                    f'    initrdefi (http)/ubuntu/{os_ver}/casper/initrd\n'
                    f'}}'
                )
            else:
                ks_url = f"http://{server_ip}/ks/{ks_path}"
                if ks_url in content:
                    msgs.append(f"[+] 이미 존재: {ks_url}"); continue
                entry_text = (
                    f'menuentry "{pretty} — {ks_label} [AUTO]" {{\n'
                    f'    linuxefi (http)/{os_name}/{os_ver}/images/pxeboot/vmlinuz \\\n'
                    f'        ip=dhcp inst.stage2=http://{server_ip}/{os_name}/{os_ver} \\\n'
                    f'        inst.repo=http://{server_ip}/{os_name}/{os_ver} \\\n'
                    f'        inst.ks=http://{server_ip}/ks/{ks_path}\n'
                    f'    initrdefi (http)/{os_name}/{os_ver}/images/pxeboot/initrd.img\n'
                    f'}}'
                )
            new_entries.append(entry_text)
            msgs.append(f"[+] KS 자동부팅 항목: {pretty} — {ks_label}")

        if new_entries:
            # 헤더(insmod/set/주석) 와 나머지 분리
            header_lines = []
            rest_lines   = []
            in_header = True
            for line in content.splitlines():
                if in_header and (
                    line.startswith("insmod") or line.startswith("set ") or
                    line.startswith("#") or line.strip() == ""
                ):
                    header_lines.append(line)
                else:
                    in_header = False
                    rest_lines.append(line)

            # set default=0, set timeout=5 강제 적용
            new_header = []
            timeout_set = default_set = False
            for line in header_lines:
                if re.match(r"set default=", line):
                    new_header.append("set default=0"); default_set = True
                elif re.match(r"set timeout=", line):
                    new_header.append("set timeout=5"); timeout_set = True
                else:
                    new_header.append(line)
            if not default_set: new_header.append("set default=0")
            if not timeout_set: new_header.append("set timeout=5")

            ks_block   = "\n\n".join(new_entries)
            rest_block = "\n".join(rest_lines).strip()
            updated = (
                "\n".join(new_header).rstrip() + "\n\n"
                "# ---- [AUTO] Kickstart/Autoinstall (default 0, timeout 5s) ----\n" +
                ks_block + "\n\n"
                "# ---- 수동 설치 메뉴 ----\n" +
                rest_block + "\n"
            )
            cfg_file.write_text(updated)
            subprocess.run(["chmod", "644", str(cfg_file)], capture_output=True)
            _restorecon(cfg_file)
            msgs.append(f"[+] grub.cfg: KS 항목 맨 앞 배치, default=0, timeout=5 완료")
        return msgs
    return hook


def _build_grub_script(iso_path, os_name, os_ver, server_ip, www_root, ks_entries):
    """generate_grub_cfg.sh 없을 때 직접 grub.cfg를 생성"""
    dest_dir  = f"{www_root}/{os_name}/{os_ver}"
    tftp_cfg  = str(TFTP_ROOT / "grub.cfg")
    is_ubuntu = (os_name == "ubuntu")

    # ISO 파일명 (Ubuntu base entry용)
    iso_filename = Path(iso_path).name

    # 기본 메뉴 항목
    if is_ubuntu:
        base_entry = (
            f'menuentry "Ubuntu {os_ver} (Live Install)" {{\n'
            f'    linuxefi (http)/ubuntu/{os_ver}/casper/vmlinuz \\\n'
            f'        ip=dhcp url=http://{server_ip}/ubuntu/{os_ver}/{iso_filename} \\\n'
            f'        quiet splash ---\n'
            f'    initrdefi (http)/ubuntu/{os_ver}/casper/initrd\n'
            f'}}'
        )
    else:
        base_entry = (
            f'menuentry "{os_name.capitalize()} {os_ver} (네트워크 설치)" {{\n'
            f'    linuxefi (http)/{os_name}/{os_ver}/images/pxeboot/vmlinuz \\\n'
            f'        ip=dhcp inst.stage2=http://{server_ip}/{os_name}/{os_ver} \\\n'
            f'        inst.repo=http://{server_ip}/{os_name}/{os_ver}\n'
            f'    initrdefi (http)/{os_name}/{os_ver}/images/pxeboot/initrd.img\n'
            f'}}'
        )

    # KS/autoinstall 메뉴 항목
    ks_menu_block = ""
    for entry in ks_entries:
        ks_path  = entry.get("path", "")
        ks_label = entry.get("label", ks_path.split("/")[-1].replace(".ks",""))
        if not ks_path: continue

        if is_ubuntu:
            ud_dir   = ks_path.replace(".ks", "")
            ds_url   = f"http://{server_ip}/ks/{ud_dir}/"
            ks_menu_block += (
                f'\nmenuentry "Ubuntu {os_ver} — {ks_label} (Autoinstall)" {{\n'
                f'    linuxefi (http)/ubuntu/{os_ver}/casper/vmlinuz \\\n'
                f'        ip=dhcp url=http://{server_ip}/ubuntu/{os_ver}/{iso_filename} \\\n'
                f'        autoinstall ds=nocloud-net\\;s={ds_url} \\\n'
                f'        quiet splash ---\n'
                f'    initrdefi (http)/ubuntu/{os_ver}/casper/initrd\n'
                f'}}\n'
            )
        else:
            ks_url = f"http://{server_ip}/ks/{ks_path}"
            ks_menu_block += (
                f'\nmenuentry "{os_name.capitalize()} {os_ver} — {ks_label}" {{\n'
                f'    linuxefi (http)/{os_name}/{os_ver}/images/pxeboot/vmlinuz \\\n'
                f'        ip=dhcp inst.stage2=http://{server_ip}/{os_name}/{os_ver} \\\n'
                f'        inst.repo=http://{server_ip}/{os_name}/{os_ver} \\\n'
                f'        inst.ks={ks_url}\n'
                f'    initrdefi (http)/{os_name}/{os_ver}/images/pxeboot/initrd.img\n'
                f'}}\n'
            )

    grub_content = (
        f'# Auto-generated by PXE Manager\n'
        f'insmod efinet\ninsmod tftp\ninsmod http\n\n'
        f'set default=0\nset timeout=60\n\n'
        f'set srv={server_ip}\n\n'
        f'{base_entry}\n'
        f'{ks_menu_block}'
    )
    grub_escaped = grub_content.replace("'", "'\\''")
    return f"""
set -e
log() {{ echo "[+] $*"; }}
warn() {{ echo "[!] $*"; }}

log "ISO 마운트 및 파일 복사 시작..."
DEST="{dest_dir}"
mkdir -p "$DEST"

MNT=$(mktemp -d)
mount -o loop,ro "{iso_path}" "$MNT" || {{ warn "ISO 마운트 실패 — xorriso로 재시도"; \
  xorriso -osirrox on -indev "{iso_path}" -extract / "$DEST/" 2>&1 | tail -5 && log "xorriso 추출 완료" || {{ warn "추출 실패"; exit 1; }}; }}

if mountpoint -q "$MNT" 2>/dev/null; then
  log "ISO 내용 복사 중..."
  if command -v rsync >/dev/null 2>&1; then
    rsync -aHAX --info=progress2 "$MNT/" "$DEST/" 2>&1 | tail -5
  else
    cp -aT "$MNT" "$DEST"
  fi
  umount "$MNT"
fi
rmdir "$MNT" 2>/dev/null || true
command -v restorecon >/dev/null && restorecon -R "$DEST" 2>/dev/null || true
log "파일 복사 완료: $DEST"

log "grub.cfg 생성 중..."
TFTP_CFG="{tftp_cfg}"
mkdir -p "$(dirname "$TFTP_CFG")"
[ -f "$TFTP_CFG" ] && cp -a "$TFTP_CFG" "${{TFTP_CFG}}.$(date +%Y%m%d-%H%M%S).bak" || true

printf '%s' '{grub_escaped}' > "$TFTP_CFG"
chmod 644 "$TFTP_CFG"
command -v restorecon >/dev/null && restorecon "$TFTP_CFG" 2>/dev/null || true

log "================================================================"
log "grub.cfg 생성 완료: $TFTP_CFG"
log "OS  : {os_name} {os_ver}"
log "Repo: http://{server_ip}/{os_name}/{os_ver}"
log "KS 항목: {len(ks_entries)}개"
log "================================================================"
"""


@app.route("/api/grub/save", methods=["PUT"])
def api_grub_save():
    """grub.cfg 직접 저장"""
    d = request.json or {}
    content = d.get("content", "")
    cfg = TFTP_ROOT / "grub.cfg"
    cfg.parent.mkdir(parents=True, exist_ok=True)
    # 백업
    if cfg.exists():
        bak = cfg.with_suffix(f".cfg.{time.strftime('%Y%m%d-%H%M%S')}.bak")
        cfg.rename(bak)
    cfg.write_text(content)
    subprocess.run(["chmod", "644", str(cfg)], capture_output=True)
    _restorecon(cfg)
    return jsonify({"ok": True})


# ── Kickstart 파일 관리 ───────────────────────────────────────────────────────

def _ks_list():
    if not KS_DIR.exists():
        return []
    result = []
    for f in sorted(KS_DIR.rglob("*.ks")):
        rel = f.relative_to(KS_DIR)
        result.append({
            "path": str(rel),
            "full_path": str(f),
            "size": f.stat().st_size,
            "mtime": int(f.stat().st_mtime),
        })
    return result

@app.route("/api/ks")
def api_ks_list():
    return jsonify({"files": _ks_list()})

@app.route("/api/ks/<path:ks_path>", methods=["GET"])
def api_ks_get(ks_path):
    f = KS_DIR / ks_path
    if not f.exists() or not str(f).startswith(str(KS_DIR)):
        return jsonify({"error": "Not found"}), 404
    return jsonify({"path": ks_path, "content": f.read_text()})

@app.route("/api/ks/<path:ks_path>", methods=["PUT"])
def api_ks_save(ks_path):
    # 경로 탈출 방지
    target = (KS_DIR / ks_path).resolve()
    if not str(target).startswith(str(KS_DIR.resolve())):
        return jsonify({"error": "Invalid path"}), 400
    d = request.json or {}
    content  = d.get("content", "")
    is_ubuntu = d.get("is_ubuntu", False) or content.startswith("#cloud-config")

    target.parent.mkdir(parents=True, exist_ok=True)

    if is_ubuntu:
        # Ubuntu autoinstall: user-data + meta-data 를 디렉터리에 저장
        # ks_path 가 "ubuntu/22.04/server01.ks" 면
        # → /ks/ubuntu/22.04/server01/user-data
        # → /ks/ubuntu/22.04/server01/meta-data
        ud_dir = target.parent / target.stem   # .ks 제거한 디렉터리명
        ud_dir.mkdir(parents=True, exist_ok=True)
        (ud_dir / "user-data").write_text(content)
        if not (ud_dir / "meta-data").exists():
            (ud_dir / "meta-data").write_text("instance-id: iid-local01\nlocal-hostname: ubuntu\n")
        # .ks 파일도 함께 저장 (목록 표시용)
        target.write_text(content)
        _restorecon(ud_dir, recursive=True)
        _restorecon(target)
        return jsonify({"ok": True, "path": ks_path, "autoinstall_dir": str(ud_dir.relative_to(KS_DIR))})
    else:
        target.write_text(content)
        _restorecon(target)
        return jsonify({"ok": True, "path": ks_path})

@app.route("/api/ks/<path:ks_path>", methods=["DELETE"])
def api_ks_delete(ks_path):
    target = (KS_DIR / ks_path).resolve()
    if not str(target).startswith(str(KS_DIR.resolve())):
        return jsonify({"error": "Invalid path"}), 400
    if target.exists():
        target.unlink()
    return jsonify({"ok": True})

@app.route("/api/ks/generate", methods=["POST"])
def api_ks_generate():
    """UI 설정값 → ks.cfg 텍스트 생성"""
    cfg = request.json or {}
    ks  = _build_ks(cfg)
    return jsonify({"content": ks})


# ── ISO 목록 ──────────────────────────────────────────────────────────────────

@app.route("/api/isos")
def api_isos():
    if not ISO_DIR.exists():
        return jsonify({"isos": []})
    isos = []
    for f in sorted(ISO_DIR.glob("*.iso")):
        size_gb = f.stat().st_size / (1024 ** 3)
        name = f.name.lower()
        os_hint = "unknown"
        for kw in ["rocky", "rhel", "centos", "ubuntu", "almalinux", "oraclelinux", "ol-", "sle-"]:
            if kw in name:
                os_hint = kw.rstrip("-")
                break
        isos.append({
            "name": f.name,
            "path": str(f),
            "size": f"{size_gb:.1f} GB",
            "os":   os_hint,
        })
    return jsonify({"isos": isos})


# ── 작업 상태 ─────────────────────────────────────────────────────────────────

@app.route("/api/jobs/<job_id>")
def api_job_status(job_id):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "Not found"}), 404
    return jsonify(job)


# ── Kickstart 생성기 ──────────────────────────────────────────────────────────

def _encrypt_pw(plain: str) -> str:
    r = subprocess.run(["openssl", "passwd", "-6", plain], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else plain

def _sanitize_id(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_.\-]", "", s)

def _build_ks(cfg: dict) -> str:
    lines = []
    os_type = cfg.get("osType", "rhel")   # rhel | ubuntu

    if os_type == "ubuntu":
        return _build_autoinstall(cfg)

    # ── RHEL/Rocky/CentOS 계열 Kickstart ─────────────────────────────────────
    # 기본 시스템
    kbd = cfg.get('keyboard', 'us')
    lines += [
        f"lang {cfg.get('lang', 'en_US.UTF-8')}",
        f"keyboard --vckeymap={kbd} --xlayouts='{kbd}'",
        f"timezone {cfg.get('timezone', 'Asia/Seoul')} --utc",
        "text",
        "skipx",
    ]

    # Network — DHCP only (Static IP는 다수 동시 설치 시 IP 충돌 발생)
    hostname = _sanitize_id(cfg.get("hostname", "localhost"))
    lines.append(f"network --bootproto=dhcp --hostname={hostname} --activate --noipv6")

    # Auth
    root_pw = cfg.get("rootPassword", "changeme")
    lines.append(f"rootpw --iscrypted {_encrypt_pw(root_pw)}")

    extra_user = _sanitize_id(cfg.get("extraUser", ""))
    if extra_user:
        upw  = _encrypt_pw(cfg.get("extraUserPassword", "changeme"))
        grps = "--groups=wheel" if cfg.get("extraUserSudo") else ""
        lines.append(f"user --name={extra_user} --password={upw} --iscrypted --shell=/bin/bash {grps}".strip())

    # Disk
    disk     = _sanitize_id(cfg.get("disk", ""))
    disk_mode = cfg.get("diskMode", "auto")   # "auto" | "manual"
    auto_disk = (disk_mode == "auto") or not disk

    lines.append("zerombr")
    if auto_disk:
        # 특정 디스크를 지정하지 않음 → 시스템이 인식한 첫 번째 디스크 자동 사용
        lines.append("clearpart --all --initlabel")
        # ignoredisk 없음 — Anaconda가 첫 번째 디스크를 자동 선택
    else:
        lines.append(f"clearpart --all --initlabel --drives={disk}")
        lines.append(f"ignoredisk --only-use={disk}")

    part_scheme = cfg.get("partScheme", "auto")
    if part_scheme == "auto":
        auto_type = cfg.get("autoPartType", "lvm")
        enc = cfg.get("autoPartEncrypted", "no") == "yes"
        enc_flag = f" --encrypted --passphrase={cfg.get('luksPassphrase','')}" if enc else ""
        lines.append(f"autopart --type={auto_type}{enc_flag}")
    else:
        vg      = _sanitize_id(cfg.get("vgName", "vg_root"))
        pv_grow = "--grow" if cfg.get("pvGrow", "grow") == "grow" else f"--size={cfg.get('pvSize',40960)}"
        fsBoot  = cfg.get("fsBoot", "xfs")
        pv_ondisk = f" --ondisk={disk}" if not auto_disk and disk else ""
        lines += [
            f"part /boot     --fstype={fsBoot} --size={cfg.get('partBoot',1024)}",
            f"part /boot/efi --fstype=efi      --size={cfg.get('partEfi',512)}",
            f"part pv.01     --fstype=lvmpv{pv_ondisk} --size=1 {pv_grow}",
            f"volgroup {vg} pv.01",
        ]
        custom_parts = cfg.get("customParts", [])
        if custom_parts:
            for p in custom_parts:
                mount  = re.sub(r"[^a-zA-Z0-9_./\-]", "", str(p.get("mount", ""))).strip()
                size   = max(1, int(p.get("size", 2048)))
                fstype = re.sub(r"[^a-zA-Z0-9]", "", str(p.get("fstype", "xfs")))
                grow   = bool(p.get("grow", False))
                if not mount:
                    continue
                grow_flag = " --grow" if grow else ""
                if mount == "swap" or fstype == "swap":
                    lv_name = "lv_swap"
                    lines.append(f"logvol swap  --vgname={vg} --name={lv_name} --fstype=swap --size={size}{grow_flag}")
                else:
                    lv_name = "lv_" + re.sub(r"[^a-zA-Z0-9_]", "_", mount.strip("/")) or "lv_data"
                    lines.append(f"logvol {mount}  --vgname={vg} --name={lv_name} --fstype={fstype} --size={size}{grow_flag}")
        else:
            lines += [
                f"logvol /     --vgname={vg} --name=lv_root --fstype={cfg.get('fsRoot','xfs')} --size={cfg.get('partRoot',10240)}{' --grow' if cfg.get('rootGrow')=='grow' else ''}",
                f"logvol /home --vgname={vg} --name=lv_home --fstype={cfg.get('fsHome','xfs')} --size={cfg.get('partHome',5120)}{' --grow' if cfg.get('homeGrow')=='grow' else ''}",
            ]
            if cfg.get("swapMode", "lv") != "none":
                lines.append(f"logvol swap  --vgname={vg} --name=lv_swap --fstype=swap --size={cfg.get('partSwap',2048)}")
            if cfg.get("separateTmp"):
                lines.append(f"logvol /tmp  --vgname={vg} --name=lv_tmp  --fstype=xfs  --size={cfg.get('partTmp',2048)}")

    # Bootloader
    bl_append = cfg.get("bootloaderAppend", "crashkernel=auto").strip()
    bl_append_flag = f' --append="{bl_append}"' if bl_append else ""
    # auto_disk 모드에서는 --boot-drive 생략 → Anaconda 자동 선택
    bl_drive_flag = "" if auto_disk else f" --boot-drive={disk}"
    lines.append(f"bootloader --location=mbr{bl_drive_flag}{bl_append_flag}")

    # Security
    selinux = cfg.get("selinux", "enforcing")
    lines.append(f"selinux --{selinux}")
    if cfg.get("firewallEnabled", True):
        svc_raw  = cfg.get("firewallServices", "ssh")
        services = ",".join(s.strip() for s in svc_raw.split(",") if s.strip())
        ssh_port = cfg.get("sshPort", "22")
        port_flag = f" --port={ssh_port}:tcp" if str(ssh_port) != "22" else ""
        lines.append(f"firewall --enabled --service={services}{port_flag}")
    else:
        lines.append("firewall --disabled")

    # Packages
    pkg_opts = []
    if cfg.get("pkgIgnoreMissing", True):
        pkg_opts.append("--ignoremissing")
    if cfg.get("pkgExcludeDocs", False):
        pkg_opts.append("--excludedocs")
    pkg_opts_str = " " + " ".join(pkg_opts) if pkg_opts else ""

    env_pkg = cfg.get("packageEnv", "@^minimal-environment")
    lines.append(f"%packages{pkg_opts_str}")
    if env_pkg:
        lines.append(env_pkg)
    lines.append("")
    for pkg in cfg.get("packages", []):
        pkg = re.sub(r"[^a-zA-Z0-9_.+\-@]", "", pkg)
        if pkg:
            lines.append(pkg)
    for pkg in cfg.get("excludePackages", []):
        pkg = re.sub(r"[^a-zA-Z0-9_.+\-@]", "", pkg)
        if pkg:
            lines.append(f"-{pkg}")
    lines.append("%end")

    # %pre script
    pre = cfg.get("preScript", "").strip()
    if pre:
        lines += ["%pre --log=/tmp/ks-pre.log", pre, "%end"]

    # %post script
    post = cfg.get("postScript", "").strip()
    if not post:
        post = "systemctl enable sshd\necho 'KS install complete' >> /root/install.log"

    # 설치 완료 마커 — PXE 서버에 curl로 알림 (모니터링에서 installed 상태로 감지)
    server_ip_for_marker = cfg.get("serverIp", "")
    marker_snippet = ""
    if server_ip_for_marker:
        marker_snippet = (
            f"\n# 설치 완료 알림 (PXE 모니터링)\n"
            f"_MY_IP=$(hostname -I | awk '{{print $1}}')\n"
            f"curl -sf --retry 3 --max-time 5 "
            f"http://{server_ip_for_marker}/ks-done/${{_MY_IP}} -o /dev/null || true\n"
            f"echo \"[ks-done] ${{_MY_IP}}\" >> /root/install.log\n"
        )

    lines += ["%post --log=/root/ks-post.log", post + marker_snippet, "%end"]

    lines.append(cfg.get("onFinish", "reboot"))
    return "\n".join(lines) + "\n"



def _build_autoinstall(cfg: dict) -> str:
    """Ubuntu autoinstall user-data (cloud-config YAML) — 완전한 버전"""
    hostname  = _sanitize_id(cfg.get("hostname", "ubuntu-server"))
    username  = _sanitize_id(cfg.get("extraUser", "ubuntu")) or "ubuntu"
    password  = cfg.get("extraUserPassword", "changeme")
    locale    = cfg.get("lang", "en_US.UTF-8")
    kbd       = cfg.get("keyboard", "us")
    tz        = cfg.get("timezone", "Asia/Seoul")
    disk      = _sanitize_id(cfg.get("disk", "sda"))
    # nic: 네트워크 인터페이스 이름 — disk(sda/nvme0n1)와 완전히 별개
    nic       = _sanitize_id(cfg.get("nic", cfg.get("networkInterface", "")))
    net_mode  = cfg.get("networkMode", "dhcp")
    ssh_pw    = cfg.get("sshAllowPassword", True)
    ssh_keys  = cfg.get("sshAuthorizedKeys", [])
    packages  = cfg.get("packages", ["vim", "curl", "wget", "openssh-server"])
    post      = cfg.get("postScript", "").strip()
    part_scheme = cfg.get("ubuntuStorage", "lvm")  # lvm | direct | custom

    lines = ["#cloud-config", "autoinstall:"]
    lines += [
        f"  version: 1",
        f"  locale: {locale}",
        f"  refresh-installer:",
        f"    update: false",
        f"  keyboard:",
        f"    layout: {kbd}",
        f"    variant: ''",
        f"  timezone: {tz}",
    ]

    # Network
    if net_mode == "static":
        ip      = cfg.get("ip", "")
        prefix  = cfg.get("netmask", "24")
        # netmask → prefix 변환
        if "." in str(prefix):
            octets = [int(x) for x in str(prefix).split(".")]
            bits   = sum(bin(o).count("1") for o in octets)
            prefix = str(bits)
        gw  = cfg.get("gateway", "")
        dns = cfg.get("dns", "8.8.8.8")
        # nic 미지정 시 ens3 기본값 — disk 이름(sda 등)을 절대 사용하지 않음
        nic_name = nic if nic else "ens3"
        lines += [
            f"  network:",
            f"    version: 2",
            f"    ethernets:",
            f"      {nic_name}:",
            f"        addresses: [{ip}/{prefix}]",
            f"        gateway4: {gw}",
            f"        nameservers:",
            f"          addresses: [{dns}]",
        ]
    else:
        lines += [
            f"  network:",
            f"    version: 2",
            f"    ethernets:",
            f"      any:",
            f"        match:",
            f"          name: 'en*'",
            f"        dhcp4: true",
        ]

    # Identity
    lines += [
        f"  identity:",
        f"    hostname: {hostname}",
        f"    username: {username}",
        f"    password: \"{_encrypt_pw(password)}\"",
    ]

    # SSH
    lines += [
        f"  ssh:",
        f"    install-server: true",
        f"    allow-pw: {'true' if ssh_pw else 'false'}",
    ]
    if ssh_keys:
        lines.append(f"    authorized-keys:")
        for key in ssh_keys:
            lines.append(f"      - {key}")

    # Storage
    if part_scheme == "lvm":
        lines += [
            f"  storage:",
            f"    layout:",
            f"      name: lvm",
            f"      reset-partition: true",
        ]
    elif part_scheme == "direct":
        lines += [
            f"  storage:",
            f"    layout:",
            f"      name: direct",
        ]
    else:
        # custom: 기본 LVM with /home
        root_sz  = cfg.get("partRoot", 10240)
        home_sz  = cfg.get("partHome", 5120)
        swap_sz  = cfg.get("partSwap", 2048)
        lines += [
            f"  storage:",
            f"    config:",
            f"      - type: disk",
            f"        id: disk0",
            f"        name: {disk}",
            f"        ptable: gpt",
            f"        wipe: superblock",
            f"      - type: partition",
            f"        id: part-efi",
            f"        device: disk0",
            f"        size: 512M",
            f"        flag: boot",
            f"        grub_device: true",
            f"      - type: format",
            f"        id: fmt-efi",
            f"        fstype: fat32",
            f"        volume: part-efi",
            f"      - type: mount",
            f"        id: mnt-efi",
            f"        device: fmt-efi",
            f"        path: /boot/efi",
            f"      - type: partition",
            f"        id: part-lvm",
            f"        device: disk0",
            f"        size: -1",
            f"      - type: lvm_volgroup",
            f"        id: vg0",
            f"        name: vg0",
            f"        devices: [part-lvm]",
            f"      - type: lvm_partition",
            f"        id: lv-root",
            f"        volgroup: vg0",
            f"        name: lv-root",
            f"        size: {root_sz}M",
            f"      - type: format",
            f"        id: fmt-root",
            f"        fstype: ext4",
            f"        volume: lv-root",
            f"      - type: mount",
            f"        id: mnt-root",
            f"        device: fmt-root",
            f"        path: /",
            f"      - type: lvm_partition",
            f"        id: lv-home",
            f"        volgroup: vg0",
            f"        name: lv-home",
            f"        size: {home_sz}M",
            f"      - type: format",
            f"        id: fmt-home",
            f"        fstype: ext4",
            f"        volume: lv-home",
            f"      - type: mount",
            f"        id: mnt-home",
            f"        device: fmt-home",
            f"        path: /home",
            f"      - type: lvm_partition",
            f"        id: lv-swap",
            f"        volgroup: vg0",
            f"        name: lv-swap",
            f"        size: {swap_sz}M",
            f"      - type: format",
            f"        id: fmt-swap",
            f"        fstype: swap",
            f"        volume: lv-swap",
            f"      - type: mount",
            f"        id: mnt-swap",
            f"        device: fmt-swap",
            f"        path: ''",
        ]

    # Packages
    lines.append(f"  packages:")
    for pkg in packages:
        lines.append(f"    - {pkg}")

    # Late commands (post script)
    if post:
        lines.append(f"  late-commands:")
        for line in post.splitlines():
            line = line.strip()
            if line:
                # chroot 환경에서 실행
                escaped = line.replace("'", "'\\''")
                lines.append(f"    - curtin in-target --target=/target -- bash -c '{escaped}'")

    lines.append(f"  user-data:")
    lines.append(f"    timezone: {tz}")

    return "\n".join(lines) + "\n"


# ── 모니터링 ──────────────────────────────────────────────────────────────────

@app.route("/api/monitor/clients")
def api_monitor_clients():
    """
    1순위: dnsmasq DHCP 로그
    2순위: Nginx 액세스 로그 (DHCP 로그 없어도 클라이언트 감지)
    """
    clients = {}

    # ── 1) dnsmasq 로그 (파일 또는 journald) ─────────────────────────────────
    log_text = ""
    for lp in [Path("/var/log/dnsmasq.log"), Path("/var/log/dnsmasq/dnsmasq.log")]:
        if lp.exists():
            try: log_text = lp.read_text(errors="replace")[-300000:]
            except: pass
            break

    if not log_text:
        r = subprocess.run(
            ["journalctl", "-u", "dnsmasq", "--no-pager", "-n", "3000", "--output=short"],
            capture_output=True, text=True
        )
        log_text = r.stdout

    # DHCP 이벤트 파싱 (여러 형식 대응)
    dhcp_patterns = [
        # dnsmasq: "DHCPACK(eth0) 10.0.0.153 aa:bb:cc:dd:ee:ff hostname"
        r"DHCP(\w+)\([\w.]+\)\s+([\d.]+)\s+([0-9a-f:]{17})(?:\s+(\S+))?",
        # journald short: "dnsmasq-dhcp[123]: DHCPACK 10.0.0.153 aa:bb..."
        r"DHCP(\w+)\s+([\d.]+)\s+([0-9a-f:]{17})(?:\s+(\S+))?",
    ]
    for line in log_text.splitlines():
        ts_m = re.search(r"(\w{3}\s+\d+\s+[\d:]+|\d{4}-\d{2}-\d{2}T[\d:]+)", line)
        ts   = ts_m.group(1) if ts_m else ""
        for pat in dhcp_patterns:
            m = re.search(pat, line, re.IGNORECASE)
            if not m: continue
            event, ip, mac = m.group(1).upper(), m.group(2), m.group(3).lower()
            hostname = (m.group(4) or "").strip()
            if mac not in clients:
                clients[mac] = {"mac": mac, "ip": ip, "hostname": hostname,
                                "first_seen": ts, "last_seen": ts,
                                "events": [], "status": "unknown"}
            clients[mac].update({"last_seen": ts, "ip": ip})
            if hostname: clients[mac]["hostname"] = hostname
            clients[mac]["events"].append({"ts": ts, "event": f"DHCP{event}", "ip": ip})
            if event == "ACK":      clients[mac]["status"] = "booting"
            elif event in ("DISCOVER","REQUEST"): clients[mac]["status"] = "requesting"
            break

    # ── 2) Nginx 액세스 로그 — DHCP 로그 없어도 클라이언트 자동 등록 ─────────
    # 신호 분류 상수
    DONE_SIGNALS = ["ks-done", "install.log", "anaconda-ks.cfg", "post-install"]
    PKG_SIGNALS  = ["/Packages/", "/repodata/", ".rpm"]
    KS_SIGNALS   = ["/ks/", "/autoinstall/"]
    BOOT_SIGNALS = ["vmlinuz", "initrd", "stage2", "LiveOS"]
    ip_last_req: dict = {}

    for nginx_log in [
        Path("/var/log/nginx/pxe-www.access.log"),
        Path("/var/log/nginx/access.log"),
    ]:
        if not nginx_log.exists(): continue
        try:
            ng_text     = nginx_log.read_text(errors="replace")[-400000:]
            ng_mtime    = nginx_log.stat().st_mtime   # 로그 파일 마지막 수정 시각 (UTC epoch)
        except: continue

        for line in ng_text.splitlines():
            m_ip = re.match(r"([\d.]+)", line)
            if not m_ip: continue
            req_ip = m_ip.group(1)
            if not req_ip.startswith("10.") and not req_ip.startswith("192.168."): continue

            ts_m  = re.search(r"\[([^\]]+)\]", line)
            ts    = ts_m.group(1) if ts_m else ""
            url_m = re.search(r'"(?:GET|POST|HEAD)\s+(\S+)', line)
            url   = url_m.group(1) if url_m else ""
            code_m = re.search(r'" (\d{3}) ', line)
            code  = code_m.group(1) if code_m else "000"

            # 마지막 요청 epoch 추적 (idle 감지용)
            # nginx 형식: 25/Mar/2026:10:38:06 +0900  → UTC epoch 변환
            ep_m = re.search(r"(\d{2}/\w{3}/\d{4}:\d{2}:\d{2}:\d{2})\s*([+-]\d{4})?", ts)
            if ep_m:
                try:
                    dt_naive = datetime.datetime.strptime(ep_m.group(1), "%d/%b/%Y:%H:%M:%S")
                    tz_str   = ep_m.group(2) or "+0000"
                    tz_sign  = 1 if tz_str[0] == "+" else -1
                    tz_off   = tz_sign * (int(tz_str[1:3]) * 3600 + int(tz_str[3:5]) * 60)
                    # UTC epoch = local_time - tz_offset
                    req_ep   = calendar.timegm(dt_naive.timetuple()) - tz_off
                    if req_ip not in ip_last_req or req_ep > ip_last_req[req_ip]:
                        ip_last_req[req_ip] = req_ep
                except: pass

            existing_mac = next((mac for mac, info in clients.items() if info["ip"] == req_ip), None)
            if existing_mac is None:
                fake_mac = f"nginx-{req_ip}"
                if fake_mac not in clients:
                    clients[fake_mac] = {
                        "mac": fake_mac, "ip": req_ip, "hostname": "",
                        "first_seen": ts, "last_seen": ts,
                        "events": [], "status": "unknown"
                    }
                existing_mac = fake_mac

            info = clients[existing_mac]
            info["last_seen"] = ts
            cur = info["status"]

            # 상태 전이 (installed는 덮어쓰지 않음)
            if any(sig in url for sig in DONE_SIGNALS):
                info["status"] = "installed"
                info["events"].append({"ts": ts, "event": f"설치완료({code})", "ip": req_ip, "url": url})
            elif any(sig in url for sig in KS_SIGNALS):
                if cur not in ("installed",):
                    info["status"] = "installing"
                info["events"].append({"ts": ts, "event": f"KS요청({code})", "ip": req_ip, "url": url})
            elif any(sig in url for sig in PKG_SIGNALS):
                if cur not in ("installed",):
                    info["status"] = "installing"
                info["events"].append({"ts": ts, "event": f"패키지({code})", "ip": req_ip, "url": url})
            elif "squashfs" in url or "filesystem" in url:
                if cur not in ("installed",):
                    info["status"] = "installing"
                info["events"].append({"ts": ts, "event": f"squashfs({code})", "ip": req_ip, "url": url})
            elif any(sig in url for sig in BOOT_SIGNALS):
                if cur in ("unknown", "requesting"):
                    info["status"] = "booting"
                info["events"].append({"ts": ts, "event": f"부팅파일({code})", "ip": req_ip, "url": url})
        break

    # ── 3) 완료 마커 파일 확인 (/var/www/html/ks-done/<ip>) ───────────────────
    done_dir = WWW_ROOT / "ks-done"
    if done_dir.exists():
        for marker in done_dir.iterdir():
            marker_ip = marker.name
            mac = next((mac for mac, info in clients.items() if info["ip"] == marker_ip), None)
            if mac:
                if clients[mac]["status"] != "installed":
                    clients[mac]["status"] = "installed"
                    done_ts = datetime.datetime.fromtimestamp(marker.stat().st_mtime).strftime("%d/%b/%Y:%H:%M:%S")
                    clients[mac]["events"].append({"ts": done_ts, "event": "마커파일(완료)", "ip": marker_ip})

    # ── 4) idle 기반 설치완료 추정 ─────────────────────────────────────────────
    # 판단 기준: installing 상태 + 마지막 패키지 요청 후 N분 이상 요청 없음
    # - PXE 설치는 reboot 또는 halt로 끝나므로 요청이 갑자기 끊김
    # - 5분: 일반적인 설치 후 reboot까지 소요 시간
    # - 로그가 [-400000:]으로 잘린 경우: 파일 mtime을 기준으로 보정
    now_ts       = time.time()
    IDLE_DONE_SEC = 5 * 60   # 5분 무요청 → 완료 추정

    for mac, info in clients.items():
        if info["status"] != "installing":
            continue
        ip       = info["ip"]
        last_ep  = ip_last_req.get(ip)
        if not last_ep:
            continue

        # 로그 파일이 마지막으로 갱신된 시각이 last_ep보다 최신이면
        # 그 IP에서 그 이후 추가 요청이 없었다는 뜻 → mtime을 기준으로 사용
        # (로그 tail 잘림으로 last_ep가 실제보다 이를 경우 보정)
        try:
            ref_ep = ng_mtime if (ng_mtime > last_ep) else now_ts
        except NameError:
            ref_ep = now_ts

        idle_sec = ref_ep - last_ep
        if idle_sec > IDLE_DONE_SEC:
            idle_min = int(idle_sec // 60)
            info["status"] = "installed(추정)"
            info["events"].append({
                "ts": "", "event": f"설치완료추정({idle_min}분 무요청)", "ip": ip
            })

    result = sorted(clients.values(), key=lambda x: x["last_seen"], reverse=True)
    for c in result:
        c["events"] = c["events"][-20:]

    return jsonify({"clients": result, "count": len(result)})


@app.route("/api/monitor/nginx-log")
def api_monitor_nginx():
    """최근 Nginx 접근 로그 (PXE 관련만)"""
    log_file = Path("/var/log/nginx/pxe-www.access.log")
    if not log_file.exists():
        return jsonify({"lines": []})
    try:
        text = log_file.read_text(errors="replace")
        lines = text.strip().splitlines()[-200:]  # 최근 200줄
        # KS/vmlinuz/initrd 관련만
        filtered = [l for l in lines if any(
            kw in l for kw in ["/ks/", "vmlinuz", "initrd", "squashfs", "pxeboot", "casper"]
        )]
        return jsonify({"lines": filtered[-100:]})
    except Exception as e:
        return jsonify({"lines": [], "error": str(e)})



# ── Diskless grub.cfg entry 생성 ──────────────────────────────────────────────

@app.route("/api/diskless/grub-entry", methods=["POST"])
def api_diskless_grub_entry():
    """Diskless 부팅용 grub.cfg menuentry 생성 및 grub.cfg에 추가"""
    d = request.json or {}
    mode       = d.get("mode", "nfs")
    label      = d.get("label", "Diskless Boot")
    server_ip  = _sanitize(d.get("serverIp", "10.0.0.200"), r"[^0-9.]")
    os_name    = _sanitize(d.get("osName", "rocky"), r"[^a-zA-Z0-9_\-]")
    os_ver     = _sanitize(d.get("osVer",  "9.6"),   r"[^0-9.]")
    kern_path  = d.get("kernelPath", "") or f"(http)/{os_name}/{os_ver}/images/pxeboot/vmlinuz"
    init_path  = d.get("initrdPath", "") or f"(http)/{os_name}/{os_ver}/images/pxeboot/initrd.img"
    extra_args = d.get("extraKernelArgs", "").strip()

    if mode == "nfs":
        nfs_export = d.get("nfsExport", "/exports/rootfs")
        nfs_opts   = _sanitize(d.get("nfsOpts", "vers=3,tcp,rw"), r"[^a-zA-Z0-9_,=.]")
        # 표준 방식: root=/dev/nfs + nfsroot=<srv>:<path>,<opts>
        root_param = (
            f"root=/dev/nfs "
            f"nfsroot={server_ip}:{nfs_export},{nfs_opts} "
            f"{DISKLESS_NET_ARGS} "
            f"{DISKLESS_KERN_ARGS}"
        )
        # kern/initrd 기본 경로를 (tftp) prefix 기준으로
        if not d.get("kernelPath"):
            kern_path = f"(tftp)/pxelinux/{os_name}/{_ver_to_dir(os_ver)}/vmlinuz"
        if not d.get("initrdPath"):
            init_path = f"(tftp)/pxelinux/{os_name}/{_ver_to_dir(os_ver)}/initrd.img"
    elif mode == "iscsi":
        target  = d.get("iscsiTarget", "")
        port    = _sanitize(d.get("iscsiPort", "3260"), r"[^0-9]")
        root_param = f"root=UUID=diskless netroot=iscsi:{server_ip}::{port}::{target} rd.iscsi.initiator=auto ip=dhcp"
    elif mode == "nbd":
        export = d.get("nbdExport", "rootfs")
        port   = _sanitize(d.get("nbdPort", "10809"), r"[^0-9]")
        root_param = f"root=/dev/nbd0 nbdroot={server_ip}/{export}:{port} ip=dhcp"
    elif mode == "overlay":
        squash_path = d.get("squashfsPath", "/exports/rootfs.squashfs")
        overlay_sz  = _sanitize(d.get("overlaySize", "512"), r"[^0-9]")
        root_param = f"root=live:nfs:{server_ip}:{squash_path} rd.live.overlay.size={overlay_sz}M rd.live.overlay=tmpfs ip=dhcp"
    else:
        return jsonify({"error": f"Unknown mode: {mode}"}), 400

    extra = f" {extra_args}" if extra_args else ""
    entry = (
        f'menuentry "{label}" {{\n'
        f'    linuxefi {kern_path} \\\n'
        f'        {root_param}{extra}\n'
        f'    initrdefi {init_path}\n'
        f'}}'
    )

    append = d.get("append", False)
    if append:
        cfg_file = TFTP_ROOT / "grub.cfg"
        cfg_file.parent.mkdir(parents=True, exist_ok=True)
        if not cfg_file.exists():
            cfg_file.write_text("set default=0\nset timeout=10\n")
        bak = cfg_file.with_suffix(f".cfg.{time.strftime('%Y%m%d-%H%M%S')}.bak")
        shutil.copy2(str(cfg_file), str(bak))
        current = cfg_file.read_text()
        updated = current.rstrip() + "\n\n# ---- Diskless entry ----\n" + entry + "\n"
        cfg_file.write_text(updated)
        subprocess.run(["chmod", "644", str(cfg_file)], capture_output=True)
        _restorecon(cfg_file)
        return jsonify({"ok": True, "entry": entry, "appended": True})

    return jsonify({"ok": True, "entry": entry, "appended": False})


# ── Diskless API ──────────────────────────────────────────────────────────────

@app.route("/api/diskless/status")
def api_diskless_status():
    """
    ISO 목록 + pxelinux 배포 상태 + diskless rootfs 존재 여부 통합 반환.
    프론트의 DisklessPanel이 사용하는 단일 엔드포인트.
    """
    nfs_srv = _get_nfs_server()

    # ISO 목록 (기존 /api/isos 와 동일 로직)
    isos = []
    if ISO_DIR.exists():
        for f in sorted(ISO_DIR.glob("*.iso")):
            os_name, os_ver = _detect_os_from_iso(f.name)
            if not os_name:
                continue  # OS 감지 불가 ISO는 제외
            ver_dir = _ver_to_dir(os_ver)
            kern_path  = PXELINUX_DIR / os_name / ver_dir / "vmlinuz"
            initrd_path = PXELINUX_DIR / os_name / ver_dir / "initrd.img"
            root_path   = Path(NFS_DISKLESS_BASE) / os_name / ver_dir / "root"
            root_ok     = root_path.exists() and root_path.is_dir() and any(root_path.iterdir())
            isos.append({
                "name":       f.name,
                "path":       str(f),
                "size":       f"{f.stat().st_size / (1024**3):.1f} GB",
                "os_name":    os_name,
                "os_ver":     os_ver,
                "ver_dir":    ver_dir,
                "kern_ok":    kern_path.exists(),
                "initrd_ok":  initrd_path.exists(),
                "root_ok":    root_ok,
                "root_path":  str(root_path),
                "nfs_root":   f"nfs:{nfs_srv}:{NFS_DISKLESS_BASE}/{os_name}/{ver_dir}/root",
            })

    return jsonify({
        "nfs_server": nfs_srv,
        "isos":       isos,
    })


@app.route("/api/diskless/setup", methods=["POST"])
def api_diskless_setup():
    """
    ISO를 기반으로 Diskless rootfs 자동 구성 (백그라운드 job):
      1. /diskless/{os}/{ver_dir}/root/ 디렉터리 생성
      2. dnf --installroot 최소 OS 설치
      3. dracut (network+nfs 모듈) initrd 재생성 → pxelinux/ 자동 배치
      4. /etc/exports NFS 항목 추가
      5. grub.cfg Diskless menuentry 자동 추가
    """
    d            = request.json or {}
    iso_path     = d.get("iso_path", "")
    label        = d.get("label", "").strip()
    packages     = d.get("packages", [])
    root_pw      = d.get("rootPassword", "")        # 평문; 빈 문자열이면 랜덤 설정
    extra_user   = _sanitize_id(d.get("extraUser", ""))
    extra_pw     = d.get("extraPassword", "")
    extra_sudo   = bool(d.get("extraSudo", True))

    if not iso_path or not Path(iso_path).exists():
        return jsonify({"error": f"ISO 없음: {iso_path}"}), 400

    iso_name = Path(iso_path).name
    os_name, os_ver = _detect_os_from_iso(iso_name)
    if not os_name:
        return jsonify({"error": f"ISO 파일명에서 OS 감지 실패: {iso_name}"}), 400

    nfs_srv  = _get_nfs_server()
    ver_dir  = _ver_to_dir(os_ver)
    ver_disp = _dir_to_ver(ver_dir)
    os_cap   = os_name.capitalize()
    lbl      = label or f"Dskless: {os_cap} {ver_disp} x86-64"

    root_path      = Path(NFS_DISKLESS_BASE) / os_name / ver_dir / "root"
    pxelinux_ver   = PXELINUX_DIR / os_name / ver_dir
    major_ver      = ver_dir.split("_")[0]
    pkg_extra      = " ".join(f"'{p}'" for p in packages) if packages else ""

    # 패스워드 — 빈 문자열이면 랜덤 생성
    _root_pw_plain  = root_pw  if root_pw  else secrets.token_urlsafe(12)
    _extra_pw_plain = extra_pw if extra_pw else secrets.token_urlsafe(12)
    root_pw_hash    = _encrypt_pw(_root_pw_plain)
    extra_pw_hash   = _encrypt_pw(_extra_pw_plain) if extra_user else ""
    # setup_script에 평문 노출 최소화: hash만 전달, 평문은 완료 로그에만 출력
    root_pw_log     = _root_pw_plain  if root_pw  else f"{_root_pw_plain} (자동생성)"
    extra_pw_log    = _extra_pw_plain if extra_pw else f"{_extra_pw_plain} (자동생성)"

    setup_script = f"""#!/usr/bin/env bash
set -e
export PATH=/usr/local/sbin:/usr/sbin:/sbin:/usr/local/bin:/usr/bin:/bin
log()  {{ echo "[+] $*"; }}
warn() {{ echo "[!] $*"; }}
die()  {{ echo "[✗] $*"; exit 1; }}

ROOT="{root_path}"
PXEDIR="{pxelinux_ver}"
NFS_SRV="{nfs_srv}"
ISO_PATH="{iso_path}"
ISO_MNT="/mnt/_pxe_iso_$$"

log "== STEP 1: 디렉터리 생성 =="
mkdir -p "$ROOT"
mkdir -p "$PXEDIR"
log "rootfs : $ROOT"
log "pxedir : $PXEDIR"

log "== STEP 2: OS 최소 설치 (dnf --installroot) =="
# --installroot로 별도 rootfs에 설치한다.
# 호스트에 같은 패키지가 있어도 installroot에 별도로 설치해야 한다.
# kernel-modules / dracut-network 는 initrd NFS 부팅에 필수.
dnf -y \\
    --installroot="$ROOT" \\
    --releasever={major_ver} \\
    --setopt=install_weak_deps=False \\
    --setopt=reposdir=/etc/yum.repos.d \\
    --nogpgcheck \\
    install \\
    basesystem bash coreutils shadow-utils util-linux \\
    systemd NetworkManager \\
    openssh-server openssh-clients \\
    kernel kernel-modules kernel-modules-extra \\
    nfs-utils iproute iputils net-tools \\
    dracut dracut-network dracut-config-generic \\
    {pkg_extra} \\
    2>&1 || warn "일부 패키지 설치 실패 — 계속"

# installroot 커널 모듈 설치 확인
KVER_INST=$(ls "$ROOT/lib/modules/" 2>/dev/null | sort -V | tail -1)
if [[ -n "$KVER_INST" ]]; then
    log "OS 최소 설치 완료 (installroot 커널: $KVER_INST)"
else
    warn "installroot에 커널 모듈 없음 — ISO에서 vmlinuz/initrd를 직접 사용합니다"
fi

log "== STEP 3: rootfs 기본 설정 =="
# fstab — tmpfs 쓰기 레이어 (NFS root는 커널 nfsroot= 파라미터로 마운트)
cat > "$ROOT/etc/fstab" << 'FSTAB'
# /etc/fstab — Diskless NFS client
# root(/)는 커널 nfsroot= 파라미터로 initrd가 마운트
tmpfs   /tmp     tmpfs  defaults,size=512m  0 0
tmpfs   /var/tmp tmpfs  defaults,size=256m  0 0
FSTAB

echo "{os_name}-diskless" > "$ROOT/etc/hostname"
log "hostname: {os_name}-diskless"

# NetworkManager — PXE로 잡은 NIC 재설정 방지
mkdir -p "$ROOT/etc/NetworkManager/conf.d"
cat > "$ROOT/etc/NetworkManager/conf.d/pxe.conf" << 'NMCFG'
[main]
# PXE로 부팅한 NIC은 NM이 건드리지 않음
no-auto-default=*
NMCFG
log "NetworkManager no-auto-default 설정 완료"

log "== STEP 4: vmlinuz / initrd 준비 =="

# ── 4-A: ISO를 마운트해서 vmlinuz + initrd.img 먼저 확보 ─────────────────
# dnf --installroot는 호스트 패키지 캐시를 재사용해 installroot에 실제로
# 커널을 설치하지 않는 경우가 있으므로 ISO를 primary source로 사용한다.
ISO_VMLINUZ=""
ISO_INITRD=""
if [[ -f "$ISO_PATH" ]]; then
    mkdir -p "$ISO_MNT"
    mount -o loop,ro "$ISO_PATH" "$ISO_MNT" 2>&1 && log "ISO 마운트: $ISO_MNT" || true
    if mountpoint -q "$ISO_MNT" 2>/dev/null; then
        ISO_VMLINUZ=$(find "$ISO_MNT" -name "vmlinuz" -path "*/pxeboot/*" 2>/dev/null | head -1)
        ISO_INITRD=$(find  "$ISO_MNT" -name "initrd.img" -path "*/pxeboot/*" 2>/dev/null | head -1)
        [[ -z "$ISO_VMLINUZ" ]] && ISO_VMLINUZ=$(find "$ISO_MNT" -name "vmlinuz"   2>/dev/null | head -1)
        [[ -z "$ISO_INITRD"  ]] && ISO_INITRD=$(find  "$ISO_MNT" -name "initrd.img" 2>/dev/null | head -1)
    fi
fi

# ── 4-B: installroot 커널 버전 탐색 ──────────────────────────────────────
KVER=$(ls "$ROOT/lib/modules/" 2>/dev/null | sort -V | tail -1)
log "installroot 커널 버전: ${{KVER:-없음}}"

# ── 4-C: vmlinuz 확보 ────────────────────────────────────────────────────
if [[ -n "$ISO_VMLINUZ" ]]; then
    cp -v "$ISO_VMLINUZ" "$PXEDIR/vmlinuz"
    log "vmlinuz → $PXEDIR/vmlinuz (ISO pxeboot)"
elif [[ -n "$KVER" && -f "$ROOT/boot/vmlinuz-${{KVER}}" ]]; then
    cp -v "$ROOT/boot/vmlinuz-${{KVER}}" "$PXEDIR/vmlinuz"
    log "vmlinuz → $PXEDIR/vmlinuz (installroot)"
elif [[ -f "/boot/vmlinuz-$(uname -r)" ]]; then
    cp -v "/boot/vmlinuz-$(uname -r)" "$PXEDIR/vmlinuz"
    KVER=$(uname -r)
    log "vmlinuz → $PXEDIR/vmlinuz (호스트 fallback, KVER=$KVER)"
else
    die "vmlinuz 확보 실패 — ISO 내 pxeboot/vmlinuz 없음"
fi

# ── 4-D: initrd.img — ISO pxeboot 우선, 없으면 dracut 생성 ──────────────
#
# ISO의 pxeboot/initrd.img는 이미 NFS 부팅용 dracut 모듈이 포함된
# 공식 Red Hat/Rocky initrd이므로 가장 신뢰할 수 있는 소스다.
# dracut은 호스트 /lib/modules/<KVER>가 반드시 존재해야 하므로
# ISO initrd를 사용할 수 없을 때만 fallback으로 dracut을 실행한다.
if [[ -n "$ISO_INITRD" ]]; then
    cp -v "$ISO_INITRD" "$PXEDIR/initrd.img"
    log "initrd.img → $PXEDIR/initrd.img (ISO pxeboot — NFS 모듈 포함)"
    USED_ISO_INITRD=1
else
    log "ISO pxeboot/initrd.img 없음 — dracut으로 생성"
    USED_ISO_INITRD=0
fi

# ── 4-E: dracut fallback ──────────────────────────────────────────────────
if [[ "$USED_ISO_INITRD" -eq 0 ]]; then
    # dracut은 호스트의 /lib/modules/$KVER 를 읽어야 한다.
    # installroot의 모듈을 호스트 경로로 bind-mount해서 제공한다.
    HOST_MOD_DIR="/lib/modules/$KVER"
    ROOT_MOD_DIR="$ROOT/lib/modules/$KVER"
    BIND_MOUNTED=0

    if [[ -n "$KVER" && -d "$ROOT_MOD_DIR" && ! -d "$HOST_MOD_DIR" ]]; then
        log "installroot 모듈을 호스트 경로로 bind-mount: $HOST_MOD_DIR"
        mkdir -p "$HOST_MOD_DIR"
        mount --bind "$ROOT_MOD_DIR" "$HOST_MOD_DIR" 2>/dev/null && BIND_MOUNTED=1 || \
            warn "bind-mount 실패 — dracut이 실패할 수 있습니다"
    elif [[ -z "$KVER" || ! -d "${{ROOT_MOD_DIR:-/nonexistent}}" ]]; then
        # installroot 모듈 없음 → 호스트 커널로 전환
        KVER=$(uname -r)
        log "installroot 모듈 없음 → 호스트 커널로 전환: $KVER"
        if [[ ! -d "/lib/modules/$KVER" ]]; then
            die "호스트 /lib/modules/$KVER 도 없습니다. kernel-devel 패키지를 설치하세요."
        fi
    fi

    log "dracut 실행 (kver=$KVER, --no-hostonly) ..."
    dracut --force \\
        --no-hostonly \\
        --kver "$KVER" \\
        --add "network nfs base" \\
        --add-drivers "nfs nfsv3 nfsv4 sunrpc" \\
        "$PXEDIR/initrd.img" 2>&1

    # bind-mount 해제
    if [[ "$BIND_MOUNTED" -eq 1 ]]; then
        umount "$HOST_MOD_DIR" 2>/dev/null || true
        rmdir  "$HOST_MOD_DIR" 2>/dev/null || true
    fi

    if [[ ! -f "$PXEDIR/initrd.img" ]]; then
        die "initrd.img 생성 실패 — dracut 오류 확인 필요"
    fi
    log "initrd.img 생성 완료 (dracut): $(du -sh $PXEDIR/initrd.img | cut -f1)"

    # NFS 모듈 포함 확인
    NFS_CHECK=$(lsinitrd "$PXEDIR/initrd.img" 2>/dev/null | grep -c "nfs" || true)
    if [[ "$NFS_CHECK" -gt 0 ]]; then
        log "NFS 모듈 확인: $NFS_CHECK 개 항목"
    else
        die "NFS 모듈이 initrd에 포함되지 않았습니다. 'dnf install -y nfs-utils dracut-network' 후 재시도하세요."
    fi
fi

# ── 4-F: ISO 언마운트 정리 ───────────────────────────────────────────────
if mountpoint -q "$ISO_MNT" 2>/dev/null; then
    umount "$ISO_MNT" && rmdir "$ISO_MNT" 2>/dev/null || true
    log "ISO 언마운트 완료"
fi

log "initrd 크기: $(du -sh $PXEDIR/initrd.img | cut -f1)"

log "== STEP 5: 계정 및 패스워드 설정 =="

# root 패스워드 — SHA-512 해시로 직접 주입 (평문 노출 없음)
ROOT_PW_HASH="{root_pw_hash}"
if [[ -n "$ROOT_PW_HASH" ]]; then
    # chpasswd -e : 이미 암호화된 해시를 그대로 적용
    echo "root:$ROOT_PW_HASH" | chroot "$ROOT" chpasswd -e 2>/dev/null || \
        chroot "$ROOT" usermod -p "$ROOT_PW_HASH" root 2>/dev/null || \
        warn "root 패스워드 설정 실패 — chroot 후 수동 설정 필요"
    log "root 패스워드 설정 완료"
else
    warn "root 패스워드 해시 없음 — root 계정이 잠긴 상태로 유지됩니다"
fi

# root 계정 잠금 해제 (installroot 기본값이 잠긴 경우 대비)
chroot "$ROOT" passwd -u root 2>/dev/null || true

# 추가 사용자 생성
EXTRA_USER="{extra_user}"
EXTRA_PW_HASH="{extra_pw_hash}"
EXTRA_SUDO="{str(extra_sudo).lower()}"
if [[ -n "$EXTRA_USER" ]]; then
    if ! chroot "$ROOT" id "$EXTRA_USER" &>/dev/null; then
        chroot "$ROOT" useradd -m -s /bin/bash "$EXTRA_USER" 2>/dev/null || \
            warn "사용자 생성 실패: $EXTRA_USER"
    fi
    if [[ -n "$EXTRA_PW_HASH" ]]; then
        echo "$EXTRA_USER:$EXTRA_PW_HASH" | chroot "$ROOT" chpasswd -e 2>/dev/null || \
            chroot "$ROOT" usermod -p "$EXTRA_PW_HASH" "$EXTRA_USER" 2>/dev/null || \
            warn "$EXTRA_USER 패스워드 설정 실패"
        log "사용자 생성 및 패스워드 설정 완료: $EXTRA_USER"
    fi
    if [[ "$EXTRA_SUDO" == "true" ]]; then
        chroot "$ROOT" usermod -aG wheel "$EXTRA_USER" 2>/dev/null || true
        # wheel 그룹 sudo 허용 확인
        if ! grep -q "^%wheel" "$ROOT/etc/sudoers" 2>/dev/null; then
            echo "%wheel ALL=(ALL) ALL" >> "$ROOT/etc/sudoers"
        fi
        log "$EXTRA_USER wheel 그룹 추가 완료"
    fi
fi

log "== STEP 6: sshd 활성화 =="
mkdir -p "$ROOT/etc/systemd/system/multi-user.target.wants"
ln -sf /usr/lib/systemd/system/sshd.service \\
    "$ROOT/etc/systemd/system/multi-user.target.wants/sshd.service" 2>/dev/null || true
# PermitRootLogin 허용 (diskless 환경에서는 초기 root 접속 필요)
SSHD_CFG="$ROOT/etc/ssh/sshd_config"
if [[ -f "$SSHD_CFG" ]]; then
    sed -i 's/^#*PermitRootLogin.*/PermitRootLogin yes/' "$SSHD_CFG"
    grep -q "^PermitRootLogin" "$SSHD_CFG" || echo "PermitRootLogin yes" >> "$SSHD_CFG"
    log "sshd PermitRootLogin yes 설정"
fi
log "sshd 심볼릭 링크 생성"

log "== STEP 6: SELinux 레이블 =="
command -v restorecon >/dev/null 2>&1 && restorecon -RF "$ROOT" 2>/dev/null || true

log "== STEP 7: NFS exports 설정 =="
# rw: 클라이언트 쓰기 필요 (tmpfs 마운트 전 /run /tmp 등 생성)
# no_root_squash: root로 파일 쓰기 허용
EXPORTS_LINE="{NFS_DISKLESS_BASE}/{os_name}/{ver_dir}/root  *(rw,sync,no_root_squash,no_subtree_check)"
# 기존 ro 항목 제거 후 rw로 교체
sed -i "\\|{NFS_DISKLESS_BASE}/{os_name}/{ver_dir}/root|d" /etc/exports 2>/dev/null || true
echo "$EXPORTS_LINE" >> /etc/exports
log "NFS exports 설정: $EXPORTS_LINE"

# nfs-utils 설치 및 nfs-server 기동
if ! systemctl is-active --quiet nfs-server 2>/dev/null; then
    dnf install -y nfs-utils 2>&1 | tail -5 || true
    systemctl enable --now nfs-server 2>/dev/null || \
        systemctl enable --now nfs-kernel-server 2>/dev/null || true
fi
# exports 적용 및 검증
exportfs -ra 2>&1 && log "exportfs -ra 완료"
exportfs -v 2>&1 | grep "{NFS_DISKLESS_BASE}/{os_name}/{ver_dir}/root" && \
    log "NFS export 확인 완료" || warn "exportfs -v 에서 경로 미확인 — /etc/exports 수동 점검 필요"

# 방화벽 — NFS/mountd/rpcbind 허용
if systemctl is-active --quiet firewalld 2>/dev/null; then
    firewall-cmd --add-service=nfs   --permanent 2>/dev/null || true
    firewall-cmd --add-service=mountd --permanent 2>/dev/null || true
    firewall-cmd --add-service=rpc-bind --permanent 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
    log "방화벽 NFS 규칙 적용 완료"
fi

log "== STEP 8: TFTP 파일 퍼미션 / SELinux 레이블 확인 =="
TFTP_ROOT_DIR="{TFTP_ROOT}"
chmod 755 "$TFTP_ROOT_DIR" 2>/dev/null || true
find "$PXEDIR" -type f -exec chmod 644 {{}} + 2>/dev/null || true
command -v restorecon >/dev/null 2>&1 && restorecon -RF "$PXEDIR" 2>/dev/null || true
log "TFTP pxelinux 경로 레이블: $(ls -Z $PXEDIR/vmlinuz 2>/dev/null || echo 'N/A')"

log "== STEP 9: grubx64.efi TFTP 배치 확인 =="
if [[ ! -f "$TFTP_ROOT_DIR/grubx64.efi" ]]; then
    warn "grubx64.efi 없음 — 복사 시도"
    cp -av /boot/efi/EFI/rocky/grubx64.efi "$TFTP_ROOT_DIR/" 2>/dev/null || \
    cp -av /boot/efi/EFI/redhat/grubx64.efi "$TFTP_ROOT_DIR/" 2>/dev/null || \
    cp -av /usr/lib/grub/x86_64-efi-signed/grubx64.efi "$TFTP_ROOT_DIR/" 2>/dev/null || \
    warn "grubx64.efi 자동 복사 실패 — 수동 배치 필요 (/var/lib/tftpboot/grubx64.efi)"
else
    log "grubx64.efi 확인 완료: $(stat -c%s $TFTP_ROOT_DIR/grubx64.efi 2>/dev/null || echo '?') bytes"
fi

log "================================================================"
log "Diskless rootfs 구성 완료"
log "  rootfs  : $ROOT"
log "  nfsroot : $NFS_SRV:{NFS_DISKLESS_BASE}/{os_name}/{ver_dir}/root"
log "  vmlinuz : $PXEDIR/vmlinuz"
log "  initrd  : $PXEDIR/initrd.img"
log "  grub    : (tftp)/pxelinux/{os_name}/{ver_dir}/vmlinuz"
log "  NFS export 확인: exportfs -v | grep {NFS_DISKLESS_BASE}"
log "----------------------------------------------------------------"
log "  계정 정보"
log "  root 패스워드 : {root_pw_log}"
if [[ -n "{extra_user}" ]]; then
    log "  추가 계정     : {extra_user} / {extra_pw_log}{' (wheel)' if extra_sudo else ''}"
fi
log "================================================================"
"""

    def _grub_hook():
        nfs_path = f"{NFS_DISKLESS_BASE}/{os_name}/{ver_dir}/root"
        # GRUB EFI는 TFTP로 로드되므로 (tftp) prefix로 TFTP root 기준 경로를 지정
        # root=/dev/nfs + nfsroot= 는 표준 커널 NFS root 파라미터 (initrd가 처리)
        entry = (
            f"menuentry '{lbl}' {{\n"
            f"  echo 'Loading vmlinuz ...'\n"
            f"  linuxefi (tftp)/pxelinux/{os_name}/{ver_dir}/vmlinuz \\\n"
            f"    root=/dev/nfs \\\n"
            f"    nfsroot={nfs_srv}:{nfs_path},vers=3,tcp,rw \\\n"
            f"    {DISKLESS_NET_ARGS} \\\n"
            f"    {DISKLESS_KERN_ARGS}\n"
            f"  echo 'Loading initrd.img ...'\n"
            f"  initrdefi (tftp)/pxelinux/{os_name}/{ver_dir}/initrd.img\n"
            f"}}"
        )
        cfg_file = TFTP_ROOT / "grub.cfg"
        cfg_file.parent.mkdir(parents=True, exist_ok=True)
        if not cfg_file.exists():
            cfg_file.write_text("set default=0\nset timeout=10\n")
        current = cfg_file.read_text()
        if f"menuentry '{lbl}'" in current:
            return [f"[+] menuentry 이미 존재: {lbl}"]
        cfg_file.write_text(current.rstrip() + f"\n\n{entry}\n")
        subprocess.run(["chmod", "644", str(cfg_file)], capture_output=True)
        _restorecon(cfg_file)
        return [f"[+] grub.cfg Diskless menuentry 추가: {lbl}"]

    job_id = start_job(["bash", "-c", setup_script], post_hook=_grub_hook)
    return jsonify({
        "job_id":    job_id,
        "os_name":   os_name,
        "os_ver":    os_ver,
        "ver_dir":   ver_dir,
        "root_path": str(root_path),
        "nfs_root":  f"nfs:{nfs_srv}:{NFS_DISKLESS_BASE}/{os_name}/{ver_dir}/root",
    })


@app.route("/api/diskless/passwd", methods=["POST"])
def api_diskless_passwd():
    """기존 rootfs에 패스워드/계정 재설정 (chroot chpasswd)"""
    d           = request.json or {}
    os_name     = _sanitize(d.get("os_name", ""), r"[^a-zA-Z0-9_\-]")
    ver_dir     = _sanitize(d.get("ver_dir", ""),  r"[^a-zA-Z0-9_.]")
    root_pw     = d.get("rootPassword", "")
    extra_user  = _sanitize_id(d.get("extraUser", ""))
    extra_pw    = d.get("extraPassword", "")
    extra_sudo  = bool(d.get("extraSudo", True))

    if not os_name or not ver_dir:
        return jsonify({"error": "os_name, ver_dir 필수"}), 400

    root_path = Path(NFS_DISKLESS_BASE) / os_name / ver_dir / "root"
    if not root_path.exists():
        return jsonify({"error": f"rootfs 없음: {root_path}"}), 400

    msgs = []

    # root 패스워드
    _root_pw_plain = root_pw if root_pw else secrets.token_urlsafe(12)
    root_pw_hash   = _encrypt_pw(_root_pw_plain)
    r = subprocess.run(
        ["chroot", str(root_path), "chpasswd", "-e"],
        input=f"root:{root_pw_hash}\n", capture_output=True, text=True
    )
    if r.returncode != 0:
        # fallback: usermod -p
        subprocess.run(
            ["chroot", str(root_path), "usermod", "-p", root_pw_hash, "root"],
            capture_output=True
        )
    # 잠금 해제
    subprocess.run(["chroot", str(root_path), "passwd", "-u", "root"], capture_output=True)
    pw_display = _root_pw_plain if root_pw else f"{_root_pw_plain} (자동생성)"
    msgs.append(f"root 패스워드 설정 완료: {pw_display}")

    # 추가 계정
    if extra_user:
        _extra_pw_plain = extra_pw if extra_pw else secrets.token_urlsafe(12)
        extra_pw_hash   = _encrypt_pw(_extra_pw_plain)
        # 계정 없으면 생성
        chk = subprocess.run(
            ["chroot", str(root_path), "id", extra_user], capture_output=True
        )
        if chk.returncode != 0:
            subprocess.run(
                ["chroot", str(root_path), "useradd", "-m", "-s", "/bin/bash", extra_user],
                capture_output=True
            )
        # 패스워드 설정
        subprocess.run(
            ["chroot", str(root_path), "chpasswd", "-e"],
            input=f"{extra_user}:{extra_pw_hash}\n", capture_output=True, text=True
        )
        if extra_sudo:
            subprocess.run(
                ["chroot", str(root_path), "usermod", "-aG", "wheel", extra_user],
                capture_output=True
            )
            sudoers = root_path / "etc" / "sudoers"
            if sudoers.exists():
                txt = sudoers.read_text()
                if "%wheel" not in txt:
                    sudoers.write_text(txt + "\n%wheel ALL=(ALL) ALL\n")
        ep_display = _extra_pw_plain if extra_pw else f"{_extra_pw_plain} (자동생성)"
        msgs.append(f"계정 설정 완료: {extra_user} / {ep_display}" +
                    (" (wheel)" if extra_sudo else ""))

    return jsonify({"ok": True, "messages": msgs})


@app.route("/api/grub/nfs-build", methods=["POST"])
def api_grub_nfs_build():
    """기존 rootfs에 대해 grub.cfg menuentry만 추가"""
    d = request.json or {}
    os_name = _sanitize(d.get("os_name",""), r"[^a-zA-Z0-9_\-]")
    ver_dir = _sanitize(d.get("ver_dir", ""), r"[^a-zA-Z0-9_.]")
    label   = d.get("label","").strip()
    if not os_name or not ver_dir:
        return jsonify({"error":"os_name, ver_dir 필수"}),400

    nfs_srv  = _get_nfs_server()
    ver_disp = _dir_to_ver(ver_dir)
    os_cap   = os_name.capitalize()
    lbl      = label or f"Dskless: {os_cap} {ver_disp} x86-64"
    nfs_path = f"{NFS_DISKLESS_BASE}/{os_name}/{ver_dir}/root"

    entry = (
        f"menuentry '{lbl}' {{\n"
        f"  echo 'Loading vmlinuz ...'\n"
        f"  linuxefi (tftp)/pxelinux/{os_name}/{ver_dir}/vmlinuz \\\n"
        f"    root=/dev/nfs \\\n"
        f"    nfsroot={nfs_srv}:{nfs_path},vers=3,tcp,rw \\\n"
        f"    {DISKLESS_NET_ARGS} \\\n"
        f"    {DISKLESS_KERN_ARGS}\n"
        f"  echo 'Loading initrd.img ...'\n"
        f"  initrdefi (tftp)/pxelinux/{os_name}/{ver_dir}/initrd.img\n"
        f"}}"
    )
    cfg_file = TFTP_ROOT / "grub.cfg"
    cfg_file.parent.mkdir(parents=True, exist_ok=True)
    if not cfg_file.exists():
        cfg_file.write_text("set default=0\nset timeout=10\n")
    current = cfg_file.read_text()
    if f"menuentry '{lbl}'" in current:
        return jsonify({"ok":True,"entry":entry,"skipped":True})
    cfg_file.write_text(current.rstrip()+f"\n\n{entry}\n")
    subprocess.run(["chmod","644",str(cfg_file)],capture_output=True)
    _restorecon(cfg_file)
    return jsonify({"ok":True,"entry":entry,"skipped":False})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
