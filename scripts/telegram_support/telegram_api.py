"""Telegram Bot API transport with explicit delivery certainty."""
from contextlib import closing
import http.client
import json
import re

if __package__:
    from .support import DeliveryError
else:
    from support import DeliveryError


MAX_RESPONSE_BYTES = 2 * 1024 * 1024
TOKEN_FORMAT = re.compile(r"[1-9][0-9]{0,15}:[A-Za-z0-9_-]{20,128}")
METHOD_FORMAT = re.compile(r"[A-Za-z]+")
REJECTION_CODES = {
    400: "bad-request",
    401: "unauthorized",
    403: "forbidden",
    409: "poll-conflict",
}


class TelegramApi:
    def __init__(self, token, *, connection_factory=http.client.HTTPSConnection):
        if not TOKEN_FORMAT.fullmatch(token):
            raise ValueError("invalid-bot-token")
        self._token = token
        self._connect = connection_factory

    def call(self, method, parameters=None, *, timeout=10):
        if not METHOD_FORMAT.fullmatch(method):
            raise ValueError("invalid-api-method")
        body = json.dumps(parameters if parameters is not None else {}).encode("utf-8")
        with closing(self._connect("api.telegram.org", timeout=timeout)) as connection:
            try:
                connection.connect()
            except (OSError, http.client.HTTPException):
                raise DeliveryError("retry", code="offline") from None
            try:
                connection.request(
                    "POST", f"/bot{self._token}/{method}", body=body,
                    headers={"Content-Type": "application/json"},
                )
                response = connection.getresponse()
                status = response.status
                payload = response.read(MAX_RESPONSE_BYTES + 1)
            except (OSError, http.client.HTTPException):
                raise DeliveryError("unknown", code="transport-unknown") from None
        return self._result(status, payload)

    @staticmethod
    def _result(status, payload):
        # A rejected HTTP request cannot be taken as proof that Telegram delivered a message.
        if status in REJECTION_CODES:
            raise DeliveryError("rejected", code=REJECTION_CODES[status])
        if status != 200 and status != 429:
            raise DeliveryError("unknown", code="gateway-unknown")
        data = None
        if len(payload) <= MAX_RESPONSE_BYTES:
            try:
                data = json.loads(payload)
            except (ValueError, UnicodeError):
                pass
        if status == 429:
            parameters = data.get("parameters") if isinstance(data, dict) else None
            delay = parameters.get("retry_after") if isinstance(parameters, dict) else None
            if type(delay) is not int or not 1 <= delay <= 2_147_483_647:
                delay = 30
            raise DeliveryError("retry", delay=delay, code="rate-limited")
        if isinstance(data, dict) and data.get("ok") is True and "result" in data:
            return data["result"]
        raise DeliveryError("unknown", code="invalid-response")
