import json

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
import subprocess

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
                "data": "No notebook found"
            }))
        else: 
            path_and_args = '../../performance/correctness.py' + nb
            result = subprocess.run(['python3', path_and_args], capture_output=True, text=True)
            print('result:', result)
            self.finish(json.dumps({
                "data": "hello"
            }))


def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "rerun-server", "get-example")
    handlers = [(route_pattern, RouteHandler)]
    web_app.add_handlers(host_pattern, handlers)
