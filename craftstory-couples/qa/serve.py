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
import os
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

    def send_head(self):
        """Les plages d'octets, parce que sans elles on ne peut pas SE DEPLACER
        dans un media.

        SimpleHTTPRequestHandler ne connait pas Range. Chromium, lui, refuse de
        deplacer la tete de lecture d'une piste servie sans Range : le
        currentTime qu'on ecrit est simplement ignore. Resultat, on testait un
        montage bloque sur son premier plan — une panne qui n'existe que dans
        le banc d'essai, parce que le CDN de Shopify sait repondre 206.
        """
        rng = self.headers.get("Range")
        if not rng or not rng.startswith("bytes="):
            return super().send_head()

        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404)
            return None

        size = os.fstat(f.fileno()).st_size
        first, _, last = rng[6:].partition("-")
        try:
            start = int(first) if first else None
            end = int(last) if last else None
            if start is None:                    # bytes=-500, les derniers octets
                start, end = max(0, size - end), size - 1
            elif end is None:
                end = size - 1
            end = min(end, size - 1)
            if start > end or start >= size:
                raise ValueError
        except ValueError:
            f.close()
            self.send_response(416)
            self.send_header("Content-Range", "bytes */%d" % size)
            self.end_headers()
            return None

        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        f.seek(start)
        # On ne renvoie que la tranche demandee : copyfile lirait jusqu'au bout.
        self.wfile.write(f.read(end - start + 1))
        f.close()
        return None

    def end_headers(self):
        # Annonce sur TOUTES les reponses : c'est ce que le navigateur regarde
        # pour savoir s'il peut se deplacer dans un media.
        if self.command in ("GET", "HEAD") and not self._told_ranges:
            self._told_ranges = True
            self.send_header("Accept-Ranges", "bytes")
        SimpleHTTPRequestHandler.end_headers(self)

    _told_ranges = False

    def handle_one_request(self):
        self._told_ranges = False
        SimpleHTTPRequestHandler.handle_one_request(self)

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
