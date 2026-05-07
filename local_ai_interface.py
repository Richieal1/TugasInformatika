#!/usr/bin/env python3
"""
local_ai_interface.py
Local AI CLI: gunakan model GGUF via llama-cpp (jika tersedia) atau fallback ke engine berbasis aturan.

Cara pakai singkat:
  python local_ai_interface.py --model /path/to/your/model.gguf
  python local_ai_interface.py --no-model     # pakai engine rule-based lokal

File ini bersifat offline: jika Anda punya model .gguf dan pustaka `llama-cpp-python` terinstal, skrip akan mencoba memuat model.
"""

import os
import sys
import re
import ast
import argparse
import textwrap
import time

try:
    from llama_cpp import Llama
    HAVE_LLAMA = True
except Exception:
    HAVE_LLAMA = False

try:
    import requests
    HAVE_REQUESTS = True
except Exception:
    HAVE_REQUESTS = False

try:
    from bs4 import BeautifulSoup
    HAVE_BS4 = True
except Exception:
    HAVE_BS4 = False


def normalize_text(s: str) -> str:
    return re.sub(r"[^a-z0-9\s]", " ", s.lower()).strip()


# ----- Safe math evaluator using ast (no eval/exec) -----
import operator
_ops = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.Mod: operator.mod,
    ast.FloorDiv: operator.floordiv,
}


def _eval_node(node):
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return node.value
        raise ValueError('Unsupported constant')
    if isinstance(node, ast.BinOp):
        left = _eval_node(node.left)
        right = _eval_node(node.right)
        op_type = type(node.op)
        if op_type in _ops:
            return _ops[op_type](left, right)
        raise ValueError('Unsupported operator')
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
        val = _eval_node(node.operand)
        return +val if isinstance(node.op, ast.UAdd) else -val
    raise ValueError('Unsupported expression type')


def safe_eval_expr(expr: str):
    expr = expr.replace(',', '.')
    node = ast.parse(expr, mode='eval')
    return _eval_node(node.body)


def web_search_duckduckgo(query: str, max_results: int = 3, timeout: int = 8):
    """Simple web search using DuckDuckGo HTML interface and extractive summary.
    Returns dict {ok: bool, summary: str, results: [...] } or error.
    """
    if not HAVE_REQUESTS or not HAVE_BS4:
        return {'ok': False, 'error': 'requests atau beautifulsoup4 tidak terinstal.'}

    headers = {'User-Agent': 'Mozilla/5.0 (compatible; LocalAI/1.0)'}
    params = {'q': query}
    try:
        # DuckDuckGo HTML endpoint
        resp = requests.post('https://html.duckduckgo.com/html/', data=params, headers=headers, timeout=timeout)
        if resp.status_code != 200:
            resp = requests.get('https://duckduckgo.com/html/', params=params, headers=headers, timeout=timeout)
    except Exception as e:
        return {'ok': False, 'error': f'HTTP error saat mencari: {e}'}

    try:
        soup = BeautifulSoup(resp.text, 'html.parser')
        # prefer result__a anchors (DuckDuckGo), else take first http anchors
        anchors = soup.select('a.result__a')
        if not anchors:
            anchors = [a for a in soup.select('a[href]') if a['href'].startswith('http')]

        results = []
        seen = set()
        for a in anchors:
            href = a.get('href')
            title = a.get_text(' ', strip=True)
            if not href:
                continue
            if href.startswith('/l/?kh=1&uddg='):
                # extract uddg param
                try:
                    import urllib.parse
                    q = urllib.parse.urlparse(href).query
                    qs = urllib.parse.parse_qs(q)
                    if 'uddg' in qs:
                        href = urllib.parse.unquote(qs['uddg'][0])
                except Exception:
                    pass
            if href.startswith('http') and href not in seen:
                results.append({'title': title, 'url': href})
                seen.add(href)
            if len(results) >= max_results:
                break

        items = []
        for r in results:
            try:
                rpage = requests.get(r['url'], headers=headers, timeout=timeout)
                page = BeautifulSoup(rpage.text, 'html.parser')
                for tag in page(['script', 'style', 'noscript', 'header', 'footer', 'nav', 'form']):
                    tag.decompose()
                text = ' '.join([p.get_text(' ', strip=True) for p in page.find_all('p')])
                if not text:
                    text = ' '.join([h.get_text(' ', strip=True) for h in page.find_all(['h1', 'h2', 'h3'])])
                items.append({'url': r['url'], 'title': r['title'], 'text': text})
            except Exception:
                continue

        # simple extractive summary: pick top sentences containing query terms
        import re
        qterms = [t.lower() for t in re.findall(r"\w+", query)]
        sentences = []
        for it in items:
            text = it.get('text', '')
            sents = re.split(r'(?<=[.!?])\s+', text)
            for s in sents:
                if not s or len(s) < 30:
                    continue
                score = sum(s.lower().count(t) for t in qterms)
                sentences.append({'sent': s.strip(), 'score': score, 'url': it.get('url')})

        if not sentences:
            return {'ok': True, 'summary': '', 'results': items}

        sentences.sort(key=lambda x: x['score'], reverse=True)
        top_sents = [s['sent'] for s in sentences[:3]]
        sources = list(dict.fromkeys([s['url'] for s in sentences[:3]]))
        summary = '\n'.join(top_sents)
        if sources:
            summary += '\n\nSumber: ' + ', '.join(sources)

        return {'ok': True, 'summary': summary, 'results': items}
    except Exception as e:
        return {'ok': False, 'error': f'Parsing error: {e}'}


