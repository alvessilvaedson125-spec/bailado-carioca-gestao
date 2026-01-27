/**
 * Bailado Carioca — Sistema de Gestão
 * app.js (versão estável, limpa e coerente)
 */

/* =========================
   DATA STORE
========================= */
const DataStore = {
  state: {
    currentPage: "dashboard",
    data: {
      alunos: [],
      turmas: [],
      unidades: [],
      professores: [],
      mensalidades: [],
      caixa: [],
    },
  },

  load() {
    const raw = localStorage.getItem("bailadoData");
    if (raw) this.state.data = JSON.parse(raw);
  },

  save() {
    localStorage.setItem(
      "bailadoData",
      JSON.stringify(this.state.data)
    );
  },

  count(entidade) {
    return this.state.data[entidade].filter(
      item => item.ativo !== false && item.ativa !== false
    ).length;
  },
};

/* =========================
   UI
========================= */
const UI = {
  menu: document.getElementById("menu"),
  title: document.getElementById("page-title"),
  content: document.getElementById("content-area"),

  init() {
    DataStore.load();
    this.renderMenu();
    this.navigate("dashboard");
  },

  renderMenu() {
    const pages = [
      ["dashboard", "Dashboard"],
      ["alunos", "Alunos"],
      ["turmas", "Turmas"],
      ["unidades", "Unidades"],
      ["professores", "Professores"],
      ["mensalidades", "Mensalidades"],
      ["caixa", "Caixa"],
      ["config", "Configurações"],
    ];

    this.menu.innerHTML = "";
    pages.forEach(([id, label]) => {
      const li = document.createElement("li");
      li.className = "menu-item";
      li.textContent = label;
      li.dataset.page = id;
      li.onclick = () => this.navigate(id);
      this.menu.appendChild(li);
    });
  },

  navigate(page) {
    if (!pagesRenderers[page]) return;

    DataStore.state.currentPage = page;

    document.querySelectorAll(".menu-item").forEach(i =>
      i.classList.toggle("active", i.dataset.page === page)
    );

    this.title.textContent =
      page.charAt(0).toUpperCase() + page.slice(1);

    this.content.innerHTML = "";
    pagesRenderers[page]();
  },
};

/* =========================
   RENDERIZADORES
========================= */
const pagesRenderers = {
  dashboard() {
    const grid = document.createElement("div");
    grid.className = "dashboard-cards";

    const cards = [
      ["Total Alunos", DataStore.count("alunos")],
      ["Turmas", DataStore.count("turmas")],
      ["Unidades", DataStore.count("unidades")],
      ["Professores", DataStore.count("professores")],
      ["Mensalidades", DataStore.count("mensalidades")],
    ];

    cards.forEach(([title, value]) => {
      const card = document.createElement("div");
      card.className = "summary-card";
      card.innerHTML = `
        <span class="card-title">${title}</span>
        <span class="card-value">${value}</span>
      `;
      grid.appendChild(card);
    });

    UI.content.appendChild(grid);
  },

  alunos() {
    renderAlunos();
  },

  turmas() {
    renderTurmas();
  },

  unidades() {
    renderPlaceholder("Unidades");
  },

  professores() {
    renderPlaceholder("Professores");
  },

  mensalidades() {
    renderPlaceholder("Mensalidades");
  },

  caixa() {
    renderPlaceholder("Caixa");
  },

  config() {
    renderPlaceholder("Configurações");
  },
};

