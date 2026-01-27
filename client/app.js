/**
 * Bailado Carioca — Sistema de Gestão Completo
 * app.js (versão final com todas funcionalidades)
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
      lixeira: [],
      config: {
        nomeProjeto: "Bailado Carioca",
        observacoes: "",
      },
    },
  },

  /** Carrega dados do localStorage */
  load() {
    const raw = localStorage.getItem("bailadoData");
    if (raw) {
      const parsed = JSON.parse(raw);
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
    return this.state.data.alunos.filter(a => a.ativo !== false && a.status === "trancado").length;
  },

  /** Conta mensalidades por status */
  countMensalidades(status) {
    return this.state.data.mensalidades.filter(m => m.status === status).length;
  },

  /** Soma total do caixa */
  totalCaixa() {
    return this.state.data.caixa.reduce((sum, c) => sum + (c.valor || 0), 0);
  },

  /** Busca item por ID em uma entidade */
  findById(entidade, id) {
    return this.state.data[entidade].find(item => item.id === id);
  },

  /** Move item para lixeira */
  moverParaLixeira(entidade, item) {
    this.state.data.lixeira.push({
      ...item,
      _entidade: entidade,
      _deletadoEm: new Date().toISOString(),
    });
    this.save();
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

    const titulos = {
      dashboard: "Dashboard",
      alunos: "Alunos",
      turmas: "Turmas",
      unidades: "Unidades",
      professores: "Professores",
      mensalidades: "Mensalidades",
      caixa: "Caixa",
      lixeira: "Lixeira",
      config: "Configurações",
    };

    this.title.textContent = titulos[page] || page;
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

/** Formata data para exibição */
function formatarData(dataISO) {
  if (!dataISO) return "-";
  const d = new Date(dataISO);
  return d.toLocaleDateString("pt-BR");
}

/** Cria container de cards */
function criarGridCards() {
  const grid = document.createElement("div");
  grid.className = "dashboard-cards";
  grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(280px, 1fr))";
  return grid;
}

/* =========================
   RENDERIZADORES DE PÁGINA
========================= */
const pagesRenderers = {
  /** Dashboard com métricas */
  dashboard() {
    const grid = document.createElement("div");
    grid.className = "dashboard-cards";

    const cards = [
      ["Alunos Ativos", DataStore.count("alunos")],
      ["Alunos Trancados", DataStore.countTrancados()],
      ["Turmas Ativas", DataStore.count("turmas")],
      ["Unidades", DataStore.count("unidades")],
      ["Professores", DataStore.count("professores")],
      ["Mensalidades Pendentes", DataStore.countMensalidades("pendente")],
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
    renderUnidades();
  },

  professores() {
    renderProfessores();
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
    renderConfig();
  },
};

/* =========================
   ALUNOS
========================= */

/** Renderiza página de alunos em cards */
function renderAlunos() {
  const header = document.createElement("div");
  header.style.cssText = "margin-bottom: 1.5rem; display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;";

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.textContent = "+ Novo Aluno";
  btn.onclick = () => abrirModalAluno();
  header.appendChild(btn);

  // Filtro por status
  const selectStatus = document.createElement("select");
  selectStatus.style.padding = "0.5rem";
  selectStatus.innerHTML = `
    <option value="todos">Todos os Status</option>
    <option value="ativo">Ativos</option>
    <option value="trancado">Trancados</option>
  `;
  selectStatus.onchange = () => renderCardsAlunos(selectStatus.value, inputBusca.value);
  header.appendChild(selectStatus);

  // Filtro por nome
  const inputBusca = document.createElement("input");
  inputBusca.placeholder = "Buscar por nome...";
  inputBusca.style.padding = "0.5rem";
  inputBusca.oninput = () => renderCardsAlunos(selectStatus.value, inputBusca.value);
  header.appendChild(inputBusca);

  UI.content.appendChild(header);

  const container = document.createElement("div");
  container.id = "alunos-container";
  UI.content.appendChild(container);

  renderCardsAlunos("todos", "");
}

/** Renderiza cards de alunos */
function renderCardsAlunos(statusFiltro, buscaNome) {
  const container = document.getElementById("alunos-container");
  container.innerHTML = "";

  let alunos = DataStore.state.data.alunos.filter(a => a.ativo !== false);

  if (statusFiltro === "ativo") {
    alunos = alunos.filter(a => a.status !== "trancado");
  } else if (statusFiltro === "trancado") {
    alunos = alunos.filter(a => a.status === "trancado");
  }

  if (buscaNome) {
    const termo = buscaNome.toLowerCase();
    alunos = alunos.filter(a => a.nome?.toLowerCase().includes(termo));
  }

  if (alunos.length === 0) {
    container.innerHTML = '<p style="color: #64748b;">Nenhum aluno encontrado.</p>';
    return;
  }

  const grid = criarGridCards();

  alunos.forEach(aluno => {
    const turma = DataStore.findById("turmas", aluno.turma);
    const unidade = turma ? DataStore.findById("unidades", turma.unidade_id) : null;
    const isTrancado = aluno.status === "trancado";

    const card = document.createElement("div");
    card.className = "summary-card";
    card.style.cursor = "default";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <strong style="font-size: 1.1rem;">${aluno.nome}</strong>
        <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; background: ${isTrancado ? "#fef2f2" : "#f0fdf4"}; color: ${isTrancado ? "#dc2626" : "#16a34a"};">
          ${isTrancado ? "Trancado" : "Ativo"}
        </span>
      </div>
      <p style="margin: 0.5rem 0; color: #64748b; font-size: 0.9rem;">
        📞 ${aluno.telefone || "Não informado"}<br>
        🕺 ${turma ? `${turma.nome} (${turma.nivel})` : "Sem turma"}<br>
        🏢 ${unidade?.nome || turma?.unidade || "Não informado"}<br>
        💰 ${formatarReais(aluno.mensalidade)}<br>
        📋 ${aluno.tipo || "Normal"}
      </p>
      <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap;"></div>
    `;

    const acoes = card.querySelector("div:last-child");

    const btnEditar = document.createElement("button");
    btnEditar.className = "btn-secondary";
    btnEditar.textContent = "Editar";
    btnEditar.onclick = () => abrirModalAluno(aluno);
    acoes.appendChild(btnEditar);

    const btnTrancar = document.createElement("button");
    btnTrancar.className = "btn-secondary";
    btnTrancar.textContent = isTrancado ? "Reativar" : "Trancar";
    btnTrancar.onclick = () => {
      aluno.status = isTrancado ? "ativo" : "trancado";
      DataStore.save();
      UI.navigate("alunos");
    };
    acoes.appendChild(btnTrancar);

    const btnExcluir = document.createElement("button");
    btnExcluir.className = "btn-secondary";
    btnExcluir.textContent = "Excluir";
    btnExcluir.onclick = () => {
      if (confirm("Mover aluno para lixeira?")) {
        aluno.ativo = false;
        DataStore.moverParaLixeira("alunos", aluno);
        UI.navigate("alunos");
      }
    };
    acoes.appendChild(btnExcluir);

    grid.appendChild(card);
  });

  container.appendChild(grid);
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
        <label>Nome *</label>
        <input id="nome" placeholder="Nome completo" value="${alunoExistente?.nome || ""}">
      </div>

      <div class="field">
        <label>Telefone</label>
        <input id="telefone" placeholder="(00) 00000-0000" value="${alunoExistente?.telefone || ""}">
      </div>

      <div class="field">
        <label>Turma</label>
        <select id="turma">
          <option value="">Selecione uma turma</option>
        </select>
      </div>

      <div class="field">
        <label>Tipo de Matrícula</label>
        <select id="tipo">
          <option value="Normal" ${alunoExistente?.tipo === "Normal" ? "selected" : ""}>Normal</option>
          <option value="Casal" ${alunoExistente?.tipo === "Casal" ? "selected" : ""}>Casal</option>
          <option value="Múltiplas" ${alunoExistente?.tipo === "Múltiplas" ? "selected" : ""}>Múltiplas turmas</option>
        </select>
      </div>

      <div class="field">
        <label>Mensalidade (R$)</label>
        <input id="mensalidade" type="number" placeholder="0.00" value="${alunoExistente?.mensalidade || ""}">
      </div>
    </div>

    <div class="modal-actions">
      <button class="modal-btn-secondary">Cancelar</button>
      <button class="modal-btn-primary">${isEdicao ? "Salvar" : "Criar"}</button>
    </div>
  `;

  modal.querySelector(".modal-btn-secondary").onclick = () => overlay.remove();

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
      telefone: modal.querySelector("#telefone").value,
      turma: selectTurma.value,
      tipo: modal.querySelector("#tipo").value,
      mensalidade: Number(modal.querySelector("#mensalidade").value),
    };

    if (!dados.nome) {
      alert("Nome é obrigatório!");
      return;
    }

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

/** Renderiza página de turmas em cards */
function renderTurmas() {
  const header = document.createElement("div");
  header.style.cssText = "margin-bottom: 1.5rem; display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;";

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.textContent = "+ Nova Turma";
  btn.onclick = () => abrirModalTurma();
  header.appendChild(btn);

  // Filtro por unidade
  const selectUnidade = document.createElement("select");
  selectUnidade.style.padding = "0.5rem";
  selectUnidade.innerHTML = '<option value="">Todas as Unidades</option>';
  DataStore.state.data.unidades
    .filter(u => u.ativa !== false)
    .forEach(u => {
      selectUnidade.innerHTML += `<option value="${u.id}">${u.nome}</option>`;
    });
  selectUnidade.onchange = () => renderCardsTurmas(selectUnidade.value);
  header.appendChild(selectUnidade);

  UI.content.appendChild(header);

  const container = document.createElement("div");
  container.id = "turmas-container";
  UI.content.appendChild(container);

  renderCardsTurmas("");
}

/** Renderiza cards de turmas */
function renderCardsTurmas(unidadeFiltro) {
  const container = document.getElementById("turmas-container");
  container.innerHTML = "";

  let turmas = DataStore.state.data.turmas.filter(t => t.ativa !== false);

  if (unidadeFiltro) {
    turmas = turmas.filter(t => t.unidade_id === unidadeFiltro || t.unidade === unidadeFiltro);
  }

  if (turmas.length === 0) {
    container.innerHTML = '<p style="color: #64748b;">Nenhuma turma encontrada.</p>';
    return;
  }

  const grid = criarGridCards();

  turmas.forEach(turma => {
    const professor = DataStore.findById("professores", turma.professor_id);
    const unidade = DataStore.findById("unidades", turma.unidade_id);
    const monitoresNomes = (turma.monitores_ids || [])
      .map(id => DataStore.findById("professores", id)?.nome)
      .filter(Boolean)
      .join(", ");

    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `
      <strong style="font-size: 1.1rem;">${turma.nome}</strong>
      <p style="margin: 0.5rem 0; color: #64748b; font-size: 0.9rem;">
        📊 Nível: ${turma.nivel}<br>
        🏢 Unidade: ${unidade?.nome || turma.unidade || "-"}<br>
        🕐 Horário: ${turma.horario || "-"}<br>
        👨‍🏫 Professor: ${professor?.nome || "-"}<br>
        👥 Monitores: ${monitoresNomes || "-"}<br>
        ${turma.descricao ? `📝 ${turma.descricao}` : ""}
      </p>
      <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;"></div>
    `;

    const acoes = card.querySelector("div:last-child");

    const btnEditar = document.createElement("button");
    btnEditar.className = "btn-secondary";
    btnEditar.textContent = "Editar";
    btnEditar.onclick = () => abrirModalTurma(turma);
    acoes.appendChild(btnEditar);

    const btnExcluir = document.createElement("button");
    btnExcluir.className = "btn-secondary";
    btnExcluir.textContent = "Excluir";
    btnExcluir.onclick = () => {
      if (confirm("Mover turma para lixeira?")) {
        turma.ativa = false;
        DataStore.moverParaLixeira("turmas", turma);
        UI.navigate("turmas");
      }
    };
    acoes.appendChild(btnExcluir);

    grid.appendChild(card);
  });

  container.appendChild(grid);
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
        <label>Nome *</label>
        <input id="nome" value="${turmaExistente?.nome || ""}">
      </div>

      <div class="field">
        <label>Nível *</label>
        <select id="nivel">
          <option ${turmaExistente?.nivel === "Iniciante" ? "selected" : ""}>Iniciante</option>
          <option ${turmaExistente?.nivel === "Iniciado" ? "selected" : ""}>Iniciado</option>
          <option ${turmaExistente?.nivel === "Intermediário 1" ? "selected" : ""}>Intermediário 1</option>
          <option ${turmaExistente?.nivel === "Intermediário 2" ? "selected" : ""}>Intermediário 2</option>
          <option ${turmaExistente?.nivel === "Avançado" ? "selected" : ""}>Avançado</option>
        </select>
      </div>

      <div class="field">
        <label>Unidade</label>
        <select id="unidade">
          <option value="">Selecione</option>
        </select>
      </div>

      <div class="field">
        <label>Horário</label>
        <input id="horario" placeholder="Ex: Terça 19h" value="${turmaExistente?.horario || ""}">
      </div>

      <div class="field">
        <label>Professor Responsável</label>
        <select id="professor">
          <option value="">Nenhum</option>
        </select>
      </div>

      <div class="field">
        <label>Monitores</label>
        <select id="monitores" multiple style="min-height: 70px;">
        </select>
        <small>Ctrl+Click para múltiplos</small>
      </div>

      <div class="field" style="grid-column: span 2;">
        <label>Descrição</label>
        <input id="descricao" placeholder="Descrição da turma" value="${turmaExistente?.descricao || ""}">
      </div>
    </div>

    <div class="modal-actions">
      <button class="modal-btn-secondary">Cancelar</button>
      <button class="modal-btn-primary">${isEdicao ? "Salvar" : "Criar"}</button>
    </div>
  `;

  modal.querySelector(".modal-btn-secondary").onclick = () => overlay.remove();

  // Popular select de unidades
  const selectUnidade = modal.querySelector("#unidade");
  DataStore.state.data.unidades
    .filter(u => u.ativa !== false)
    .forEach(u => {
      const option = document.createElement("option");
      option.value = u.id;
      option.textContent = u.nome;
      if (turmaExistente?.unidade_id === u.id) option.selected = true;
      selectUnidade.appendChild(option);
    });

  // Popular select de professores
  const selectProfessor = modal.querySelector("#professor");
  DataStore.state.data.professores
    .filter(p => p.ativo !== false && p.funcao === "Professor")
    .forEach(prof => {
      const option = document.createElement("option");
      option.value = prof.id;
      option.textContent = prof.nome;
      if (turmaExistente?.professor_id === prof.id) option.selected = true;
      selectProfessor.appendChild(option);
    });

  // Popular select de monitores
  const selectMonitores = modal.querySelector("#monitores");
  DataStore.state.data.professores
    .filter(p => p.ativo !== false && p.funcao === "Monitor")
    .forEach(mon => {
      const option = document.createElement("option");
      option.value = mon.id;
      option.textContent = mon.nome;
      if (turmaExistente?.monitores_ids?.includes(mon.id)) option.selected = true;
      selectMonitores.appendChild(option);
    });

  modal.querySelector(".modal-btn-primary").onclick = () => {
    const monitoresSelecionados = Array.from(selectMonitores.selectedOptions).map(o => o.value);

    const dados = {
      nome: modal.querySelector("#nome").value,
      nivel: modal.querySelector("#nivel").value,
      unidade_id: selectUnidade.value,
      unidade: selectUnidade.options[selectUnidade.selectedIndex]?.text || "",
      horario: modal.querySelector("#horario").value,
      professor_id: selectProfessor.value || null,
      monitores_ids: monitoresSelecionados,
      descricao: modal.querySelector("#descricao").value,
    };

    if (!dados.nome) {
      alert("Nome é obrigatório!");
      return;
    }

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
   UNIDADES
========================= */

/** Renderiza página de unidades */
function renderUnidades() {
  const header = document.createElement("div");
  header.style.cssText = "margin-bottom: 1.5rem;";

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.textContent = "+ Nova Unidade";
  btn.onclick = () => abrirModalUnidade();
  header.appendChild(btn);

  UI.content.appendChild(header);

  const unidades = DataStore.state.data.unidades.filter(u => u.ativa !== false);

  if (unidades.length === 0) {
    UI.content.innerHTML += '<p style="color: #64748b;">Nenhuma unidade cadastrada.</p>';
    return;
  }

  const grid = criarGridCards();

  unidades.forEach(unidade => {
    const turmasVinculadas = DataStore.state.data.turmas
      .filter(t => t.ativa !== false && t.unidade_id === unidade.id)
      .length;

    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `
      <strong style="font-size: 1.1rem;">${unidade.nome}</strong>
      <p style="margin: 0.5rem 0; color: #64748b; font-size: 0.9rem;">
        📍 ${unidade.endereco || "Endereço não informado"}<br>
        🎓 ${turmasVinculadas} turma(s) vinculada(s)
      </p>
      <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;"></div>
    `;

    const acoes = card.querySelector("div:last-child");

    const btnEditar = document.createElement("button");
    btnEditar.className = "btn-secondary";
    btnEditar.textContent = "Editar";
    btnEditar.onclick = () => abrirModalUnidade(unidade);
    acoes.appendChild(btnEditar);

    const btnExcluir = document.createElement("button");
    btnExcluir.className = "btn-secondary";
    btnExcluir.textContent = "Excluir";
    btnExcluir.onclick = () => {
      if (confirm("Mover unidade para lixeira?")) {
        unidade.ativa = false;
        DataStore.moverParaLixeira("unidades", unidade);
        UI.navigate("unidades");
      }
    };
    acoes.appendChild(btnExcluir);

    grid.appendChild(card);
  });

  UI.content.appendChild(grid);
}

/** Modal para criar/editar unidade */
function abrirModalUnidade(unidadeExistente = null) {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";

  const isEdicao = !!unidadeExistente;

  modal.innerHTML = `
    <h2 class="modal-title">${isEdicao ? "Editar Unidade" : "Nova Unidade"}</h2>

    <div class="modal-grid">
      <div class="field">
        <label>Nome *</label>
        <input id="nome" placeholder="Nome da unidade" value="${unidadeExistente?.nome || ""}">
      </div>

      <div class="field">
        <label>Endereço</label>
        <input id="endereco" placeholder="Endereço (opcional)" value="${unidadeExistente?.endereco || ""}">
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
      endereco: modal.querySelector("#endereco").value,
    };

    if (!dados.nome) {
      alert("Nome é obrigatório!");
      return;
    }

    if (isEdicao) {
      Object.assign(unidadeExistente, dados);
    } else {
      DataStore.state.data.unidades.push({
        id: crypto.randomUUID(),
        ...dados,
        ativa: true,
      });
    }

    DataStore.save();
    overlay.remove();
    UI.navigate("unidades");
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
  header.style.cssText = "margin-bottom: 1.5rem;";

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.textContent = "+ Novo Professor/Monitor";
  btn.onclick = () => abrirModalProfessor();
  header.appendChild(btn);

  UI.content.appendChild(header);

  const professores = DataStore.state.data.professores.filter(p => p.ativo !== false);

  if (professores.length === 0) {
    UI.content.innerHTML += '<p style="color: #64748b;">Nenhum professor cadastrado.</p>';
    return;
  }

  const grid = criarGridCards();

  professores.forEach(prof => {
    const turmasVinculadas = DataStore.state.data.turmas
      .filter(t => t.ativa !== false && (t.professor_id === prof.id || t.monitores_ids?.includes(prof.id)))
      .map(t => t.nome)
      .join(", ");

    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <strong style="font-size: 1.1rem;">${prof.nome}</strong>
        <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; background: ${prof.funcao === "Professor" ? "#dbeafe" : "#fef9c3"}; color: ${prof.funcao === "Professor" ? "#1d4ed8" : "#a16207"};">
          ${prof.funcao || "Professor"}
        </span>
      </div>
      <p style="margin: 0.5rem 0; color: #64748b; font-size: 0.9rem;">
        📞 ${prof.telefone || "Não informado"}<br>
        🎓 Turmas: ${turmasVinculadas || "Nenhuma"}
      </p>
      <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;"></div>
    `;

    const acoes = card.querySelector("div:last-child");

    const btnEditar = document.createElement("button");
    btnEditar.className = "btn-secondary";
    btnEditar.textContent = "Editar";
    btnEditar.onclick = () => abrirModalProfessor(prof);
    acoes.appendChild(btnEditar);

    const btnExcluir = document.createElement("button");
    btnExcluir.className = "btn-secondary";
    btnExcluir.textContent = "Excluir";
    btnExcluir.onclick = () => {
      if (confirm("Mover para lixeira?")) {
        prof.ativo = false;
        DataStore.moverParaLixeira("professores", prof);
        UI.navigate("professores");
      }
    };
    acoes.appendChild(btnExcluir);

    grid.appendChild(card);
  });

  UI.content.appendChild(grid);
}

/** Modal para criar/editar professor */
function abrirModalProfessor(profExistente = null) {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";

  const isEdicao = !!profExistente;

  modal.innerHTML = `
    <h2 class="modal-title">${isEdicao ? "Editar" : "Novo Professor/Monitor"}</h2>

    <div class="modal-grid">
      <div class="field">
        <label>Nome *</label>
        <input id="nome" value="${profExistente?.nome || ""}">
      </div>

      <div class="field">
        <label>Função *</label>
        <select id="funcao">
          <option value="Professor" ${profExistente?.funcao === "Professor" ? "selected" : ""}>Professor</option>
          <option value="Monitor" ${profExistente?.funcao === "Monitor" ? "selected" : ""}>Monitor</option>
        </select>
      </div>

      <div class="field">
        <label>Telefone</label>
        <input id="telefone" placeholder="(00) 00000-0000" value="${profExistente?.telefone || ""}">
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
      funcao: modal.querySelector("#funcao").value,
      telefone: modal.querySelector("#telefone").value,
    };

    if (!dados.nome) {
      alert("Nome é obrigatório!");
      return;
    }

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
   MENSALIDADES
========================= */

/** Renderiza página de mensalidades */
function renderMensalidades() {
  const header = document.createElement("div");
  header.style.cssText = "margin-bottom: 1.5rem; display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;";

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.textContent = "+ Registrar Mensalidade";
  btn.onclick = () => abrirModalMensalidade();
  header.appendChild(btn);

  // Filtro por status
  const selectStatus = document.createElement("select");
  selectStatus.style.padding = "0.5rem";
  selectStatus.innerHTML = `
    <option value="todos">Todos</option>
    <option value="pendente">Pendentes</option>
    <option value="paga">Pagas</option>
  `;
  selectStatus.onchange = () => renderCardsMensalidades(selectStatus.value);
  header.appendChild(selectStatus);

  UI.content.appendChild(header);

  const container = document.createElement("div");
  container.id = "mensalidades-container";
  UI.content.appendChild(container);

  renderCardsMensalidades("todos");
}

/** Renderiza cards de mensalidades */
function renderCardsMensalidades(statusFiltro) {
  const container = document.getElementById("mensalidades-container");
  container.innerHTML = "";

  let mensalidades = [...DataStore.state.data.mensalidades];

  if (statusFiltro !== "todos") {
    mensalidades = mensalidades.filter(m => m.status === statusFiltro);
  }

  // Ordenar por data (mais recentes primeiro)
  mensalidades.sort((a, b) => {
    const dataA = `${a.ano}-${a.mes}`;
    const dataB = `${b.ano}-${b.mes}`;
    return dataB.localeCompare(dataA);
  });

  if (mensalidades.length === 0) {
    container.innerHTML = '<p style="color: #64748b;">Nenhuma mensalidade encontrada.</p>';
    return;
  }

  const grid = criarGridCards();

  mensalidades.forEach(mens => {
    const aluno = DataStore.findById("alunos", mens.aluno_id);
    const isPaga = mens.status === "paga";

    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <strong style="font-size: 1.1rem;">${aluno?.nome || "Aluno não encontrado"}</strong>
        <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; background: ${isPaga ? "#f0fdf4" : "#fef2f2"}; color: ${isPaga ? "#16a34a" : "#dc2626"};">
          ${isPaga ? "Paga" : "Pendente"}
        </span>
      </div>
      <p style="margin: 0.5rem 0; color: #64748b; font-size: 0.9rem;">
        📅 Competência: ${mens.mes}/${mens.ano}<br>
        💰 Valor: ${formatarReais(mens.valor)}<br>
        💳 Forma: ${mens.forma_pagamento || "-"}
      </p>
      <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap;"></div>
    `;

    const acoes = card.querySelector("div:last-child");

    if (!isPaga) {
      const btnPagar = document.createElement("button");
      btnPagar.className = "btn-primary";
      btnPagar.textContent = "Registrar Pagamento";
      btnPagar.onclick = () => abrirModalPagamento(mens);
      acoes.appendChild(btnPagar);
    }

    const btnEditar = document.createElement("button");
    btnEditar.className = "btn-secondary";
    btnEditar.textContent = "Editar";
    btnEditar.onclick = () => abrirModalMensalidade(mens);
    acoes.appendChild(btnEditar);

    grid.appendChild(card);
  });

  container.appendChild(grid);
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
          <option value="">Selecione</option>
        </select>
      </div>

      <div class="field">
        <label>Competência (Mês/Ano) *</label>
        <div style="display: flex; gap: 0.5rem;">
          <select id="mes" style="flex: 1;">
            ${["01","02","03","04","05","06","07","08","09","10","11","12"].map(m => 
              `<option value="${m}" ${(mensExistente?.mes || mesAtual) === m ? "selected" : ""}>${m}</option>`
            ).join("")}
          </select>
          <input id="ano" style="flex: 1;" value="${mensExistente?.ano || anoAtual}">
        </div>
      </div>

      <div class="field">
        <label>Valor (R$) *</label>
        <input id="valor" type="number" value="${mensExistente?.valor || ""}">
      </div>

      <div class="field">
        <label>Status</label>
        <select id="status">
          <option value="pendente" ${mensExistente?.status === "pendente" ? "selected" : ""}>Pendente</option>
          <option value="paga" ${mensExistente?.status === "paga" ? "selected" : ""}>Paga</option>
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

    if (!dados.aluno_id || !dados.valor) {
      alert("Aluno e valor são obrigatórios!");
      return;
    }

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

/** Modal para registrar pagamento */
function abrirModalPagamento(mensalidade) {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";

  const aluno = DataStore.findById("alunos", mensalidade.aluno_id);

  modal.innerHTML = `
    <h2 class="modal-title">Registrar Pagamento</h2>

    <p style="margin-bottom: 1rem;">
      <strong>Aluno:</strong> ${aluno?.nome || "-"}<br>
      <strong>Competência:</strong> ${mensalidade.mes}/${mensalidade.ano}<br>
      <strong>Valor:</strong> ${formatarReais(mensalidade.valor)}
    </p>

    <div class="field" style="margin-bottom: 1rem;">
      <label>Forma de Pagamento *</label>
      <select id="forma" style="width: 100%; padding: 0.5rem;">
        <option value="Pix">Pix</option>
        <option value="Dinheiro">Dinheiro</option>
        <option value="Cartão">Cartão</option>
        <option value="Transferência">Transferência</option>
      </select>
    </div>

    <div class="modal-actions">
      <button class="modal-btn-secondary">Cancelar</button>
      <button class="modal-btn-primary">Confirmar Pagamento</button>
    </div>
  `;

  modal.querySelector(".modal-btn-secondary").onclick = () => overlay.remove();

  modal.querySelector(".modal-btn-primary").onclick = () => {
    const formaPagamento = modal.querySelector("#forma").value;

    // Atualiza mensalidade
    mensalidade.status = "paga";
    mensalidade.forma_pagamento = formaPagamento;
    mensalidade.data_pagamento = new Date().toISOString();

    // Lança no caixa
    DataStore.state.data.caixa.push({
      id: crypto.randomUUID(),
      data: new Date().toISOString(),
      tipo: "mensalidade",
      aluno_id: mensalidade.aluno_id,
      aluno_nome: aluno?.nome || "N/A",
      valor: mensalidade.valor,
      forma_pagamento: formaPagamento,
      descricao: `Mensalidade ${mensalidade.mes}/${mensalidade.ano}`,
    });

    DataStore.save();
    overlay.remove();
    UI.navigate("mensalidades");
  };

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/* =========================
   CAIXA (FINANCEIRO)
========================= */

/** Renderiza página do caixa */
function renderCaixa() {
  const header = document.createElement("div");
  header.style.cssText = "margin-bottom: 1.5rem; display: flex; gap: 1rem; align-items: center;";

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.textContent = "+ Aula Avulsa";
  btn.onclick = () => abrirModalAulaAvulsa();
  header.appendChild(btn);

  UI.content.appendChild(header);

  // Resumo
  const total = DataStore.totalCaixa();
  const resumo = document.createElement("div");
  resumo.className = "summary-card";
  resumo.style.marginBottom = "1.5rem";
  resumo.innerHTML = `
    <span class="card-title">Total de Entradas</span>
    <span class="card-value">${formatarReais(total)}</span>
  `;
  UI.content.appendChild(resumo);

  // Lista de lançamentos
  const lancamentos = [...DataStore.state.data.caixa].sort((a, b) => 
    new Date(b.data) - new Date(a.data)
  );

  if (lancamentos.length === 0) {
    UI.content.innerHTML += '<p style="color: #64748b;">Nenhum lançamento registrado.</p>';
    return;
  }

  const grid = criarGridCards();

  lancamentos.forEach(lanc => {
    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <strong>${lanc.tipo === "mensalidade" ? "Mensalidade" : "Aula Avulsa"}</strong>
        <span style="color: #16a34a; font-weight: 600;">${formatarReais(lanc.valor)}</span>
      </div>
      <p style="margin: 0.5rem 0; color: #64748b; font-size: 0.9rem;">
        📅 ${formatarData(lanc.data)}<br>
        👤 ${lanc.aluno_nome || "-"}<br>
        💳 ${lanc.forma_pagamento || "-"}<br>
        ${lanc.descricao ? `📝 ${lanc.descricao}` : ""}
        ${lanc.telefone ? `<br>📞 ${lanc.telefone}` : ""}
      </p>
    `;
    grid.appendChild(card);
  });

  UI.content.appendChild(grid);
}

/** Modal para aula avulsa */
function abrirModalAulaAvulsa() {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";

  modal.innerHTML = `
    <h2 class="modal-title">Registrar Aula Avulsa</h2>

    <div class="modal-grid">
      <div class="field">
        <label>Nome do Aluno *</label>
        <input id="nome" placeholder="Nome completo">
      </div>

      <div class="field">
        <label>Telefone</label>
        <input id="telefone" placeholder="(00) 00000-0000">
      </div>

      <div class="field">
        <label>Data</label>
        <input id="data" type="date" value="${new Date().toISOString().split("T")[0]}">
      </div>

      <div class="field">
        <label>Valor (R$) *</label>
        <input id="valor" type="number" placeholder="0.00">
      </div>

      <div class="field">
        <label>Forma de Pagamento</label>
        <select id="forma">
          <option value="Pix">Pix</option>
          <option value="Dinheiro">Dinheiro</option>
          <option value="Cartão">Cartão</option>
        </select>
      </div>
    </div>

    <div class="modal-actions">
      <button class="modal-btn-secondary">Cancelar</button>
      <button class="modal-btn-primary">Registrar</button>
    </div>
  `;

  modal.querySelector(".modal-btn-secondary").onclick = () => overlay.remove();

  modal.querySelector(".modal-btn-primary").onclick = () => {
    const nome = modal.querySelector("#nome").value;
    const valor = Number(modal.querySelector("#valor").value);

    if (!nome || !valor) {
      alert("Nome e valor são obrigatórios!");
      return;
    }

    DataStore.state.data.caixa.push({
      id: crypto.randomUUID(),
      data: modal.querySelector("#data").value || new Date().toISOString(),
      tipo: "aula_avulsa",
      aluno_nome: nome,
      telefone: modal.querySelector("#telefone").value,
      valor: valor,
      forma_pagamento: modal.querySelector("#forma").value,
      descricao: "Aula avulsa",
    });

    DataStore.save();
    overlay.remove();
    UI.navigate("caixa");
  };

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/* =========================
   LIXEIRA
========================= */

/** Renderiza página da lixeira */
function renderLixeira() {
  const lixeira = DataStore.state.data.lixeira;

  if (lixeira.length === 0) {
    UI.content.innerHTML = `
      <div class="empty-state">
        <h3>Lixeira Vazia</h3>
        <p>Nenhum item excluído.</p>
      </div>
    `;
    return;
  }

  const grid = criarGridCards();

  lixeira.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <strong>${item.nome}</strong>
        <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; background: #f1f5f9; color: #64748b;">
          ${item._entidade}
        </span>
      </div>
      <p style="margin: 0.5rem 0; color: #64748b; font-size: 0.85rem;">
        Excluído em: ${formatarData(item._deletadoEm)}
      </p>
      <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;"></div>
    `;

    const acoes = card.querySelector("div:last-child");

    const btnRestaurar = document.createElement("button");
    btnRestaurar.className = "btn-primary";
    btnRestaurar.textContent = "Restaurar";
    btnRestaurar.onclick = () => {
      const entidade = item._entidade;
      const itemOriginal = DataStore.state.data[entidade].find(i => i.id === item.id);
      
      if (itemOriginal) {
        if (entidade === "turmas") {
          itemOriginal.ativa = true;
        } else {
          itemOriginal.ativo = true;
        }
      }

      DataStore.state.data.lixeira.splice(index, 1);
      DataStore.save();
      UI.navigate("lixeira");
    };
    acoes.appendChild(btnRestaurar);

    const btnExcluirDef = document.createElement("button");
    btnExcluirDef.className = "btn-secondary";
    btnExcluirDef.textContent = "Excluir Definitivo";
    btnExcluirDef.onclick = () => {
      if (confirm("Excluir permanentemente? Esta ação não pode ser desfeita.")) {
        // Remove da entidade original
        const entidade = item._entidade;
        const idx = DataStore.state.data[entidade].findIndex(i => i.id === item.id);
        if (idx !== -1) {
          DataStore.state.data[entidade].splice(idx, 1);
        }

        // Remove da lixeira
        DataStore.state.data.lixeira.splice(index, 1);
        DataStore.save();
        UI.navigate("lixeira");
      }
    };
    acoes.appendChild(btnExcluirDef);

    grid.appendChild(card);
  });

  UI.content.appendChild(grid);
}

/* =========================
   CONFIGURAÇÕES
========================= */

/** Renderiza página de configurações */
function renderConfig() {
  const config = DataStore.state.data.config || { nomeProjeto: "Bailado Carioca", observacoes: "" };

  const container = document.createElement("div");
  container.className = "summary-card";
  container.style.maxWidth = "600px";

  container.innerHTML = `
    <h3 style="margin-bottom: 1rem;">Configurações do Sistema</h3>

    <div class="field" style="margin-bottom: 1rem;">
      <label>Nome do Projeto</label>
      <input id="nomeProjeto" style="width: 100%; padding: 0.5rem;" value="${config.nomeProjeto || ""}">
    </div>

    <div class="field" style="margin-bottom: 1rem;">
      <label>Observações Gerais</label>
      <textarea id="observacoes" style="width: 100%; padding: 0.5rem; min-height: 100px; border: 1px solid #d1d5db; border-radius: 6px;">${config.observacoes || ""}</textarea>
    </div>

    <button class="btn-primary" id="btnSalvarConfig">Salvar Configurações</button>
    <span id="msgSalvo" style="margin-left: 1rem; color: #16a34a; display: none;">Salvo com sucesso!</span>
  `;

  container.querySelector("#btnSalvarConfig").onclick = () => {
    DataStore.state.data.config = {
      nomeProjeto: container.querySelector("#nomeProjeto").value,
      observacoes: container.querySelector("#observacoes").value,
    };
    DataStore.save();

    const msg = container.querySelector("#msgSalvo");
    msg.style.display = "inline";
    setTimeout(() => msg.style.display = "none", 2000);
  };

  UI.content.appendChild(container);
}

/* =========================
   START
========================= */
document.addEventListener("DOMContentLoaded", () => UI.init());
