#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
IDM 冒烟：userName -> uid -> 部门层级 + 最小部门
文档：https://mi.feishu.cn/wiki/RAujwaUIZi91sCkzTtAcnACen1c

X5（与飞书文档《X5请求格式(返回报文自定义)说明文档》一致）：
  - 默认 IDM_X5_HTTP_MODE=base64_data：内层 JSON（body 为字符串）→ Base64 → POST 表单字段 data=
  - 若仍异常可试 IDM_X5_HTTP_MODE=json（直接 POST application/json，历史调试）

环境变量（兼容 .env.local 中的 IDM_AppId / IDM_AppKey）：
  IDM_BASE_URL    默认 https://api.id.mioffice.cn
  IDM_APP_ID / IDM_AppId
  IDM_APP_KEY / IDM_AppKey
  IDM_X5_HTTP_MODE   base64_data（默认）| json
  IDM_X5_METHOD_STYLE  relpath | segment | fullpath
  IDM_X5_STYLE         仅 json 模式：nested_object | nested_string | ...
  IDM_X5_ROOT_WRAP     仅 json 模式：request | payload
  IDM_X5_OMIT_METHOD   1 时官方包 header 不传 method（文档中 method 为可选）

用法：
  "D:\\miniforge3\\python.exe" "D:\\Micode\\FOD_OperaSkill\\scripts\\idm_department_query.py" --user-name wanghongyi3
  "D:\\miniforge3\\python.exe" "D:\\Micode\\FOD_OperaSkill\\scripts\\idm_department_query.py" --uid <uid>
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from argparse import Namespace
from datetime import datetime
from pathlib import Path
from typing import Any

import requests
import urllib3
from tqdm import tqdm

from idm_x5 import (
    build_official_x5_inner_json,
    build_x5_payload,
    official_x5_post_form_data,
    x5_request_bytes,
)

# 内网调试：若需跳过证书校验，设置 IDM_SSL_VERIFY=false（仅本机联调）
def _http_verify() -> bool | str:
    return os.environ.get("IDM_SSL_VERIFY", "true").lower() not in (
        "0",
        "false",
        "no",
    )

LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

ROOT = Path(__file__).resolve().parent.parent


def load_env_local() -> None:
    """读取项目根目录 .env.local：始终覆盖同名变量（与 dotenv 常见行为一致），避免终端里残留旧 IDM_X5_*。"""
    p = ROOT / ".env.local"
    if not p.is_file():
        return
    text = p.read_text(encoding="utf-8-sig")
    for line in text.splitlines():
        line = line.strip().rstrip("\r")
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip().rstrip("\r")
        v = v.strip().strip('"').strip("'").rstrip("\r")
        if k:
            os.environ[k] = v


def get_idm_credentials() -> tuple[str, str]:
    app_id = os.environ.get("IDM_APP_ID") or os.environ.get("IDM_AppId", "")
    app_key = (
        os.environ.get("IDM_APP_KEY")
        or os.environ.get("IDM_AppKey")
        or os.environ.get("IDM_APP_SECRET", "")
    )
    return app_id, app_key


def x5_method_for_path(path: str) -> str:
    """relpath：api/account/findUidByUserName（无首 /，IDM 常见）；segment：仅方法名。"""
    style = os.environ.get("IDM_X5_METHOD_STYLE", "relpath").lower()
    path = path.strip()
    if style == "fullpath":
        return path if path.startswith("/") else f"/{path}"
    if style == "segment":
        return path.rstrip("/").split("/")[-1]
    # relpath
    return path.lstrip("/")


def idm_code_ok(r: dict[str, Any]) -> bool:
    c = r.get("code")
    return c == 0 or c == "0"


def idm_code_int(r: dict[str, Any]) -> int:
    c = r.get("code")
    if c is None:
        return -1
    if isinstance(c, int):
        return c
    try:
        return int(str(c).strip())
    except ValueError:
        return -1


def setup_logging() -> Path:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = LOG_DIR / f"idm_department_query_{ts}.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(log_path, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )
    return log_path


