import json

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
import subprocess
import os

class RouteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def get(self):
        nb = self.get_argument('nb', default="")
        print('notebook requested: ', nb)
        if len(nb) == 0:
            self.finish(json.dumps({
                "data": "No notebook found. Notebook sent in: " + nb + " | END"
            }))
        else: 
            script = 'performance/notebooks/correctness.py'
            if not script or not os.path.exists(script): 
                self.finish(json.dumps({
                    "data": "No paths found for the script"
                }))
                return 
            result = subprocess.run(['python3', script, nb], capture_output=True, text=True)
            print('result:', result)
            self.finish(json.dumps({
                "data": "Notebook sent in: " + nb + " results: " + result.stderr + result.stdout
            }))


def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "rerun-server", "get-correctness")
    handlers = [(route_pattern, RouteHandler)]
    web_app.add_handlers(host_pattern, handlers)
