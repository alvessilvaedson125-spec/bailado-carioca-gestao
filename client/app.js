/**
 * Bailado Carioca — Sistema de Gestão
 * app.js (versão completa com todas funcionalidades)
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
      monitores: [],
      mensalidades: [],
      caixa: [],
    },
  },

  /** Carrega dados do localStorage */
  load() {
    const raw = localStorage.getItem("bailadoData");
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge com estrutura padrão para garantir arrays existem
      this.state.data = { ...this.state.data, ...parsed };
    }
  },

  /** Salva dados no localStorage */
  save() {
    localStorage.setItem("bailadoData", JSON.stringify(this.state.data));
  },

  /** Conta itens ativos de uma entidade */
  count(entidade) {
    const items = this.state.data[entidade] || [];
    return items.filter(
      item => item.ativo !== false && item.ativa !== false && item.status !== "trancado"
    ).length;
  },

  /** Conta alunos trancados */
  countTrancados() {
    return this.state.data.alunos.filter(a => a.status === "trancado").length;
  },

  /** Conta mensalidades por status */
  countMensalidades(status) {
    return this.state.data.mensalidades.filter(m => m.status === status).length;
  },

  /** Soma total de mensalidades pagas (caixa) */
  totalCaixa() {
    return this.state.data.mensalidades
      .filter(m => m.status === "paga")
      .reduce((sum, m) => sum + (m.valor || 0), 0);
  },

  /** Busca item por ID em uma entidade */
  findById(entidade, id) {
    return this.state.data[entidade].find(item => item.id === id);
  },

  /** Atualiza item por ID */
  updateById(entidade, id, updates) {
    const item = this.findById(entidade, id);
    if (item) {
      Object.assign(item, updates);
      this.save();
    }
    return item;
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
      ["monitores", "Monitores"],
      ["mensalidades", "Mensalidades"],
      ["caixa", "Caixa"],
      ["lixeira", "Lixeira"],
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

    this.title.textContent = page.charAt(0).toUpperCase() + page.slice(1);
    this.content.innerHTML = "";
    pagesRenderers[page]();
  },
};

/* =========================
   UTILIDADES
========================= */

/** Cria overlay de modal */
function criarOverlay() {
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
  return overlay;
}

/** Formata valor em Reais */
function formatarReais(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor || 0);
}

