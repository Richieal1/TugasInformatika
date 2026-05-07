const PREFIX = { bubble: 'b', selection: 's', insertion: 'i', binary: 'bs' };
const ALGO_KEYS = ['bubble', 'selection', 'insertion', 'binary'];
const STATE = {
  bubble: createState(),
  selection: createState(),
  insertion: createState(),
  binary: createState()
};

function createState() {
  return {
    arr: [],
    steps: [],
    stepIdx: 0,
    playing: false,
    timer: null,
    size: 20
  };
}

function get(id) {
  return document.getElementById(id);
}

function scrollToAi() {
  const aiSection = document.querySelector('.ai-section');
  if (aiSection) {
    aiSection.scrollIntoView({ behavior: 'smooth' });
  }
}

function initAlgo(algo) {
  const prefix = PREFIX[algo];
  const st = STATE[algo];
  clearTimeout(st.timer);
  st.playing = false;
  st.stepIdx = 0;
  st.size = parseInt(get(prefix + '-size').value, 10);

  st.arr = Array.from({ length: st.size }, () => Math.floor(Math.random() * 92) + 6);
  st.steps = buildSteps(algo, [...st.arr]);

  // For binary search, sync st.arr to the sorted array used in steps
  if (algo === 'binary' && st.steps.length > 0) {
    st.arr = [...st.steps[0].arr];
  }

  renderBars(algo, {});
  resetCounters(algo);
  setStatus(algo, 'Siap — tekan ▶ untuk mulai', false);
  get(prefix + '-done').classList.remove('show');
  get(prefix + '-play').innerHTML = '▶ &nbsp;Mulai';
  get(prefix + '-play').disabled = false;
  get(prefix + '-step').disabled = false;
  clearPseudo(algo);
}

function onSizeChange(algo, value) {
  const prefix = PREFIX[algo];
  get(prefix + '-size-val').textContent = value;
  initAlgo(algo);
}

function buildSteps(algo, arr) {
  if (algo === 'bubble') return buildBubble(arr);
  if (algo === 'selection') return buildSelection(arr);
  if (algo === 'insertion') return buildInsertion(arr);
  if (algo === 'binary') return buildBinary(arr);
  return [];
}

function buildBubble(arr) {
  const steps = [];
  const n = arr.length;
  const sorted = new Set();
  let comps = 0;
  let swaps = 0;
  let pass = 0;

  const snap = (hl, pseudo, status, done = false) => {
    steps.push({ arr: [...arr], hl, comps, swaps, pass, pseudo, status, sorted: [...sorted], done });
  };

  for (let i = 0; i < n - 1; i++) {
    pass++;
    let swapped = false;
    for (let j = 0; j < n - i - 1; j++) {
      comps++;
      snap({ [j]: 'compare', [j + 1]: 'compare' }, 'p2', `Pass ${pass}: bandingkan arr[${j}]=${arr[j]} dan arr[${j + 1}]=${arr[j + 1]}`);

      if (arr[j] > arr[j + 1]) {
        swaps++;
        snap({ [j]: 'swap', [j + 1]: 'swap' }, 'p3', `Tukar arr[${j}]=${arr[j]} ↔ arr[${j + 1}]=${arr[j + 1]}`);
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        swapped = true;
        snap({ [j]: 'compare', [j + 1]: 'compare' }, 'p3', `Susun ulang setelah pertukaran`, false);
      }
    }

    sorted.add(n - 1 - i);
    snap({}, 'p0', `Pass ${pass} selesai. Elemen ke-${n - 1 - i} sudah berada di posisi benar.`);
    if (!swapped) break;
  }

  for (let idx = 0; idx < n; idx++) sorted.add(idx);
  snap({}, '', 'Sorting selesai!', true);
  return steps;
}

