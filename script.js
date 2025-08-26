
(function () {
  const STORAGE_KEY = 'newsData_v4';
  const ADMIN_FLAG = 'isAdminSession';
  const CATEGORIES = [
    'Todas',
    'Economia',
    'Espaço',
    'Inovação',
    'Tecnologia',
    'Esportes',
    'Política',
    'Saúde',
  ];

  // ---------- Utils ----------
  const qs  = (sel, el=document) => el.querySelector(sel);
  const qsa = (sel, el=document) => Array.from(el.querySelectorAll(sel));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  const readStore = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } };
  const writeStore = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  const normalize = (str='') => str.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  const fileToBase64 = (file) => new Promise((res, rej) => { const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });

  function populateCategorySelect(sel) {
    sel.innerHTML = '';
    CATEGORIES.filter(c => c !== 'Todas').forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat; opt.textContent = cat;
      sel.appendChild(opt);
    });
  }

  function renderCategoryDropdown(menuEl, onPick) {
    menuEl.innerHTML = '';
    CATEGORIES.forEach(cat => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'drop-item';
      btn.textContent = cat;
      btn.addEventListener('click', () => onPick(cat));
      menuEl.appendChild(btn);
    });
  }

  function groupByCategory(items) {
    const map = new Map();
    items.forEach(n => {
      const cat = n.category || 'Sem categoria';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(n);
    });
    const order = CATEGORIES.filter(c => c !== 'Todas');
    return Array.from(map.entries()).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  }

  // ---------- INDEX (carrossel por categoria) ----------
  function initIndex() {
    const root = qs('#newsRoot');
    const searchInput = qs('#searchInput');
    const filterBtn = qs('#filterBtn');
    const filterMenu = qs('#filterMenu');

    let selectedCategory = 'Todas';
    let all = readStore();
    // Estado do carrossel por categoria (independente)
    const indices = {}; // { 'Economia': 0, ... }

    const apply = () => {
      const q = normalize(searchInput.value);
      let items = all.slice();

      if (selectedCategory && selectedCategory !== 'Todas') {
        items = items.filter(n => n.category === selectedCategory);
      }
      if (q) {
        items = items.filter(n => normalize(`${n.title}\n${n.summary}\n${n.content}\n${n.category}`).includes(q));
      }

      renderGroupedCarousels(root, items, indices);
    };

    renderCategoryDropdown(filterMenu, (cat) => {
      selectedCategory = cat;
      filterBtn.textContent = `Filtros: ${cat} ▾`;
      filterMenu.classList.remove('open');
      filterBtn.setAttribute('aria-expanded', 'false');
      filterMenu.setAttribute('aria-hidden', 'true');
      apply();
    });

    filterBtn.addEventListener('click', () => {
      const open = !filterMenu.classList.contains('open');
      filterMenu.classList.toggle('open', open);
      filterBtn.setAttribute('aria-expanded', String(open));
      filterMenu.setAttribute('aria-hidden', String(!open));
    });
    document.addEventListener('click', (e) => {
      if (!filterBtn.contains(e.target) && !filterMenu.contains(e.target)) {
        filterMenu.classList.remove('open');
        filterBtn.setAttribute('aria-expanded', 'false');
        filterMenu.setAttribute('aria-hidden', 'true');
      }
    });

    searchInput.addEventListener('input', apply);
    apply();
  }

  function renderGroupedCarousels(root, items, indices) {
    root.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'card';
      empty.textContent = 'Nenhuma notícia encontrada.';
      root.appendChild(empty);
      return;
    }

    const grouped = groupByCategory(items);
    grouped.forEach(([category, list]) => {
      // Preserva índice por categoria
      if (!(category in indices)) indices[category] = 0;
      if (indices[category] >= list.length) indices[category] = 0;

      const block = document.createElement('section');
      block.className = 'category-block';
      block.setAttribute('aria-labelledby', `cat-${category}`);

      const title = document.createElement('h2');
      title.className = 'category-title';
      title.id = `cat-${category}`;
      title.textContent = category;

      const carousel = document.createElement('div');
      carousel.className = 'news-carousel';

      const slide = document.createElement('article');
      slide.className = 'news-slide';

      function renderSlide() {
        const i = indices[category];
        const n = list[i];
        slide.innerHTML = '';
        const img = document.createElement('img');
        img.className = 'thumb';
        img.src = n.imageBase64 || '';
        img.alt = n.title;

        const content = document.createElement('div');
        const h3 = document.createElement('h3'); h3.textContent = n.title;
        const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `Categoria: ${n.category}`;
        const p = document.createElement('p'); p.textContent = n.summary;

        content.appendChild(h3); content.appendChild(meta); content.appendChild(p);
        slide.appendChild(img); slide.appendChild(content);
      }
      renderSlide();

      const nav = document.createElement('div');
      nav.className = 'nav-buttons';
      const prev = document.createElement('button'); prev.className = 'nav-btn'; prev.textContent = '⬅ Anterior';
      const next = document.createElement('button'); next.className = 'nav-btn'; next.textContent = 'Próxima ➡';

      prev.addEventListener('click', () => {
        indices[category] = (indices[category] - 1 + list.length) % list.length;
        renderSlide();
      });
      next.addEventListener('click', () => {
        indices[category] = (indices[category] + 1) % list.length;
        renderSlide();
      });

      nav.appendChild(prev); nav.appendChild(next);
      carousel.appendChild(slide);
      carousel.appendChild(nav);

      block.appendChild(title);
      block.appendChild(carousel);
      root.appendChild(block);
    });
  }

  // ---------- ADICIONAR ----------
  function initAddPage() {
    const form = qs('#newsForm');
    const sel = qs('#category');
    const inputFile = qs('#image');
    const imgPrev = qs('#imgPreview');

    populateCategorySelect(sel);

    inputFile.addEventListener('change', async () => {
      const f = inputFile.files?.[0];
      if (!f) { imgPrev.src = ''; return; }
      imgPrev.src = await fileToBase64(f);
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const title = qs('#title').value.trim();
      const summary = qs('#summary').value.trim();
      const content = qs('#content').value.trim();
      const category = qs('#category').value;
      const file = inputFile.files?.[0];
      if (!file) { alert('Selecione uma imagem.'); return; }
      const imageBase64 = await fileToBase64(file);

      const all = readStore();
      all.push({ id: uid(), title, summary, content, category, imageBase64, createdAt: Date.now() });
      writeStore(all);
      alert('Notícia adicionada com sucesso!');
      window.location.href = 'index.html';
    });
  }

  // ---------- EDITAR ----------
  function initEditPage() {
    const listEl = qs('#editList');
    const form = qs('#editForm');
    const sel = qs('#editCategory');
    const imgPrev = qs('#editImgPreview');
    const fileInput = qs('#editImage');
    const cancelBtn = qs('#cancelEdit');

    populateCategorySelect(sel);

    let currentEditId = null;
    let previewBase64 = '';

    function renderList() {
      const all = readStore().slice().sort((a,b) => (b.createdAt||0)-(a.createdAt||0));
      listEl.innerHTML = '';
      if (!all.length) { listEl.innerHTML = '<p>Sem notícias cadastradas.</p>'; return; }

      all.forEach(n => {
        const row = document.createElement('div');
        row.className = 'list-item';
        const img = document.createElement('img'); img.src = n.imageBase64 || ''; img.alt = n.title;
        const info = document.createElement('div');
        const t = document.createElement('div'); t.style.fontWeight='700'; t.textContent = n.title;
        const m = document.createElement('div'); m.style.fontSize='12px'; m.style.color='#6b7280'; m.textContent = `Categoria: ${n.category}`;
        info.appendChild(t); info.appendChild(m);
        const actions = document.createElement('div'); actions.className='item-actions';
        const eb = document.createElement('button'); eb.className='btn btn-outline'; eb.textContent='Editar';
        const db = document.createElement('button'); db.className='btn btn-danger'; db.textContent='Excluir';
        eb.addEventListener('click', () => loadToForm(n.id));
        db.addEventListener('click', () => {
          if (confirm('Deseja excluir esta notícia?')) {
            const rest = readStore().filter(x => x.id !== n.id); writeStore(rest);
            if (currentEditId === n.id) resetForm();
            renderList();
          }
        });
        actions.appendChild(eb); actions.appendChild(db);
        row.appendChild(img); row.appendChild(info); row.appendChild(actions);
        listEl.appendChild(row);
      });
    }

    function loadToForm(id) {
      const all = readStore();
      const item = all.find(x => x.id === id);
      if (!item) return;
      currentEditId = id;
      qs('#editId').value = id;
      qs('#editTitleInput').value = item.title;
      qs('#editSummary').value = item.summary;
      qs('#editContent').value = item.content;
      sel.value = item.category;
      previewBase64 = item.imageBase64 || '';
      imgPrev.src = previewBase64;
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function resetForm() {
      currentEditId = null;
      qs('#editId').value = '';
      qs('#editTitleInput').value = '';
      qs('#editSummary').value = '';
      qs('#editContent').value = '';
      sel.selectedIndex = 0;
      fileInput.value = '';
      previewBase64 = '';
      imgPrev.src = '';
    }

    fileInput.addEventListener('change', async () => {
      const f = fileInput.files?.[0]; if (!f) return;
      previewBase64 = await fileToBase64(f); imgPrev.src = previewBase64;
    });

    cancelBtn.addEventListener('click', resetForm);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      if (!currentEditId) { alert('Selecione uma notícia para editar.'); return; }
      const all = readStore();
      const idx = all.findIndex(x => x.id === currentEditId);
      if (idx === -1) return;
      all[idx] = {
        ...all[idx],
        title: qs('#editTitleInput').value.trim(),
        summary: qs('#editSummary').value.trim(),
        content: qs('#editContent').value.trim(),
        category: sel.value,
        imageBase64: previewBase64 || all[idx].imageBase64,
        updatedAt: Date.now(),
      };
      writeStore(all);
      alert('Notícia atualizada!');
      renderList(); resetForm();
    });

    renderList();
  }

  // ---------- ADMIN (login simples) ----------
  function initAdmin() {
    const loginArea = qs('#login-area');
    const adminArea = qs('#admin-area');
    const btn = qs('#loginBtn');
    const err = qs('#loginError');

    // Respeita sessão já ativa
    if (sessionStorage.getItem(ADMIN_FLAG) === '1') {
      loginArea.classList.add('hidden');
      adminArea.classList.remove('hidden');
      return;
    }

    btn.addEventListener('click', () => {
      const u = qs('#username').value.trim();
      const p = qs('#password').value;
      if (u === 'admin' && p === 'admin') {
        sessionStorage.setItem(ADMIN_FLAG, '1');
        loginArea.classList.add('hidden');
        adminArea.classList.remove('hidden');
        err.textContent = '';
      } else {
        err.textContent = 'Usuário ou senha inválidos!';
      }
    });
  }

  // Expor
  window.NewsApp = { initIndex, initAddPage, initEditPage, initAdmin };
})();



