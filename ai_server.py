#!/usr/bin/env python3
"""
ai_server.py
Simple HTTP wrapper around the LocalAI class to allow the web UI to call the local AI or LLM.

Usage:
  python ai_server.py --model C:\path\to\model.gguf --port 5000 --host 127.0.0.1

If no model is provided or `llama-cpp-python` is not installed, the server will use rule-based fallback.
"""

import os
import argparse
import logging
from flask import Flask, request, jsonify, make_response
from flask_cors import CORS

try:
    from local_ai_interface import LocalAI
except Exception as e:
    LocalAI = None

app = Flask(__name__)
# Permissive CORS for local development (allow '*' and null origins)
CORS(app, resources={r"/*": {"origins": "*"}}, send_wildcard=True)


@app.after_request
def add_cors_headers(response):
    # Ensure common CORS headers are present for file:// (null) origin and preflight
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    return response


# basic logging setup
logger = logging.getLogger('ai_server')
logger.setLevel(logging.INFO)
_handler = logging.StreamHandler()
_handler.setFormatter(logging.Formatter('[%(asctime)s] %(levelname)s: %(message)s'))
logger.addHandler(_handler)

# global AI instance (set in main)
ai = None


@app.route('/api/health', methods=['GET'])
def health():
    logger.info(f"[health] request from {request.remote_addr} headers={dict(request.headers)}")
    status = {'ok': True, 'mode': 'unknown', 'use_web': False}
    if ai is None:
        status['mode'] = 'uninitialized'
        return jsonify(status)
    status['mode'] = 'llm' if getattr(ai, 'use_model', False) and getattr(ai, 'llm', None) else 'rule'
    status['use_web'] = bool(getattr(ai, 'use_web', False))
    return jsonify(status)


@app.route('/api/ask', methods=['POST'])
def api_ask():
    logger.info(f"[ask] request from {request.remote_addr} headers={dict(request.headers)}")
    if ai is None:
        logger.warning('AI backend not initialized for /api/ask')
        return jsonify({'ok': False, 'error': 'AI backend belum diinisialisasi.'}), 503
    data = request.get_json(force=True) or {}
    logger.debug(f'[ask] payload: {data}')
    question = data.get('question') or data.get('q') or ''
    verbose = bool(data.get('verbose', False))
    online = data.get('online', None)

    prev_use_web = getattr(ai, 'use_web', False)
    prev_verbose = getattr(ai, 'verbose', False)
    try:
        if online is True:
            ai.use_web = True
        ai.verbose = verbose
        answer = ai.ask(question)
        logger.info('Answer generated (len=%d)', len(answer) if isinstance(answer, str) else 0)
        return jsonify({'ok': True, 'answer': answer})
    except Exception as e:
        logger.exception('Error while handling /api/ask')
        return jsonify({'ok': False, 'error': str(e)}), 500
    finally:
        ai.use_web = prev_use_web
        ai.verbose = prev_verbose


def main():
    global ai
    parser = argparse.ArgumentParser(description='Run local AI HTTP server')
    parser.add_argument('--model', '-m', help='Path to model (.gguf)', default=os.environ.get('MODEL_PATH'))
    parser.add_argument('--host', default='0.0.0.0')
    parser.add_argument('--port', type=int, default=5000)
    parser.add_argument('--no-model', action='store_true', help='Force no model (use rule-based)')
    parser.add_argument('--online', action='store_true', help='Allow web scraping for fallback answers')
    parser.add_argument('--debug', action='store_true', help='Enable debug logging')
    args = parser.parse_args()

    if LocalAI is None:
        logger.error('Error: cannot import LocalAI from local_ai_interface. Make sure files are present.')
        return

    if args.debug:
        logger.setLevel(logging.DEBUG)
        logger.debug('Debug logging enabled')

    use_model = False if args.no_model else True
    ai = LocalAI(model_path=args.model, use_model=use_model, use_web=args.online, verbose=False)

    logger.info(f"Starting AI server on http://{args.host}:{args.port} (mode={'LLM' if ai.use_model and ai.llm else 'rule'})")
    app.run(host=args.host, port=args.port)


if __name__ == '__main__':
    main()