function buildSelection(arr) {
  const steps = [];
  const n = arr.length;
  const sorted = new Set();
  let comps = 0;
  let swaps = 0;
  let pass = 0;

  const snap = (hl, pseudo, status, done = false) => {
    steps.push({ arr: [...arr], hl, comps, swaps, pass, pseudo, status, sorted: [...sorted], done });
  };

  for (let i = 0; i < n - 1; i++) {
    pass++;
    let minIdx = i;
    snap({ [i]: 'pivot' }, 's-p1', `Pass ${pass}: mulai dari index ${i}, anggap arr[${i}] sebagai minimum sementara.`);

    for (let j = i + 1; j < n; j++) {
      comps++;
      snap({ [minIdx]: 'pivot', [j]: 'compare' }, 's-p3', `Bandingkan arr[${j}]=${arr[j]} dengan minimum saat ini arr[${minIdx}]=${arr[minIdx]}.`);
      if (arr[j] < arr[minIdx]) {
        minIdx = j;
        snap({ [minIdx]: 'pivot' }, 's-p4', `Minimum baru: arr[${minIdx}]=${arr[minIdx]}.`);
      }
    }

    if (minIdx !== i) {
      swaps++;
      snap({ [i]: 'swap', [minIdx]: 'swap' }, 's-p5', `Tukar arr[${i}]=${arr[i]} dengan arr[${minIdx}]=${arr[minIdx]}.`);
      [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
    }
    sorted.add(i);
    snap({}, 's-p0', `Pass ${pass} selesai. arr[${i}] sudah di posisi benar.`);
  }

  sorted.add(n - 1);
  snap({}, '', 'Sorting selesai!', true);
  return steps;
}

function buildInsertion(arr) {
  const steps = [];
  const n = arr.length;
  const sorted = new Set([0]);
  let comps = 0;
  let shifts = 0;
  let pass = 0;

  const snap = (hl, pseudo, status, done = false) => {
    steps.push({ arr: [...arr], hl, comps, swaps: shifts, pass, pseudo, status, sorted: [...sorted], done });
  };

  snap({ 0: 'sorted' }, 'i-p0', 'Elemen pertama sudah terurut.');

  for (let i = 1; i < n; i++) {
    pass++;
    const key = arr[i];
    let j = i - 1;
    snap({ [i]: 'hand' }, 'i-p1', `Ambil arr[${i}]=${key} sebagai key.`);

    while (j >= 0 && arr[j] > key) {
      comps++;
      snap({ [i]: 'hand', [j]: 'compare' }, 'i-p3', `Bandingkan key=${key} dengan arr[${j}]=${arr[j]} — geser arr[${j}] ke kanan.`);
      shifts++;
      arr[j + 1] = arr[j];
      snap({ [j + 1]: 'swap', [j]: 'compare' }, 'i-p4', `Geser nilai ke posisi ${j + 1}.`);
      j--;
    }

    if (j >= 0) {
      comps++;
      snap({ [j]: 'compare', [i]: 'hand' }, 'i-p3', `arr[${j}]=${arr[j]} ≤ key=${key}, hentikan pergeseran.`);
    }

    arr[j + 1] = key;
    for (let k = 0; k <= i; k++) sorted.add(k);
    snap({ [j + 1]: 'hand' }, 'i-p6', `Sisipkan key=${key} ke posisi ${j + 1}.`);
  }

  for (let k = 0; k < n; k++) sorted.add(k);
  snap({}, '', 'Sorting selesai!', true);
  return steps;
}

function buildBinary(arr) {
  const steps = [];
  const n = arr.length;

  // Snapshot helper
  const snap = (a, hl, pseudo, status, done = false, target = null) => {
    steps.push({ arr: [...a], hl, comps: 0, swaps: 0, pass: 0, pseudo, status, sorted: [], done, target });
  };

  // Step 1: tampilkan array acak dulu (1 frame)
  snap(arr, {}, 'bs-p0', 'Array acak — langsung diurutkan untuk Binary Search...');

  // Step 2: sort array, tampilkan hasil terurut (1 frame)
  const sorted = [...arr].sort((a, b) => a - b);
  const allIdx = new Set(sorted.map((_, i) => i));
  steps.push({ arr: [...sorted], hl: {}, comps: 0, swaps: 0, pass: 0, pseudo: 'bs-p0', status: '✓ Array terurut! Memulai Binary Search...', sorted: [...allIdx], done: false, target: null });

  // Step 3: Binary Search
  const target = sorted[Math.floor(Math.random() * n)];
  let comps = 0;
  let pass = 0;

  const snapBS = (hl, pseudo, status, done = false) => {
    steps.push({ arr: [...sorted], hl, comps, swaps: 0, pass, pseudo, status, sorted: [], done, target });
  };

  snapBS({}, 'bs-p0', `Binary Search dimulai — cari target: ${target}`);

  let left = 0, right = n - 1;
  let found = false;
  let foundIdx = -1;

  while (left <= right) {
    pass++;
    const mid = Math.floor((left + right) / 2);
    comps++;

    const hl = {};
    for (let i = left; i <= right; i++) hl[i] = 'selection';
    hl[mid] = 'compare';
    snapBS(hl, 'bs-p2', `Pass ${pass}: mid=${mid}, arr[mid]=${sorted[mid]}, target=${target}`);

    if (sorted[mid] === target) {
      found = true;
      foundIdx = mid;
      const hlFound = {};
      for (let i = left; i <= right; i++) hlFound[i] = 'selection';
      hlFound[mid] = 'insertion';
      snapBS(hlFound, 'bs-p4', `✓ Target ${target} ditemukan di index ${mid}!`);
      break;
    } else if (sorted[mid] < target) {
      comps++;
      snapBS({ [mid]: 'compare' }, 'bs-p5', `arr[${mid}]=${sorted[mid]} < ${target} → buang kiri, cari kanan`);
      left = mid + 1;
    } else {
      comps++;
      snapBS({ [mid]: 'compare' }, 'bs-p7', `arr[${mid}]=${sorted[mid]} > ${target} → buang kanan, cari kiri`);
      right = mid - 1;
    }
  }

  if (found) {
    snapBS({ [foundIdx]: 'insertion' }, '', `✓ Selesai! Target ${target} di index ${foundIdx}. Perbandingan: ${comps}`, true);
  } else {
    snapBS({}, '', `✗ Target ${target} tidak ditemukan. Perbandingan: ${comps}`, true);
  }

  return steps;
}

function renderBars(algo, highlights = {}) {
  const prefix = PREFIX[algo];
  const st = STATE[algo];
  const viz = get(prefix + '-viz');
  const arr = st.arr;

  if (!viz.children.length || viz.children.length !== arr.length) {
    viz.innerHTML = '';
    const fragment = document.createDocumentFragment();
    arr.forEach(() => {
      const bar = document.createElement('div');
      bar.className = 'bar';
      fragment.appendChild(bar);
    });
    viz.appendChild(fragment);
  }

  const maxVal = Math.max(...arr, 1);
  const bars = viz.querySelectorAll('.bar');
  const sortedSet = new Set(highlights.sorted || []);

  bars.forEach((bar, index) => {
    const value = arr[index];
    const percent = (value / maxVal) * 100;
    bar.style.height = `calc(${percent}% - 8px)`;
    bar.className = 'bar';
    if (sortedSet.has(index)) bar.classList.add('sorted');
    const highlight = highlights[index];
    if (highlight) bar.classList.add(highlight);
  });
}

function applyStep(algo, step) {
  const prefix = PREFIX[algo];
  STATE[algo].arr = [...step.arr];
  renderBars(algo, { ...step.hl, sorted: step.sorted });

  get(prefix + '-comps').textContent = step.comps;
  if (algo !== 'binary') {
    get(prefix + '-swaps').textContent = step.swaps;
  } else if (step.target) {
    const targetEl = get(prefix + '-target');
    if (targetEl) targetEl.textContent = step.target;
  }
  get(prefix + '-pass').textContent = step.pass;

  setStatus(algo, step.status, !step.done);
  highlightPseudo(algo, step.pseudo);

  if (step.done) {
    get(prefix + '-done').classList.add('show');
    get(prefix + '-play').disabled = true;
    get(prefix + '-step').disabled = true;
    const bar = get(prefix + '-status-bar');
    bar.classList.remove('running');
    bar.classList.add('done');
  }
}

function setStatus(algo, text, running) {
  const prefix = PREFIX[algo];
  const bar = get(prefix + '-status-bar');
  get(prefix + '-status-txt').textContent = text;
  bar.classList.toggle('running', running);
  if (!running) bar.classList.remove('done');
}

function resetCounters(algo) {
  const prefix = PREFIX[algo];
  if (algo === 'binary') {
    get(prefix + '-comps').textContent = '0';
    get(prefix + '-pass').textContent = '0';
    get(prefix + '-target').textContent = '-';
  } else {
    ['comps', 'swaps', 'pass'].forEach(key => {
      get(prefix + '-' + key).textContent = '0';
    });
  }
}

function clearPseudo(algo) {
  document.querySelectorAll(`#panel-${algo} .pline`).forEach(el => el.classList.remove('hi'));
}

function highlightPseudo(algo, pseudoKey) {
  clearPseudo(algo);
  if (!pseudoKey) return;

  const prefix = PREFIX[algo];
  let id = pseudoKey;
  if (!pseudoKey.includes('-')) {
    id = prefix + '-' + pseudoKey;
  } else if (pseudoKey.startsWith('s-') || pseudoKey.startsWith('i-')) {
    id = pseudoKey.replace(/^s-|^i-/, prefix + '-');
  }

  const element = get(id);
  if (element) element.classList.add('hi');
}

function algoPlay(algo) {
  const st = STATE[algo];
  const prefix = PREFIX[algo];
  const button = get(prefix + '-play');

  if (st.playing) {
    st.playing = false;
    clearTimeout(st.timer);
    button.innerHTML = '▶ &nbsp;Lanjut';
    get(prefix + '-status-bar').classList.remove('running');
    return;
  }

  if (st.stepIdx >= st.steps.length) {
    initAlgo(algo);
  }

  st.playing = true;
  button.innerHTML = '⏸ &nbsp;Pause';

  const tick = () => {
    if (!st.playing) return;
    if (st.stepIdx >= st.steps.length) {
      st.playing = false;
      button.innerHTML = '▶ &nbsp;Mulai';
      return;
    }

    applyStep(algo, st.steps[st.stepIdx]);
    st.stepIdx++;

    if (st.stepIdx < st.steps.length && !st.steps[st.stepIdx - 1].done) {
      const delay = 1050 - parseInt(get(prefix + '-speed').value, 10);
      st.timer = setTimeout(tick, Math.max(18, delay));
    } else {
      st.playing = false;
      button.innerHTML = '✓ &nbsp;Selesai';
    }
  };

  tick();
}

function algoStep(algo) {
  const st = STATE[algo];
  if (st.playing) return;
  if (st.stepIdx >= st.steps.length) {
    initAlgo(algo);
    return;
  }
  applyStep(algo, st.steps[st.stepIdx]);
  st.stepIdx++;
}

function switchAlgo(algo) {
  document.querySelectorAll('.algo-panel').forEach(panel => panel.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(button => button.classList.remove('active'));
  get('panel-' + algo).classList.add('active');
  document.querySelector(`.tab-btn[data-algo='${algo}']`).classList.add('active');
}

function appendAiMessage(sender, text) {
  const chat = get('ai-chat');
  const bubble = document.createElement('div');
  bubble.className = `ai-message ${sender}`;
  bubble.textContent = text;
  chat.appendChild(bubble);
  chat.scrollTop = chat.scrollHeight;
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildKnowledgeBase() {
  return [
    {
      tags: ['bubble', 'bubble sort', 'gelembung', 'sorting', 'urut'],
      answer: 'Bubble Sort bekerja dengan membandingkan pasangan elemen bersebelahan dan menukar mereka bila tidak terurut. Algoritma ini stabil, mudah dipahami, tetapi memiliki kompleksitas O(n²) pada rata-rata dan kasus terburuk.'
    },
    {
      tags: ['selection', 'selection sort', 'pilih', 'minimum', 'sorting', 'urut'],
      answer: 'Selection Sort memilih elemen terkecil dari bagian yang belum terurut dan menukarnya ke posisi saat ini. Ini memiliki O(n²) di semua kasus, tetapi hanya melakukan sedikit pertukaran dibanding Bubble Sort.'
    },
    {
      tags: ['insertion', 'insertion sort', 'insert', 'sisip', 'kartu', 'sorting', 'urut'],
      answer: 'Insertion Sort menyisipkan elemen saat ini ke posisi yang benar di bagian yang sudah terurut. Sangat efisien untuk data kecil atau hampir terurut, dengan O(n) pada kasus terbaik.'
    },
    {
      tags: ['merge', 'merge sort', 'gabung', 'divide and conquer', 'sorting'],
      answer: 'Merge Sort membagi array menjadi dua, mengurutkan bagian tersebut secara rekursif, lalu menggabungkannya. Ini memiliki kompleksitas O(n log n) dan stabil, cocok untuk data besar.'
    },
    {
      tags: ['quick', 'quick sort', 'pivot', 'divide', 'sorting'],
      answer: 'Quick Sort memilih pivot dan membagi array menjadi bagian yang lebih kecil dan lebih besar. Rata-rata O(n log n), tetapi kasus terburuk O(n²) jika pivot buruk.'
    },
    {
      tags: ['array', 'larik', 'daftar', 'list'],
      answer: 'Array adalah struktur data linier yang menyimpan elemen berurutan. Akses elemen menggunakan indeks cepat, tetapi penyisipan di tengah dapat memerlukan pergeseran semua elemen.'
    },
    {
      tags: ['stack', 'tumpukan', 'lifo'],
      answer: 'Stack adalah struktur data LIFO (last in, first out). Elemen terakhir yang dimasukkan adalah yang pertama keluar, mirip tumpukan piring.'
    },
    {
      tags: ['queue', 'antrian', 'fifo'],
      answer: 'Queue adalah struktur data FIFO (first in, first out). Elemen pertama yang masuk adalah yang pertama keluar, seperti antrian di kasir.'
    },
    {
      tags: ['tree', 'pohon', 'graf'],
      answer: 'Tree adalah struktur data hierarkis dengan simpul dan cabang. Binary tree dan heap adalah varian yang umum digunakan dalam algoritma dan struktur data.'
    },
    {
      tags: ['graph', 'graf', 'grafik', 'hubungan'],
      answer: 'Graph adalah struktur data yang terdiri dari simpul dan tepi. Graph digunakan untuk merepresentasikan jaringan, jalan, dan hubungan antar objek.'
    },
    {
      tags: ['algorithm', 'algoritma', 'langkah', 'prosedur'],
      answer: 'Algoritma adalah serangkaian instruksi yang jelas untuk menyelesaikan masalah. Kualitas algoritma dinilai dari kompleksitas waktu dan ruangnya.'
    },
    {
      tags: ['complexity', 'kompleksitas', 'big o', 'o(n)', 'o(n²)', 'waktu', 'ruang'],
      answer: 'Kompleksitas mengukur performa algoritma. O(n) berarti linear, O(n²) berarti kuadrat, O(log n) lebih baik untuk dataset besar. Ruang merujuk memori yang digunakan.'
    },
    {
      tags: ['javascript', 'js', 'html', 'css', 'web', 'frontend', 'browser'],
      answer: 'JavaScript, HTML, dan CSS adalah teknologi utama web. HTML memberi struktur, CSS memberi gaya, dan JavaScript membuat halaman interaktif.'
    },
    {
      tags: ['computer', 'komputer', 'hardware', 'perangkat keras', 'cpu', 'memory'],
      answer: 'Komputer terdiri dari perangkat keras seperti CPU, memori, dan penyimpanan. Sistem operasi mengatur sumber daya dan menjalankan program.'
    },
    {
      tags: ['network', 'jaringan', 'internet', 'tcp', 'ip', 'http'],
      answer: 'Jaringan komputer menghubungkan perangkat melalui protokol seperti TCP/IP dan HTTP. Internet adalah jaringan global dari komputer dan server.'
    },
    {
      tags: ['database', 'sql', 'nosql', 'database', 'penyimpanan'],
      answer: 'Database menyimpan data terstruktur. SQL digunakan untuk query relasional, sedangkan NoSQL cocok untuk data tidak terstruktur atau skala besar.'
    },
    {
      tags: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'neural', 'model'],
      answer: 'AI adalah kemampuan mesin untuk meniru kecerdasan manusia. Machine learning adalah cabang AI yang belajar dari data, dan model neural adalah salah satu pendekatan populer.'
    },
    {
      tags: ['python', 'java', 'c++', 'programming', 'pemrograman'],
      answer: 'Bahasa pemrograman seperti Python, Java, dan C++ digunakan untuk menulis program. Pilihan bahasa tergantung pada tujuan, performa, dan ekosistem.'
    }
  ];
}

function scoreKnowledgeEntry(query, entry) {
  const normalizedQuery = normalizeText(query);
  const queryTerms = normalizedQuery.split(' ');
  const entryText = normalizeText(entry.tags.join(' '));
  const entryTerms = entryText.split(' ');

  let score = 0;
  queryTerms.forEach(term => {
    if (entryTerms.includes(term)) score += 3;
  });

  entryTerms.forEach(term => {
    if (normalizedQuery.includes(term) && term.length > 3) score += 1;
  });

  const bigrams = normalizedQuery.split(' ').slice(0, -1).map((word, index, words) => `${word} ${words[index + 1]}`);
  bigrams.forEach(bigram => {
    if (entryText.includes(bigram)) score += 4;
  });

  return score;
}

function findBestKnowledgeAnswer(query) {
  const base = buildKnowledgeBase();
  const scored = base.map(entry => ({ entry, score: scoreKnowledgeEntry(query, entry) }));
  scored.sort((a, b) => b.score - a.score);

  return scored[0].score >= 1 ? scored[0].entry.answer : null;
}

/* Advanced local reasoning pipeline */
function analyzeQuestion(query) {
  const q = String(query || '');
  const normalized = normalizeText(q);
  const res = { intent: 'explain', topics: [], codeSnippets: [], mathExpr: null, raw: q };

  // detect fenced code blocks ```...```
  const fenceRE = /```(?:\w+)?([\s\S]*?)```/g;
  let m;
  while ((m = fenceRE.exec(q))) {
    res.codeSnippets.push(m[1].trim());
  }

  // detect inline `code`
  const inlineRE = /`([^`]+)`/g;
  while ((m = inlineRE.exec(q))) {
    res.codeSnippets.push(m[1].trim());
  }

  // collect topics from KB
  const base = buildKnowledgeBase();
  base.forEach(entry => {
    entry.tags.forEach(tag => {
      if (normalized.includes(tag)) res.topics.push(tag);
    });
  });
  res.topics = Array.from(new Set(res.topics));

  // detect simple math intent
  if (/\b(hitung|berapa|jumlah|total|calculate|compute|sum|evaluate)\b/.test(normalized)) {
    const exprMatch = q.match(/=\s*([0-9\s()+\-*/.,]+)/);
    if (exprMatch) res.mathExpr = exprMatch[1].replace(/,/g, '.').trim();
    else {
      const fallback = q.match(/([0-9\s()+\-*/.,]+)/);
      if (fallback) res.mathExpr = fallback[0].replace(/,/g, '.').trim();
    }
  }

  // intents
  if (/\b(perbedaan|beda|vs)\b/.test(normalized)) res.intent = 'compare';
  else if (res.codeSnippets.length > 0 || /\b(kode|function|console\.log|=>|\bvar\b|\blet\b|\bconst\b)\b/.test(normalized)) res.intent = 'code';
  else if (/\b(bagaimana|cara|langkah|implementasi|implement)\b/.test(normalized)) res.intent = 'howto';
  else if (res.mathExpr) res.intent = 'math';
  else if (/\b(apa itu|apa)\b/.test(normalized)) res.intent = 'define';
  else if (/\b(mengapa|kenapa|alasan)\b/.test(normalized)) res.intent = 'why';
  else res.intent = 'explain';

  return res;
}

function getKBEntryByTag(tag) {
  const base = buildKnowledgeBase();
  return base.find(e => e.tags.includes(tag)) || null;
}

function safeEvalMath(expr) {
  if (!expr) return { ok: false, error: 'Tidak menemukan ekspresi.' };
  const cleaned = expr.replace(/[^0-9+\-*/().\s]/g, '');
  if (!/^[0-9+\-*/().\s]+$/.test(cleaned)) return { ok: false, error: 'Ekspresi mengandung karakter tidak aman.' };
  try {
    const val = Function('"use strict"; return (' + cleaned + ')')();
    return { ok: true, result: val };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function generateStructuredAnswer(query) {
  const analysis = analyzeQuestion(query);
  const verboseEl = get('ai-verbose');
  const verbose = verboseEl ? verboseEl.checked : false;
  const out = [];

  if (verbose) out.push('Proses berpikir: mengidentifikasi intent, mencocokkan KB, merangkai jawaban.');

  if (analysis.intent === 'math') {
    const expr = analysis.mathExpr || query;
    const r = safeEvalMath(expr);
    if (r.ok) {
      if (verbose) out.push('Menjalankan evaluasi matematis secara lokal.');
      out.push(`Hasil: ${r.result}`);
      out.push(`Ekspresi: ${expr}`);
      return out.join('\n\n');
    } else {
      out.push('Gagal mengeksekusi ekspresi: ' + r.error);
    }
  }

  if (analysis.intent === 'compare') {
    let topics = analysis.topics.slice(0, 2);
    if (topics.length < 2) {
      const m = query.toLowerCase().match(/(bubble|selection|insertion|merge|quick)/g) || [];
      topics = m.slice(0, 2);
    }
    if (!topics.length) return 'Sebutkan dua topik/algoritma yang ingin dibandingkan, mis. "Bubble vs Selection"';
    const e1 = getKBEntryByTag(topics[0]) || { answer: 'Tidak ada informasi.' };
    const e2 = getKBEntryByTag(topics[1]) || { answer: 'Tidak ada informasi.' };
    out.push(`Membandingkan ${topics[0]} dan ${topics[1]}:\n\n- ${topics[0]}: ${e1.answer}\n- ${topics[1]}: ${e2.answer}`);
    const timeMap = { bubble: 'O(n²)', selection: 'O(n²)', insertion: 'O(n) terbaik, O(n²) rata-rata', merge: 'O(n log n)', quick: 'O(n log n) rata-rata' };
    const stabilityMap = { bubble: 'stabil', selection: 'tidak stabil (biasanya)', insertion: 'stabil', merge: 'stabil', quick: 'tidak stabil (biasanya)' };
    const c1 = timeMap[topics[0]] || '—', c2 = timeMap[topics[1]] || '—';
    const s1 = stabilityMap[topics[0]] || '—', s2 = stabilityMap[topics[1]] || '—';
    out.push('\nPerbandingan cepat:\n- Kompleksitas waktu: ' + topics[0] + ' ' + c1 + ' vs ' + topics[1] + ' ' + c2);
    out.push('- Stabilitas: ' + topics[0] + ' ' + s1 + ' vs ' + topics[1] + ' ' + s2);
    out.push('\nSaran: pilih ' + (topics[0] === 'insertion' ? 'Insertion untuk data hampir terurut atau kecil.' : 'algoritma tergantung ukuran dan pola data.'));
    return out.join('\n\n');
  }

  if (analysis.intent === 'code') {
    if (!analysis.codeSnippets.length) return 'Tidak menemukan blok kode. Gunakan tanda ```js ... ``` atau `...` untuk menandai kode.';
    const code = analysis.codeSnippets[0];
    out.push('Analisis kode singkat:');
    if (/\b(function|console\.log|let |const |var |=>)\b/.test(code)) {
      out.push('Terlihat seperti JavaScript.');
      if (verbose) out.push('Menjalankan sandbox terbatas jika aman.');
      if (/fetch|XMLHttpRequest|WebSocket|window|document|eval|new Function|import|require/.test(code)) {
        out.push('Eksekusi dinonaktifkan karena mengandung operasi I/O atau akses global berisiko.');
      } else {
        try {
          const logs = [];
          const originalConsoleLog = console.log;
          console.log = (...args) => logs.push(args.map(a => String(a)).join(' '));
          const fn = new Function(code);
          const ret = fn();
          console.log = originalConsoleLog;
          out.push('Output console:\n' + (logs.length ? logs.join('\n') : '(tidak ada output)'));
          if (ret !== undefined) out.push('Nilai kembalian: ' + String(ret));
        } catch (e) {
          out.push('Gagal eksekusi: ' + e.message);
        }
      }
      return out.join('\n\n');
    } else {
      return 'Kode tidak dikenali sebagai JavaScript; beri konteks bahasa.';
    }
  }

  // default: explain/howto/define/why
  const best = findBestKnowledgeAnswer(query);
  if (best) {
    if (verbose) out.push('Menemukan jawaban terbaik di KB lokal dan menambahkan langkah atau pseudocode bila relevan.');
    out.push(best);
    const topic = analysis.topics[0] || (query.toLowerCase().match(/bubble|selection|insertion|merge|quick/) || [])[0];
    if (topic === 'bubble') {
      out.push('\nPseudocode (Bubble Sort):\nfor i = 0 to n-2\n  for j = 0 to n-i-2\n    if arr[j] > arr[j+1] swap(arr[j], arr[j+1])\n');
      out.push('Contoh singkat: [5,2,4] -> [2,5,4] -> [2,4,5]');
    } else if (topic === 'selection') {
      out.push('\nPseudocode (Selection Sort):\nfor i = 0 to n-2\n  minIdx = i\n  for j = i+1 to n-1\n    if arr[j] < arr[minIdx] minIdx = j\n  swap(arr[i], arr[minIdx])\n');
    } else if (topic === 'insertion') {
      out.push('\nPseudocode (Insertion Sort):\nfor i = 1 to n-1\n  key = arr[i]\n  j = i-1\n  while j >= 0 and arr[j] > key\n    arr[j+1] = arr[j]\n    j--\n  arr[j+1] = key\n');
    }
    return out.join('\n\n');
  }

  // Fallback informatif
  out.push('📚 Topik yang tersedia: Bubble Sort, Selection Sort, Insertion Sort, Merge Sort, Quick Sort, Array, Stack, Queue, Tree, Graph, Algoritma, Kompleksitas, JavaScript/Web, Komputer, Jaringan, Database, AI/ML, Pemrograman.');
  out.push('💡 Contoh: "Apa itu Bubble Sort?", "Perbedaan Selection vs Insertion?", "Bagaimana Merge Sort kerja?", atau "Hitung 5 * 7 + 3"');
  return out.join('\n\n');
}

function generateAiAnswer(query) {
  return generateStructuredAnswer(query);
}

async function askAi() {
  const input = get('ai-input').value.trim();
  if (!input) return;
  appendAiMessage('user', input);
  get('ai-input').value = '';

  const useServerEl = get('ai-use-server');
  const useServer = useServerEl ? useServerEl.checked : false;

  if (useServer) {
    appendAiMessage('ai', 'Memproses (server)...');
    try {
      const verbose = get('ai-verbose') ? !!get('ai-verbose').checked : false;
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify({ question: input, verbose })
      });
      if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
      const data = await res.json();
      const chat = get('ai-chat');
      chat.lastChild.textContent = data.answer || data.summary || data.error || 'Tidak ada jawaban dari server';
    } catch (e) {
      const chat = get('ai-chat');
      console.error('AI server fetch error:', e);
      const suggestion = 'Periksa: jalankan `python ai_server.py --no-model --online` dan buka halaman melalui http://localhost:8000 (jangan file://).';
      chat.lastChild.textContent = `Gagal terhubung ke server: ${e.message}. ${suggestion} Menggunakan AI lokal sebagai fallback.`;
      setTimeout(() => appendAiMessage('ai', generateAiAnswer(input)), 300);
    }
    return;
  }

  setTimeout(() => {
    appendAiMessage('ai', generateAiAnswer(input));
  }, 250);
}

function clearAiChat() {
  const chat = get('ai-chat');
  chat.innerHTML = '';
}

function aiQuick(question) {
  get('ai-input').value = question;
  askAi();
}

window.addEventListener('DOMContentLoaded', () => {
  ALGO_KEYS.forEach(algo => initAlgo(algo));
  // start server health checks if UI has the control
  if (get('ai-server-pill')) {
    // initial check
    checkAiServer();
    // poll every 5s
    setInterval(checkAiServer, 5000);
  }
});

async function checkAiServer() {
  const pill = get('ai-server-pill');
  if (!pill) return;
  try {
      const res = await fetch('/api/health', { method: 'GET', cache: 'no-store', headers: { 'ngrok-skip-browser-warning': '1' } });
    if (res.ok) {
      pill.innerHTML = 'Server: <strong style="color:var(--bubble)">Online</strong>';
    } else {
      pill.innerHTML = 'Server: <strong>Offline</strong>';
    }
  } catch (e) {
    pill.innerHTML = 'Server: <strong>Offline</strong>';
  }
}