def post_idm(path: str, business_body: dict[str, Any]) -> dict[str, Any]:
    base = os.environ.get("IDM_BASE_URL", "https://api.id.mioffice.cn").rstrip("/")
    app_id, app_key = get_idm_credentials()
    if not app_id or not app_key:
        raise RuntimeError("请设置 IDM_APP_ID/IDM_AppId 与 IDM_APP_KEY/IDM_AppKey")

    method = x5_method_for_path(path)
    url = f"{base}{path}"
    verify = _http_verify()
    if not verify:
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        logging.warning("IDM_SSL_VERIFY=false：已关闭 TLS 证书校验，仅用于联调")

    http_mode = os.environ.get("IDM_X5_HTTP_MODE", "base64_data").strip().lower()
    use_proxy = os.environ.get("IDM_HTTP_USE_PROXY", "").lower() in ("1", "true", "yes")
    proxies = None if use_proxy else {"http": None, "https": None}

    if http_mode == "base64_data":
        inner_json = build_official_x5_inner_json(
            app_id, app_key, method, business_body
        )
        form_data = official_x5_post_form_data(inner_json)
        logging.info(
            "POST %s X5=OFFICIAL(Base64+form data=) method=%s inner_len=%d",
            url,
            method,
            len(inner_json),
        )
        logging.debug("inner_json: %s", inner_json[:500])
        resp = requests.post(
            url,
            data=form_data,
            timeout=60,
            verify=verify,
            proxies=proxies,
        )
    else:
        payload = build_x5_payload(app_id, app_key, method, business_body)
        wrap = os.environ.get("IDM_X5_ROOT_WRAP", "").strip().lower()
        if wrap == "request":
            payload = {"request": payload}
        elif wrap == "payload":
            payload = {"payload": payload}
        raw = x5_request_bytes(payload)
        headers = {"Content-Type": "application/json; charset=utf-8"}
        logging.info("POST %s X5=JSON_RAW X5.method=%s", url, method)
        logging.debug("request payload keys: %s", list(payload.keys()))
        resp = requests.post(
            url,
            data=raw,
            headers=headers,
            timeout=60,
            verify=verify,
            proxies=proxies,
        )
    resp.raise_for_status()
    try:
        return resp.json()
    except Exception:
        logging.error("非 JSON 响应: %s", resp.text[:2000])
        raise


def find_uid_by_username(user_name: str) -> str | None:
    """POST /api/account/findUidByUserName"""
    r = post_idm("/api/account/findUidByUserName", {"userName": user_name})
    if idm_code_int(r) == 6001:
        logging.error(
            "findUidByUserName 返回 6001（appId 无该 API 权限）："
            "说明 X5 协议已通过，但当前 Client 未绑定接口 "
            "「/api/account/findUidByUserName」。"
            "请到 https://open.id.mioffice.cn/ 在 AppId 下「修改绑定接口」勾选并保存。"
            "若暂不能开通，可改用已知 IDM uid："
            "\"...idm_department_query.py\" --uid <你的uid>（跳过查 uid 步骤）。"
        )
        return None
    if not idm_code_ok(r):
        logging.error("findUidByUserName 失败: %s", r)
        return None
    data = r.get("data")
    if isinstance(data, str):
        return data
    if isinstance(data, dict) and "uid" in data:
        return data.get("uid")
    logging.warning("未识别的 data 形态: %s", data)
    return None


def fuzzy_find_uid_by_name(name: str, limit: int = 10) -> str | None:
    """POST /api/account/v1/fuzzySearchAccountListByName（需单独申请权限）"""
    r = post_idm(
        "/api/account/v1/fuzzySearchAccountListByName",
        {"name": name, "limit": str(limit)},
    )
    if not idm_code_ok(r):
        logging.error("fuzzySearch 失败: %s", r)
        return None
    data = r.get("data") or []
    if not data:
        logging.warning("未找到匹配用户")
        return None
    for row in data:
        if row.get("displayName") == name or row.get("name") == name:
            return row.get("uid")
    return data[0].get("uid")


