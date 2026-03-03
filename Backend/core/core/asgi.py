import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.core.asgi              import get_asgi_application
from channels.routing              import ProtocolTypeRouter, URLRouter
from channels.security.websocket   import AllowedHostsOriginValidator
from violation.routing             import websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": get_asgi_application(),

    # ✅ Removed AuthMiddlewareStack — replaced with AllowedHostsOriginValidator
    "websocket": AllowedHostsOriginValidator(
        URLRouter(websocket_urlpatterns)
    ),
})