# ----- Simple rule-based knowledge base fallback -----
def build_kb():
    return [
        (['bubble', 'bubble sort', 'gelembung'],
         'Bubble Sort: membandingkan pasangan bersebelahan dan menukar jika tidak berurutan. Kompleksitas O(n²), stabil.'),
        (['selection', 'selection sort', 'pilih'],
         'Selection Sort: memilih elemen minimum dan menukarnya ke posisi saat ini. Kompleksitas O(n²), biasanya tidak stabil.'),
        (['insertion', 'insertion sort', 'sisip'],
         'Insertion Sort: menyisipkan elemen ke bagian yang sudah terurut. Sangat baik untuk data hampir terurut; O(n) terbaik.'),
        (['merge', 'merge sort'],
         'Merge Sort: divide-and-conquer, kompleksitas O(n log n), stabil.'),
        (['quick', 'quick sort'],
         'Quick Sort: rata-rata O(n log n), kasus buruk O(n²) jika pivot buruk.'),
        (['javascript', 'js'], 'JavaScript: bahasa scripting untuk web (DOM, event, fungsi, array).'),
        (['html'], 'HTML: bahasa markup untuk struktur halaman web.'),
        (['css'], 'CSS: mengatur tampilan (warna, layout, font).'),
        (['ai', 'machine learning', 'ml'], 'AI / ML: teknik untuk membuat mesin belajar dari data; model neural adalah salah satu pendekatan.'),
    ]


def rule_based_answer(query: str) -> str:
    q = normalize_text(query)
    kb = build_kb()
    for tags, answer in kb:
        for t in tags:
            if t in q:
                return answer
    # fallback heuristics
    if re.search(r'\b(perbedaan|vs|beda)\b', q):
        return 'Sebutkan dua topik yang ingin dibandingkan, mis. "Bubble vs Selection".'
    if re.search(r'\b(hitung|berapa|jumlah|calculate|compute)\b', q) or re.match(r'^[0-9\s()+\-*/.,]+$', query.strip()):
        try:
            val = safe_eval_expr(query)
            return f'Hasil: {val}'
        except Exception as e:
            return 'Saya tidak bisa menghitung ekspresi tersebut secara aman: ' + str(e)
    return 'Maaf, saya belum menemukan jawaban di basis pengetahuan lokal. Coba tanyakan lebih spesifik.'


# ----- LocalAI wrapper (model + fallback) -----
class LocalAI:
    def __init__(self, model_path=None, use_model=True, use_web=False, max_history=6, max_tokens=512, temperature=0.7, verbose=False):
        self.model_path = model_path
        self.verbose = verbose
        self.history = []  # list of (role, text)
        self.max_history = max_history
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.llm = None
        self.use_model = use_model and HAVE_LLAMA and bool(model_path)
        self.use_web = use_web and HAVE_REQUESTS and HAVE_BS4

        if self.use_model:
            try:
                print('Memuat model lokal dari:', model_path)
                self.llm = Llama(model_path=model_path, n_ctx=4096, n_gpu_layers=-1)
                print('Model berhasil dimuat.')
            except Exception as e:
                print('Gagal memuat model llama-cpp:', e)
                print('Melanjutkan dengan mesin rule-based lokal.')
                self.llm = None
                self.use_model = False

    def _compose_prompt(self, user_text: str) -> str:
        parts = ["SYSTEM: Kamu asisten yang membantu, jawab singkat dan jelas. Jika pertanyaan berbahasa Indonesia, jawab dalam Bahasa Indonesia."]
        for role, msg in self.history[-self.max_history:]:
            parts.append(f"{role.upper()}: {msg}")
        parts.append(f"USER: {user_text}")
        parts.append("ASSISTANT:")
        return "\n".join(parts)

    def _llm_call(self, prompt: str) -> str:
        try:
            # try common llama-cpp-python call shapes
            out = None
            if hasattr(self.llm, 'create_completion'):
                out = self.llm.create_completion(prompt=prompt, max_tokens=self.max_tokens, temperature=self.temperature)
            else:
                out = self.llm(prompt, max_tokens=self.max_tokens, temperature=self.temperature, echo=False)

            if isinstance(out, dict):
                # check common shapes
                if 'choices' in out and out['choices']:
                    ch = out['choices'][0]
                    if isinstance(ch, dict):
                        return ch.get('text') or (ch.get('message') and ch['message'].get('content')) or str(out)
                if 'text' in out:
                    return out['text']
            return str(out)
        except Exception as e:
            return f'LLM error: {e}'

    def ask(self, user_text: str) -> str:
        # quick math shortcut
        if re.match(r'^[0-9\s()+\-*/.,]+$', user_text.strip()) or re.search(r'\b(hitung|berapa|calculate|compute|jumlah)\b', user_text.lower()):
            try:
                val = safe_eval_expr(user_text)
                return f'Hasil: {val}'
            except Exception:
                pass

        if self.use_model and self.llm:
            prompt = self._compose_prompt(user_text)
            if self.verbose:
                self.history.append(('system', 'VERBOSE: aktif'))
            resp = self._llm_call(prompt)
            self.history.append(('user', user_text))
            self.history.append(('assistant', resp))
            return resp
        else:
            resp = rule_based_answer(user_text)
            self.history.append(('user', user_text))
            self.history.append(('assistant', resp))

            # jika jawaban fallback dan web-search diizinkan, coba cari secara online
            if self.use_web and (resp.startswith('Maaf') or 'belum menemukan' in resp or 'Coba tanyakan' in resp):
                web = web_search_duckduckgo(user_text)
                if web.get('ok'):
                    summary = web.get('summary') or ''
                    if summary.strip():
                        final = 'Hasil pencarian online (ringkasan):\n\n' + summary
                    else:
                        results = web.get('results', [])
                        if results:
                            final = 'Tidak menemukan ringkasan yang relevan; sumber teratas:\n' + '\n'.join([r['url'] for r in results[:3]])
                        else:
                            final = resp
                    self.history.append(('assistant', final))
                    return final
                # jika gagal web-search, lanjutkan mengembalikan jawaban lokal
            return resp


