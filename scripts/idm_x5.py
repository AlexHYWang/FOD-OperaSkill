"""小米 X5 请求封装。

官方说明文档《X5请求格式(返回报文自定义)说明文档》要点：
1. sign = md5(appid + body + appkey)，再将 sign 转为**大写**；其中 body 为业务参数的 **JSON 字符串**（与 PHP json_encode / Java JSON 序列化一致）。
2. 请求包结构含 header 与 body；**body 字段的值必须是字符串**（即上一步的业务 JSON 字符串）。
3. 将拼装好的数据包转为字符串后做 **BASE64**。
4. 调用接口时以 **key-value** POST，**key 固定为 data**，value 为 Base64 后的数据（非直接 POST application/json 整包）。

兼容旧调试方式：设置 IDM_X5_HTTP_MODE=json 可走直接 JSON 体（部分环境历史行为）。
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import time
from typing import Any


def _business_json_str(business: dict[str, Any], sort_keys: bool) -> str:
    return json.dumps(business, ensure_ascii=False, separators=(",", ":"), sort_keys=sort_keys)


def compute_x5_sign(
    app_id: str,
    body_str: str,
    app_key: str,
    *,
    timestamp_ms: str | None,
    order: str,
    upper: bool,
) -> str:
    if order == "reverse":
        raw = (app_key + body_str + app_id).encode("utf-8")
    elif order == "body_key":
        if timestamp_ms:
            raw = (body_str + timestamp_ms + app_key).encode("utf-8")
        else:
            raw = (body_str + app_key).encode("utf-8")
    elif timestamp_ms:
        raw = (app_id + body_str + timestamp_ms + app_key).encode("utf-8")
    else:
        raw = (app_id + body_str + app_key).encode("utf-8")
    h = hashlib.md5(raw).hexdigest()
    return h.upper() if upper else h


def build_official_x5_inner_json(
    app_id: str,
    app_key: str,
    method: str,
    business: dict[str, Any],
) -> str:
    """
    按《X5请求格式》拼装**内层** JSON 字符串（尚未 Base64）。
    header 使用 appid（小写，与文档一致），可通过 IDM_X5_APPID_KEY 覆盖。
    """
    sort_keys = os.environ.get("IDM_X5_SORT_KEYS", "0").lower() in ("1", "true", "yes")
    body_str = _business_json_str(business, sort_keys)
    upper = os.environ.get("IDM_X5_SIGN_UPPER", "1").lower() not in ("0", "false", "no")
    order = os.environ.get("IDM_X5_SIGN_ORDER", "normal").lower()
    appid_key = os.environ.get("IDM_X5_APPID_KEY", "appid").strip() or "appid"

    ts: str | None = None
    if os.environ.get("IDM_X5_INCLUDE_TIMESTAMP", "").lower() in ("1", "true", "yes"):
        ts = str(int(time.time() * 1000))

    sign = compute_x5_sign(
        app_id, body_str, app_key, timestamp_ms=ts, order=order, upper=upper
    )

    header: dict[str, Any] = {
        appid_key: app_id,
        "sign": sign,
    }
    if method and not os.environ.get("IDM_X5_OMIT_METHOD", "").lower() in (
        "1",
        "true",
        "yes",
    ):
        header["method"] = method
    if ts is not None:
        header["timestamp"] = ts

    package = {"header": header, "body": body_str}
    return json.dumps(package, ensure_ascii=False, separators=(",", ":"))


def official_x5_post_form_data(inner_json: str) -> dict[str, str]:
    """返回 requests POST data= 用的 dict：{\"data\": base64(inner_json)}"""
    b64 = base64.b64encode(inner_json.encode("utf-8")).decode("ascii")
    return {"data": b64}


# ── 以下为 IDM_X5_HTTP_MODE=json 时的历史兼容（直接 POST JSON 体）──


def build_x5_payload(
    app_id: str,
    app_key: str,
    method: str,
    business: dict[str, Any],
) -> dict[str, Any]:
    sort_keys = os.environ.get("IDM_X5_SORT_KEYS", "0").lower() in ("1", "true", "yes")
    body_str = _business_json_str(business, sort_keys)
    style = os.environ.get("IDM_X5_STYLE", "nested_object").lower()
    upper = os.environ.get("IDM_X5_SIGN_UPPER", "1").lower() not in ("0", "false", "no")
    order = os.environ.get("IDM_X5_SIGN_ORDER", "normal").lower()
    body_key = os.environ.get("IDM_X5_BODY_KEY", "body").strip() or "body"
    appid_key = os.environ.get("IDM_X5_APPID_KEY", "appid").strip() or "appid"

    ts: str | None = None
    if os.environ.get("IDM_X5_INCLUDE_TIMESTAMP", "").lower() in ("1", "true", "yes"):
        ts = str(int(time.time() * 1000))

    sign = compute_x5_sign(
        app_id, body_str, app_key, timestamp_ms=ts, order=order, upper=upper
    )

    header: dict[str, Any] = {
        appid_key: app_id,
        "sign": sign,
        "method": method,
    }
    if ts is not None:
        header["timestamp"] = ts

    if style == "nested_string":
        return {"header": header, body_key: body_str}
    if style == "nested_object":
        return {"header": header, body_key: business}
    if style == "nested_data_object":
        return {"header": header, "data": business}
    if style == "nested_data_string":
        return {"header": header, "data": body_str}
    if style == "flat_object":
        return {appid_key: app_id, "method": method, "sign": sign, body_key: business}
    if style == "flat_string":
        return {appid_key: app_id, "method": method, "sign": sign, body_key: body_str}
    raise ValueError(f"未知 IDM_X5_STYLE={style!r}")


def x5_request_bytes(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