/* =========================
   ALUNOS
========================= */
function renderAlunos() {
  const header = document.createElement("div");
  header.style.marginBottom = "1.5rem";

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.textContent = "+ Novo Aluno";
  btn.onclick = abrirModalAluno;

  header.appendChild(btn);
  UI.content.appendChild(header);

  const table = document.createElement("table");
  table.style.width = "100%";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Nome</th>
        <th>Turma</th>
        <th>Unidade</th>
        <th>Tipo</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  DataStore.state.data.alunos
    .filter(a => a.ativo !== false)
    .forEach(aluno => {
      const turma = DataStore.state.data.turmas.find(
        t => t.id === aluno.turma
      );

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${aluno.nome}</td>
        <td>
          ${turma ? `${turma.nome} (${turma.nivel})` : "-"}
        </td>
        <td>${turma?.unidade || "-"}</td>
        <td>${aluno.tipo}</td>
        <td>
          <button class="btn-secondary">Excluir</button>
        </td>
      `;

      tr.querySelector("button").onclick = () => {
        if (confirm("Excluir aluno?")) {
          aluno.ativo = false;
          DataStore.save();
          UI.navigate("alunos");
        }
      };

      table.querySelector("tbody").appendChild(tr);
    });

  UI.content.appendChild(table);
}

/* =========================
   MODAL NOVO ALUNO
========================= */
function abrirModalAluno() {
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `;

  const modal = document.createElement("div");
  modal.className = "modal-card";

  modal.innerHTML = `
    <h2 class="modal-title">Novo Aluno</h2>

    <div class="modal-grid">
      <div class="field">
        <label>Nome do Aluno</label>
        <input id="nome" placeholder="Ex: Maria Silva">
      </div>

      <div class="field">
        <label>Turma *</label>
        <select id="turma">
          <option value="">Selecione uma turma</option>
        </select>
      </div>

      <div class="field">
        <label>Horário</label>
        <input id="horario" placeholder="Ex: Terça 18h">
      </div>

      <div class="field">
        <label>Mensalidade (R$)</label>
        <input id="mensalidade" type="number" placeholder="0.00">
      </div>

      <div class="field">
        <label>Tipo de Matrícula</label>
        <select id="tipo">
          <option value="Normal">Normal</option>
          <option value="Casal">Casal</option>
          <option value="Múltiplas">Múltiplas turmas</option>
        </select>
      </div>
    </div>

    <div class="modal-actions">
      <button class="modal-btn-secondary">Cancelar</button>
      <button class="modal-btn-primary">Criar</button>
    </div>
  `;

  modal.querySelector(".modal-btn-secondary").onclick = () =>
    overlay.remove();

  const selectTurma = modal.querySelector("#turma");

  DataStore.state.data.turmas
    .filter(t => t.ativa !== false)
    .forEach(turma => {
      const option = document.createElement("option");
      option.value = turma.id;
      option.textContent = `${turma.nome} (${turma.nivel})`;
      selectTurma.appendChild(option);
    });

  modal.querySelector(".modal-btn-primary").onclick = () => {
    const aluno = {
      id: crypto.randomUUID(),
      nome: modal.querySelector("#nome").value,
      turma: selectTurma.value,
      horario: modal.querySelector("#horario").value,
      mensalidade: Number(modal.querySelector("#mensalidade").value),
      tipo: modal.querySelector("#tipo").value,
      ativo: true,
    };

    DataStore.state.data.alunos.push(aluno);
    DataStore.save();
    overlay.remove();
    UI.navigate("alunos");
  };

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/* =========================
   TURMAS
========================= */
function renderTurmas() {
  const header = document.createElement("div");
  header.style.marginBottom = "1.5rem";

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.textContent = "+ Nova Turma";
  btn.onclick = abrirModalTurma;

  header.appendChild(btn);
  UI.content.appendChild(header);

  const table = document.createElement("table");
  table.style.width = "100%";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Nome</th>
        <th>Nível</th>
        <th>Unidade</th>
        <th>Horário</th>
        <th>Status</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  DataStore.state.data.turmas
    .filter(t => t.ativa !== false)
    .forEach(turma => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${turma.nome}</td>
        <td>${turma.nivel}</td>
        <td>${turma.unidade}</td>
        <td>${turma.horario}</td>
        <td>${turma.ativa ? "Ativa" : "Inativa"}</td>
        <td>
          <button class="btn-secondary">Excluir</button>
        </td>
      `;

      tr.querySelector("button").onclick = () => {
        if (confirm("Excluir turma?")) {
          turma.ativa = false;
          DataStore.save();
          UI.navigate("turmas");
        }
      };

      table.querySelector("tbody").appendChild(tr);
    });

  UI.content.appendChild(table);
}

/* =========================
   MODAL NOVA TURMA
========================= */
function abrirModalTurma() {
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `;

  const modal = document.createElement("div");
  modal.className = "modal-card";

  modal.innerHTML = `
    <h2 class="modal-title">Nova Turma</h2>

    <div class="modal-grid">
      <div class="field">
        <label>Nome da Turma *</label>
        <input id="nome">
      </div>

      <div class="field">
        <label>Nível *</label>
        <select id="nivel">
          <option>Iniciante</option>
          <option>Iniciado</option>
          <option>Intermediário 1</option>
          <option>Intermediário 2</option>
          <option>Roots Intermediário/Avançado</option>
        </select>
      </div>

      <div class="field">
        <label>Unidade *</label>
        <input id="unidade">
      </div>

      <div class="field">
        <label>Horário</label>
        <input id="horario">
      </div>
    </div>

    <div class="modal-actions">
      <button class="modal-btn-secondary">Cancelar</button>
      <button class="modal-btn-primary">Criar</button>
    </div>
  `;

  modal.querySelector(".modal-btn-secondary").onclick = () =>
    overlay.remove();

  modal.querySelector(".modal-btn-primary").onclick = () => {
    const turma = {
      id: crypto.randomUUID(),
      nome: modal.querySelector("#nome").value,
      nivel: modal.querySelector("#nivel").value,
      unidade: modal.querySelector("#unidade").value,
      horario: modal.querySelector("#horario").value,
      ativa: true,
    };

    DataStore.state.data.turmas.push(turma);
    DataStore.save();
    overlay.remove();
    UI.navigate("turmas");
  };

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/* =========================
   PLACEHOLDER
========================= */
function renderPlaceholder(nome) {
  UI.content.innerHTML = `
    <div class="empty-state">
      <h3>${nome}</h3>
      <p>Módulo em construção.</p>
    </div>
  `;
}

/* =========================
   START
========================= */
document.addEventListener("DOMContentLoaded", () => UI.init());