def query_full_dept_by_uid(uid: str) -> list[dict[str, Any]] | None:
    r = post_idm("/api/department/queryFullDeptByUid", {"uid": uid})
    if not idm_code_ok(r):
        logging.error("queryFullDeptByUid 失败: %s", r)
        return None
    return r.get("data")


def query_min_department_by_uid(uid: str) -> Any:
    r = post_idm("/api/department/queryMinDepartmentByUid", {"uid": uid})
    if not idm_code_ok(r):
        logging.error("queryMinDepartmentByUid 失败: %s", r)
        return None
    return r.get("data")


def main() -> int:
    load_env_local()
    log_path = setup_logging()
    logging.info("日志文件: %s", log_path)
    logging.info(
        "IDM 生效配置: IDM_X5_HTTP_MODE=%s IDM_X5_STYLE=%s IDM_X5_METHOD_STYLE=%s "
        "IDM_X5_APPID_KEY=%s IDM_X5_INCLUDE_TIMESTAMP=%s IDM_X5_SIGN_ORDER=%s",
        os.environ.get("IDM_X5_HTTP_MODE", "base64_data"),
        os.environ.get("IDM_X5_STYLE", ""),
        os.environ.get("IDM_X5_METHOD_STYLE", ""),
        os.environ.get("IDM_X5_APPID_KEY", ""),
        os.environ.get("IDM_X5_INCLUDE_TIMESTAMP", ""),
        os.environ.get("IDM_X5_SIGN_ORDER", ""),
    )

    p = argparse.ArgumentParser(description="IDM：userName / 姓名 / uid 查询部门")
    p.add_argument("--user-name", help="IDM userName（如邮箱前缀 wanghongyi3）")
    p.add_argument("--name", help="中文姓名等（走 fuzzySearch，需接口权限）")
    p.add_argument("--uid", help="已知 IDM uid")
    p.add_argument("--limit", type=int, default=10, help="fuzzySearch 条数上限")
    args = p.parse_args()

    try:
        return _run_smoke(args)
    except requests.RequestException as e:
        logging.error(
            "网络请求失败（内网 api.id.mioffice.cn 需公司网络/VPN；"
            "可尝试设置 NO_PROXY、或 IDM_SSL_VERIFY=false / IDM_HTTP_USE_PROXY=1）：%s",
            e,
        )
        return 3


def _run_smoke(args: Namespace) -> int:
    if not args.uid and not args.user_name and not args.name:
        logging.error("请提供 --uid、--user-name 或 --name")
        return 2

    uid: str | None = args.uid
    steps: list[str] = []
    if args.user_name and not uid:
        steps = ["findUidByUserName", "queryFullDeptByUid", "queryMinDepartmentByUid"]
    elif args.name and not uid:
        steps = ["fuzzySearch", "queryFullDeptByUid", "queryMinDepartmentByUid"]
    elif uid:
        steps = ["queryFullDeptByUid", "queryMinDepartmentByUid"]

    dept_chain: list | None = None
    min_dept: Any = None

    with tqdm(total=len(steps), desc="IDM 步骤", unit="step") as bar:
        if args.user_name and not uid:
            uid = find_uid_by_username(args.user_name)
            bar.update(1)
            if not uid:
                return 1
            logging.info("解析到 uid=%s", uid)
        elif args.name and not uid:
            uid = fuzzy_find_uid_by_name(args.name, limit=args.limit)
            bar.update(1)
            if not uid:
                return 1
            logging.info("解析到 uid=%s", uid)

        assert uid is not None
        dept_chain = query_full_dept_by_uid(uid)
        bar.update(1)
        min_dept = query_min_department_by_uid(uid)
        bar.update(1)

    if dept_chain is None and min_dept is None:
        return 1

    out = {
        "uid": uid,
        "full_department_chain": dept_chain,
        "min_department": min_dept,
    }
    logging.info("结果: %s", json.dumps(out, ensure_ascii=False, indent=2))
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
