from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
import SocketServer
from urlparse import urlparse
import json
from network.RNN import RNN

class S(BaseHTTPRequestHandler):
    def _set_headers(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.send_header("Access-Control-Allow-Origin", "*");
        self.end_headers()

    def do_GET(self):
        query = urlparse(self.path).query
        division = [qc.split("=") for qc in query.split("&")]
        if division != [[""]]:
            query_components = dict(division)

            if 'plot' in query_components:
                if query_components['plot'] == 'users':
                    if 'sequenceNbr' in query_components:
                        sequenceNbr = int(query_components['sequenceNbr'])
                        self._set_headers()
                        data = self.rnn.users_reduced(sequenceNbr)
                        self.wfile.write(json.dumps(data.tolist()))

                if query_components['plot'] == 'movies':
                    self._set_headers()
                    data = self.rnn.movies_reduced()
                    self.wfile.write(json.dumps(data.tolist()))

            if 'movie_titles' in query_components:
                data = self.rnn.movies_titles()
                self._set_headers()
                self.wfile.write(json.dumps(data))

            if 'movie_genres_colors' in query_components:
                data = self.rnn.movies_genre_colors()
                self._set_headers()
                self.wfile.write(json.dumps(data))

            if 'movie_popularity' in query_components:
                data = self.rnn.movies_popularity()
                self._set_headers()
                self.wfile.write(json.dumps(data))

            if 'movie_bias' in query_components:
                data = self.rnn.movie_bias()
                self._set_headers()
                self.wfile.write(json.dumps(data))

            if 'user_titles' in query_components:
                data = self.rnn.users_titles()
                self._set_headers()
                self.wfile.write(json.dumps(data))

            if 'user_clicked' in query_components:
                index = query_components['user_clicked']
                predictions = self.rnn.prediction(index)
                self._set_headers()
                self.wfile.write(json.dumps(predictions))

            if 'user_sorted_heatmap' in query_components:
                index = query_components['user_sorted_heatmap']

                sorted_heatmap = self.rnn.sorted_heatmap(index)
                self._set_headers()
                self.wfile.write(json.dumps(sorted_heatmap.tolist()))

            if 'user_gates' in query_components:
                index = query_components['user_gates']
                user_gates = self.rnn.user_gates(index)
                self._set_headers()
                self.wfile.write(json.dumps(user_gates))

            if 'user_prediction_rate' in query_components:
                users_prediction_rates = self.rnn.users_prediction_rates()
                self._set_headers()
                self.wfile.write(json.dumps(users_prediction_rates))

            if 'user_saliency' in query_components and 'movie_id' in query_components and 'sequence_id' in query_components:
                user_id = query_components['user_saliency']
                movie_id = query_components['movie_id']
                sequence_id = query_components['sequence_id']
                user_saliency = self.rnn.user_saliency(user_id, movie_id, sequence_id)
                self._set_headers()
                self.wfile.write(json.dumps(user_saliency))




    def do_HEAD(self):
        self._set_headers()

    def do_POST(self):
        # Doesn't do anything with posted data
        self._set_headers()
        self.wfile.write("<html><body><h1>POST!</h1></body></html>")


def run(server_class=HTTPServer, handler_class=S, port=8000):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print('Preparing model')
    rnn = RNN()
    rnn.prepare_model()
    handler_class.rnn = rnn
    print('Starting httpd...')
    httpd.serve_forever()

run()