# ----- CLI -----

def parse_args():
    p = argparse.ArgumentParser(description='Local AI CLI (llama-cpp + fallback)')
    p.add_argument('--model', '-m', help='Path ke file .gguf model (gguf/ggml)', default=os.environ.get('MODEL_PATH'))
    p.add_argument('--no-model', action='store_true', help='Jangan coba memuat model, pakai fallback rule-based')
    p.add_argument('--online', action='store_true', help='Aktifkan pencarian web (scrape DuckDuckGo)')
    p.add_argument('--history', type=int, default=6, help='Panjang history chat yang dimasukkan ke prompt')
    p.add_argument('--max-tokens', type=int, default=512, help='Max tokens untuk model')
    p.add_argument('--temp', type=float, default=0.7, help='Temperature untuk sampling model')
    p.add_argument('--verbose', action='store_true', help='Tampilkan mode verbose (prompt chain-of-thought apabila model mendukung)')
    return p.parse_args()


def main():
    args = parse_args()
    if args.no_model:
        use_model = False
    else:
        use_model = True if (HAVE_LLAMA and args.model) else False

    if use_model and not HAVE_LLAMA:
        print('Peringatan: pustaka llama_cpp tidak ditemukan. Pastikan menginstall `llama-cpp-python`. Melanjutkan dengan fallback.')
        use_model = False

    ai = LocalAI(model_path=args.model, use_model=use_model, use_web=args.online, max_history=args.history,
                 max_tokens=args.max_tokens, temperature=args.temp, verbose=args.verbose)

    print('\n=== Local AI Interface ===')
    mode = 'LLM (local)' if ai.use_model and ai.llm else 'Rule-based (fallback)'
    print('Mode:', mode)
    print("Commands: 'keluar' or 'exit' to quit, '/history' to view chat history, '/clear' to clear history, '/online on|off' to toggle web search")

    while True:
        try:
            text = input('\nAnda: ').strip()
        except (EOFError, KeyboardInterrupt):
            print('\nKeluar.'); break

        if not text:
            continue

        cmd = text.lower().strip()
        if cmd in ('keluar', 'exit', 'quit'):
            print('Sampai jumpa!')
            break

        if text.startswith('/'):
            action = text[1:].strip().lower()
            if action == 'history':
                print('\n-- History --')
                for role, msg in ai.history:
                    print(f"{role}: {msg}")
                continue
            if action.startswith('online'):
                parts = action.split()
                if len(parts) > 1:
                    if parts[1] in ('on', 'aktif', 'enable', '1'):
                        ai.use_web = True
                        print('Pencarian web diaktifkan.')
                    elif parts[1] in ('off', 'nonaktif', 'disable', '0'):
                        ai.use_web = False
                        print('Pencarian web dinonaktifkan.')
                    else:
                        print("Gunakan '/online on' atau '/online off'")
                else:
                    print('Pencarian web saat ini:', 'aktif' if ai.use_web else 'nonaktif')
                continue
            if action == 'clear':
                ai.history.clear()
                print('History dibersihkan.')
                continue
            if action.startswith('save '):
                fname = action.split(' ', 1)[1].strip()
                try:
                    with open(fname, 'w', encoding='utf-8') as f:
                        for role, msg in ai.history:
                            f.write(f"{role}: {msg}\n")
                    print('History disimpan ke', fname)
                except Exception as e:
                    print('Gagal menyimpan:', e)
                continue
            print('Perintah tidak dikenal. Gunakan /history, /clear, /save <file>')
            continue

        # normal question
        answer = ai.ask(text)
        print('\nAI:\n' + answer)


if __name__ == '__main__':
    main()
