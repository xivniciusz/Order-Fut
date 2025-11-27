from __future__ import annotations

import logging

logger = logging.getLogger("orderfut.email")


def send_password_reset_email(recipient: str, reset_link: str) -> None:
    # Em um ambiente real, integre com um provedor (SendGrid, SES etc.).
    logger.info("Email de redefinicao enviado", extra={"to": recipient, "link": reset_link})
