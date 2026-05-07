local_ai_interface
===================

Skrip `local_ai_interface.py` menyediakan antarmuka CLI untuk menjalankan AI lokal:
- Jika Anda memiliki model GGUF (mis. Llama-3 .gguf) dan pustaka `llama-cpp-python`, skrip akan mencoba memuat model lokal dan men-generate jawaban.
- Jika tidak ada model atau pustaka tidak terpasang, skrip menggunakan engine rule-based (fallback) yang dapat menjawab pertanyaan umum mengenai algoritma, web, dan melakukan evaluasi matematika sederhana.

Persyaratan
-----------
- Python 3.8+
- (Opsional) `llama-cpp-python` jika ingin menggunakan model .gguf lokal

Instalasi (opsional untuk LLM)
-----------------------------
Jika Anda ingin menggunakan model GGUF lokal dengan `llama-cpp-python`:

1. Pasang dependensi (contoh):

```bash
pip install -r requirements.txt
```

2. Letakkan file model `.gguf` di suatu folder. Contoh nama file: `llama-3-8b.gguf`.
3. Jalankan skrip dengan path model:

```bash
python local_ai_interface.py --model C:/path/to/llama-3-8b.gguf
```

Jika pustaka `llama_cpp` tidak tersedia atau model tidak ditemukan, gunakan fallback rule-based:

```bash
python local_ai_interface.py --no-model
```

Cara pakai
---------
- Ketik pertanyaan lalu tekan Enter.
- Perintah khusus:
  - `/history` — tampilkan riwayat percakapan.
  - `/clear` — hapus riwayat.
  - `/save nama_file.txt` — simpan riwayat ke berkas.
  - `/online on` atau `/online off` — aktifkan atau nonaktifkan pencarian web langsung (scrape DuckDuckGo).

Menjalankan server HTTP untuk dipanggil dari UI
------------------------------------------------
Jika Anda ingin agar UI web (`index.html`) memanggil AI lokal atau melakukan pencarian online lewat server, jalankan `ai_server.py`:

```bash
python ai_server.py --no-model --online
# atau jika punya model GGUF:
python ai_server.py --model C:/path/to/model.gguf --online
```

Setelah server berjalan pada `http://127.0.0.1:5000`, buka `index.html` di browser (atau jalankan server static) lalu aktifkan opsi "Gunakan server lokal" pada panel AI. UI akan mencoba menghubungi `http://127.0.0.1:5000/api/health` dan menampilkan status server.
  - `keluar` atau `exit` — keluar.

Catatan penting
---------------
- Skrip ini tidak melakukan panggilan ke API eksternal; semua operasi bersifat lokal.
- Untuk menjalankan model LLM besar secara lokal Anda perlu mengunduh model `.gguf` dan memastikan lingkungan Anda kompatibel dengan `llama-cpp-python` (pada Windows mungkin diperlukan instalasi toolchain atau wheel khusus).

Butuh bantuan lebih lanjut?
-------------------------
Saya bisa:
- Menambahkan memory/persistent chat ke file.
- Membuat wrapper HTTP kecil agar UI web Anda dapat memanggil AI lokal.
- Menunjukkan opsi menjalankan on-device LLM (llama.cpp/ggml/gguf) dan trade-offs.

