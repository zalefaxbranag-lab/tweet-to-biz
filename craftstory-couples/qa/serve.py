#!/usr/bin/env python3
"""Un serveur local pour les tests de rendu.

Pourquoi : sous file:// un chemin absolu comme /pages/couples-preview ne
resout pas, donc on ne peut pas voir si le tunnel saute vraiment sur la page
d'attente. Servi en HTTP, l'enchainement se teste en entier.

Les adresses de la boutique sont posees sur les fichiers du mock :
    /pages/couples-start    -> flow.html
    /pages/couples-preview  -> preview.html
    /contact                -> 302 vers la page d'ou vient le formulaire
"""
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial

ROUTES = {
    "/": "/flow.html",
    "/pages/couples-start": "/flow.html",
    "/pages/couples-preview": "/preview.html",
    "/pages/couples": "/preview.html",
}


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def translate_path(self, path):
        clean = path.split("?", 1)[0].split("#", 1)[0]
        return super().translate_path(ROUTES.get(clean, clean))

    def do_POST(self):
        """Le formulaire de contact de Shopify : on rejoue sa redirection."""
        length = int(self.headers.get("Content-Length") or 0)
        if length:
            self.rfile.read(length)
        back = self.headers.get("Referer") or "/pages/couples-start"
        back = back.split("?", 1)[0]
        self.send_response(302)
        self.send_header("Location", back + "?contact_posted=true")
        self.end_headers()


def start(root, port=0):
    srv = ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=root))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, "http://127.0.0.1:%d" % srv.server_address[1]


if __name__ == "__main__":
    import sys
    srv, base = start(sys.argv[1] if len(sys.argv) > 1 else ".", 8765)
    print("sert", base)
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        srv.shutdown()