/* =========================
   RENDERIZADORES DE PÁGINA
========================= */
const pagesRenderers = {
  /** Dashboard com métricas inteligentes */
  dashboard() {
    const grid = document.createElement("div");
    grid.className = "dashboard-cards";

    const cards = [
      ["Alunos Ativos", DataStore.count("alunos")],
      ["Alunos Trancados", DataStore.countTrancados()],
      ["Turmas Ativas", DataStore.count("turmas")],
      ["Professores", DataStore.count("professores")],
      ["Mensalidades Abertas", DataStore.countMensalidades("aberta")],
      ["Mensalidades Pagas", DataStore.countMensalidades("paga")],
      ["Total Caixa", formatarReais(DataStore.totalCaixa())],
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
    renderProfessores();
  },

  monitores() {
    renderMonitores();
  },

  mensalidades() {
    renderMensalidades();
  },

  caixa() {
    renderCaixa();
  },

  lixeira() {
    renderLixeira();
  },

  config() {
    renderPlaceholder("Configurações");
  },
};

/* =========================
   ALUNOS
========================= */

/** Renderiza página de alunos com filtros */
function renderAlunos() {
  // Header com botão e filtros
  const header = document.createElement("div");
  header.style.cssText = "margin-bottom: 1.5rem; display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;";

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.textContent = "+ Novo Aluno";
  btn.onclick = () => abrirModalAluno();
  header.appendChild(btn);

  // Filtro por status
  const selectStatus = document.createElement("select");
  selectStatus.innerHTML = `
    <option value="todos">Todos os Status</option>
    <option value="ativo">Ativos</option>
    <option value="trancado">Trancados</option>
  `;
  selectStatus.onchange = () => renderTabelaAlunos(selectStatus.value, inputBusca.value);
  header.appendChild(selectStatus);

  // Filtro por nome
  const inputBusca = document.createElement("input");
  inputBusca.placeholder = "Buscar por nome...";
  inputBusca.style.padding = "0.5rem";
  inputBusca.oninput = () => renderTabelaAlunos(selectStatus.value, inputBusca.value);
  header.appendChild(inputBusca);

  UI.content.appendChild(header);

  // Container da tabela
  const tableContainer = document.createElement("div");
  tableContainer.id = "alunos-table-container";
  UI.content.appendChild(tableContainer);

  renderTabelaAlunos("todos", "");
}

/** Renderiza tabela de alunos com filtros aplicados */
function renderTabelaAlunos(statusFiltro, buscaNome) {
  const container = document.getElementById("alunos-table-container");
  container.innerHTML = "";

  const table = document.createElement("table");
  table.style.width = "100%";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Nome</th>
        <th>Turma</th>
        <th>Unidade</th>
        <th>Tipo</th>
        <th>Status</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  let alunos = DataStore.state.data.alunos.filter(a => a.ativo !== false);

  // Aplicar filtro de status
  if (statusFiltro === "ativo") {
    alunos = alunos.filter(a => a.status !== "trancado");
  } else if (statusFiltro === "trancado") {
    alunos = alunos.filter(a => a.status === "trancado");
  }

  // Aplicar filtro de busca
  if (buscaNome) {
    const termo = buscaNome.toLowerCase();
    alunos = alunos.filter(a => a.nome?.toLowerCase().includes(termo));
  }

  alunos.forEach(aluno => {
    const turma = DataStore.findById("turmas", aluno.turma);
    const isTrancado = aluno.status === "trancado";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${aluno.nome}</td>
      <td>${turma ? `${turma.nome} (${turma.nivel})` : "-"}</td>
      <td>${turma?.unidade || "-"}</td>
      <td>${aluno.tipo || "-"}</td>
      <td>${isTrancado ? "Trancado" : "Ativo"}</td>
      <td></td>
    `;

    const tdAcoes = tr.querySelector("td:last-child");

    // Botão Editar
    const btnEditar = document.createElement("button");
    btnEditar.className = "btn-secondary";
    btnEditar.textContent = "Editar";
    btnEditar.style.marginRight = "0.5rem";
    btnEditar.onclick = () => abrirModalAluno(aluno);
    tdAcoes.appendChild(btnEditar);

    // Botão Trancar/Reativar
    const btnTrancar = document.createElement("button");
    btnTrancar.className = "btn-secondary";
    btnTrancar.textContent = isTrancado ? "Reativar" : "Trancar";
    btnTrancar.style.marginRight = "0.5rem";
    btnTrancar.onclick = () => {
      aluno.status = isTrancado ? "ativo" : "trancado";
      DataStore.save();
      UI.navigate("alunos");
    };
    tdAcoes.appendChild(btnTrancar);

    // Botão Excluir
    const btnExcluir = document.createElement("button");
    btnExcluir.className = "btn-secondary";
    btnExcluir.textContent = "Excluir";
    btnExcluir.onclick = () => {
      if (confirm("Excluir aluno?")) {
        aluno.ativo = false;
        DataStore.save();
        UI.navigate("alunos");
      }
    };
    tdAcoes.appendChild(btnExcluir);

    table.querySelector("tbody").appendChild(tr);
  });

  container.appendChild(table);
}

/** Modal para criar/editar aluno */
function abrirModalAluno(alunoExistente = null) {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";

  const isEdicao = !!alunoExistente;

  modal.innerHTML = `
    <h2 class="modal-title">${isEdicao ? "Editar Aluno" : "Novo Aluno"}</h2>

    <div class="modal-grid">
      <div class="field">
        <label>Nome do Aluno *</label>
        <input id="nome" placeholder="Ex: Maria Silva" value="${alunoExistente?.nome || ""}">
      </div>

      <div class="field">
        <label>Turma *</label>
        <select id="turma">
          <option value="">Selecione uma turma</option>
        </select>
      </div>

      <div class="field">
        <label>Horário</label>
        <input id="horario" placeholder="Ex: Terça 18h" value="${alunoExistente?.horario || ""}">
      </div>

      <div class="field">
        <label>Mensalidade (R$)</label>
        <input id="mensalidade" type="number" placeholder="0.00" value="${alunoExistente?.mensalidade || ""}">
      </div>

      <div class="field">
        <label>Tipo de Matrícula</label>
        <select id="tipo">
          <option value="Normal" ${alunoExistente?.tipo === "Normal" ? "selected" : ""}>Normal</option>
          <option value="Casal" ${alunoExistente?.tipo === "Casal" ? "selected" : ""}>Casal</option>
          <option value="Múltiplas" ${alunoExistente?.tipo === "Múltiplas" ? "selected" : ""}>Múltiplas turmas</option>
        </select>
      </div>
    </div>

    <div class="modal-actions">
      <button class="modal-btn-secondary">Cancelar</button>
      <button class="modal-btn-primary">${isEdicao ? "Salvar" : "Criar"}</button>
    </div>
  `;

  modal.querySelector(".modal-btn-secondary").onclick = () => overlay.remove();

  // Popular select de turmas
  const selectTurma = modal.querySelector("#turma");
  DataStore.state.data.turmas
    .filter(t => t.ativa !== false)
    .forEach(turma => {
      const option = document.createElement("option");
      option.value = turma.id;
      option.textContent = `${turma.nome} (${turma.nivel})`;
      if (alunoExistente?.turma === turma.id) option.selected = true;
      selectTurma.appendChild(option);
    });

  modal.querySelector(".modal-btn-primary").onclick = () => {
    const dados = {
      nome: modal.querySelector("#nome").value,
      turma: selectTurma.value,
      horario: modal.querySelector("#horario").value,
      mensalidade: Number(modal.querySelector("#mensalidade").value),
      tipo: modal.querySelector("#tipo").value,
    };

    if (isEdicao) {
      Object.assign(alunoExistente, dados);
    } else {
      DataStore.state.data.alunos.push({
        id: crypto.randomUUID(),
        ...dados,
        ativo: true,
        status: "ativo",
      });
    }

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

/** Renderiza página de turmas */
function renderTurmas() {
  const header = document.createElement("div");
  header.style.cssText = "margin-bottom: 1.5rem; display: flex; gap: 1rem; align-items: center;";

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.textContent = "+ Nova Turma";
  btn.onclick = () => abrirModalTurma();
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
        <th>Professor</th>
        <th>Monitores</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  DataStore.state.data.turmas
    .filter(t => t.ativa !== false)
    .forEach(turma => {
      const professor = DataStore.findById("professores", turma.professor_id);
      const monitoresNomes = (turma.monitores_ids || [])
        .map(id => DataStore.findById("monitores", id)?.nome)
        .filter(Boolean)
        .join(", ");

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${turma.nome}</td>
        <td>${turma.nivel}</td>
        <td>${turma.unidade}</td>
        <td>${turma.horario || "-"}</td>
        <td>${professor?.nome || "-"}</td>
        <td>${monitoresNomes || "-"}</td>
        <td></td>
      `;

      const tdAcoes = tr.querySelector("td:last-child");

      const btnEditar = document.createElement("button");
      btnEditar.className = "btn-secondary";
      btnEditar.textContent = "Editar";
      btnEditar.style.marginRight = "0.5rem";
      btnEditar.onclick = () => abrirModalTurma(turma);
      tdAcoes.appendChild(btnEditar);

      const btnExcluir = document.createElement("button");
      btnExcluir.className = "btn-secondary";
      btnExcluir.textContent = "Excluir";
      btnExcluir.onclick = () => {
        if (confirm("Excluir turma?")) {
          turma.ativa = false;
          DataStore.save();
          UI.navigate("turmas");
        }
      };
      tdAcoes.appendChild(btnExcluir);

      table.querySelector("tbody").appendChild(tr);
    });

  UI.content.appendChild(table);
}

/** Modal para criar/editar turma */
function abrirModalTurma(turmaExistente = null) {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";

  const isEdicao = !!turmaExistente;

  modal.innerHTML = `
    <h2 class="modal-title">${isEdicao ? "Editar Turma" : "Nova Turma"}</h2>

    <div class="modal-grid">
      <div class="field">
        <label>Nome da Turma *</label>
        <input id="nome" value="${turmaExistente?.nome || ""}">
      </div>

      <div class="field">
        <label>Nível *</label>
        <select id="nivel">
          <option ${turmaExistente?.nivel === "Iniciante" ? "selected" : ""}>Iniciante</option>
          <option ${turmaExistente?.nivel === "Iniciado" ? "selected" : ""}>Iniciado</option>
          <option ${turmaExistente?.nivel === "Intermediário 1" ? "selected" : ""}>Intermediário 1</option>
          <option ${turmaExistente?.nivel === "Intermediário 2" ? "selected" : ""}>Intermediário 2</option>
          <option ${turmaExistente?.nivel === "Roots Intermediário/Avançado" ? "selected" : ""}>Roots Intermediário/Avançado</option>
        </select>
      </div>

      <div class="field">
        <label>Unidade *</label>
        <input id="unidade" value="${turmaExistente?.unidade || ""}">
      </div>

      <div class="field">
        <label>Horário</label>
        <input id="horario" value="${turmaExistente?.horario || ""}">
      </div>

      <div class="field">
        <label>Professor Responsável</label>
        <select id="professor">
          <option value="">Nenhum</option>
        </select>
      </div>

      <div class="field">
        <label>Monitores</label>
        <select id="monitores" multiple style="min-height: 80px;">
        </select>
        <small>Ctrl+Click para selecionar múltiplos</small>
      </div>
    </div>

    <div class="modal-actions">
      <button class="modal-btn-secondary">Cancelar</button>
      <button class="modal-btn-primary">${isEdicao ? "Salvar" : "Criar"}</button>
    </div>
  `;

  modal.querySelector(".modal-btn-secondary").onclick = () => overlay.remove();

  // Popular select de professores
  const selectProfessor = modal.querySelector("#professor");
  DataStore.state.data.professores
    .filter(p => p.ativo !== false)
    .forEach(prof => {
      const option = document.createElement("option");
      option.value = prof.id;
      option.textContent = prof.nome;
      if (turmaExistente?.professor_id === prof.id) option.selected = true;
      selectProfessor.appendChild(option);
    });

  // Popular select de monitores
  const selectMonitores = modal.querySelector("#monitores");
  DataStore.state.data.monitores
    .filter(m => m.ativo !== false)
    .forEach(mon => {
      const option = document.createElement("option");
      option.value = mon.id;
      option.textContent = `${mon.nome} (${mon.tipo})`;
      if (turmaExistente?.monitores_ids?.includes(mon.id)) option.selected = true;
      selectMonitores.appendChild(option);
    });

  modal.querySelector(".modal-btn-primary").onclick = () => {
    const monitoresSelecionados = Array.from(selectMonitores.selectedOptions).map(o => o.value);

    const dados = {
      nome: modal.querySelector("#nome").value,
      nivel: modal.querySelector("#nivel").value,
      unidade: modal.querySelector("#unidade").value,
      horario: modal.querySelector("#horario").value,
      professor_id: selectProfessor.value || null,
      monitores_ids: monitoresSelecionados,
    };

    if (isEdicao) {
      Object.assign(turmaExistente, dados);
    } else {
      DataStore.state.data.turmas.push({
        id: crypto.randomUUID(),
        ...dados,
        ativa: true,
      });
    }

    DataStore.save();
    overlay.remove();
    UI.navigate("turmas");
  };

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/* =========================
   PROFESSORES
========================= */

/** Renderiza página de professores */
function renderProfessores() {
  const header = document.createElement("div");
  header.style.cssText = "margin-bottom: 1.5rem; display: flex; gap: 1rem; align-items: center;";

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.textContent = "+ Novo Professor";
  btn.onclick = () => abrirModalProfessor();
  header.appendChild(btn);

  UI.content.appendChild(header);

  const table = document.createElement("table");
  table.style.width = "100%";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Nome</th>
        <th>Telefone</th>
        <th>Especialidade</th>
        <th>Status</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  DataStore.state.data.professores
    .filter(p => p.ativo !== false)
    .forEach(prof => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${prof.nome}</td>
        <td>${prof.telefone || "-"}</td>
        <td>${prof.especialidade || "-"}</td>
        <td>Ativo</td>
        <td></td>
      `;

      const tdAcoes = tr.querySelector("td:last-child");

      const btnEditar = document.createElement("button");
      btnEditar.className = "btn-secondary";
      btnEditar.textContent = "Editar";
      btnEditar.style.marginRight = "0.5rem";
      btnEditar.onclick = () => abrirModalProfessor(prof);
      tdAcoes.appendChild(btnEditar);

      const btnExcluir = document.createElement("button");
      btnExcluir.className = "btn-secondary";
      btnExcluir.textContent = "Excluir";
      btnExcluir.onclick = () => {
        if (confirm("Excluir professor?")) {
          prof.ativo = false;
          DataStore.save();
          UI.navigate("professores");
        }
      };
      tdAcoes.appendChild(btnExcluir);

      table.querySelector("tbody").appendChild(tr);
    });

  UI.content.appendChild(table);
}

/** Modal para criar/editar professor */
function abrirModalProfessor(profExistente = null) {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";

  const isEdicao = !!profExistente;

  modal.innerHTML = `
    <h2 class="modal-title">${isEdicao ? "Editar Professor" : "Novo Professor"}</h2>

    <div class="modal-grid">
      <div class="field">
        <label>Nome *</label>
        <input id="nome" value="${profExistente?.nome || ""}">
      </div>

      <div class="field">
        <label>Telefone</label>
        <input id="telefone" value="${profExistente?.telefone || ""}">
      </div>

      <div class="field">
        <label>Especialidade</label>
        <input id="especialidade" placeholder="Ex: Forró, Samba" value="${profExistente?.especialidade || ""}">
      </div>
    </div>

    <div class="modal-actions">
      <button class="modal-btn-secondary">Cancelar</button>
      <button class="modal-btn-primary">${isEdicao ? "Salvar" : "Criar"}</button>
    </div>
  `;

  modal.querySelector(".modal-btn-secondary").onclick = () => overlay.remove();

  modal.querySelector(".modal-btn-primary").onclick = () => {
    const dados = {
      nome: modal.querySelector("#nome").value,
      telefone: modal.querySelector("#telefone").value,
      especialidade: modal.querySelector("#especialidade").value,
    };

    if (isEdicao) {
      Object.assign(profExistente, dados);
    } else {
      DataStore.state.data.professores.push({
        id: crypto.randomUUID(),
        ...dados,
        ativo: true,
      });
    }

    DataStore.save();
    overlay.remove();
    UI.navigate("professores");
  };

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/* =========================
   MONITORES
========================= */

/** Renderiza página de monitores */
function renderMonitores() {
  const header = document.createElement("div");
  header.style.cssText = "margin-bottom: 1.5rem; display: flex; gap: 1rem; align-items: center;";

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.textContent = "+ Novo Monitor";
  btn.onclick = () => abrirModalMonitor();
  header.appendChild(btn);

  UI.content.appendChild(header);

  const table = document.createElement("table");
  table.style.width = "100%";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Nome</th>
        <th>Tipo</th>
        <th>Turmas Vinculadas</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  DataStore.state.data.monitores
    .filter(m => m.ativo !== false)
    .forEach(mon => {
      // Encontrar turmas onde este monitor está vinculado
      const turmasVinculadas = DataStore.state.data.turmas
        .filter(t => t.ativa !== false && t.monitores_ids?.includes(mon.id))
        .map(t => t.nome)
        .join(", ");

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${mon.nome}</td>
        <td>${mon.tipo}</td>
        <td>${turmasVinculadas || "-"}</td>
        <td></td>
      `;

      const tdAcoes = tr.querySelector("td:last-child");

      const btnEditar = document.createElement("button");
      btnEditar.className = "btn-secondary";
      btnEditar.textContent = "Editar";
      btnEditar.style.marginRight = "0.5rem";
      btnEditar.onclick = () => abrirModalMonitor(mon);
      tdAcoes.appendChild(btnEditar);

      const btnExcluir = document.createElement("button");
      btnExcluir.className = "btn-secondary";
      btnExcluir.textContent = "Excluir";
      btnExcluir.onclick = () => {
        if (confirm("Excluir monitor?")) {
          mon.ativo = false;
          DataStore.save();
          UI.navigate("monitores");
        }
      };
      tdAcoes.appendChild(btnExcluir);

      table.querySelector("tbody").appendChild(tr);
    });

  UI.content.appendChild(table);
}

/** Modal para criar/editar monitor */
function abrirModalMonitor(monExistente = null) {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";

  const isEdicao = !!monExistente;

  modal.innerHTML = `
    <h2 class="modal-title">${isEdicao ? "Editar Monitor" : "Novo Monitor"}</h2>

    <div class="modal-grid">
      <div class="field">
        <label>Nome *</label>
        <input id="nome" value="${monExistente?.nome || ""}">
      </div>

      <div class="field">
        <label>Tipo *</label>
        <select id="tipo">
          <option value="Professor" ${monExistente?.tipo === "Professor" ? "selected" : ""}>Professor</option>
          <option value="Aluno" ${monExistente?.tipo === "Aluno" ? "selected" : ""}>Aluno</option>
        </select>
      </div>
    </div>

    <div class="modal-actions">
      <button class="modal-btn-secondary">Cancelar</button>
      <button class="modal-btn-primary">${isEdicao ? "Salvar" : "Criar"}</button>
    </div>
  `;

  modal.querySelector(".modal-btn-secondary").onclick = () => overlay.remove();

  modal.querySelector(".modal-btn-primary").onclick = () => {
    const dados = {
      nome: modal.querySelector("#nome").value,
      tipo: modal.querySelector("#tipo").value,
    };

    if (isEdicao) {
      Object.assign(monExistente, dados);
    } else {
      DataStore.state.data.monitores.push({
        id: crypto.randomUUID(),
        ...dados,
        ativo: true,
      });
    }

    DataStore.save();
    overlay.remove();
    UI.navigate("monitores");
  };

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/* =========================
   MENSALIDADES
========================= */

/** Renderiza página de mensalidades */
function renderMensalidades() {
  const header = document.createElement("div");
  header.style.cssText = "margin-bottom: 1.5rem; display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;";

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.textContent = "+ Nova Mensalidade";
  btn.onclick = () => abrirModalMensalidade();
  header.appendChild(btn);

  // Filtro por status
  const selectStatus = document.createElement("select");
  selectStatus.innerHTML = `
    <option value="todos">Todos os Status</option>
    <option value="aberta">Abertas</option>
    <option value="paga">Pagas</option>
    <option value="atrasada">Atrasadas</option>
  `;
  selectStatus.onchange = () => renderTabelaMensalidades(selectStatus.value, selectMes.value);
  header.appendChild(selectStatus);

  // Filtro por mês
  const selectMes = document.createElement("select");
  selectMes.innerHTML = `
    <option value="">Todos os Meses</option>
    <option value="01">Janeiro</option>
    <option value="02">Fevereiro</option>
    <option value="03">Março</option>
    <option value="04">Abril</option>
    <option value="05">Maio</option>
    <option value="06">Junho</option>
    <option value="07">Julho</option>
    <option value="08">Agosto</option>
    <option value="09">Setembro</option>
    <option value="10">Outubro</option>
    <option value="11">Novembro</option>
    <option value="12">Dezembro</option>
  `;
  selectMes.onchange = () => renderTabelaMensalidades(selectStatus.value, selectMes.value);
  header.appendChild(selectMes);

  UI.content.appendChild(header);

  const tableContainer = document.createElement("div");
  tableContainer.id = "mensalidades-table-container";
  UI.content.appendChild(tableContainer);

  renderTabelaMensalidades("todos", "");
}

/** Renderiza tabela de mensalidades com filtros */
function renderTabelaMensalidades(statusFiltro, mesFiltro) {
  const container = document.getElementById("mensalidades-table-container");
  container.innerHTML = "";

  const table = document.createElement("table");
  table.style.width = "100%";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Aluno</th>
        <th>Mês/Ano</th>
        <th>Valor</th>
        <th>Status</th>
        <th>Forma Pgto</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  let mensalidades = [...DataStore.state.data.mensalidades];

  // Aplicar filtros
  if (statusFiltro !== "todos") {
    mensalidades = mensalidades.filter(m => m.status === statusFiltro);
  }
  if (mesFiltro) {
    mensalidades = mensalidades.filter(m => m.mes === mesFiltro);
  }

  mensalidades.forEach(mens => {
    const aluno = DataStore.findById("alunos", mens.aluno_id);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${aluno?.nome || "-"}</td>
      <td>${mens.mes}/${mens.ano}</td>
      <td>${formatarReais(mens.valor)}</td>
      <td>${mens.status}</td>
      <td>${mens.forma_pagamento || "-"}</td>
      <td></td>
    `;

    const tdAcoes = tr.querySelector("td:last-child");

    if (mens.status !== "paga") {
      const btnPagar = document.createElement("button");
      btnPagar.className = "btn-primary";
      btnPagar.textContent = "Marcar Pago";
      btnPagar.style.marginRight = "0.5rem";
      btnPagar.onclick = () => {
        mens.status = "paga";
        mens.data_pagamento = new Date().toISOString();
        DataStore.save();
        UI.navigate("mensalidades");
      };
      tdAcoes.appendChild(btnPagar);
    }

    const btnEditar = document.createElement("button");
    btnEditar.className = "btn-secondary";
    btnEditar.textContent = "Editar";
    btnEditar.onclick = () => abrirModalMensalidade(mens);
    tdAcoes.appendChild(btnEditar);

    table.querySelector("tbody").appendChild(tr);
  });

  container.appendChild(table);
}

/** Modal para criar/editar mensalidade */
function abrirModalMensalidade(mensExistente = null) {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";

  const isEdicao = !!mensExistente;
  const mesAtual = String(new Date().getMonth() + 1).padStart(2, "0");
  const anoAtual = String(new Date().getFullYear());

  modal.innerHTML = `
    <h2 class="modal-title">${isEdicao ? "Editar Mensalidade" : "Nova Mensalidade"}</h2>

    <div class="modal-grid">
      <div class="field">
        <label>Aluno *</label>
        <select id="aluno">
          <option value="">Selecione um aluno</option>
        </select>
      </div>

      <div class="field">
        <label>Mês *</label>
        <select id="mes">
          <option value="01" ${(mensExistente?.mes || mesAtual) === "01" ? "selected" : ""}>Janeiro</option>
          <option value="02" ${(mensExistente?.mes || mesAtual) === "02" ? "selected" : ""}>Fevereiro</option>
          <option value="03" ${(mensExistente?.mes || mesAtual) === "03" ? "selected" : ""}>Março</option>
          <option value="04" ${(mensExistente?.mes || mesAtual) === "04" ? "selected" : ""}>Abril</option>
          <option value="05" ${(mensExistente?.mes || mesAtual) === "05" ? "selected" : ""}>Maio</option>
          <option value="06" ${(mensExistente?.mes || mesAtual) === "06" ? "selected" : ""}>Junho</option>
          <option value="07" ${(mensExistente?.mes || mesAtual) === "07" ? "selected" : ""}>Julho</option>
          <option value="08" ${(mensExistente?.mes || mesAtual) === "08" ? "selected" : ""}>Agosto</option>
          <option value="09" ${(mensExistente?.mes || mesAtual) === "09" ? "selected" : ""}>Setembro</option>
          <option value="10" ${(mensExistente?.mes || mesAtual) === "10" ? "selected" : ""}>Outubro</option>
          <option value="11" ${(mensExistente?.mes || mesAtual) === "11" ? "selected" : ""}>Novembro</option>
          <option value="12" ${(mensExistente?.mes || mesAtual) === "12" ? "selected" : ""}>Dezembro</option>
        </select>
      </div>

      <div class="field">
        <label>Ano *</label>
        <input id="ano" value="${mensExistente?.ano || anoAtual}">
      </div>

      <div class="field">
        <label>Valor (R$) *</label>
        <input id="valor" type="number" value="${mensExistente?.valor || ""}">
      </div>

      <div class="field">
        <label>Status</label>
        <select id="status">
          <option value="aberta" ${mensExistente?.status === "aberta" ? "selected" : ""}>Aberta</option>
          <option value="paga" ${mensExistente?.status === "paga" ? "selected" : ""}>Paga</option>
          <option value="atrasada" ${mensExistente?.status === "atrasada" ? "selected" : ""}>Atrasada</option>
        </select>
      </div>

      <div class="field">
        <label>Forma de Pagamento</label>
        <select id="forma">
          <option value="">-</option>
          <option value="Pix" ${mensExistente?.forma_pagamento === "Pix" ? "selected" : ""}>Pix</option>
          <option value="Dinheiro" ${mensExistente?.forma_pagamento === "Dinheiro" ? "selected" : ""}>Dinheiro</option>
          <option value="Cartão" ${mensExistente?.forma_pagamento === "Cartão" ? "selected" : ""}>Cartão</option>
          <option value="Transferência" ${mensExistente?.forma_pagamento === "Transferência" ? "selected" : ""}>Transferência</option>
        </select>
      </div>
    </div>

    <div class="modal-actions">
      <button class="modal-btn-secondary">Cancelar</button>
      <button class="modal-btn-primary">${isEdicao ? "Salvar" : "Criar"}</button>
    </div>
  `;

  modal.querySelector(".modal-btn-secondary").onclick = () => overlay.remove();

  // Popular select de alunos (apenas ativos, não trancados)
  const selectAluno = modal.querySelector("#aluno");
  DataStore.state.data.alunos
    .filter(a => a.ativo !== false && a.status !== "trancado")
    .forEach(aluno => {
      const option = document.createElement("option");
      option.value = aluno.id;
      option.textContent = aluno.nome;
      if (mensExistente?.aluno_id === aluno.id) option.selected = true;
      selectAluno.appendChild(option);
    });

  modal.querySelector(".modal-btn-primary").onclick = () => {
    const dados = {
      aluno_id: selectAluno.value,
      mes: modal.querySelector("#mes").value,
      ano: modal.querySelector("#ano").value,
      valor: Number(modal.querySelector("#valor").value),
      status: modal.querySelector("#status").value,
      forma_pagamento: modal.querySelector("#forma").value,
    };

    if (isEdicao) {
      Object.assign(mensExistente, dados);
    } else {
      DataStore.state.data.mensalidades.push({
        id: crypto.randomUUID(),
        ...dados,
      });
    }

    DataStore.save();
    overlay.remove();
    UI.navigate("mensalidades");
  };

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/* =========================
   CAIXA
========================= */

/** Renderiza página de caixa (resumo financeiro) */
function renderCaixa() {
  const total = DataStore.totalCaixa();
  const abertas = DataStore.countMensalidades("aberta");
  const pagas = DataStore.countMensalidades("paga");
  const atrasadas = DataStore.countMensalidades("atrasada");

  const container = document.createElement("div");
  container.innerHTML = `
    <div class="dashboard-cards">
      <div class="summary-card">
        <span class="card-title">Total Recebido</span>
        <span class="card-value">${formatarReais(total)}</span>
      </div>
      <div class="summary-card">
        <span class="card-title">Mensalidades Pagas</span>
        <span class="card-value">${pagas}</span>
      </div>
      <div class="summary-card">
        <span class="card-title">Mensalidades Abertas</span>
        <span class="card-value">${abertas}</span>
      </div>
      <div class="summary-card">
        <span class="card-title">Mensalidades Atrasadas</span>
        <span class="card-value">${atrasadas}</span>
      </div>
    </div>
  `;

  UI.content.appendChild(container);
}

/* =========================
   LIXEIRA
========================= */

/** Renderiza página da lixeira com itens excluídos */
function renderLixeira() {
  const header = document.createElement("div");
  header.innerHTML = "<p style='margin-bottom: 1rem; color: #64748b;'>Itens excluídos podem ser restaurados abaixo.</p>";
  UI.content.appendChild(header);

  const entidades = [
    ["alunos", "Alunos", "ativo"],
    ["turmas", "Turmas", "ativa"],
    ["professores", "Professores", "ativo"],
    ["monitores", "Monitores", "ativo"],
  ];

  entidades.forEach(([key, label, campo]) => {
    const excluidos = DataStore.state.data[key].filter(item => item[campo] === false);

    if (excluidos.length === 0) return;

    const section = document.createElement("div");
    section.style.marginBottom = "2rem";
    section.innerHTML = `<h3 style="margin-bottom: 0.5rem;">${label} Excluídos</h3>`;

    const table = document.createElement("table");
    table.style.width = "100%";
    table.innerHTML = `
      <thead><tr><th>Nome</th><th>Ações</th></tr></thead>
      <tbody></tbody>
    `;

    excluidos.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${item.nome}</td><td></td>`;

      const btnRestaurar = document.createElement("button");
      btnRestaurar.className = "btn-primary";
      btnRestaurar.textContent = "Restaurar";
      btnRestaurar.onclick = () => {
        item[campo] = true;
        DataStore.save();
        UI.navigate("lixeira");
      };

      tr.querySelector("td:last-child").appendChild(btnRestaurar);
      table.querySelector("tbody").appendChild(tr);
    });

    section.appendChild(table);
    UI.content.appendChild(section);
  });

  // Verificar se não há nada na lixeira
  const totalExcluidos = entidades.reduce((sum, [key, , campo]) => {
    return sum + DataStore.state.data[key].filter(item => item[campo] === false).length;
  }, 0);

  if (totalExcluidos === 0) {
    UI.content.innerHTML = `
      <div class="empty-state">
        <h3>Lixeira Vazia</h3>
        <p>Nenhum item excluído.</p>
      </div>
    `;
  }
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
