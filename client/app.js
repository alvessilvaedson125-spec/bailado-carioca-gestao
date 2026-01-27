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
      mensalidades: [],
      recibos: [],
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

  /** Calcula total de entradas no caixa */
  totalEntradas() {
    return this.state.data.caixa
      .filter(c => c.tipo === "entrada")
      .reduce((sum, c) => sum + (c.valor || 0), 0);
  },

  /** Calcula total de saídas no caixa */
  totalSaidas() {
    return this.state.data.caixa
      .filter(c => c.tipo === "saida")
      .reduce((sum, c) => sum + (c.valor || 0), 0);
  },

  /** Calcula saldo atual */
  saldoAtual() {
    return this.totalEntradas() - this.totalSaidas();
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
      ["recibos", "Recibos"],
      ["caixa", "Caixa"],
      ["relatorio", "Relatorio Mensal"],
      ["lixeira", "Lixeira"],
      ["config", "Configuracoes"],
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
      recibos: "Recibos",
      caixa: "Caixa",
      relatorio: "Relatorio Mensal",
      lixeira: "Lixeira",
      config: "Configuracoes",
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

/** Gera número do recibo */
function gerarNumeroRecibo() {
  const num = DataStore.state.data.recibos.length + 1;
  return String(num).padStart(5, "0");
}

/** Template do recibo - texto gerado dinamicamente */
function gerarTextoRecibo(recibo) {
  const config = DataStore.state.data.config || {};
  const nomeAluno = recibo.nomeAluno || recibo.aluno_nome || "N/A";
  const descricao = recibo.descricaoServico || recibo.competencia || "servico";
  const formaPgto = recibo.formaPagamento || recibo.forma_pagamento || "N/A";
  const nomeRecebedor = config.nomeRecebedor || "Edson Silva";
  const cnpj = config.cnpj || "";
  const nomeProjeto = config.nomeProjeto || "Bailado Carioca";
  
  return `RECIBO

Recebi de ${nomeAluno} a quantia de ${formatarReais(recibo.valor)},
referente a ${descricao}.

Forma de pagamento: ${formaPgto}
Data do pagamento: ${formatarData(recibo.data)}

Declaro que o valor acima foi recebido e dou plena quitacao.

Recebedor:
${nomeRecebedor}${cnpj ? `\nCNPJ: ${cnpj}` : ""}

${nomeProjeto}`;
}

/** Formata telefone para WhatsApp (remove caracteres especiais) */
function formatarTelefoneWhatsApp(telefone) {
  if (!telefone) return null;
  const numeros = telefone.replace(/\D/g, "");
  if (numeros.length >= 10) {
    return numeros.startsWith("55") ? numeros : "55" + numeros;
  }
  return null;
}

/** Gera link do WhatsApp com texto do recibo */
function gerarLinkWhatsApp(telefone, texto) {
  const telefoneFormatado = formatarTelefoneWhatsApp(telefone);
  const textoCodificado = encodeURIComponent(texto);
  if (telefoneFormatado) {
    return `https://wa.me/${telefoneFormatado}?text=${textoCodificado}`;
  }
  return null;
}

/** Gera e baixa PDF do recibo */
function gerarPDFRecibo(recibo) {
  const config = DataStore.state.data.config || {};
  const dataGeracao = new Date().toLocaleString("pt-BR");
  const nomeAluno = recibo.nomeAluno || recibo.aluno_nome || "N/A";
  const descricao = recibo.descricaoServico || recibo.competencia || "servico";
  const formaPgto = recibo.formaPagamento || recibo.forma_pagamento || "N/A";
  const nomeRecebedor = config.nomeRecebedor || "Edson Silva";
  const cnpj = config.cnpj || "";
  const nomeProjeto = config.nomeProjeto || "Bailado Carioca";
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Recibo #${recibo.numero}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: Georgia, 'Times New Roman', serif; 
          padding: 60px; 
          max-width: 600px; 
          margin: 0 auto;
          line-height: 1.8;
          color: #1a1a1a;
        }
        .header { 
          text-align: center; 
          margin-bottom: 40px;
          border-bottom: 2px solid #333;
          padding-bottom: 20px;
        }
        .header h1 { 
          font-size: 28px; 
          letter-spacing: 4px;
          font-weight: normal;
        }
        .numero {
          font-size: 14px;
          color: #666;
          margin-top: 8px;
        }
        .body { 
          margin: 40px 0; 
          font-size: 16px;
          text-align: justify;
        }
        .body p { margin-bottom: 20px; }
        .recebedor {
          margin-top: 40px;
          text-align: center;
        }
        .recebedor .nome {
          font-weight: bold;
          font-size: 18px;
        }
        .recebedor .cnpj {
          font-size: 14px;
          color: #666;
          margin-top: 4px;
        }
        .assinatura {
          margin-top: 30px;
          text-align: center;
          font-weight: bold;
          font-size: 18px;
        }
        .footer { 
          margin-top: 60px; 
          text-align: center; 
          font-size: 11px; 
          color: #888;
          border-top: 1px solid #ddd;
          padding-top: 20px;
        }
        @media print {
          body { padding: 40px; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>RECIBO</h1>
        <div class="numero">N ${recibo.numero}</div>
      </div>
      <div class="body">
        <p>Recebi de <strong>${nomeAluno}</strong> a quantia de <strong>${formatarReais(recibo.valor)}</strong>, referente a ${descricao}.</p>
        <p><strong>Forma de pagamento:</strong> ${formaPgto}</p>
        <p><strong>Data do pagamento:</strong> ${formatarData(recibo.data)}</p>
        <p>Declaro que o valor acima foi recebido e dou plena quitacao.</p>
      </div>
      <div class="recebedor">
        <div>Recebedor:</div>
        <div class="nome">${nomeRecebedor}</div>
        ${cnpj ? `<div class="cnpj">CNPJ: ${cnpj}</div>` : ""}
      </div>
      <div class="assinatura">${nomeProjeto}</div>
      <div class="footer">Gerado em ${dataGeracao}</div>
    </body>
    </html>
  `;
  
  const printWindow = window.open("", "_blank", "width=650,height=800");
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 300);
}

/** Copia texto para área de transferência */
function copiarTexto(texto) {
  navigator.clipboard.writeText(texto).then(() => {
    alert("Texto copiado!");
  }).catch(() => {
    const textarea = document.createElement("textarea");
    textarea.value = texto;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    alert("Texto copiado!");
  });
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
      ["Saldo Atual", formatarReais(DataStore.saldoAtual())],
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

  recibos() {
    renderRecibos();
  },

  caixa() {
    renderCaixa();
  },

  relatorio() {
    renderRelatorio();
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

  const selectStatus = document.createElement("select");
  selectStatus.style.padding = "0.5rem";
  selectStatus.innerHTML = `
    <option value="todos">Todos os Status</option>
    <option value="ativo">Ativos</option>
    <option value="trancado">Trancados</option>
  `;
  selectStatus.onchange = () => renderCardsAlunos(selectStatus.value, inputBusca.value);
  header.appendChild(selectStatus);

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
        🏢 ${unidade?.nome || turma?.unidade || aluno.unidade || "-"}<br>
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
  const turmaAtual = alunoExistente ? DataStore.findById("turmas", alunoExistente.turma) : null;
  const unidadeAtual = turmaAtual ? DataStore.findById("unidades", turmaAtual.unidade_id) : null;

  modal.innerHTML = `
    <h2 class="modal-title">${isEdicao ? "Editar Aluno" : "Novo Aluno"}</h2>

    <div class="modal-grid">
      <div class="field">
        <label>Nome *</label>
        <input id="nome" placeholder="Nome completo" value="${alunoExistente?.nome || ""}">
      </div>

      <div class="field">
        <label>Telefone *</label>
        <input id="telefone" placeholder="(00) 00000-0000" value="${alunoExistente?.telefone || ""}">
      </div>

      <div class="field">
        <label>Turma *</label>
        <select id="turma">
          <option value="">Selecione uma turma</option>
        </select>
      </div>

      <div class="field">
        <label>Unidade</label>
        <input id="unidade" readonly style="background: #f1f5f9;" value="${unidadeAtual?.nome || turmaAtual?.unidade || ""}">
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
  const inputUnidade = modal.querySelector("#unidade");

  // Popular select de turmas
  DataStore.state.data.turmas
    .filter(t => t.ativa !== false)
    .forEach(turma => {
      const option = document.createElement("option");
      option.value = turma.id;
      option.textContent = `${turma.nome} (${turma.nivel})`;
      if (alunoExistente?.turma === turma.id) option.selected = true;
      selectTurma.appendChild(option);
    });

  // Atualizar unidade ao mudar turma
  selectTurma.onchange = () => {
    const turmaId = selectTurma.value;
    const turma = DataStore.findById("turmas", turmaId);
    const unidade = turma ? DataStore.findById("unidades", turma.unidade_id) : null;
    inputUnidade.value = unidade?.nome || turma?.unidade || "";
  };

  modal.querySelector(".modal-btn-primary").onclick = () => {
    const nome = modal.querySelector("#nome").value;
    const telefone = modal.querySelector("#telefone").value;
    const turmaId = selectTurma.value;

    if (!nome) {
      alert("Nome é obrigatório!");
      return;
    }
    if (!telefone) {
      alert("Telefone é obrigatório!");
      return;
    }
    if (!turmaId) {
      alert("Selecione uma turma!");
      return;
    }

    const dados = {
      nome: nome,
      telefone: telefone,
      turma: turmaId,
      unidade: inputUnidade.value,
      tipo: modal.querySelector("#tipo").value,
      mensalidade: Number(modal.querySelector("#mensalidade").value),
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

/** Renderiza página de turmas em cards */
function renderTurmas() {
  const header = document.createElement("div");
  header.style.cssText = "margin-bottom: 1.5rem; display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;";

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.textContent = "+ Nova Turma";
  btn.onclick = () => abrirModalTurma();
  header.appendChild(btn);

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
    turmas = turmas.filter(t => t.unidade_id === unidadeFiltro);
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
    
    const alunosMatriculados = DataStore.state.data.alunos
      .filter(a => a.ativo !== false && a.turma === turma.id);
    
    const listaAlunosHtml = alunosMatriculados.length > 0
      ? alunosMatriculados.map(a => {
          const tipoMatricula = a.tipoMatricula || "Normal";
          return `<li style="padding: 2px 0;">${a.nome} <span style="color: #94a3b8; font-size: 0.8rem;">(${tipoMatricula})</span></li>`;
        }).join("")
      : '<li style="color: #94a3b8;">Nenhum aluno matriculado</li>';

    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <strong style="font-size: 1.1rem;">${turma.nome}</strong>
        <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; background: #f0fdf4; color: #16a34a;">Ativa</span>
      </div>
      <p style="margin: 0.5rem 0; color: #64748b; font-size: 0.9rem;">
        Nivel: ${turma.nivel}<br>
        Unidade: ${unidade?.nome || turma.unidade || "-"}<br>
        Horario: ${turma.horario || "-"}<br>
        Professor: ${professor?.nome || "-"}<br>
        Monitores: ${monitoresNomes || "-"}
      </p>
      <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0;">
        <strong style="font-size: 0.9rem;">Alunos Matriculados (${alunosMatriculados.length}):</strong>
        <ul style="margin: 0.5rem 0 0 1rem; padding: 0; list-style: disc; color: #475569; font-size: 0.85rem;">
          ${listaAlunosHtml}
        </ul>
      </div>
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
        <label>Unidade *</label>
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
    const nome = modal.querySelector("#nome").value;
    const unidadeId = selectUnidade.value;

    if (!nome) {
      alert("Nome é obrigatório!");
      return;
    }
    if (!unidadeId) {
      alert("Selecione uma unidade!");
      return;
    }

    const unidade = DataStore.findById("unidades", unidadeId);
    const monitoresSelecionados = Array.from(selectMonitores.selectedOptions).map(o => o.value);

    const dados = {
      nome: nome,
      nivel: modal.querySelector("#nivel").value,
      unidade_id: unidadeId,
      unidade: unidade?.nome || "",
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

  const container = document.createElement("div");
  container.id = "unidades-container";
  UI.content.appendChild(container);

  renderCardsUnidades();
}

/** Renderiza cards de unidades */
function renderCardsUnidades() {
  const container = document.getElementById("unidades-container");
  container.innerHTML = "";

  const unidades = DataStore.state.data.unidades.filter(u => u.ativa !== false);

  if (unidades.length === 0) {
    container.innerHTML = '<p style="color: #64748b;">Nenhuma unidade cadastrada.</p>';
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

  container.appendChild(grid);
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
    const nome = modal.querySelector("#nome").value;

    if (!nome) {
      alert("Nome é obrigatório!");
      return;
    }

    const dados = {
      nome: nome,
      endereco: modal.querySelector("#endereco").value,
    };

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

  const container = document.createElement("div");
  container.id = "professores-container";
  UI.content.appendChild(container);

  renderCardsProfessores();
}

/** Renderiza cards de professores */
function renderCardsProfessores() {
  const container = document.getElementById("professores-container");
  container.innerHTML = "";

  const professores = DataStore.state.data.professores.filter(p => p.ativo !== false);

  if (professores.length === 0) {
    container.innerHTML = '<p style="color: #64748b;">Nenhum professor cadastrado.</p>';
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

  container.appendChild(grid);
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
    const nome = modal.querySelector("#nome").value;

    if (!nome) {
      alert("Nome é obrigatório!");
      return;
    }

    const dados = {
      nome: nome,
      funcao: modal.querySelector("#funcao").value,
      telefone: modal.querySelector("#telefone").value,
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
        <label>Competência (MM/AAAA) *</label>
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
    const alunoId = selectAluno.value;
    const valor = Number(modal.querySelector("#valor").value);

    if (!alunoId) {
      alert("Selecione um aluno!");
      return;
    }
    if (!valor) {
      alert("Informe o valor!");
      return;
    }

    const dados = {
      aluno_id: alunoId,
      mes: modal.querySelector("#mes").value,
      ano: modal.querySelector("#ano").value,
      valor: valor,
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
        <option value="Cartao">Cartao</option>
        <option value="Transferencia">Transferencia</option>
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
    const dataAtual = new Date().toISOString();
    const numeroRecibo = gerarNumeroRecibo();

    mensalidade.status = "paga";
    mensalidade.forma_pagamento = formaPagamento;
    mensalidade.data_pagamento = dataAtual;

    const turma = aluno ? DataStore.findById("turmas", aluno.turma) : null;
    const descricaoServico = turma 
      ? `mensalidade da turma ${turma.nome} (${turma.nivel})`
      : `mensalidade de ${mensalidade.mes}/${mensalidade.ano}`;

    const reciboData = {
      id: crypto.randomUUID(),
      numero: numeroRecibo,
      pagamentoId: mensalidade.id,
      nomeAluno: aluno?.nome || "N/A",
      telefoneAluno: aluno?.telefone || "",
      valor: mensalidade.valor,
      descricaoServico: descricaoServico,
      formaPagamento: formaPagamento,
      data: dataAtual,
      tipo: "mensalidade",
    };

    DataStore.state.data.recibos.push(reciboData);

    DataStore.state.data.caixa.push({
      id: crypto.randomUUID(),
      data: dataAtual,
      tipo: "entrada",
      descricao: `Mensalidade ${mensalidade.mes}/${mensalidade.ano} - ${aluno?.nome || "N/A"}`,
      aluno_id: mensalidade.aluno_id,
      aluno_nome: aluno?.nome || "N/A",
      valor: mensalidade.valor,
      forma_pagamento: formaPagamento,
    });

    DataStore.save();
    overlay.remove();
    
    abrirModalReciboGerado(reciboData);
  };

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/** Modal exibido apos gerar recibo com opcoes de compartilhar */
function abrirModalReciboGerado(recibo) {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";
  modal.style.maxWidth = "500px";

  const textoRecibo = gerarTextoRecibo(recibo);
  const linkWhatsApp = gerarLinkWhatsApp(recibo.telefoneAluno, textoRecibo);

  modal.innerHTML = `
    <h2 class="modal-title" style="color: #16a34a;">Pagamento Registrado!</h2>
    
    <div style="background: #f8fafc; padding: 1.25rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #16a34a;">
      <p style="font-size: 0.85rem; color: #374151; white-space: pre-line; line-height: 1.6;">${textoRecibo}</p>
    </div>

    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      <button class="btn-primary" id="btn-pdf" style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
        <span>Baixar PDF</span>
      </button>
      
      ${linkWhatsApp ? `
        <button class="btn-secondary" id="btn-whatsapp" style="background: #25D366; color: white; border: none; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
          <span>Enviar WhatsApp</span>
        </button>
      ` : ""}
      
      <button class="btn-secondary" id="btn-copiar" style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
        <span>Copiar Texto</span>
      </button>
    </div>

    <div class="modal-actions" style="margin-top: 1.5rem;">
      <button class="modal-btn-secondary">Fechar</button>
    </div>
  `;

  modal.querySelector("#btn-pdf").onclick = () => gerarPDFRecibo(recibo);
  
  if (linkWhatsApp) {
    modal.querySelector("#btn-whatsapp").onclick = () => window.open(linkWhatsApp, "_blank");
  }
  
  modal.querySelector("#btn-copiar").onclick = () => copiarTexto(textoRecibo);
  
  modal.querySelector(".modal-btn-secondary").onclick = () => {
    overlay.remove();
    UI.navigate("mensalidades");
  };

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/* =========================
   RECIBOS
========================= */

/** Renderiza página de recibos */
function renderRecibos() {
  const header = document.createElement("div");
  header.style.cssText = "display: flex; gap: 1rem; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap;";

  const selectFiltro = document.createElement("select");
  selectFiltro.id = "filtro-tipo-recibo";
  selectFiltro.className = "btn-secondary";
  selectFiltro.style.cssText = "padding: 0.5rem 1rem; min-width: 150px;";
  selectFiltro.innerHTML = `
    <option value="">Todos os tipos</option>
    <option value="mensalidade">Mensalidades</option>
    <option value="aula_avulsa">Aulas Avulsas</option>
  `;
  selectFiltro.onchange = () => renderCardsRecibos(selectFiltro.value);
  header.appendChild(selectFiltro);

  UI.content.appendChild(header);

  const container = document.createElement("div");
  container.id = "recibos-container";
  UI.content.appendChild(container);

  renderCardsRecibos("");
}

/** Renderiza cards de recibos com filtro */
function renderCardsRecibos(filtroTipo) {
  const container = document.getElementById("recibos-container");
  container.innerHTML = "";

  let recibos = [...DataStore.state.data.recibos].sort((a, b) => 
    new Date(b.data) - new Date(a.data)
  );

  if (filtroTipo) {
    recibos = recibos.filter(r => r.tipo === filtroTipo);
  }

  if (recibos.length === 0) {
    container.innerHTML = '<p style="color: #64748b;">Nenhum recibo encontrado.</p>';
    return;
  }

  const grid = criarGridCards();

  recibos.forEach(recibo => {
    const tipoLabel = recibo.tipo === "aula_avulsa" ? "Aula Avulsa" : "Mensalidade";
    const nomeAluno = recibo.nomeAluno || recibo.aluno_nome || "N/A";
    const descricao = recibo.descricaoServico || recibo.competencia || "servico";
    const formaPgto = recibo.formaPagamento || recibo.forma_pagamento || "N/A";
    const telefone = recibo.telefoneAluno || "";
    
    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <strong style="font-size: 1.1rem;">Recibo #${recibo.numero}</strong>
        <span style="color: #16a34a; font-weight: 600;">${formatarReais(recibo.valor)}</span>
      </div>
      <p style="margin: 0.5rem 0; color: #64748b; font-size: 0.9rem;">
        <span style="display: inline-block; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: ${recibo.tipo === "aula_avulsa" ? "#fef9c3" : "#dbeafe"}; color: ${recibo.tipo === "aula_avulsa" ? "#a16207" : "#1d4ed8"}; margin-bottom: 4px;">${tipoLabel}</span><br>
        ${nomeAluno}<br>
        ${descricao}<br>
        ${formaPgto} - ${formatarData(recibo.data)}
      </p>
      <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap;"></div>
    `;

    const acoes = card.querySelector("div:last-child");

    const btnVer = document.createElement("button");
    btnVer.className = "btn-secondary";
    btnVer.textContent = "Ver Recibo";
    btnVer.onclick = () => exibirRecibo(recibo);
    acoes.appendChild(btnVer);

    const btnPDF = document.createElement("button");
    btnPDF.className = "btn-secondary";
    btnPDF.textContent = "PDF";
    btnPDF.onclick = () => gerarPDFRecibo(recibo);
    acoes.appendChild(btnPDF);

    const linkWA = gerarLinkWhatsApp(telefone, gerarTextoRecibo(recibo));
    if (linkWA) {
      const btnWA = document.createElement("button");
      btnWA.className = "btn-secondary";
      btnWA.style.background = "#25D366";
      btnWA.style.color = "white";
      btnWA.style.border = "none";
      btnWA.textContent = "WhatsApp";
      btnWA.onclick = () => window.open(linkWA, "_blank");
      acoes.appendChild(btnWA);
    }

    grid.appendChild(card);
  });

  container.appendChild(grid);
}

/** Exibe recibo em modal */
function exibirRecibo(recibo) {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";
  modal.style.maxWidth = "500px";

  const textoRecibo = gerarTextoRecibo(recibo);
  const linkWhatsApp = gerarLinkWhatsApp(recibo.telefoneAluno, textoRecibo);

  modal.innerHTML = `
    <h2 class="modal-title">Recibo #${recibo.numero}</h2>
    
    <div style="background: #f8fafc; padding: 1.25rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #3b82f6;">
      <p style="font-size: 0.85rem; color: #374151; white-space: pre-line; line-height: 1.6;">${textoRecibo}</p>
    </div>

    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      <button class="btn-primary" id="btn-pdf">Baixar PDF</button>
      
      ${linkWhatsApp ? `
        <button class="btn-secondary" id="btn-whatsapp" style="background: #25D366; color: white; border: none;">Enviar WhatsApp</button>
      ` : ""}
      
      <button class="btn-secondary" id="btn-copiar">Copiar Texto</button>
    </div>

    <div class="modal-actions" style="margin-top: 1.5rem;">
      <button class="modal-btn-secondary">Fechar</button>
    </div>
  `;

  modal.querySelector("#btn-pdf").onclick = () => gerarPDFRecibo(recibo);
  
  if (linkWhatsApp) {
    modal.querySelector("#btn-whatsapp").onclick = () => window.open(linkWhatsApp, "_blank");
  }
  
  modal.querySelector("#btn-copiar").onclick = () => copiarTexto(textoRecibo);
  
  modal.querySelector(".modal-btn-secondary").onclick = () => overlay.remove();

  modal.querySelector(".modal-btn-secondary").onclick = () => overlay.remove();

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/* =========================
   CAIXA (FINANCEIRO)
========================= */

/** Renderiza página do caixa */
function renderCaixa() {
  const header = document.createElement("div");
  header.style.cssText = "margin-bottom: 1.5rem; display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;";

  const btnEntrada = document.createElement("button");
  btnEntrada.className = "btn-primary";
  btnEntrada.textContent = "+ Entrada";
  btnEntrada.onclick = () => abrirModalCaixa("entrada");
  header.appendChild(btnEntrada);

  const btnSaida = document.createElement("button");
  btnSaida.className = "btn-secondary";
  btnSaida.style.background = "#fef2f2";
  btnSaida.style.color = "#dc2626";
  btnSaida.textContent = "- Saída";
  btnSaida.onclick = () => abrirModalCaixa("saida");
  header.appendChild(btnSaida);

  const btnAula = document.createElement("button");
  btnAula.className = "btn-secondary";
  btnAula.textContent = "Aula Avulsa";
  btnAula.onclick = () => abrirModalAulaAvulsa();
  header.appendChild(btnAula);

  UI.content.appendChild(header);

  // Resumo financeiro
  const totalEntradas = DataStore.totalEntradas();
  const totalSaidas = DataStore.totalSaidas();
  const saldo = DataStore.saldoAtual();

  const resumoGrid = document.createElement("div");
  resumoGrid.className = "dashboard-cards";
  resumoGrid.style.marginBottom = "1.5rem";
  resumoGrid.innerHTML = `
    <div class="summary-card">
      <span class="card-title">Total Entradas</span>
      <span class="card-value" style="color: #16a34a;">${formatarReais(totalEntradas)}</span>
    </div>
    <div class="summary-card">
      <span class="card-title">Total Saídas</span>
      <span class="card-value" style="color: #dc2626;">${formatarReais(totalSaidas)}</span>
    </div>
    <div class="summary-card">
      <span class="card-title">Saldo Atual</span>
      <span class="card-value" style="color: ${saldo >= 0 ? "#16a34a" : "#dc2626"};">${formatarReais(saldo)}</span>
    </div>
  `;
  UI.content.appendChild(resumoGrid);

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
    const isEntrada = lanc.tipo === "entrada";

    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <strong>${lanc.descricao || (isEntrada ? "Entrada" : "Saída")}</strong>
        <span style="color: ${isEntrada ? "#16a34a" : "#dc2626"}; font-weight: 600;">
          ${isEntrada ? "+" : "-"}${formatarReais(lanc.valor)}
        </span>
      </div>
      <p style="margin: 0.5rem 0; color: #64748b; font-size: 0.9rem;">
        📅 ${formatarData(lanc.data)}<br>
        ${lanc.aluno_nome ? `👤 ${lanc.aluno_nome}<br>` : ""}
        💳 ${lanc.forma_pagamento || "-"}
        ${lanc.telefone ? `<br>📞 ${lanc.telefone}` : ""}
      </p>
    `;
    grid.appendChild(card);
  });

  UI.content.appendChild(grid);
}

/** Modal para entrada ou saída no caixa */
function abrirModalCaixa(tipo) {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";

  const isEntrada = tipo === "entrada";

  modal.innerHTML = `
    <h2 class="modal-title">${isEntrada ? "Nova Entrada" : "Nova Saída"}</h2>

    <div class="modal-grid">
      <div class="field">
        <label>Descrição *</label>
        <input id="descricao" placeholder="Descrição do lançamento">
      </div>

      <div class="field">
        <label>Valor (R$) *</label>
        <input id="valor" type="number" placeholder="0.00">
      </div>

      <div class="field">
        <label>Data</label>
        <input id="data" type="date" value="${new Date().toISOString().split("T")[0]}">
      </div>

      <div class="field">
        <label>Forma de Pagamento</label>
        <select id="forma">
          <option value="Pix">Pix</option>
          <option value="Dinheiro">Dinheiro</option>
          <option value="Cartão">Cartão</option>
          <option value="Transferência">Transferência</option>
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
    const descricao = modal.querySelector("#descricao").value;
    const valor = Number(modal.querySelector("#valor").value);

    if (!descricao) {
      alert("Descrição é obrigatória!");
      return;
    }
    if (!valor) {
      alert("Valor é obrigatório!");
      return;
    }

    DataStore.state.data.caixa.push({
      id: crypto.randomUUID(),
      data: modal.querySelector("#data").value || new Date().toISOString(),
      tipo: tipo,
      descricao: descricao,
      valor: valor,
      forma_pagamento: modal.querySelector("#forma").value,
    });

    DataStore.save();
    overlay.remove();
    UI.navigate("caixa");
  };

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
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
          <option value="Cartao">Cartao</option>
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
    const telefone = modal.querySelector("#telefone").value;
    const valor = Number(modal.querySelector("#valor").value);
    const formaPagamento = modal.querySelector("#forma").value;
    const dataInput = modal.querySelector("#data").value;
    const dataAtual = dataInput ? new Date(dataInput + "T12:00:00").toISOString() : new Date().toISOString();

    if (!nome) {
      alert("Nome e obrigatorio!");
      return;
    }
    if (!valor) {
      alert("Valor e obrigatorio!");
      return;
    }

    const caixaId = crypto.randomUUID();
    const numeroRecibo = gerarNumeroRecibo();

    DataStore.state.data.caixa.push({
      id: caixaId,
      data: dataAtual,
      tipo: "entrada",
      descricao: "Aula avulsa",
      aluno_nome: nome,
      telefone: telefone,
      valor: valor,
      forma_pagamento: formaPagamento,
    });

    const reciboData = {
      id: crypto.randomUUID(),
      numero: numeroRecibo,
      pagamentoId: caixaId,
      nomeAluno: nome,
      telefoneAluno: telefone,
      valor: valor,
      descricaoServico: "aula avulsa",
      formaPagamento: formaPagamento,
      data: dataAtual,
      tipo: "aula_avulsa",
    };

    DataStore.state.data.recibos.push(reciboData);
    DataStore.save();
    overlay.remove();

    abrirModalReciboGerado(reciboData);
  };

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/* =========================
   LIXEIRA
========================= */

/* =========================
   RELATORIO MENSAL
========================= */

/** Renderiza página de relatório mensal */
function renderRelatorio() {
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();

  const header = document.createElement("div");
  header.style.cssText = "display: flex; gap: 1rem; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap;";

  const labelMes = document.createElement("label");
  labelMes.textContent = "Mes: ";
  labelMes.style.fontWeight = "500";
  header.appendChild(labelMes);

  const selectMes = document.createElement("select");
  selectMes.id = "relatorio-mes";
  selectMes.className = "btn-secondary";
  selectMes.style.cssText = "padding: 0.5rem; min-width: 120px;";
  const meses = ["Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  meses.forEach((m, i) => {
    const opt = document.createElement("option");
    opt.value = i + 1;
    opt.textContent = m;
    if (i + 1 === mesAtual) opt.selected = true;
    selectMes.appendChild(opt);
  });
  header.appendChild(selectMes);

  const labelAno = document.createElement("label");
  labelAno.textContent = "Ano: ";
  labelAno.style.fontWeight = "500";
  labelAno.style.marginLeft = "1rem";
  header.appendChild(labelAno);

  const inputAno = document.createElement("input");
  inputAno.id = "relatorio-ano";
  inputAno.type = "number";
  inputAno.value = anoAtual;
  inputAno.style.cssText = "padding: 0.5rem; width: 80px; border: 1px solid #d1d5db; border-radius: 6px;";
  header.appendChild(inputAno);

  const btnGerar = document.createElement("button");
  btnGerar.className = "btn-primary";
  btnGerar.textContent = "Gerar Relatorio";
  btnGerar.style.marginLeft = "1rem";
  btnGerar.onclick = () => gerarRelatorioMensal(parseInt(selectMes.value), parseInt(inputAno.value));
  header.appendChild(btnGerar);

  UI.content.appendChild(header);

  const container = document.createElement("div");
  container.id = "relatorio-container";
  UI.content.appendChild(container);

  gerarRelatorioMensal(mesAtual, anoAtual);
}

/** Gera relatório mensal */
function gerarRelatorioMensal(mes, ano) {
  const container = document.getElementById("relatorio-container");
  container.innerHTML = "";

  const caixa = DataStore.state.data.caixa;
  const movimentosMes = caixa.filter(mov => {
    const data = new Date(mov.data);
    return data.getMonth() + 1 === mes && data.getFullYear() === ano;
  });

  const entradas = movimentosMes.filter(m => m.tipo === "entrada");
  const saidas = movimentosMes.filter(m => m.tipo === "saida");
  const totalEntradas = entradas.reduce((sum, m) => sum + (m.valor || 0), 0);
  const totalSaidas = saidas.reduce((sum, m) => sum + (m.valor || 0), 0);
  const saldo = totalEntradas - totalSaidas;

  const mensalidadesEntradas = entradas.filter(m => m.descricao && m.descricao.toLowerCase().includes("mensalidade"));
  const aulasAvulsas = entradas.filter(m => m.descricao && m.descricao.toLowerCase().includes("aula avulsa"));
  const outrasEntradas = entradas.filter(m => !m.descricao || (!m.descricao.toLowerCase().includes("mensalidade") && !m.descricao.toLowerCase().includes("aula avulsa")));

  const meses = ["","Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  const summaryCards = document.createElement("div");
  summaryCards.className = "dashboard-cards";
  summaryCards.innerHTML = `
    <div class="summary-card" style="border-left: 4px solid #16a34a;">
      <h4>Total de Entradas</h4>
      <p style="font-size: 1.5rem; font-weight: bold; color: #16a34a;">${formatarReais(totalEntradas)}</p>
    </div>
    <div class="summary-card" style="border-left: 4px solid #dc2626;">
      <h4>Total de Saidas</h4>
      <p style="font-size: 1.5rem; font-weight: bold; color: #dc2626;">${formatarReais(totalSaidas)}</p>
    </div>
    <div class="summary-card" style="border-left: 4px solid #3b82f6;">
      <h4>Saldo do Mes</h4>
      <p style="font-size: 1.5rem; font-weight: bold; color: ${saldo >= 0 ? "#16a34a" : "#dc2626"};">${formatarReais(saldo)}</p>
    </div>
  `;
  container.appendChild(summaryCards);

  const detalhes = document.createElement("div");
  detalhes.className = "summary-card";
  detalhes.style.marginTop = "1.5rem";

  let htmlMensalidades = mensalidadesEntradas.length > 0 
    ? mensalidadesEntradas.map(m => `<li>${m.aluno_nome || "N/A"} - ${formatarReais(m.valor)} (${m.forma_pagamento || "N/A"})</li>`).join("")
    : "<li>Nenhuma mensalidade registrada</li>";

  let htmlAulas = aulasAvulsas.length > 0
    ? aulasAvulsas.map(m => `<li>${m.aluno_nome || "N/A"} - ${formatarReais(m.valor)} (${m.forma_pagamento || "N/A"})</li>`).join("")
    : "<li>Nenhuma aula avulsa registrada</li>";

  let htmlSaidas = saidas.length > 0
    ? saidas.map(m => `<li>${m.descricao || "Despesa"} - ${formatarReais(m.valor)}</li>`).join("")
    : "<li>Nenhuma saida registrada</li>";

  detalhes.innerHTML = `
    <h3 style="margin-bottom: 1rem;">Detalhes - ${meses[mes]} ${ano}</h3>
    
    <div style="margin-bottom: 1.5rem;">
      <h4 style="color: #16a34a; margin-bottom: 0.5rem;">Mensalidades (${mensalidadesEntradas.length})</h4>
      <ul style="margin-left: 1.5rem; color: #64748b;">${htmlMensalidades}</ul>
    </div>

    <div style="margin-bottom: 1.5rem;">
      <h4 style="color: #f59e0b; margin-bottom: 0.5rem;">Aulas Avulsas (${aulasAvulsas.length})</h4>
      <ul style="margin-left: 1.5rem; color: #64748b;">${htmlAulas}</ul>
    </div>

    <div style="margin-bottom: 1rem;">
      <h4 style="color: #dc2626; margin-bottom: 0.5rem;">Saidas (${saidas.length})</h4>
      <ul style="margin-left: 1.5rem; color: #64748b;">${htmlSaidas}</ul>
    </div>
  `;
  container.appendChild(detalhes);

  const botoesContainer = document.createElement("div");
  botoesContainer.style.cssText = "display: flex; gap: 1rem; margin-top: 1.5rem;";

  const btnPDF = document.createElement("button");
  btnPDF.className = "btn-primary";
  btnPDF.textContent = "Baixar PDF";
  btnPDF.onclick = () => gerarPDFRelatorio(mes, ano, totalEntradas, totalSaidas, saldo, mensalidadesEntradas, aulasAvulsas, saidas);
  botoesContainer.appendChild(btnPDF);

  const btnImprimir = document.createElement("button");
  btnImprimir.className = "btn-secondary";
  btnImprimir.textContent = "Imprimir";
  btnImprimir.onclick = () => imprimirRelatorio(mes, ano, totalEntradas, totalSaidas, saldo, mensalidadesEntradas, aulasAvulsas, saidas);
  botoesContainer.appendChild(btnImprimir);

  container.appendChild(botoesContainer);
}

/** Imprime relatório mensal */
function imprimirRelatorio(mes, ano, totalEntradas, totalSaidas, saldo, mensalidades, aulas, saidas) {
  gerarPDFRelatorio(mes, ano, totalEntradas, totalSaidas, saldo, mensalidades, aulas, saidas);
}

/** Gera PDF do relatório mensal */
function gerarPDFRelatorio(mes, ano, totalEntradas, totalSaidas, saldo, mensalidades, aulas, saidas) {
  const config = DataStore.state.data.config || {};
  const nomeProjeto = config.nomeProjeto || "Bailado Carioca";
  const meses = ["","Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const dataGeracao = new Date().toLocaleString("pt-BR");

  let htmlMensalidades = mensalidades.length > 0 
    ? mensalidades.map(m => `<tr><td>${m.aluno_nome || "N/A"}</td><td>${formatarReais(m.valor)}</td><td>${m.forma_pagamento || "N/A"}</td></tr>`).join("")
    : "<tr><td colspan='3'>Nenhuma mensalidade</td></tr>";

  let htmlAulas = aulas.length > 0
    ? aulas.map(m => `<tr><td>${m.aluno_nome || "N/A"}</td><td>${formatarReais(m.valor)}</td><td>${m.forma_pagamento || "N/A"}</td></tr>`).join("")
    : "<tr><td colspan='3'>Nenhuma aula avulsa</td></tr>";

  let htmlSaidas = saidas.length > 0
    ? saidas.map(m => `<tr><td>${m.descricao || "Despesa"}</td><td colspan='2'>${formatarReais(m.valor)}</td></tr>`).join("")
    : "<tr><td colspan='3'>Nenhuma saida</td></tr>";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Relatorio ${meses[mes]} ${ano}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
        .header h1 { font-size: 22px; }
        .header h2 { font-size: 16px; color: #666; margin-top: 5px; }
        .resumo { display: flex; justify-content: space-around; margin: 30px 0; }
        .resumo-item { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; min-width: 150px; }
        .resumo-item h3 { font-size: 14px; color: #666; }
        .resumo-item p { font-size: 20px; font-weight: bold; margin-top: 5px; }
        .entradas { color: #16a34a; }
        .saidas { color: #dc2626; }
        .saldo { color: ${saldo >= 0 ? "#16a34a" : "#dc2626"}; }
        .secao { margin: 25px 0; }
        .secao h3 { font-size: 16px; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #eee; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f8f8f8; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #888; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${nomeProjeto}</h1>
        <h2>Relatorio Mensal - ${meses[mes]} ${ano}</h2>
      </div>
      
      <div class="resumo">
        <div class="resumo-item">
          <h3>Total Entradas</h3>
          <p class="entradas">${formatarReais(totalEntradas)}</p>
        </div>
        <div class="resumo-item">
          <h3>Total Saidas</h3>
          <p class="saidas">${formatarReais(totalSaidas)}</p>
        </div>
        <div class="resumo-item">
          <h3>Saldo</h3>
          <p class="saldo">${formatarReais(saldo)}</p>
        </div>
      </div>

      <div class="secao">
        <h3>Mensalidades (${mensalidades.length})</h3>
        <table>
          <thead><tr><th>Aluno</th><th>Valor</th><th>Pagamento</th></tr></thead>
          <tbody>${htmlMensalidades}</tbody>
        </table>
      </div>

      <div class="secao">
        <h3>Aulas Avulsas (${aulas.length})</h3>
        <table>
          <thead><tr><th>Aluno</th><th>Valor</th><th>Pagamento</th></tr></thead>
          <tbody>${htmlAulas}</tbody>
        </table>
      </div>

      <div class="secao">
        <h3>Saidas (${saidas.length})</h3>
        <table>
          <thead><tr><th>Descricao</th><th colspan="2">Valor</th></tr></thead>
          <tbody>${htmlSaidas}</tbody>
        </table>
      </div>

      <div class="footer">Gerado em ${dataGeracao}</div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "width=800,height=900");
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 300);
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
        if (entidade === "turmas" || entidade === "unidades") {
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
        const entidade = item._entidade;
        const idx = DataStore.state.data[entidade].findIndex(i => i.id === item.id);
        if (idx !== -1) {
          DataStore.state.data[entidade].splice(idx, 1);
        }
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
  const config = DataStore.state.data.config || { nomeProjeto: "Bailado Carioca", cnpj: "", nomeRecebedor: "Edson Silva", observacoes: "" };

  const container = document.createElement("div");
  container.className = "summary-card";
  container.style.maxWidth = "600px";

  container.innerHTML = `
    <h3 style="margin-bottom: 1rem;">Configuracoes do Sistema</h3>

    <div class="field" style="margin-bottom: 1rem;">
      <label>Nome do Projeto</label>
      <input id="nomeProjeto" style="width: 100%; padding: 0.5rem;" value="${config.nomeProjeto || ""}">
    </div>

    <div class="field" style="margin-bottom: 1rem;">
      <label>Nome do Recebedor</label>
      <input id="nomeRecebedor" style="width: 100%; padding: 0.5rem;" placeholder="Nome que aparece no recibo" value="${config.nomeRecebedor || ""}">
    </div>

    <div class="field" style="margin-bottom: 1rem;">
      <label>CNPJ</label>
      <input id="cnpj" style="width: 100%; padding: 0.5rem;" placeholder="00.000.000/0001-00" value="${config.cnpj || ""}">
    </div>

    <div class="field" style="margin-bottom: 1rem;">
      <label>Observacoes Gerais</label>
      <textarea id="observacoes" style="width: 100%; padding: 0.5rem; min-height: 100px; border: 1px solid #d1d5db; border-radius: 6px;">${config.observacoes || ""}</textarea>
    </div>

    <button class="btn-primary" id="btnSalvarConfig">Salvar Configuracoes</button>
    <span id="msgSalvo" style="margin-left: 1rem; color: #16a34a; display: none;">Salvo com sucesso!</span>
  `;

  container.querySelector("#btnSalvarConfig").onclick = () => {
    DataStore.state.data.config = {
      nomeProjeto: container.querySelector("#nomeProjeto").value,
      nomeRecebedor: container.querySelector("#nomeRecebedor").value,
      cnpj: container.querySelector("#cnpj").value,
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