// === Tema Dark/Light ===
function aplicarTema(tema) {
    document.body.setAttribute("data-theme", tema);
    localStorage.setItem("tema", tema);
}
document.getElementById("themeToggle")?.addEventListener("click", () => {
    const atual = localStorage.getItem("tema") || "light";
    aplicarTema(atual === "light" ? "dark" : "light");
});
window.addEventListener("DOMContentLoaded", () => {
    aplicarTema(localStorage.getItem("tema") || "light");
});

// === Notícias pré-definidas ===
function inicializarNoticias() {
    let noticias = JSON.parse(localStorage.getItem("noticias")) || [];
    if (noticias.length === 0) {
        noticias = [
            {
                id: Date.now(),
                titulo: "Tecnologia revoluciona educação",
                resumo: "Escolas adotam inteligência artificial para personalizar ensino.",
                conteudo: "Várias instituições já aplicam IA para adaptar o aprendizado...",
                categoria: "Tecnologia",
                imagem: "https://via.placeholder.com/400x200?text=Educação+e+IA"
            },
            {
                id: Date.now()+1,
                titulo: "Esporte em alta",
                resumo: "Equipe nacional conquista campeonato internacional.",
                conteudo: "Com grande desempenho, o time trouxe o título...",
                categoria: "Esportes",
                imagem: "https://via.placeholder.com/400x200?text=Esportes"
            },
            {
                id: Date.now()+2,
                titulo: "Clima extremo preocupa especialistas",
                resumo: "Ondas de calor e enchentes trazem desafios globais.",
                conteudo: "Eventos climáticos extremos estão se tornando mais frequentes...",
                categoria: "Meio Ambiente",
                imagem: "https://via.placeholder.com/400x200?text=Clima"
            }
        ];
        localStorage.setItem("noticias", JSON.stringify(noticias));
    }
}

// === Login Admin ===
document.getElementById("loginForm")?.addEventListener("submit", function(e){
    e.preventDefault();
    const user = document.getElementById("user").value;
    const pass = document.getElementById("pass").value;
    if(user === "admin" && pass === "admin"){
        document.getElementById("loginSection").style.display = "none";
        document.getElementById("adminPanel").style.display = "block";
    } else {
        document.getElementById("loginError").textContent = "Usuário ou senha inválidos!";
    }
});

// Inicialização
inicializarNoticias();
