/**
 * Bailado Carioca — Sistema de Gestão Completo
 * app.js (versão final com todas funcionalidades)
 */

/* =========================
   APP STATE (Idempotent Init)
========================= */
const AppState = {
  initialized: false,
  eventListeners: [],

  addListener(element, event, handler) {
    if (element) {
      element.addEventListener(event, handler);
      this.eventListeners.push({ element, event, handler });
    }
  },

  cleanup() {
    this.eventListeners.forEach(({ element, event, handler }) => {
      if (element) {
        element.removeEventListener(event, handler);
      }
    });
    this.eventListeners = [];
    this.initialized = false;
  },

  markInitialized() {
    this.initialized = true;
  }
};

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
      presencas: [],
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
    if (entidade === "alunos") {
      return items.filter(item => item.status === "ativo").length;
    }
    return items.filter(
      item => item.ativo !== false && item.ativa !== false
    ).length;
  },

  /** Conta alunos trancados */
  countTrancados() {
    return this.state.data.alunos.filter(a => a.status === "trancado").length;
  },

  /** Migra alunos antigos para o novo sistema de status */
  migrateAlunosStatus() {
    let changed = false;
    this.state.data.alunos.forEach(aluno => {
      if (!aluno.status) {
        if (aluno.ativo === false) {
          aluno.status = "excluido";
        } else {
          aluno.status = "ativo";
        }
        changed = true;
      }
    });
    if (changed) {
      this.save();
    }
  },

  /** Conta mensalidades por status */
  countMensalidades(status) {
    return this.state.data.mensalidades.filter(m => m.status === status).length;
  },

  /** Calcula total de entradas no caixa (exclui cancelados) */
  totalEntradas() {
    return this.state.data.caixa
      .filter(c => c.tipo === "entrada" && c.status !== "cancelado")
      .reduce((sum, c) => sum + (c.valor || 0), 0);
  },

  /** Calcula total de saídas no caixa (exclui cancelados) */
  totalSaidas() {
    return this.state.data.caixa
      .filter(c => c.tipo === "saida" && c.status !== "cancelado")
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
   AUTH - Sistema de Autenticacao
========================= */
const Auth = {
  // Usuarios do sistema (pode ser expandido via localStorage futuramente)
  usuarios: [
    { usuario: "edson", senha: "bailado2024", nome: "Edson", perfil: "admin" },
    { usuario: "livia", senha: "bailado2024", nome: "Livia", perfil: "admin" },
    { usuario: "operador", senha: "op2024", nome: "Operador", perfil: "operacional" },
  ],

  // Paginas permitidas por perfil
  permissoes: {
    admin: ["dashboard", "alunos", "bolsistas", "trancados", "turmas", "unidades", "professores", "mensalidades", "recibos", "caixa", "presenca", "relatorio", "lixeira", "config", "manual"],
    operacional: ["alunos", "bolsistas", "presenca", "turmas", "unidades", "trancados", "manual"],
  },

  // Paginas com dados financeiros (ocultar para operacional)
  paginasFinanceiras: ["dashboard", "mensalidades", "caixa", "relatorio", "recibos"],

  /** Retorna sessao atual do localStorage */
  getSessao() {
    const raw = localStorage.getItem("bailadoSessao");
    return raw ? JSON.parse(raw) : null;
  },

  /** Salva sessao no localStorage */
  setSessao(usuario) {
    localStorage.setItem("bailadoSessao", JSON.stringify({
      usuario: usuario.usuario,
      nome: usuario.nome,
      perfil: usuario.perfil,
      loginEm: new Date().toISOString(),
    }));
  },

  /** Limpa sessao */
  logout() {
    localStorage.removeItem("bailadoSessao");
  },

  /** Valida credenciais */
  validarLogin(usuario, senha) {
    return this.usuarios.find(u => 
      u.usuario.toLowerCase() === usuario.toLowerCase() && u.senha === senha
    );
  },

  /** Verifica se esta logado */
  estaLogado() {
    return this.getSessao() !== null;
  },

  /** Retorna perfil atual */
  getPerfilAtual() {
    const sessao = this.getSessao();
    return sessao ? sessao.perfil : null;
  },

  /** Verifica se tem acesso a uma pagina */
  temAcesso(pagina) {
    const perfil = this.getPerfilAtual();
    if (!perfil) return false;
    return this.permissoes[perfil]?.includes(pagina) || false;
  },

  /** Verifica se pode ver dados financeiros */
  podeVerFinanceiro() {
    return this.getPerfilAtual() === "admin";
  },

  /** Retorna pagina inicial baseada no perfil */
  getPaginaInicial() {
    const perfil = this.getPerfilAtual();
    return perfil === "admin" ? "dashboard" : "alunos";
  },

  /** Carrega usuarios do localStorage ou usa padrao */
  carregarUsuarios() {
    const raw = localStorage.getItem("bailadoUsuarios");
    if (raw) {
      try {
        this.usuarios = JSON.parse(raw);
      } catch (e) {
        console.error("Erro ao carregar usuarios:", e);
      }
    }
  },

  /** Salva usuarios no localStorage */
  salvarUsuarios() {
    localStorage.setItem("bailadoUsuarios", JSON.stringify(this.usuarios));
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
    DataStore.migrateAlunosStatus();
    Auth.carregarUsuarios();
    this.initTheme();
    this.initAuth();
  },

  /** Inicializa sistema de autenticacao */
  initAuth() {
    const welcomeScreen = document.getElementById("welcome-screen");
    const appContainer = document.getElementById("app");
    const btnEntrar = document.getElementById("btn-entrar");
    const loginForm = document.getElementById("login-form");
    const btnLogin = document.getElementById("btn-login");
    const loginUsuario = document.getElementById("login-usuario");
    const loginSenha = document.getElementById("login-senha");
    const loginError = document.getElementById("login-error");
    const btnLogout = document.getElementById("btn-logout");
    const userName = document.getElementById("user-name");

    // Verifica se ja esta logado
    if (Auth.estaLogado()) {
      this.entrarNoSistema();
      return;
    }

    // Mostra tela de boas-vindas
    welcomeScreen.style.display = "flex";
    appContainer.style.display = "none";

    // Clique em "Entrar no Sistema" mostra formulario de login
    btnEntrar.onclick = () => {
      btnEntrar.style.display = "none";
      loginForm.style.display = "block";
      loginUsuario.focus();
    };

    // Funcao de login
    const tentarLogin = () => {
      const usuario = loginUsuario.value.trim();
      const senha = loginSenha.value;

      if (!usuario || !senha) {
        loginError.textContent = "Preencha usuario e senha";
        loginError.style.display = "block";
        return;
      }

      const user = Auth.validarLogin(usuario, senha);
      if (user) {
        Auth.setSessao(user);
        loginError.style.display = "none";
        this.entrarNoSistema();
      } else {
        loginError.textContent = "Usuario ou senha incorretos";
        loginError.style.display = "block";
        loginSenha.value = "";
        loginSenha.focus();
      }
    };

    btnLogin.onclick = tentarLogin;
    loginSenha.onkeypress = (e) => {
      if (e.key === "Enter") tentarLogin();
    };
    loginUsuario.onkeypress = (e) => {
      if (e.key === "Enter") loginSenha.focus();
    };

    // Logout
    btnLogout.onclick = () => {
      Auth.logout();
      location.reload();
    };

    // Atualiza nome do usuario
    const sessao = Auth.getSessao();
    if (sessao) {
      userName.textContent = sessao.nome;
    }
  },

  /** Entra no sistema apos login */
  entrarNoSistema() {
    const welcomeScreen = document.getElementById("welcome-screen");
    const appContainer = document.getElementById("app");
    const userName = document.getElementById("user-name");
    const btnLogout = document.getElementById("btn-logout");

    welcomeScreen.style.display = "none";
    appContainer.style.display = "";

    const sessao = Auth.getSessao();
    if (sessao) {
      userName.textContent = sessao.nome;
    }

    // Configura logout
    btnLogout.onclick = () => {
      Auth.logout();
      location.reload();
    };

    this.renderMenu();
    this.navigate(Auth.getPaginaInicial());
  },

  initTheme() {
    const savedTheme = localStorage.getItem("bailadoTheme");
    const themeToggle = document.getElementById("theme-toggle");
    const themeIcon = document.getElementById("theme-icon");
    const themeText = document.getElementById("theme-text");

    const applyTheme = (isDark) => {
      if (isDark) {
        document.body.classList.add("dark-mode");
        themeIcon.textContent = "[Claro]";
        themeText.textContent = "Modo Claro";
      } else {
        document.body.classList.remove("dark-mode");
        themeIcon.textContent = "[Escuro]";
        themeText.textContent = "Modo Escuro";
      }
    };

    if (savedTheme === "dark") {
      applyTheme(true);
    }

    themeToggle.onclick = () => {
      const isDark = document.body.classList.contains("dark-mode");
      applyTheme(!isDark);
      localStorage.setItem("bailadoTheme", isDark ? "light" : "dark");
    };
  },

  renderMenu() {
    const allPages = [
      ["dashboard", "Dashboard"],
      ["alunos", "Alunos"],
      ["bolsistas", "Bolsistas"],
      ["trancados", "Trancados"],
      ["turmas", "Turmas"],
      ["unidades", "Unidades"],
      ["professores", "Professores"],
      ["mensalidades", "Mensalidades"],
      ["recibos", "Recibos"],
      ["caixa", "Caixa"],
      ["presenca", "Presenca"],
      ["relatorio", "Relatorio Mensal"],
      ["lixeira", "Lixeira"],
      ["config", "Configuracoes"],
      ["manual", "Manual"],
    ];

    // Filtra paginas baseado no perfil do usuario
    const pages = allPages.filter(([id]) => Auth.temAcesso(id));

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
    
    // Verifica permissao de acesso
    if (!Auth.temAcesso(page)) {
      alert("Voce nao tem permissao para acessar esta pagina.");
      return;
    }

    DataStore.state.currentPage = page;

    document.querySelectorAll(".menu-item").forEach(i =>
      i.classList.toggle("active", i.dataset.page === page)
    );

    const titulos = {
      dashboard: "Dashboard",
      alunos: "Alunos",
      bolsistas: "Bolsistas",
      trancados: "Trancados",
      turmas: "Turmas",
      unidades: "Unidades",
      professores: "Professores",
      mensalidades: "Mensalidades",
      recibos: "Recibos",
      caixa: "Caixa",
      presenca: "Presenca",
      relatorio: "Relatorio Mensal",
      lixeira: "Lixeira",
      config: "Configuracoes",
      manual: "Manual de Uso",
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

/** Formata categoria para exibição */
function formatarCategoria(categoria) {
  const labels = {
    mensalidade: "Mensalidade",
    aula_avulsa: "Aula Avulsa",
    despesa: "Despesa",
    outros: "Outros",
  };
  return labels[categoria] || categoria || "-";
}

/** Cria container de cards */
function criarGridCards() {
  const grid = document.createElement("div");
  grid.className = "dashboard-cards";
  grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(280px, 1fr))";
  return grid;
}

/** Obtem dados financeiros mensais dos ultimos 6 meses para graficos */
function obterDadosMensais() {
  const hoje = new Date();
  const meses = [];
  const entradas = [];
  const saidas = [];
  const saldos = [];
  
  const nomesMeses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  
  for (let i = 5; i >= 0; i--) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mes = data.getMonth();
    const ano = data.getFullYear();
    
    meses.push(`${nomesMeses[mes]}/${ano.toString().slice(-2)}`);
    
    const lancamentosMes = DataStore.state.data.caixa.filter(c => {
      if (c.status === "cancelado") return false;
      const dataLanc = new Date(c.data);
      return dataLanc.getMonth() === mes && dataLanc.getFullYear() === ano;
    });
    
    const totalEntradas = lancamentosMes
      .filter(c => c.tipo === "entrada")
      .reduce((sum, c) => sum + (c.valor || 0), 0);
    
    const totalSaidas = lancamentosMes
      .filter(c => c.tipo === "saida")
      .reduce((sum, c) => sum + (c.valor || 0), 0);
    
    entradas.push(totalEntradas);
    saidas.push(totalSaidas);
    saldos.push(totalEntradas - totalSaidas);
  }
  
  return { meses, entradas, saidas, saldos };
}

/** Conta alunos inadimplentes (mensalidade do mes anterior nao paga) */
function contarInadimplentes() {
  const hoje = new Date();
  const mesAnterior = hoje.getMonth(); // 0-11, getMonth() retorna 0-11
  const anoAnterior = mesAnterior === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear();
  const mesRef = mesAnterior === 0 ? 12 : mesAnterior;
  const mesRefStr = String(mesRef).padStart(2, "0");
  const anoRefStr = String(anoAnterior);
  
  const alunosAtivos = DataStore.state.data.alunos.filter(a => a.status === "ativo" && !isBolsista(a));
  const inadimplentes = [];
  
  alunosAtivos.forEach(aluno => {
    const mensalidadePaga = DataStore.state.data.mensalidades.find(m => 
      m.aluno_id === aluno.id && 
      m.mes === mesRefStr && 
      m.ano === anoRefStr && 
      m.status === "paga"
    );
    
    if (!mensalidadePaga) {
      inadimplentes.push({
        aluno,
        mesRef: `${mesRefStr}/${anoRefStr}`
      });
    }
  });
  
  return inadimplentes;
}

/** Verifica se aluno esta inadimplente */
function alunoInadimplente(alunoId) {
  // Bolsistas nao tem mensalidade, entao nunca sao inadimplentes
  const aluno = DataStore.findById("alunos", alunoId);
  if (isBolsista(aluno)) return false;
  
  const hoje = new Date();
  const mesAnterior = hoje.getMonth();
  const anoAnterior = mesAnterior === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear();
  const mesRef = mesAnterior === 0 ? 12 : mesAnterior;
  const mesRefStr = String(mesRef).padStart(2, "0");
  const anoRefStr = String(anoAnterior);
  
  const mensalidadePaga = DataStore.state.data.mensalidades.find(m => 
    m.aluno_id === alunoId && 
    m.mes === mesRefStr && 
    m.ano === anoRefStr && 
    m.status === "paga"
  );
  
  return !mensalidadePaga;
}

/** Obtem dados financeiros de um mes especifico */
function obterDadosMes(mes, ano) {
  const caixa = DataStore.state.data.caixa;
  const movimentos = caixa.filter(c => {
    if (c.status === "cancelado") return false;
    const data = new Date(c.data);
    return data.getMonth() + 1 === mes && data.getFullYear() === ano;
  });
  
  const entradas = movimentos.filter(c => c.tipo === "entrada").reduce((sum, c) => sum + (c.valor || 0), 0);
  const saidas = movimentos.filter(c => c.tipo === "saida").reduce((sum, c) => sum + (c.valor || 0), 0);
  
  return { entradas, saidas, saldo: entradas - saidas };
}

/** Adiciona evento ao historico do aluno */
function adicionarEventoAluno(alunoId, evento) {
  const aluno = DataStore.findById("alunos", alunoId);
  if (!aluno) return;
  
  if (!aluno.historico) {
    aluno.historico = [];
  }
  
  aluno.historico.push({
    data: new Date().toISOString(),
    evento: evento
  });
  
  DataStore.save();
}

/** Formata seta de comparacao */
function formatarComparativo(atual, anterior) {
  if (anterior === 0 && atual === 0) return { seta: "->", cor: "#64748b", texto: "Sem dados" };
  if (anterior === 0) return { seta: "[+]", cor: "#16a34a", texto: "Novo" };
  
  const diff = atual - anterior;
  const pct = Math.abs((diff / anterior) * 100).toFixed(0);
  
  if (diff > 0) return { seta: "[+]", cor: "#16a34a", texto: `+${pct}%` };
  if (diff < 0) return { seta: "[-]", cor: "#dc2626", texto: `-${pct}%` };
  return { seta: "[=]", cor: "#64748b", texto: "Estavel" };
}

/** Armazena instancias de graficos para destruicao posterior */
let chartInstances = {
  entradasSaidas: null,
  saldo: null
};

/** Renderiza graficos do dashboard */
function renderizarGraficos() {
  const dados = obterDadosMensais();
  
  const ctxES = document.getElementById("chart-entradas-saidas");
  const ctxSaldo = document.getElementById("chart-saldo");
  
  if (!ctxES || !ctxSaldo) return;
  
  if (chartInstances.entradasSaidas) {
    chartInstances.entradasSaidas.destroy();
  }
  if (chartInstances.saldo) {
    chartInstances.saldo.destroy();
  }
  
  const isDark = document.body.classList.contains("dark-mode");
  const textColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "rgba(148, 163, 184, 0.1)" : "rgba(0, 0, 0, 0.05)";
  
  chartInstances.entradasSaidas = new Chart(ctxES, {
    type: "bar",
    data: {
      labels: dados.meses,
      datasets: [
        {
          label: "Entradas",
          data: dados.entradas,
          backgroundColor: "rgba(34, 197, 94, 0.7)",
          borderColor: "rgb(34, 197, 94)",
          borderWidth: 1,
        },
        {
          label: "Saidas",
          data: dados.saidas,
          backgroundColor: "rgba(239, 68, 68, 0.7)",
          borderColor: "rgb(239, 68, 68)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: textColor },
        },
      },
      scales: {
        x: {
          ticks: { color: textColor },
          grid: { color: gridColor },
        },
        y: {
          ticks: { color: textColor },
          grid: { color: gridColor },
        },
      },
    },
  });
  
  chartInstances.saldo = new Chart(ctxSaldo, {
    type: "line",
    data: {
      labels: dados.meses,
      datasets: [
        {
          label: "Saldo",
          data: dados.saldos,
          borderColor: "rgb(59, 130, 246)",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: textColor },
        },
      },
      scales: {
        x: {
          ticks: { color: textColor },
          grid: { color: gridColor },
        },
        y: {
          ticks: { color: textColor },
          grid: { color: gridColor },
        },
      },
    },
  });
}

/** Gera número do recibo */
function gerarNumeroRecibo() {
  const num = DataStore.state.data.recibos.length + 1;
  return String(num).padStart(5, "0");
}

/** Template do recibo - texto gerado dinamicamente */
function gerarTextoRecibo(recibo) {
  const config = DataStore.state.data.config || {};
  const nomeAluno = recibo.nomeAluno || recibo.aluno_nome || "Não informado";
  const telefoneAluno = recibo.telefoneAluno || recibo.telefone || "Não informado";
  const descricao = recibo.descricaoServico || recibo.competencia || "serviço prestado";
  const formaPgto = recibo.formaPagamento || recibo.forma_pagamento || "Não informado";
  const nomeRecebedor = config.nomeRecebedor || "Edson Silva";
  const cnpj = config.cnpj || "Não informado";
  const nomeProjeto = config.nomeProjeto || "Bailado Carioca";
  
  return `RECIBO Nº ${recibo.numero || "S/N"}

Confirmo o recebimento de ${formatarReais(recibo.valor)},
referente a ${descricao}.

Aluno: ${nomeAluno}
Telefone: ${telefoneAluno}

Forma de pagamento: ${formaPgto}
Data do pagamento: ${formatarData(recibo.data)}

Declaro que o valor acima foi recebido e dou plena quitação.

Recebedor:
${nomeRecebedor}
CNPJ: ${cnpj}

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
  const nomeAluno = recibo.nomeAluno || recibo.aluno_nome || "Não informado";
  const telefoneAluno = recibo.telefoneAluno || recibo.telefone || "Não informado";
  const descricao = recibo.descricaoServico || recibo.competencia || "serviço prestado";
  const formaPgto = recibo.formaPagamento || recibo.forma_pagamento || "Não informado";
  const nomeRecebedor = config.nomeRecebedor || "Edson Silva";
  const cnpj = config.cnpj || "Não informado";
  const nomeProjeto = config.nomeProjeto || "Bailado Carioca";
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Recibo #${recibo.numero || "S-N"}</title>
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
        <img src="${window.location.origin}/logo.jpg" alt="Bailado Carioca" style="width: 200px; height: auto; margin-bottom: 15px;">
        <h1>RECIBO</h1>
        <div class="numero">Nº ${recibo.numero || "S/N"}</div>
      </div>
      <div class="body">
        <p>Confirmo o recebimento de <strong>${formatarReais(recibo.valor)}</strong>, referente a ${descricao}.</p>
        <p><strong>Aluno:</strong> ${nomeAluno}</p>
        <p><strong>Telefone:</strong> ${telefoneAluno}</p>
        <p><strong>Forma de pagamento:</strong> ${formaPgto}</p>
        <p><strong>Data do pagamento:</strong> ${formatarData(recibo.data)}</p>
        <p style="margin-top: 30px;">Declaro que o valor acima foi recebido e dou plena quitação.</p>
      </div>
      <div class="recebedor">
        <div>Recebedor:</div>
        <div class="nome">${nomeRecebedor}</div>
        <div class="cnpj">CNPJ: ${cnpj}</div>
      </div>
      <div class="assinatura">${nomeProjeto}</div>
      <div class="footer">Gerado em ${dataGeracao}<br>Documento gerado pelo Sistema Bailado Carioca</div>
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
  /** Dashboard com métricas e graficos */
  dashboard() {
    const inadimplentes = contarInadimplentes();
    
    const grid = document.createElement("div");
    grid.className = "dashboard-cards";

    // Contar apenas alunos PAGANTES (excluir bolsistas)
    const alunosPagantes = DataStore.state.data.alunos.filter(a => a.status === "ativo" && !isBolsista(a)).length;
    const bolsistasAtivos = DataStore.state.data.alunos.filter(a => a.status === "ativo" && isBolsista(a)).length;
    
    const cards = [
      ["Alunos Ativos", alunosPagantes, null],
      ["Bolsistas Ativos", bolsistasAtivos, null],
      ["Alunos Trancados", DataStore.countTrancados(), null],
      ["Turmas Ativas", DataStore.count("turmas"), null],
      ["Unidades", DataStore.count("unidades"), null],
      ["Professores", DataStore.count("professores"), null],
      ["Mensalidades Pendentes", DataStore.countMensalidades("pendente"), null],
      ["Saldo Atual", formatarReais(DataStore.saldoAtual()), null],
    ];

    if (inadimplentes.length > 0) {
      cards.push(["Alunos Inadimplentes", inadimplentes.length, "warning"]);
    }

    cards.forEach(([title, value, type]) => {
      const card = document.createElement("div");
      card.className = "summary-card";
      if (type === "warning") {
        card.style.borderLeft = "4px solid #f59e0b";
        card.style.background = "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)";
      }
      card.innerHTML = `
        <span class="card-title">${title}</span>
        <span class="card-value" ${type === "warning" ? 'style="color: #d97706;"' : ''}>${value}</span>
      `;
      grid.appendChild(card);
    });

    UI.content.appendChild(grid);

    if (inadimplentes.length > 0) {
      const alertSection = document.createElement("div");
      alertSection.style.cssText = "margin-top: 1.5rem; padding: 1rem; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px;";
      alertSection.innerHTML = `
        <h3 style="margin: 0 0 0.75rem 0; color: #92400e; font-size: 1rem;">Alunos com Mensalidade Pendente</h3>
        <ul style="margin: 0; padding-left: 1.25rem; color: #78350f; font-size: 0.9rem;">
          ${inadimplentes.slice(0, 10).map(i => `<li>${i.aluno.nome} - Ref: ${i.mesRef}</li>`).join("")}
          ${inadimplentes.length > 10 ? `<li style="color: #a16207;">... e mais ${inadimplentes.length - 10} aluno(s)</li>` : ""}
        </ul>
      `;
      UI.content.appendChild(alertSection);
    }

    const chartSection = document.createElement("div");
    chartSection.style.cssText = "margin-top: 2rem;";
    chartSection.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="margin: 0; font-size: 1.1rem; color: var(--color-text-primary);">Evolucao Financeira (ultimos 6 meses)</h3>
        <button class="btn-secondary" id="toggle-charts" style="font-size: 0.8rem;">Mostrar Graficos</button>
      </div>
      <div id="charts-container" style="display: none;">
        <div class="charts-grid">
          <div class="summary-card chart-card">
            <h4 class="chart-title">Entradas x Saidas</h4>
            <div class="chart-wrapper">
              <canvas id="chart-entradas-saidas"></canvas>
            </div>
          </div>
          <div class="summary-card chart-card">
            <h4 class="chart-title">Saldo Mensal</h4>
            <div class="chart-wrapper">
              <canvas id="chart-saldo"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;
    UI.content.appendChild(chartSection);

    let chartsVisible = false;
    const toggleBtn = document.getElementById("toggle-charts");
    const chartsContainer = document.getElementById("charts-container");

    toggleBtn.onclick = () => {
      chartsVisible = !chartsVisible;
      chartsContainer.style.display = chartsVisible ? "block" : "none";
      toggleBtn.textContent = chartsVisible ? "Ocultar Graficos" : "Mostrar Graficos";
      
      if (chartsVisible && typeof Chart !== "undefined") {
        renderizarGraficos();
      }
    };
  },

  alunos() {
    renderAlunos();
  },

  bolsistas() {
    renderBolsistas();
  },

  trancados() {
    renderTrancados();
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

  presenca() {
    renderPresenca();
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

  manual() {
    renderManual();
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

  const inputBusca = document.createElement("input");
  inputBusca.placeholder = "Buscar por nome...";
  inputBusca.style.padding = "0.5rem";
  inputBusca.oninput = () => renderCardsAlunosAtivos(inputBusca.value);
  header.appendChild(inputBusca);

  UI.content.appendChild(header);

  const container = document.createElement("div");
  container.id = "alunos-container";
  UI.content.appendChild(container);

  renderCardsAlunosAtivos("");
}

/** Renderiza cards de alunos ATIVOS (exclui bolsistas - eles aparecem na aba Bolsistas) */
function renderCardsAlunosAtivos(buscaNome) {
  const container = document.getElementById("alunos-container");
  container.innerHTML = "";

  // Filtrar apenas alunos PAGANTES (excluir bolsistas)
  let alunos = DataStore.state.data.alunos.filter(a => a.status === "ativo" && !isBolsista(a));

  if (buscaNome) {
    const termo = buscaNome.toLowerCase();
    alunos = alunos.filter(a => a.nome?.toLowerCase().includes(termo));
  }

  if (alunos.length === 0) {
    container.innerHTML = '<p style="color: #64748b;">Nenhum aluno ativo encontrado.</p>';
    return;
  }

  const grid = criarGridCards();

  alunos.forEach(aluno => {
    const turma = DataStore.findById("turmas", aluno.turma);
    const unidade = turma ? DataStore.findById("unidades", turma.unidade_id) : null;
    const isInadimplente = alunoInadimplente(aluno.id);

    const card = document.createElement("div");
    card.className = "summary-card aluno-card";
    if (isInadimplente) {
      card.classList.add("aluno-pendente");
    }

    card.innerHTML = `
      <div class="aluno-header">
        <h3 class="aluno-nome">${aluno.nome}</h3>
        <div class="aluno-badges">
          ${isInadimplente ? '<span class="badge badge-warning">Pendente</span>' : ''}
          <span class="badge badge-success">Ativo</span>
        </div>
      </div>
      
      <div class="aluno-body">
        <div class="aluno-info-row aluno-info-primary">
          <span class="info-icon">T</span>
          <span>${turma ? `${turma.nome} (${turma.nivel})` : "Sem turma"}</span>
        </div>
        <div class="aluno-info-row">
          <span class="info-icon">U</span>
          <span>${unidade?.nome || turma?.unidade || aluno.unidade || "-"}</span>
        </div>
        <div class="aluno-info-row aluno-info-highlight">
          <span class="info-icon">$</span>
          <span><strong>${formatarReais(aluno.mensalidade)}</strong> - ${aluno.tipoMatricula || aluno.tipo || "Normal"}</span>
        </div>
        <div class="aluno-info-row aluno-info-secondary">
          <span class="info-icon">F</span>
          <span>${aluno.telefone || "Nao informado"}</span>
        </div>
      </div>
      
      <div class="aluno-footer">
        <div class="aluno-actions-primary"></div>
        <div class="aluno-actions-secondary"></div>
      </div>
    `;

    const acoesPrimary = card.querySelector(".aluno-actions-primary");
    const acoesSecondary = card.querySelector(".aluno-actions-secondary");

    const btnHistorico = document.createElement("button");
    btnHistorico.className = "btn-secondary btn-sm";
    btnHistorico.textContent = "Historico";
    btnHistorico.onclick = () => abrirHistoricoAluno(aluno);
    acoesPrimary.appendChild(btnHistorico);

    const btnEditar = document.createElement("button");
    btnEditar.className = "btn-primary btn-sm";
    btnEditar.textContent = "Editar";
    btnEditar.onclick = () => abrirModalAluno(aluno);
    acoesPrimary.appendChild(btnEditar);

    const btnTrancar = document.createElement("button");
    btnTrancar.className = "btn-muted btn-sm";
    btnTrancar.textContent = "Trancar";
    btnTrancar.onclick = () => {
      if (confirm("Trancar matricula deste aluno?")) {
        aluno.status = "trancado";
        aluno.dataTrancamento = new Date().toISOString();
        adicionarEventoAluno(aluno.id, "Matricula trancada");
        UI.navigate("alunos");
      }
    };
    acoesSecondary.appendChild(btnTrancar);

    const btnExcluir = document.createElement("button");
    btnExcluir.className = "btn-muted btn-sm";
    btnExcluir.textContent = "Excluir";
    btnExcluir.onclick = () => {
      if (confirm("Mover aluno para lixeira?")) {
        aluno.status = "excluido";
        aluno.dataExclusao = new Date().toISOString();
        adicionarEventoAluno(aluno.id, "Aluno excluido");
        UI.navigate("alunos");
      }
    };
    acoesSecondary.appendChild(btnExcluir);

    grid.appendChild(card);
  });

  container.appendChild(grid);
}

/* =========================
   BOLSISTAS
========================= */

/** Verifica se aluno e bolsista */
function isBolsista(aluno) {
  // Bolsista se bolsa esta ativa OU tipoMatricula === "bolsista"
  return aluno?.bolsa?.ativa === true || aluno?.tipoMatricula === "bolsista";
}

/**
 * FUNCAO CENTRAL: Obtem alunos de uma turma de forma DINAMICA
 * ALUNO e a UNICA fonte da verdade - turma NAO armazena alunos
 * Inclui alunos regulares (turma) e bolsistas (turmas_ids)
 * Usa alunoEmTurma() para consistencia com resto do sistema
 */
function getAlunosDaTurma(turmaId) {
  if (!turmaId) return [];
  return DataStore.state.data.alunos.filter(aluno => 
    aluno.status === "ativo" && alunoEmTurma(aluno, turmaId)
  );
}

/**
 * Obtem apenas alunos PAGANTES de uma turma (exclui bolsistas)
 * Usado para exibicao nos cards de Turma (separacao conceitual)
 */
function getAlunosPagantesDaTurma(turmaId) {
  if (!turmaId) return [];
  return DataStore.state.data.alunos.filter(aluno => 
    aluno.status === "ativo" && alunoEmTurma(aluno, turmaId) && !isBolsista(aluno)
  );
}

/** Obtem array de turmas_ids do aluno (migrando turma unica se necessario) */
function getTurmasIds(aluno) {
  if (!aluno) return [];
  // Se ja tem array turmas_ids, retorna COPIA para evitar mutacao
  if (Array.isArray(aluno.turmas_ids)) {
    return [...aluno.turmas_ids];
  }
  // Migrar turma unica para array
  if (aluno.turma) {
    return [aluno.turma];
  }
  return [];
}

/** Define turmas_ids e mantem compatibilidade com turma unica */
function setTurmasIds(aluno, turmasIds) {
  // Sempre criar novo array para evitar mutacao
  const novoArray = Array.isArray(turmasIds) ? [...turmasIds] : [];
  aluno.turmas_ids = novoArray;
  // Manter turma como primeira para compatibilidade
  aluno.turma = novoArray.length > 0 ? novoArray[0] : null;
}

/** Verifica se aluno pertence a uma turma (usando turmas_ids ou turma) */
function alunoEmTurma(aluno, turmaId) {
  if (!aluno || !turmaId) return false;
  const turmasIds = getTurmasIds(aluno);
  return turmasIds.includes(turmaId);
}

/** Formata nome da turma com nivel */
function formatarTurmaNivel(turma) {
  if (!turma) return "Sem turma";
  return `${turma.nome} - ${turma.nivel || "Sem nivel"}`;
}

/** Renderiza pagina de Bolsistas */
function renderBolsistas() {
  const turmas = DataStore.state.data.turmas.filter(t => t.ativa !== false);
  
  // ========== AREA DE GESTAO (novo padrao similar a Turmas) ==========
  const gestaoArea = document.createElement("div");
  gestaoArea.className = "summary-card";
  gestaoArea.style.marginBottom = "1.5rem";
  gestaoArea.innerHTML = `
    <div style="margin-bottom: 1rem;">
      <strong style="font-size: 1.1rem;">Gestao de Bolsas</strong>
      <p style="color: var(--color-text-secondary); margin-top: 0.25rem; font-size: 0.9rem;">Adicione ou remova bolsas diretamente</p>
    </div>
    
    <div style="margin-bottom: 1rem;">
      <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Bolsistas Atuais</label>
      <div id="bolsistas-chips" data-testid="container-bolsistas-chips" style="display: flex; flex-wrap: wrap; gap: 0.5rem; min-height: 40px; padding: 0.75rem; background: var(--bg-card, #fff); border: 1px solid #e2e8f0; border-radius: 4px;"></div>
    </div>
    
    <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem;">
      <select id="bolsista-busca" data-testid="select-add-bolsista" style="flex: 1; min-width: 200px; padding: 0.5rem;">
        <option value="">Buscar aluno existente...</option>
      </select>
      <select id="bolsista-tipo-rapido" data-testid="select-tipo-bolsa-rapido" style="padding: 0.5rem; min-width: 120px;">
        <option value="integral">Integral</option>
        <option value="parcial">Parcial</option>
        <option value="apoio">Apoio</option>
      </select>
      <button type="button" id="btn-add-bolsista" data-testid="button-add-bolsista" class="btn-primary" style="white-space: nowrap;">Conceder</button>
      <button type="button" id="btn-clear-bolsistas" data-testid="button-clear-all-bolsistas" class="btn-secondary" style="white-space: nowrap; color: #dc2626;">Remover Todas</button>
    </div>
    <div style="border-top: 1px solid #e2e8f0; padding-top: 1rem;">
      <button type="button" id="btn-novo-bolsista" data-testid="button-new-bolsista" class="btn-primary" style="width: 100%;">+ Novo Bolsista (cadastro direto)</button>
    </div>
  `;
  UI.content.appendChild(gestaoArea);
  
  // Preencher dropdown de alunos disponiveis
  atualizarDropdownBolsistas();
  renderBolsistasChips();
  
  // Event listeners para gestao
  document.getElementById("btn-add-bolsista").onclick = () => {
    const selectAluno = document.getElementById("bolsista-busca");
    const alunoId = selectAluno.value;
    const tipo = document.getElementById("bolsista-tipo-rapido").value;
    
    if (!alunoId) {
      alert("Selecione um aluno!");
      return;
    }
    
    const aluno = DataStore.findById("alunos", alunoId);
    if (!aluno) return;
    
    // Conceder bolsa
    aluno.bolsa = {
      ativa: true,
      tipo: tipo,
      observacao: "",
      concedidaEm: new Date().toISOString()
    };
    aluno.tipoMatricula = "bolsista";
    DataStore.save();
    
    adicionarEventoAluno(alunoId, `Bolsa concedida - Tipo: ${formatarTipoBolsa(tipo)}`);
    
    atualizarDropdownBolsistas();
    renderBolsistasChips();
    renderCardsBolsistas();
  };
  
  document.getElementById("btn-clear-bolsistas").onclick = () => {
    const bolsistas = DataStore.state.data.alunos.filter(a => isBolsista(a));
    if (bolsistas.length === 0) {
      alert("Nao ha bolsistas para remover.");
      return;
    }
    
    if (!confirm(`Remover TODAS as ${bolsistas.length} bolsa(s)?\n\nOs alunos continuarao cadastrados, apenas perderao a bolsa.`)) {
      return;
    }
    
    bolsistas.forEach(aluno => {
      aluno.bolsa = { ativa: false, removidaEm: new Date().toISOString() };
      aluno.tipoMatricula = "regular";
      adicionarEventoAluno(aluno.id, "Bolsa removida");
    });
    DataStore.save();
    
    atualizarDropdownBolsistas();
    renderBolsistasChips();
    renderCardsBolsistas();
    alert("Todas as bolsas foram removidas.");
  };
  
  document.getElementById("btn-novo-bolsista").onclick = () => abrirModalNovoBolsista();
  
  // ========== FILTROS ==========
  const header = document.createElement("div");
  header.style.cssText = "display: flex; gap: 1rem; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap;";
  
  // Filtro por turma
  const selectTurma = document.createElement("select");
  selectTurma.id = "filtro-turma-bolsista";
  selectTurma.setAttribute("data-testid", "select-filter-turma");
  selectTurma.style.cssText = "padding: 0.5rem; min-width: 180px;";
  selectTurma.innerHTML = '<option value="">Todas as Turmas</option>';
  turmas.forEach(t => {
    selectTurma.innerHTML += `<option value="${t.id}">${t.nome} - ${t.nivel || "Sem nivel"}</option>`;
  });
  header.appendChild(selectTurma);
  
  // Filtro por status
  const selectStatus = document.createElement("select");
  selectStatus.id = "filtro-status-bolsista";
  selectStatus.setAttribute("data-testid", "select-filter-status");
  selectStatus.style.cssText = "padding: 0.5rem;";
  selectStatus.innerHTML = `
    <option value="">Todos os Status</option>
    <option value="ativo">Ativos</option>
    <option value="trancado">Trancados</option>
  `;
  header.appendChild(selectStatus);
  
  // Botao de adicionar bolsista (modal detalhado)
  const btnNovo = document.createElement("button");
  btnNovo.className = "btn-secondary";
  btnNovo.textContent = "+ Bolsa Detalhada";
  btnNovo.setAttribute("data-testid", "button-new-scholarship-detailed");
  btnNovo.onclick = () => abrirModalConcederBolsa();
  header.appendChild(btnNovo);
  
  UI.content.appendChild(header);
  
  // Container de cards
  const container = document.createElement("div");
  container.id = "bolsistas-container";
  UI.content.appendChild(container);
  
  // Event listeners para filtros
  selectTurma.onchange = () => renderCardsBolsistas();
  selectStatus.onchange = () => renderCardsBolsistas();
  
  renderCardsBolsistas();
}

/** Atualiza dropdown de alunos disponiveis para bolsa */
function atualizarDropdownBolsistas() {
  const select = document.getElementById("bolsista-busca");
  if (!select) return;
  
  const alunosDisponiveis = DataStore.state.data.alunos.filter(a => 
    a.status === "ativo" && !isBolsista(a)
  );
  
  select.innerHTML = '<option value="">Buscar aluno para conceder bolsa...</option>';
  alunosDisponiveis.forEach(a => {
    const turma = DataStore.findById("turmas", a.turma);
    const turmaLabel = turma ? ` (${turma.nome})` : "";
    select.innerHTML += `<option value="${a.id}">${a.nome}${turmaLabel}</option>`;
  });
}

/** Renderiza chips de bolsistas */
function renderBolsistasChips() {
  const container = document.getElementById("bolsistas-chips");
  if (!container) return;
  container.innerHTML = "";
  
  const bolsistas = DataStore.state.data.alunos.filter(a => isBolsista(a));
  
  if (bolsistas.length === 0) {
    container.innerHTML = '<span style="color: var(--color-text-secondary); font-style: italic;">Nenhum bolsista cadastrado</span>';
    return;
  }
  
  bolsistas.forEach(aluno => {
    const tipoBolsa = aluno.bolsa?.tipo || "integral";
    const statusClass = aluno.status === "ativo" ? "#16a34a" : "#f59e0b";
    
    const chip = document.createElement("span");
    chip.style.cssText = `display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.75rem; background: #dbeafe; color: #1d4ed8; border-radius: 4px; font-size: 0.85rem; border-left: 3px solid ${statusClass};`;
    chip.setAttribute("data-testid", `chip-bolsista-${aluno.id}`);
    chip.innerHTML = `
      <span>${aluno.nome}</span>
      <span style="font-size: 0.75rem; opacity: 0.8;">(${formatarTipoBolsa(tipoBolsa)})</span>
      <button type="button" data-id="${aluno.id}" data-testid="button-remove-bolsista-${aluno.id}" style="background: none; border: none; cursor: pointer; color: #1d4ed8; font-weight: bold; padding: 0 2px; font-size: 1rem;" title="Remover bolsa">X</button>
    `;
    
    chip.querySelector("button").onclick = () => {
      if (confirm(`Remover bolsa de ${aluno.nome}?\n\nO aluno continuara cadastrado.`)) {
        aluno.bolsa = { ativa: false, removidaEm: new Date().toISOString() };
        aluno.tipoMatricula = "regular";
        DataStore.save();
        adicionarEventoAluno(aluno.id, "Bolsa removida");
        
        atualizarDropdownBolsistas();
        renderBolsistasChips();
        renderCardsBolsistas();
      }
    };
    
    container.appendChild(chip);
  });
}

/** Renderiza cards de bolsistas */
function renderCardsBolsistas() {
  const container = document.getElementById("bolsistas-container");
  if (!container) return;
  container.innerHTML = "";
  
  const filtroTurma = document.getElementById("filtro-turma-bolsista")?.value || "";
  const filtroStatus = document.getElementById("filtro-status-bolsista")?.value || "";
  
  let bolsistas = DataStore.state.data.alunos.filter(a => isBolsista(a));
  
  // Aplicar filtros
  if (filtroTurma) {
    bolsistas = bolsistas.filter(a => alunoEmTurma(a, filtroTurma));
  }
  if (filtroStatus) {
    bolsistas = bolsistas.filter(a => a.status === filtroStatus);
  }
  
  if (bolsistas.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Nenhum bolsista encontrado</h3>
        <p>Use o botao "+ Conceder Bolsa" para adicionar um bolsista.</p>
      </div>
    `;
    return;
  }
  
  // Resumo
  const resumo = document.createElement("div");
  resumo.className = "summary-card";
  resumo.style.marginBottom = "1.5rem";
  const totalAtivos = bolsistas.filter(b => b.status === "ativo").length;
  const totalTrancados = bolsistas.filter(b => b.status === "trancado").length;
  resumo.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
      <div>
        <strong style="font-size: 1.1rem;">Resumo de Bolsistas</strong>
        <p style="color: var(--color-text-secondary); margin-top: 0.25rem;">${bolsistas.length} bolsista(s) encontrado(s)</p>
      </div>
      <div style="display: flex; gap: 1rem;">
        <div style="text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 600; color: #16a34a;">${totalAtivos}</div>
          <div style="font-size: 0.8rem; color: var(--color-text-secondary);">Ativos</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 600; color: #f59e0b;">${totalTrancados}</div>
          <div style="font-size: 0.8rem; color: var(--color-text-secondary);">Trancados</div>
        </div>
      </div>
    </div>
  `;
  container.appendChild(resumo);
  
  // Grid de cards
  const grid = criarGridCards();
  
  bolsistas.forEach(aluno => {
    const turmasIds = getTurmasIds(aluno);
    const tipoBolsa = aluno.bolsa?.tipo || "integral";
    const statusClass = aluno.status === "ativo" ? "badge-success" : "badge-warning";
    const statusLabel = aluno.status === "ativo" ? "Ativo" : "Trancado";
    
    // Renderizar turmas como chips com word-break para evitar vazamento
    let turmasHtml = "";
    if (turmasIds.length === 0) {
      turmasHtml = '<span style="color: var(--color-text-secondary); font-style: italic;">Nenhuma turma vinculada</span>';
    } else {
      turmasHtml = turmasIds.map(tid => {
        const t = DataStore.findById("turmas", tid);
        if (!t) return "";
        return `<span class="badge badge-muted" style="display: inline-block; max-width: 100%; word-break: break-word; white-space: normal; text-align: left; padding: 0.35rem 0.6rem; font-size: 0.8rem;">${t.nome} - ${t.nivel || "Sem nivel"}</span>`;
      }).join("");
    }
    
    const card = document.createElement("div");
    card.className = "summary-card";
    card.style.cssText = "min-width: 280px; padding: 1.25rem;";
    card.innerHTML = `
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
        <div style="width: 100%;">
          <strong style="font-size: 1.15rem; display: block; margin-bottom: 0.5rem;">${aluno.nome}</strong>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <span class="badge badge-info">Bolsista</span>
            <span class="badge badge-muted">${formatarTipoBolsa(tipoBolsa)}</span>
            <span class="badge ${statusClass}">${statusLabel}</span>
          </div>
        </div>
      </div>
      <div class="card-body" style="color: var(--color-text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">
        <div style="margin: 0.5rem 0;">
          <span style="font-weight: 600; display: block; margin-bottom: 0.5rem;">Turmas:</span>
          <div style="display: flex; flex-wrap: wrap; gap: 0.35rem;">${turmasHtml}</div>
        </div>
        ${aluno.bolsa?.observacao ? `<p style="margin: 0.75rem 0 0 0; font-style: italic; padding: 0.5rem; background: var(--color-bg-subtle, #f8f9fa); border-radius: 4px;">"${aluno.bolsa.observacao}"</p>` : ""}
      </div>
      <div class="card-footer" style="display: flex; gap: 0.5rem; flex-wrap: wrap; border-top: 1px solid var(--color-border); padding-top: 0.75rem;"></div>
    `;
    
    const footer = card.querySelector(".card-footer");
    
    // Botao Ver Historico
    const btnHistorico = document.createElement("button");
    btnHistorico.className = "btn-secondary btn-sm";
    btnHistorico.textContent = "Historico";
    btnHistorico.onclick = () => abrirModalHistorico(aluno);
    footer.appendChild(btnHistorico);
    
    // Botao Ver Presenca
    const btnPresenca = document.createElement("button");
    btnPresenca.className = "btn-secondary btn-sm";
    btnPresenca.textContent = "Presenca";
    btnPresenca.onclick = () => {
      UI.navigate("presenca");
    };
    footer.appendChild(btnPresenca);
    
    // Botao Editar Bolsa
    const btnEditar = document.createElement("button");
    btnEditar.className = "btn-secondary btn-sm";
    btnEditar.textContent = "Editar Bolsa";
    btnEditar.onclick = () => abrirModalEditarBolsa(aluno);
    footer.appendChild(btnEditar);
    
    // Botao Remover Bolsa
    const btnRemover = document.createElement("button");
    btnRemover.className = "btn-muted btn-sm";
    btnRemover.textContent = "Remover Bolsa";
    btnRemover.style.color = "#dc2626";
    btnRemover.onclick = () => removerBolsa(aluno);
    footer.appendChild(btnRemover);
    
    grid.appendChild(card);
  });
  
  container.appendChild(grid);
}

/** Formata tipo de bolsa para exibicao */
function formatarTipoBolsa(tipo) {
  const tipos = {
    integral: "Integral",
    parcial: "Parcial",
    apoio: "Apoio"
  };
  return tipos[tipo] || tipo;
}

/** Modal para cadastrar novo bolsista (cria aluno automaticamente) */
function abrirModalNovoBolsista() {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";
  
  const turmas = DataStore.state.data.turmas.filter(t => t.ativa !== false);
  
  modal.innerHTML = `
    <h2 class="modal-title">Novo Bolsista</h2>
    <p style="color: var(--color-text-secondary); margin-bottom: 1rem; font-size: 0.9rem;">Cadastre um bolsista diretamente. Um aluno sera criado automaticamente.</p>
    
    <div class="modal-grid">
      <div class="field">
        <label>Nome *</label>
        <input id="novo-bolsista-nome" data-testid="input-new-bolsista-nome" placeholder="Nome completo do bolsista" required>
      </div>
      
      <div class="field">
        <label>Telefone</label>
        <input id="novo-bolsista-telefone" data-testid="input-new-bolsista-telefone" placeholder="(00) 00000-0000">
      </div>
      
      <div class="field full-width">
        <label>Turmas (pode adicionar varias)</label>
        <div id="novo-bolsista-turmas-chips" data-testid="container-new-bolsista-turmas" style="display: flex; flex-wrap: wrap; gap: 0.5rem; min-height: 40px; padding: 0.75rem; background: var(--bg-card, #fff); border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 0.5rem;"></div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <select id="novo-bolsista-add-turma" data-testid="select-new-bolsista-turma" style="flex: 1; padding: 0.5rem;">
            <option value="">Selecionar turma...</option>
            ${turmas.map(t => `<option value="${t.id}">${t.nome} - ${t.nivel || "Sem nivel"}</option>`).join("")}
          </select>
          <button type="button" id="btn-add-turma-novo" data-testid="button-add-turma-new" class="btn-secondary" style="white-space: nowrap;">Adicionar</button>
        </div>
      </div>
      
      <div class="field">
        <label>Tipo de Bolsa *</label>
        <select id="novo-bolsista-tipo" data-testid="select-new-bolsista-tipo">
          <option value="integral">Integral (100%)</option>
          <option value="parcial">Parcial</option>
          <option value="apoio">Apoio</option>
        </select>
      </div>
      
      <div class="field full-width">
        <label>Observacao</label>
        <textarea id="novo-bolsista-obs" data-testid="input-new-bolsista-obs" rows="3" placeholder="Motivo da bolsa, condicoes, etc."></textarea>
      </div>
    </div>
    
    <div class="modal-actions">
      <button class="modal-btn-secondary" data-testid="button-cancel-new-bolsista">Cancelar</button>
      <button class="modal-btn-primary" data-testid="button-save-new-bolsista">Cadastrar Bolsista</button>
    </div>
  `;
  
  // Estado local para turmas selecionadas
  let turmasSelecionadas = [];
  
  function renderTurmasChipsNovo() {
    const container = modal.querySelector("#novo-bolsista-turmas-chips");
    container.innerHTML = "";
    
    if (turmasSelecionadas.length === 0) {
      container.innerHTML = '<span style="color: var(--color-text-secondary); font-style: italic;">Nenhuma turma selecionada</span>';
      return;
    }
    
    turmasSelecionadas.forEach(tid => {
      const t = DataStore.findById("turmas", tid);
      if (!t) return;
      
      const chip = document.createElement("span");
      chip.style.cssText = "display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: #e0f2fe; color: #0369a1; border-radius: 6px; font-size: 0.9rem; margin-bottom: 0.25rem;";
      
      const chipText = document.createElement("span");
      chipText.textContent = `${t.nome} - ${t.nivel || "Sem nivel"}`;
      chip.appendChild(chipText);
      
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.style.cssText = "background: #dc2626; border: none; cursor: pointer; color: #fff; font-weight: bold; padding: 2px 6px; font-size: 0.75rem; border-radius: 3px; margin-left: 0.25rem;";
      removeBtn.title = "Remover turma";
      removeBtn.textContent = "X";
      chip.appendChild(removeBtn);
      
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        turmasSelecionadas = turmasSelecionadas.filter(id => id !== tid);
        renderTurmasChipsNovo();
        atualizarSelectTurmasNovo();
      };
      container.appendChild(chip);
    });
  }
  
  function atualizarSelectTurmasNovo() {
    const select = modal.querySelector("#novo-bolsista-add-turma");
    const disponiveis = turmas.filter(t => !turmasSelecionadas.includes(t.id));
    select.innerHTML = '<option value="">Selecionar turma...</option>';
    disponiveis.forEach(t => {
      select.innerHTML += `<option value="${t.id}">${t.nome} - ${t.nivel || "Sem nivel"}</option>`;
    });
  }
  
  // Inicializar
  renderTurmasChipsNovo();
  
  // Adicionar turma
  modal.querySelector("#btn-add-turma-novo").onclick = () => {
    const select = modal.querySelector("#novo-bolsista-add-turma");
    const tid = select.value;
    if (!tid) {
      alert("Selecione uma turma!");
      return;
    }
    turmasSelecionadas.push(tid);
    renderTurmasChipsNovo();
    atualizarSelectTurmasNovo();
  };
  
  modal.querySelector(".modal-btn-secondary").onclick = () => overlay.remove();
  
  modal.querySelector(".modal-btn-primary").onclick = () => {
    const nome = modal.querySelector("#novo-bolsista-nome").value.trim();
    const telefone = modal.querySelector("#novo-bolsista-telefone").value.trim();
    const tipo = modal.querySelector("#novo-bolsista-tipo").value;
    const obs = modal.querySelector("#novo-bolsista-obs").value.trim();
    
    if (!nome) {
      alert("O nome e obrigatorio!");
      return;
    }
    
    // Criar aluno automaticamente com multi-turma
    const novoAluno = {
      id: crypto.randomUUID(),
      nome: nome,
      telefone: telefone || "",
      email: "",
      cpf: "",
      turma: turmasSelecionadas.length > 0 ? turmasSelecionadas[0] : null,
      turmas_ids: [...turmasSelecionadas], // Copia para evitar mutacao
      unidade: null,
      tipoMatricula: "bolsista",
      mensalidade: 0,
      status: "ativo",
      historico: [],
      bolsa: {
        ativa: true,
        tipo: tipo,
        observacao: obs,
        concedidaEm: new Date().toISOString()
      },
      createdAt: new Date().toISOString()
    };
    
    DataStore.state.data.alunos.push(novoAluno);
    DataStore.save();
    
    // Adicionar eventos ao historico
    adicionarEventoAluno(novoAluno.id, "Aluno cadastrado como bolsista");
    adicionarEventoAluno(novoAluno.id, `Bolsa concedida - Tipo: ${formatarTipoBolsa(tipo)}`);
    
    // Registrar turmas vinculadas
    turmasSelecionadas.forEach(tid => {
      const t = DataStore.findById("turmas", tid);
      if (t) {
        adicionarEventoAluno(novoAluno.id, `Bolsista vinculado a turma ${t.nome} - ${t.nivel || "Sem nivel"}`);
      }
    });
    
    overlay.remove();
    
    // Atualizar interface
    atualizarDropdownBolsistas();
    renderBolsistasChips();
    renderCardsBolsistas();
    
    alert(`Bolsista "${nome}" cadastrado com sucesso!`);
  };
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/** Modal para conceder bolsa a um aluno */
function abrirModalConcederBolsa() {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";
  
  // Alunos que NAO sao bolsistas
  const alunosDisponiveis = DataStore.state.data.alunos.filter(a => 
    a.status === "ativo" && !isBolsista(a)
  );
  
  modal.innerHTML = `
    <h2 class="modal-title">Conceder Bolsa</h2>
    
    <div class="modal-grid">
      <div class="field">
        <label>Aluno *</label>
        <select id="bolsa-aluno" data-testid="select-scholarship-student">
          <option value="">Selecione um aluno</option>
        </select>
      </div>
      
      <div class="field">
        <label>Tipo de Bolsa *</label>
        <select id="bolsa-tipo" data-testid="select-scholarship-type">
          <option value="integral">Integral (100%)</option>
          <option value="parcial">Parcial</option>
          <option value="apoio">Apoio</option>
        </select>
      </div>
      
      <div class="field full-width">
        <label>Observacao</label>
        <textarea id="bolsa-obs" rows="3" placeholder="Motivo da bolsa, condicoes, etc."></textarea>
      </div>
    </div>
    
    <div class="modal-actions">
      <button class="modal-btn-secondary">Cancelar</button>
      <button class="modal-btn-primary" data-testid="button-grant-scholarship">Conceder Bolsa</button>
    </div>
  `;
  
  // Preencher select de alunos
  const selectAluno = modal.querySelector("#bolsa-aluno");
  alunosDisponiveis.forEach(a => {
    const option = document.createElement("option");
    option.value = a.id;
    option.textContent = a.nome;
    selectAluno.appendChild(option);
  });
  
  modal.querySelector(".modal-btn-secondary").onclick = () => overlay.remove();
  
  modal.querySelector(".modal-btn-primary").onclick = () => {
    const alunoId = selectAluno.value;
    const tipo = modal.querySelector("#bolsa-tipo").value;
    const obs = modal.querySelector("#bolsa-obs").value.trim();
    
    if (!alunoId) {
      alert("Selecione um aluno!");
      return;
    }
    
    const aluno = DataStore.findById("alunos", alunoId);
    if (!aluno) return;
    
    // Definir bolsa
    aluno.bolsa = {
      ativa: true,
      tipo: tipo,
      observacao: obs,
      concedidaEm: new Date().toISOString()
    };
    
    // Atualizar tipoMatricula para bolsista (para presenca)
    aluno.tipoMatricula = "bolsista";
    
    DataStore.save();
    
    // Adicionar evento ao historico
    adicionarEventoAluno(alunoId, `Bolsa concedida - Tipo: ${formatarTipoBolsa(tipo)}`);
    
    overlay.remove();
    renderCardsBolsistas();
    alert("Bolsa concedida com sucesso!");
  };
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/** Modal para editar bolsa de um aluno */
function abrirModalEditarBolsa(aluno) {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";
  // CSS-only fix: max-height + flex layout para scroll interno e footer fixo
  modal.style.cssText = "max-height: 90vh; display: flex; flex-direction: column;";
  
  const todasTurmas = DataStore.state.data.turmas.filter(t => t.ativa !== false);
  let turmasVinculadas = [...getTurmasIds(aluno)]; // Copia para manipulacao
  
  modal.innerHTML = `
    <h2 class="modal-title" style="flex-shrink: 0;">Editar Bolsa - ${aluno.nome}</h2>
    
    <div class="modal-grid" style="flex: 1; overflow-y: auto; padding-right: 0.5rem;">
      <div class="field">
        <label>Tipo de Bolsa *</label>
        <select id="bolsa-tipo" data-testid="select-bolsa-tipo">
          <option value="integral" ${aluno.bolsa?.tipo === "integral" ? "selected" : ""}>Integral (100%)</option>
          <option value="parcial" ${aluno.bolsa?.tipo === "parcial" ? "selected" : ""}>Parcial</option>
          <option value="apoio" ${aluno.bolsa?.tipo === "apoio" ? "selected" : ""}>Apoio</option>
        </select>
      </div>
      
      <div class="field full-width">
        <label>Turmas Vinculadas</label>
        <div id="turmas-chips-container" data-testid="container-turmas-vinculadas" style="display: flex; flex-wrap: wrap; gap: 0.5rem; min-height: 40px; max-height: 200px; overflow-y: auto; padding: 0.75rem; background: var(--bg-card, #fff); border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 0.5rem;"></div>
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          <select id="adicionar-turma" data-testid="select-add-turma" style="flex: 1; padding: 0.5rem; min-width: 200px;">
            <option value="">Selecionar turma para adicionar...</option>
          </select>
          <button type="button" id="btn-add-turma" data-testid="button-add-turma" class="btn-primary" style="white-space: nowrap;">Adicionar</button>
          <button type="button" id="btn-limpar-turmas" data-testid="button-clear-turmas" class="btn-secondary" style="white-space: nowrap; color: #dc2626;">Limpar Todas</button>
        </div>
      </div>
      
      <div class="field full-width">
        <label>Observacao</label>
        <textarea id="bolsa-obs" data-testid="input-bolsa-obs" rows="3">${aluno.bolsa?.observacao || ""}</textarea>
      </div>
    </div>
    
    <div class="modal-actions" style="flex-shrink: 0; border-top: 1px solid var(--color-border, #e2e8f0); padding-top: 1rem; margin-top: 1rem;">
      <button class="modal-btn-secondary" data-testid="button-cancel-bolsa">Cancelar</button>
      <button class="modal-btn-primary" data-testid="button-save-bolsa">Salvar</button>
    </div>
  `;
  
  // Funcao para atualizar dropdown de turmas disponiveis
  function atualizarDropdownTurmas() {
    const select = modal.querySelector("#adicionar-turma");
    const turmasDisponiveis = todasTurmas.filter(t => !turmasVinculadas.includes(t.id));
    select.innerHTML = '<option value="">Selecionar turma para adicionar...</option>';
    turmasDisponiveis.forEach(t => {
      select.innerHTML += `<option value="${t.id}">${t.nome} - ${t.nivel || "Sem nivel"}</option>`;
    });
  }
  
  // Funcao para renderizar chips de turmas
  function renderTurmasChips() {
    const container = modal.querySelector("#turmas-chips-container");
    container.innerHTML = "";
    
    if (turmasVinculadas.length === 0) {
      container.innerHTML = '<span style="color: var(--color-text-secondary); font-style: italic;">Nenhuma turma vinculada</span>';
      return;
    }
    
    turmasVinculadas.forEach(tid => {
      const turma = DataStore.findById("turmas", tid);
      if (!turma) return;
      
      const chip = document.createElement("span");
      chip.style.cssText = "display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: #e0f2fe; color: #0369a1; border-radius: 6px; font-size: 0.9rem; margin-bottom: 0.25rem;";
      chip.setAttribute("data-testid", `chip-turma-${tid}`);
      
      const chipText = document.createElement("span");
      chipText.textContent = `${turma.nome} - ${turma.nivel || "Sem nivel"}`;
      chip.appendChild(chipText);
      
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.setAttribute("data-id", tid);
      removeBtn.setAttribute("data-testid", `button-remove-turma-${tid}`);
      removeBtn.style.cssText = "background: #dc2626; border: none; cursor: pointer; color: #fff; font-weight: bold; padding: 2px 6px; font-size: 0.75rem; border-radius: 3px; margin-left: 0.25rem;";
      removeBtn.title = "Remover turma";
      removeBtn.textContent = "X";
      chip.appendChild(removeBtn);
      
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        turmasVinculadas = turmasVinculadas.filter(id => id !== tid);
        renderTurmasChips();
        atualizarDropdownTurmas();
      };
      
      container.appendChild(chip);
    });
  }
  
  // Inicializar
  atualizarDropdownTurmas();
  renderTurmasChips();
  
  // Adicionar turma
  modal.querySelector("#btn-add-turma").onclick = () => {
    const select = modal.querySelector("#adicionar-turma");
    const turmaId = select.value;
    if (!turmaId) {
      alert("Selecione uma turma!");
      return;
    }
    turmasVinculadas.push(turmaId);
    renderTurmasChips();
    atualizarDropdownTurmas();
  };
  
  // Limpar todas as turmas
  modal.querySelector("#btn-limpar-turmas").onclick = () => {
    if (turmasVinculadas.length === 0) {
      alert("Nao ha turmas para remover.");
      return;
    }
    if (!confirm("Remover TODAS as turmas vinculadas?")) return;
    turmasVinculadas = [];
    renderTurmasChips();
    atualizarDropdownTurmas();
  };
  
  modal.querySelector(".modal-btn-secondary").onclick = () => overlay.remove();
  
  modal.querySelector(".modal-btn-primary").onclick = () => {
    const tipo = modal.querySelector("#bolsa-tipo").value;
    const obs = modal.querySelector("#bolsa-obs").value.trim();
    
    const tipoAnterior = aluno.bolsa?.tipo;
    const turmasAnteriores = getTurmasIds(aluno);
    
    // Atualizar bolsa
    aluno.bolsa = {
      ...aluno.bolsa,
      tipo: tipo,
      observacao: obs,
      atualizadaEm: new Date().toISOString()
    };
    
    // Atualizar turmas
    setTurmasIds(aluno, turmasVinculadas);
    
    DataStore.save();
    
    // Registrar historico para mudanca de tipo
    if (tipoAnterior !== tipo) {
      adicionarEventoAluno(aluno.id, `Bolsa atualizada - Tipo: ${formatarTipoBolsa(tipoAnterior)} -> ${formatarTipoBolsa(tipo)}`);
    }
    
    // Registrar historico para turmas adicionadas
    const turmasAdicionadas = turmasVinculadas.filter(t => !turmasAnteriores.includes(t));
    turmasAdicionadas.forEach(tid => {
      const turma = DataStore.findById("turmas", tid);
      if (turma) {
        adicionarEventoAluno(aluno.id, `Bolsista vinculado a turma ${turma.nome} - ${turma.nivel || "Sem nivel"}`);
      }
    });
    
    // Registrar historico para turmas removidas
    const turmasRemovidas = turmasAnteriores.filter(t => !turmasVinculadas.includes(t));
    turmasRemovidas.forEach(tid => {
      const turma = DataStore.findById("turmas", tid);
      if (turma) {
        adicionarEventoAluno(aluno.id, `Bolsista removido da turma ${turma.nome} - ${turma.nivel || "Sem nivel"}`);
      }
    });
    
    overlay.remove();
    renderBolsistasChips();
    renderCardsBolsistas();
    alert("Bolsa atualizada com sucesso!");
  };
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/** Remove bolsa de um aluno (sem excluir o aluno) */
function removerBolsa(aluno) {
  if (!confirm(`Remover bolsa de ${aluno.nome}?\n\nO aluno continuara cadastrado no sistema, apenas perdera a bolsa.`)) {
    return;
  }
  
  // Remover bolsa
  aluno.bolsa = {
    ativa: false,
    removidaEm: new Date().toISOString()
  };
  
  // Restaurar tipoMatricula para normal
  aluno.tipoMatricula = "regular";
  
  DataStore.save();
  
  // Adicionar evento ao historico
  adicionarEventoAluno(aluno.id, "Bolsa removida");
  
  renderCardsBolsistas();
  alert("Bolsa removida. O aluno continua cadastrado no sistema.");
}

/** Renderiza página de alunos TRANCADOS */
function renderTrancados() {
  const container = document.createElement("div");
  container.id = "trancados-container";

  // Exclui bolsistas conforme regra do sistema
  const todosTrancados = DataStore.state.data.alunos.filter(a => 
    a.status === "trancado" && !isBolsista(a)
  );
  const unidades = DataStore.state.data.unidades.filter(u => u.ativa !== false);
  const turmas = DataStore.state.data.turmas.filter(t => t.ativa !== false);

  // Filtros
  const filtrosDiv = document.createElement("div");
  filtrosDiv.className = "filtros-trancados";
  filtrosDiv.style.cssText = "display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; align-items: center;";

  // Select Unidade
  const selectUnidade = document.createElement("select");
  selectUnidade.id = "filtro-unidade-trancados";
  selectUnidade.className = "form-input";
  selectUnidade.style.cssText = "min-width: 180px; max-width: 220px;";
  selectUnidade.setAttribute("data-testid", "select-unidade-trancados");
  selectUnidade.innerHTML = `<option value="">Todas as unidades</option>` + 
    unidades.map(u => `<option value="${u.id}">${u.nome}</option>`).join("");

  // Select Turma
  const selectTurma = document.createElement("select");
  selectTurma.id = "filtro-turma-trancados";
  selectTurma.className = "form-input";
  selectTurma.style.cssText = "min-width: 180px; max-width: 220px;";
  selectTurma.setAttribute("data-testid", "select-turma-trancados");
  selectTurma.innerHTML = `<option value="">Todas as turmas</option>`;

  // Input Busca Nome
  const inputNome = document.createElement("input");
  inputNome.type = "text";
  inputNome.id = "filtro-nome-trancados";
  inputNome.className = "form-input";
  inputNome.placeholder = "Buscar por nome...";
  inputNome.style.cssText = "min-width: 180px; max-width: 250px;";
  inputNome.setAttribute("data-testid", "input-nome-trancados");

  // Contagem
  const contagem = document.createElement("span");
  contagem.id = "contagem-trancados";
  contagem.style.cssText = "color: #64748b; font-size: 0.9rem; margin-left: auto;";

  filtrosDiv.appendChild(selectUnidade);
  filtrosDiv.appendChild(selectTurma);
  filtrosDiv.appendChild(inputNome);
  filtrosDiv.appendChild(contagem);

  // Grid para cards
  const grid = criarGridCards();
  grid.id = "grid-trancados";

  container.appendChild(filtrosDiv);
  container.appendChild(grid);
  UI.content.appendChild(container);

  // Funcao para atualizar turmas conforme unidade
  function atualizarTurmasDisponiveis() {
    const unidadeId = selectUnidade.value;
    let turmasFiltradas = turmas;
    if (unidadeId) {
      turmasFiltradas = turmas.filter(t => t.unidade_id === unidadeId);
    }
    selectTurma.innerHTML = `<option value="">Todas as turmas</option>` +
      turmasFiltradas.map(t => `<option value="${t.id}">${t.nome} - ${t.nivel}</option>`).join("");
  }

  // Funcao para filtrar e renderizar
  function filtrarTrancados() {
    const unidadeId = selectUnidade.value;
    const turmaId = selectTurma.value;
    const nomeBusca = inputNome.value.toLowerCase().trim();

    let alunosFiltrados = todosTrancados;

    // Filtrar por unidade
    if (unidadeId) {
      alunosFiltrados = alunosFiltrados.filter(a => a.unidade_id === unidadeId);
    }

    // Filtrar por turma
    if (turmaId) {
      alunosFiltrados = alunosFiltrados.filter(a => alunoEmTurma(a, turmaId));
    }

    // Filtrar por nome
    if (nomeBusca) {
      alunosFiltrados = alunosFiltrados.filter(a => 
        (a.nome || "").toLowerCase().includes(nomeBusca)
      );
    }

    // Atualizar contagem
    contagem.textContent = `${alunosFiltrados.length} aluno${alunosFiltrados.length !== 1 ? "s" : ""} trancado${alunosFiltrados.length !== 1 ? "s" : ""} encontrado${alunosFiltrados.length !== 1 ? "s" : ""}`;

    // Limpar grid
    grid.innerHTML = "";

    // Estado vazio
    if (alunosFiltrados.length === 0) {
      const vazio = document.createElement("div");
      vazio.style.cssText = "grid-column: 1 / -1; text-align: center; color: #64748b; padding: 2rem;";
      vazio.textContent = todosTrancados.length === 0 
        ? "Nenhum aluno trancado." 
        : "Nenhum aluno trancado encontrado com os filtros aplicados.";
      grid.appendChild(vazio);
      return;
    }

    // Renderizar cards
    alunosFiltrados.forEach(aluno => {
      const turma = DataStore.findById("turmas", aluno.turma);
      const unidade = DataStore.findById("unidades", aluno.unidade_id);
      const dataTrancamento = aluno.dataTrancamento 
        ? new Date(aluno.dataTrancamento).toLocaleDateString("pt-BR") 
        : "N/A";

      const card = document.createElement("div");
      card.className = "summary-card";
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <strong style="font-size: 1.1rem;">${aluno.nome}</strong>
          <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; background: #fef2f2; color: #dc2626;">Trancado</span>
        </div>
        <p style="margin: 0.5rem 0; color: #64748b; font-size: 0.9rem;">
          Tel: ${aluno.telefone || "Nao informado"}<br>
          Unidade: ${unidade ? unidade.nome : "Sem unidade"}<br>
          Turma: ${turma ? `${turma.nome} (${turma.nivel})` : "Sem turma"}<br>
          Trancado em: ${dataTrancamento}
        </p>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap;"></div>
      `;

      const acoes = card.querySelector("div:last-child");

      const btnHistorico = document.createElement("button");
      btnHistorico.className = "btn-secondary";
      btnHistorico.textContent = "Historico";
      btnHistorico.onclick = () => abrirHistoricoAluno(aluno);
      acoes.appendChild(btnHistorico);

      const btnReativar = document.createElement("button");
      btnReativar.className = "btn-primary";
      btnReativar.textContent = "Reativar";
      btnReativar.onclick = () => {
        aluno.status = "ativo";
        delete aluno.dataTrancamento;
        adicionarEventoAluno(aluno.id, "Matricula reativada");
        UI.navigate("trancados");
      };
      acoes.appendChild(btnReativar);

      const btnExcluir = document.createElement("button");
      btnExcluir.className = "btn-secondary";
      btnExcluir.textContent = "Excluir Definitivamente";
      btnExcluir.onclick = () => {
        if (confirm("Mover para lixeira? O aluno podera ser restaurado posteriormente.")) {
          aluno.status = "excluido";
          aluno.dataExclusao = new Date().toISOString();
          adicionarEventoAluno(aluno.id, "Aluno excluido");
          UI.navigate("trancados");
        }
      };
      acoes.appendChild(btnExcluir);

      grid.appendChild(card);
    });
  }

  // Event listeners
  selectUnidade.addEventListener("change", () => {
    atualizarTurmasDisponiveis();
    filtrarTrancados();
  });
  selectTurma.addEventListener("change", filtrarTrancados);
  inputNome.addEventListener("input", filtrarTrancados);

  // Renderizacao inicial
  atualizarTurmasDisponiveis();
  filtrarTrancados();
}

/** Abre modal com historico do aluno */
function abrirHistoricoAluno(aluno) {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";
  modal.style.maxWidth = "500px";

  const historico = aluno.historico || [];
  
  let htmlEventos = "";
  if (historico.length === 0) {
    htmlEventos = '<p style="color: #64748b; text-align: center;">Nenhum evento registrado.</p>';
  } else {
    const eventosOrdenados = [...historico].sort((a, b) => new Date(b.data) - new Date(a.data));
    htmlEventos = eventosOrdenados.map(e => `
      <div style="display: flex; gap: 0.75rem; padding: 0.75rem; background: #f8fafc; border-radius: 6px; margin-bottom: 0.5rem;">
        <div style="width: 3px; background: #3b82f6; border-radius: 2px;"></div>
        <div>
          <div style="font-weight: 500; color: #374151;">${e.evento}</div>
          <div style="font-size: 0.8rem; color: #94a3b8;">${formatarData(e.data)} ${new Date(e.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </div>
    `).join("");
  }

  modal.innerHTML = `
    <h2 class="modal-title">Historico - ${aluno.nome}</h2>
    
    <div style="max-height: 400px; overflow-y: auto; margin-bottom: 1rem;">
      ${htmlEventos}
    </div>

    <div class="modal-actions">
      <button class="modal-btn-secondary">Fechar</button>
    </div>
  `;

  modal.querySelector(".modal-btn-secondary").onclick = () => overlay.remove();

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/** Modal para criar/editar aluno */
function abrirModalAluno(alunoExistente = null) {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";

  const isEdicao = !!alunoExistente;
  
  // Obter turmas atuais do aluno (suporte a modelo antigo e novo)
  const turmasAtuaisIds = alunoExistente ? getTurmasIds(alunoExistente) : [];
  
  // Obter unidades das turmas selecionadas
  const getUnidadesTexto = (turmaIds) => {
    if (!turmaIds || turmaIds.length === 0) return "";
    const unidades = new Set();
    turmaIds.forEach(tid => {
      const turma = DataStore.findById("turmas", tid);
      if (turma) {
        const unidade = DataStore.findById("unidades", turma.unidade_id);
        unidades.add(unidade?.nome || turma.unidade || "");
      }
    });
    return Array.from(unidades).filter(u => u).join(", ");
  };

  modal.innerHTML = `
    <h2 class="modal-title">${isEdicao ? "Editar Aluno" : "Novo Aluno"}</h2>

    <div class="modal-grid">
      <div class="field">
        <label>Nome *</label>
        <input id="nome" data-testid="input-nome" placeholder="Nome completo" value="${alunoExistente?.nome || ""}">
      </div>

      <div class="field">
        <label>Telefone *</label>
        <input id="telefone" data-testid="input-telefone" placeholder="(00) 00000-0000" value="${alunoExistente?.telefone || ""}">
      </div>

      <div class="field">
        <label>E-mail</label>
        <input id="email" data-testid="input-email" type="email" placeholder="email@exemplo.com" value="${alunoExistente?.email || ""}">
      </div>

      <div class="field">
        <label>CPF</label>
        <input id="cpf" data-testid="input-cpf" placeholder="000.000.000-00" value="${alunoExistente?.cpf || ""}">
      </div>

      <div class="field" style="grid-column: span 2;">
        <label>Turmas * (selecione uma ou mais)</label>
        <div id="turmas-container" class="turmas-select-container">
        </div>
        <small style="color: var(--text-muted); margin-top: 0.25rem; display: block;">Marque as turmas em que o aluno participara</small>
      </div>

      <div class="field">
        <label>Unidade(s)</label>
        <input id="unidade" readonly style="background: #f1f5f9;" value="${getUnidadesTexto(turmasAtuaisIds)}">
      </div>

      <div class="field">
        <label>Tipo de Matrícula</label>
        <select id="tipo" data-testid="select-tipo">
          <option value="Normal" ${alunoExistente?.tipo === "Normal" ? "selected" : ""}>Normal</option>
          <option value="Casal" ${alunoExistente?.tipo === "Casal" ? "selected" : ""}>Casal</option>
          <option value="Múltiplas" ${alunoExistente?.tipo === "Múltiplas" ? "selected" : ""}>Multiplas turmas</option>
        </select>
      </div>

      <div class="field">
        <label>Mensalidade (R$)</label>
        <input id="mensalidade" data-testid="input-mensalidade" type="number" placeholder="0.00" value="${alunoExistente?.mensalidade || ""}">
      </div>
    </div>

    <div class="modal-actions">
      <button class="modal-btn-secondary" data-testid="button-cancelar">Cancelar</button>
      <button class="modal-btn-primary" data-testid="button-salvar">${isEdicao ? "Salvar" : "Criar"}</button>
    </div>
  `;

  modal.querySelector(".modal-btn-secondary").onclick = () => overlay.remove();

  const turmasContainer = modal.querySelector("#turmas-container");
  const inputUnidade = modal.querySelector("#unidade");

  // Popular checkboxes de turmas
  const turmasAtivas = DataStore.state.data.turmas.filter(t => t.ativa !== false);
  
  if (turmasAtivas.length === 0) {
    turmasContainer.innerHTML = '<p style="color: #64748b; margin: 0;">Nenhuma turma cadastrada</p>';
  } else {
    turmasAtivas.forEach(turma => {
      const unidade = DataStore.findById("unidades", turma.unidade_id);
      const isChecked = turmasAtuaisIds.includes(turma.id);
      
      const checkboxDiv = document.createElement("div");
      checkboxDiv.className = "turma-checkbox-item";
      checkboxDiv.innerHTML = `
        <input type="checkbox" id="turma-${turma.id}" value="${turma.id}" data-testid="checkbox-turma-${turma.id}" ${isChecked ? "checked" : ""}>
        <label for="turma-${turma.id}">
          <strong>${turma.nome}</strong> - ${turma.nivel}
          ${unidade ? `<span class="turma-unidade">(${unidade.nome})</span>` : ""}
        </label>
      `;
      turmasContainer.appendChild(checkboxDiv);
    });
  }

  // Atualizar unidade ao mudar seleção de turmas
  const atualizarUnidades = () => {
    const checkboxes = turmasContainer.querySelectorAll('input[type="checkbox"]:checked');
    const turmaIds = Array.from(checkboxes).map(cb => cb.value);
    inputUnidade.value = getUnidadesTexto(turmaIds);
  };

  turmasContainer.addEventListener("change", atualizarUnidades);

  modal.querySelector(".modal-btn-primary").onclick = () => {
    const nome = modal.querySelector("#nome").value.trim();
    const telefone = modal.querySelector("#telefone").value.trim();
    
    // Obter turmas selecionadas
    const checkboxes = turmasContainer.querySelectorAll('input[type="checkbox"]:checked');
    const turmasSelecionadas = Array.from(checkboxes).map(cb => cb.value);

    if (!nome) {
      alert("Nome e obrigatorio!");
      return;
    }
    if (!telefone) {
      alert("Telefone e obrigatorio!");
      return;
    }
    if (turmasSelecionadas.length === 0) {
      alert("Selecione ao menos uma turma!");
      return;
    }

    const email = modal.querySelector("#email").value.trim();
    const cpf = modal.querySelector("#cpf").value.trim();

    const dados = {
      nome: nome,
      telefone: telefone,
      email: email || null,
      cpf: cpf || null,
      turma: turmasSelecionadas[0], // Primeiro ID para compatibilidade
      turmas_ids: turmasSelecionadas, // Array completo
      unidade: inputUnidade.value,
      tipo: modal.querySelector("#tipo").value,
      mensalidade: Number(modal.querySelector("#mensalidade").value),
    };

    if (isEdicao) {
      Object.assign(alunoExistente, dados);
    } else {
      const novoAluno = {
        id: crypto.randomUUID(),
        ...dados,
        ativo: true,
        status: "ativo",
        dataMatricula: new Date().toISOString(),
        historico: [{ data: new Date().toISOString(), evento: "Matricula criada" }]
      };
      DataStore.state.data.alunos.push(novoAluno);
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
    // Compatibilidade: pegar professores_ids ou migrar de professor_id
    const professoresIds = turma.professores_ids || (turma.professor_id ? [turma.professor_id] : []);
    const professoresNomes = professoresIds
      .map(id => DataStore.findById("professores", id)?.nome)
      .filter(Boolean)
      .join(", ");
    const unidade = DataStore.findById("unidades", turma.unidade_id);
    const monitoresNomes = (turma.monitores_ids || [])
      .map(id => DataStore.findById("professores", id)?.nome)
      .filter(Boolean)
      .join(", ");
    
    // ALUNO e a UNICA fonte da verdade - calculo DINAMICO
    // Exibir apenas alunos PAGANTES (bolsistas aparecem na aba Bolsistas)
    const alunosMatriculados = getAlunosPagantesDaTurma(turma.id);
    
    const listaAlunosHtml = alunosMatriculados.length > 0
      ? alunosMatriculados.map(a => {
          return `<li style="padding: 2px 0;">${a.nome}</li>`;
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
        Professores: ${professoresNomes || "Sem professores vinculados"}<br>
        Monitores: ${monitoresNomes || "Sem monitores vinculados"}
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

      <div class="field" style="grid-column: span 2;">
        <label>Dias da Semana</label>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.25rem;">
          <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
            <input type="checkbox" id="dia-seg" ${turmaExistente?.diasSemana?.includes("seg") ? "checked" : ""}> Seg
          </label>
          <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
            <input type="checkbox" id="dia-ter" ${turmaExistente?.diasSemana?.includes("ter") ? "checked" : ""}> Ter
          </label>
          <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
            <input type="checkbox" id="dia-qua" ${turmaExistente?.diasSemana?.includes("qua") ? "checked" : ""}> Qua
          </label>
          <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
            <input type="checkbox" id="dia-qui" ${turmaExistente?.diasSemana?.includes("qui") ? "checked" : ""}> Qui
          </label>
          <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
            <input type="checkbox" id="dia-sex" ${turmaExistente?.diasSemana?.includes("sex") ? "checked" : ""}> Sex
          </label>
          <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
            <input type="checkbox" id="dia-sab" ${turmaExistente?.diasSemana?.includes("sab") ? "checked" : ""}> Sab
          </label>
          <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
            <input type="checkbox" id="dia-dom" ${turmaExistente?.diasSemana?.includes("dom") ? "checked" : ""}> Dom
          </label>
        </div>
      </div>

      <div class="field">
        <label>Horario</label>
        <input id="horario" placeholder="Ex: 19:00 - 20:30" value="${turmaExistente?.horarioTempo || turmaExistente?.horario || ""}">
      </div>

      <div class="field" style="grid-column: span 2;">
        <label>Professores</label>
        <div id="professores-chips" data-testid="container-professores-chips" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem; min-height: 32px; padding: 0.5rem; background: var(--bg-card, #fff); border: 1px solid #e2e8f0; border-radius: 4px;"></div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <select id="professores-select" data-testid="select-professores" style="flex: 1;">
            <option value="">Adicionar professor...</option>
          </select>
          <button type="button" id="btn-add-professor" data-testid="button-add-professor" class="btn-secondary" style="white-space: nowrap;">Adicionar</button>
          <button type="button" id="btn-clear-professores" data-testid="button-clear-professores" class="btn-secondary" style="white-space: nowrap;">Limpar Todos</button>
        </div>
      </div>

      <div class="field" style="grid-column: span 2;">
        <label>Monitores</label>
        <div id="monitores-chips" data-testid="container-monitores-chips" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem; min-height: 32px; padding: 0.5rem; background: var(--bg-card, #fff); border: 1px solid #e2e8f0; border-radius: 4px;"></div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <select id="monitores-select" data-testid="select-monitores" style="flex: 1;">
            <option value="">Adicionar monitor...</option>
          </select>
          <button type="button" id="btn-add-monitor" data-testid="button-add-monitor" class="btn-secondary" style="white-space: nowrap;">Adicionar</button>
          <button type="button" id="btn-clear-monitores" data-testid="button-clear-monitores" class="btn-secondary" style="white-space: nowrap;">Limpar Todos</button>
        </div>
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

  // Sistema de chips para professores
  const professoresChipsContainer = modal.querySelector("#professores-chips");
  const selectProfessoresDropdown = modal.querySelector("#professores-select");
  const btnAddProfessor = modal.querySelector("#btn-add-professor");
  const btnClearProfessores = modal.querySelector("#btn-clear-professores");
  
  // Compatibilidade: pegar professores_ids ou migrar de professor_id
  let professoresSelecionadosIds = turmaExistente?.professores_ids?.slice() || (turmaExistente?.professor_id ? [turmaExistente.professor_id] : []);
  
  const todosProfessores = DataStore.state.data.professores.filter(p => p.ativo !== false && p.funcao === "Professor");
  
  function renderProfessoresChips() {
    professoresChipsContainer.innerHTML = "";
    if (professoresSelecionadosIds.length === 0) {
      professoresChipsContainer.innerHTML = '<span style="color: #94a3b8; font-size: 0.85rem;">Nenhum professor vinculado</span>';
    } else {
      professoresSelecionadosIds.forEach(id => {
        const prof = DataStore.findById("professores", id);
        if (prof) {
          const chip = document.createElement("span");
          chip.style.cssText = "display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; background: #dbeafe; color: #1d4ed8; border-radius: 4px; font-size: 0.85rem;";
          chip.setAttribute("data-testid", `chip-professor-${id}`);
          chip.innerHTML = `${prof.nome} <button type="button" data-id="${id}" data-testid="button-remove-professor-${id}" style="background: none; border: none; cursor: pointer; color: #1d4ed8; font-weight: bold; padding: 0 2px;">X</button>`;
          chip.querySelector("button").onclick = () => {
            professoresSelecionadosIds = professoresSelecionadosIds.filter(pid => pid !== id);
            renderProfessoresChips();
            atualizarDropdownProfessores();
          };
          professoresChipsContainer.appendChild(chip);
        }
      });
    }
  }
  
  function atualizarDropdownProfessores() {
    selectProfessoresDropdown.innerHTML = '<option value="">Adicionar professor...</option>';
    todosProfessores.filter(p => !professoresSelecionadosIds.includes(p.id)).forEach(prof => {
      const option = document.createElement("option");
      option.value = prof.id;
      option.textContent = prof.nome;
      selectProfessoresDropdown.appendChild(option);
    });
  }
  
  btnAddProfessor.onclick = () => {
    const id = selectProfessoresDropdown.value;
    if (id && !professoresSelecionadosIds.includes(id)) {
      professoresSelecionadosIds.push(id);
      renderProfessoresChips();
      atualizarDropdownProfessores();
    }
  };
  
  btnClearProfessores.onclick = () => {
    professoresSelecionadosIds = [];
    renderProfessoresChips();
    atualizarDropdownProfessores();
  };
  
  renderProfessoresChips();
  atualizarDropdownProfessores();

  // Sistema de chips para monitores
  const monitoresChipsContainer = modal.querySelector("#monitores-chips");
  const selectMonitoresDropdown = modal.querySelector("#monitores-select");
  const btnAddMonitor = modal.querySelector("#btn-add-monitor");
  const btnClearMonitores = modal.querySelector("#btn-clear-monitores");
  
  let monitoresSelecionadosIds = turmaExistente?.monitores_ids?.slice() || [];
  
  const todosMonitores = DataStore.state.data.professores.filter(p => p.ativo !== false && p.funcao === "Monitor");
  
  function renderMonitoresChips() {
    monitoresChipsContainer.innerHTML = "";
    if (monitoresSelecionadosIds.length === 0) {
      monitoresChipsContainer.innerHTML = '<span style="color: #94a3b8; font-size: 0.85rem;">Nenhum monitor vinculado</span>';
    } else {
      monitoresSelecionadosIds.forEach(id => {
        const mon = DataStore.findById("professores", id);
        if (mon) {
          const chip = document.createElement("span");
          chip.style.cssText = "display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; background: #fef9c3; color: #a16207; border-radius: 4px; font-size: 0.85rem;";
          chip.setAttribute("data-testid", `chip-monitor-${id}`);
          chip.innerHTML = `${mon.nome} <button type="button" data-id="${id}" data-testid="button-remove-monitor-${id}" style="background: none; border: none; cursor: pointer; color: #a16207; font-weight: bold; padding: 0 2px;">X</button>`;
          chip.querySelector("button").onclick = () => {
            monitoresSelecionadosIds = monitoresSelecionadosIds.filter(mid => mid !== id);
            renderMonitoresChips();
            atualizarDropdownMonitores();
          };
          monitoresChipsContainer.appendChild(chip);
        }
      });
    }
  }
  
  function atualizarDropdownMonitores() {
    selectMonitoresDropdown.innerHTML = '<option value="">Adicionar monitor...</option>';
    todosMonitores.filter(m => !monitoresSelecionadosIds.includes(m.id)).forEach(mon => {
      const option = document.createElement("option");
      option.value = mon.id;
      option.textContent = mon.nome;
      selectMonitoresDropdown.appendChild(option);
    });
  }
  
  btnAddMonitor.onclick = () => {
    const id = selectMonitoresDropdown.value;
    if (id && !monitoresSelecionadosIds.includes(id)) {
      monitoresSelecionadosIds.push(id);
      renderMonitoresChips();
      atualizarDropdownMonitores();
    }
  };
  
  btnClearMonitores.onclick = () => {
    monitoresSelecionadosIds = [];
    renderMonitoresChips();
    atualizarDropdownMonitores();
  };
  
  renderMonitoresChips();
  atualizarDropdownMonitores();

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

    const diasSelecionados = [];
    ["seg", "ter", "qua", "qui", "sex", "sab", "dom"].forEach(dia => {
      if (modal.querySelector(`#dia-${dia}`).checked) {
        diasSelecionados.push(dia);
      }
    });
    
    const horarioTempo = modal.querySelector("#horario").value;

    const dados = {
      nome: nome,
      nivel: modal.querySelector("#nivel").value,
      unidade_id: unidadeId,
      unidade: unidade?.nome || "",
      diasSemana: diasSelecionados,
      horarioTempo: horarioTempo,
      horario: diasSelecionados.length > 0 
        ? diasSelecionados.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(", ") + (horarioTempo ? ` ${horarioTempo}` : "")
        : horarioTempo,
      professores_ids: professoresSelecionadosIds,
      monitores_ids: monitoresSelecionadosIds,
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
    
    const mensalidadeBase = unidade.mensalidadeBase || 0;
    const mensalidadeFormatada = mensalidadeBase > 0 
      ? `R$ ${parseFloat(mensalidadeBase).toFixed(2).replace(".", ",")}`
      : "Nao definida";

    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `
      <strong style="font-size: 1.1rem;">${unidade.nome}</strong>
      <p style="margin: 0.5rem 0; color: #64748b; font-size: 0.9rem;">
        Endereco: ${unidade.endereco || "Nao informado"}<br>
        Turmas: ${turmasVinculadas} vinculada(s)<br>
        Mensalidade Base: <strong style="color: var(--color-primary, #0ea5e9);">${mensalidadeFormatada}</strong>
      </p>
      <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap;"></div>
    `;

    const acoes = card.querySelector("div:last-child");

    const btnEditar = document.createElement("button");
    btnEditar.className = "btn-secondary";
    btnEditar.textContent = "Editar";
    btnEditar.onclick = () => abrirModalUnidade(unidade);
    acoes.appendChild(btnEditar);
    
    // Botao Atualizar Mensalidades
    const btnAtualizar = document.createElement("button");
    btnAtualizar.className = "btn-secondary";
    btnAtualizar.textContent = "Atualizar Mensalidades";
    btnAtualizar.style.cssText = "color: #0ea5e9;";
    btnAtualizar.onclick = () => atualizarMensalidadesUnidade(unidade);
    acoes.appendChild(btnAtualizar);

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

/** Atualiza mensalidades dos alunos de uma unidade (seguro) */
function atualizarMensalidadesUnidade(unidade) {
  const novoValor = parseFloat(unidade.mensalidadeBase) || 0;
  
  if (novoValor <= 0) {
    alert("Defina um valor-base de mensalidade para esta unidade antes de atualizar.");
    return;
  }
  
  // Valor-base aplicado na ultima atualizacao
  const valorBaseAplicado = parseFloat(unidade.mensalidadeBaseAplicada) || 0;
  
  // Se nunca foi aplicado, definir como valor atual e bloquear atualizacao
  if (valorBaseAplicado === 0) {
    const confirmar = confirm(
      `Primeira definicao de valor-base para esta unidade.\n\n` +
      `Valor-base: R$ ${novoValor.toFixed(2).replace(".", ",")}\n\n` +
      `Este valor sera registrado como referencia.\n` +
      `Na PROXIMA atualizacao, alunos com este valor serao reajustados automaticamente.\n` +
      `Alunos com valores diferentes serao preservados.\n\n` +
      `Deseja registrar este valor-base?`
    );
    if (!confirmar) return;
    
    // Registrar valor-base inicial (nenhum aluno e alterado)
    unidade.mensalidadeBaseAplicada = novoValor;
    DataStore.save();
    
    alert(`Valor-base R$ ${novoValor.toFixed(2).replace(".", ",")} registrado!\n\n` +
          `Na proxima atualizacao, alunos com este valor serao reajustados automaticamente.`);
    UI.navigate("unidades");
    return;
  }
  
  // Se valor nao mudou, nao ha o que atualizar
  if (novoValor === valorBaseAplicado) {
    alert("O valor-base nao foi alterado. Nao ha alunos para atualizar.");
    return;
  }
  
  // Buscar alunos elegiveis para atualizacao
  const alunos = DataStore.state.data.alunos.filter(a => 
    a.status === "ativo" && 
    a.unidade_id === unidade.id
  );
  
  let atualizados = 0;
  let ignoradosMultiplasTurmas = 0;
  let ignoradosValorPersonalizado = 0;
  let ignoradosBolsistas = 0;
  
  alunos.forEach(aluno => {
    // Ignorar bolsistas
    if (isBolsista(aluno)) {
      ignoradosBolsistas++;
      return;
    }
    
    // Ignorar alunos com multiplas turmas
    const turmasIds = getTurmasIds(aluno);
    if (turmasIds.length > 1) {
      ignoradosMultiplasTurmas++;
      return;
    }
    
    const mensalidadeAtual = parseFloat(aluno.mensalidade) || 0;
    
    // REGRA ESTRITA: Apenas atualizar se mensalidade === valor-base aplicado anteriormente
    // Qualquer outro valor (incluindo 0) e considerado personalizado
    if (mensalidadeAtual !== valorBaseAplicado) {
      ignoradosValorPersonalizado++;
      return;
    }
    
    // Atualizar mensalidade
    aluno.mensalidade = novoValor;
    atualizados++;
  });
  
  // Registrar novo valor-base aplicado
  unidade.mensalidadeBaseAplicada = novoValor;
  DataStore.save();
  
  // Feedback detalhado
  let mensagem = `Atualizacao concluida!\n\n`;
  mensagem += `Alunos atualizados: ${atualizados}\n`;
  mensagem += `Valor anterior: R$ ${valorBaseAplicado.toFixed(2).replace(".", ",")}\n`;
  mensagem += `Novo valor: R$ ${novoValor.toFixed(2).replace(".", ",")}\n`;
  
  const totalIgnorados = ignoradosBolsistas + ignoradosMultiplasTurmas + ignoradosValorPersonalizado;
  if (totalIgnorados > 0) {
    mensagem += `\nIgnorados: ${totalIgnorados}\n`;
    if (ignoradosValorPersonalizado > 0) mensagem += `  - Valor personalizado: ${ignoradosValorPersonalizado}\n`;
    if (ignoradosMultiplasTurmas > 0) mensagem += `  - Multiplas turmas: ${ignoradosMultiplasTurmas}\n`;
  }
  
  alert(mensagem);
  UI.navigate("unidades");
}

/** Modal para criar/editar unidade */
function abrirModalUnidade(unidadeExistente = null) {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";

  const isEdicao = !!unidadeExistente;
  const mensalidadeAtual = unidadeExistente?.mensalidadeBase || "";

  modal.innerHTML = `
    <h2 class="modal-title">${isEdicao ? "Editar Unidade" : "Nova Unidade"}</h2>

    <div class="modal-grid">
      <div class="field">
        <label>Nome *</label>
        <input id="nome" placeholder="Nome da unidade" value="${unidadeExistente?.nome || ""}">
      </div>

      <div class="field">
        <label>Endereco</label>
        <input id="endereco" placeholder="Endereco (opcional)" value="${unidadeExistente?.endereco || ""}">
      </div>
      
      <div class="field">
        <label>Mensalidade Base (R$)</label>
        <input id="mensalidadeBase" type="number" step="0.01" min="0" placeholder="Ex: 150.00" value="${mensalidadeAtual}">
        <small style="color: #64748b; font-size: 0.8rem;">Valor padrao para alunos desta unidade</small>
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
      alert("Nome e obrigatorio!");
      return;
    }
    
    const novaMensalidade = parseFloat(modal.querySelector("#mensalidadeBase").value) || 0;

    const dados = {
      nome: nome,
      endereco: modal.querySelector("#endereco").value,
      mensalidadeBase: novaMensalidade,
      // mensalidadeBaseAplicada NAO e alterada aqui - so no botao "Atualizar Mensalidades"
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
  header.style.cssText = "margin-bottom: 1.5rem; display: flex; gap: 1rem; flex-wrap: wrap;";

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.textContent = "+ Novo Professor/Monitor";
  btn.onclick = () => abrirModalProfessor();
  header.appendChild(btn);

  const btnRelatorio = document.createElement("button");
  btnRelatorio.className = "btn-secondary";
  btnRelatorio.textContent = "Ver Pagamentos do Mes";
  btnRelatorio.onclick = () => abrirRelatorioPagamentosProfessores();
  header.appendChild(btnRelatorio);

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
      .filter(t => {
        if (t.ativa === false) return false;
        // Compatibilidade: verificar professores_ids ou professor_id antigo
        const professoresIds = t.professores_ids || (t.professor_id ? [t.professor_id] : []);
        return professoresIds.includes(prof.id) || t.monitores_ids?.includes(prof.id);
      })
      .map(t => t.nome)
      .join(", ");
    
    const tipoPagLabels = { fixo: "Fixo/Mes", por_aluno: "Por Aluno", percentual: "Percentual" };
    const pagamentoInfo = prof.tipoPagamento 
      ? `${tipoPagLabels[prof.tipoPagamento] || prof.tipoPagamento}: ${prof.tipoPagamento === "percentual" ? prof.valorPagamento + "%" : formatarReais(prof.valorPagamento)}`
      : "Nao configurado";

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
        Tel: ${prof.telefone || "Nao informado"}<br>
        Turmas: ${turmasVinculadas || "Nenhuma"}<br>
        Pagamento: ${pagamentoInfo}
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

/** Abre relatorio de pagamentos dos professores */
function abrirRelatorioPagamentosProfessores() {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";
  modal.style.maxWidth = "600px";

  const professores = DataStore.state.data.professores.filter(p => p.ativo !== false && p.tipoPagamento);
  const hoje = new Date();
  const meses = ["","Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();
  
  let totalGeral = 0;
  let htmlProfessores = "";
  
  if (professores.length === 0) {
    htmlProfessores = '<p style="color: #64748b;">Nenhum professor com pagamento configurado.</p>';
  } else {
    professores.forEach(prof => {
      const turmas = DataStore.state.data.turmas
        .filter(t => {
          if (t.ativa === false) return false;
          // Compatibilidade: verificar professores_ids ou professor_id antigo
          const professoresIds = t.professores_ids || (t.professor_id ? [t.professor_id] : []);
          return professoresIds.includes(prof.id) || t.monitores_ids?.includes(prof.id);
        });
      
      let valorCalculado = 0;
      let detalhes = "";
      
      if (prof.tipoPagamento === "fixo") {
        valorCalculado = prof.valorPagamento || 0;
        detalhes = "Valor fixo mensal";
      } else if (prof.tipoPagamento === "por_aluno") {
        // Usar getAlunosDaTurma para incluir bolsistas multi-turma
        const totalAlunos = turmas.reduce((sum, t) => {
          return sum + getAlunosDaTurma(t.id).length;
        }, 0);
        valorCalculado = totalAlunos * (prof.valorPagamento || 0);
        detalhes = `${totalAlunos} aluno(s) x ${formatarReais(prof.valorPagamento)}`;
      } else if (prof.tipoPagamento === "percentual") {
        // Usar getAlunosDaTurma para incluir bolsistas multi-turma
        const totalMensalidades = turmas.reduce((sum, t) => {
          const alunosTurma = getAlunosDaTurma(t.id);
          return sum + alunosTurma.reduce((s, a) => s + (a.mensalidade || 0), 0);
        }, 0);
        valorCalculado = (totalMensalidades * (prof.valorPagamento || 0)) / 100;
        detalhes = `${prof.valorPagamento}% de ${formatarReais(totalMensalidades)}`;
      }
      
      totalGeral += valorCalculado;
      
      htmlProfessores += `
        <div style="padding: 0.75rem; background: #f8fafc; border-radius: 6px; margin-bottom: 0.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong>${prof.nome}</strong>
            <span style="color: #16a34a; font-weight: 600;">${formatarReais(valorCalculado)}</span>
          </div>
          <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.25rem;">
            ${prof.funcao} | ${detalhes}
          </div>
        </div>
      `;
    });
  }

  modal.innerHTML = `
    <h2 class="modal-title">Pagamentos Professores - ${meses[mesAtual]}/${anoAtual}</h2>
    
    <div style="max-height: 400px; overflow-y: auto; margin-bottom: 1rem;">
      ${htmlProfessores}
    </div>
    
    <div style="padding: 1rem; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px; text-align: center;">
      <div style="font-size: 0.9rem; color: #166534;">Total a Pagar</div>
      <div style="font-size: 1.5rem; font-weight: bold; color: #16a34a;">${formatarReais(totalGeral)}</div>
    </div>
    
    <p style="margin-top: 1rem; font-size: 0.8rem; color: #94a3b8; text-align: center;">
      * Valores calculados com base nos alunos ativos e configuracoes de pagamento.
    </p>

    <div class="modal-actions" style="margin-top: 1rem;">
      <button class="modal-btn-secondary">Fechar</button>
    </div>
  `;

  modal.querySelector(".modal-btn-secondary").onclick = () => overlay.remove();

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
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
        <label>Funcao *</label>
        <select id="funcao">
          <option value="Professor" ${profExistente?.funcao === "Professor" ? "selected" : ""}>Professor</option>
          <option value="Monitor" ${profExistente?.funcao === "Monitor" ? "selected" : ""}>Monitor</option>
        </select>
      </div>

      <div class="field">
        <label>Telefone</label>
        <input id="telefone" placeholder="(00) 00000-0000" value="${profExistente?.telefone || ""}">
      </div>

      <div class="field">
        <label>Tipo de Pagamento</label>
        <select id="tipoPagamento">
          <option value="" ${!profExistente?.tipoPagamento ? "selected" : ""}>Nenhum</option>
          <option value="fixo" ${profExistente?.tipoPagamento === "fixo" ? "selected" : ""}>Valor Fixo/Mes</option>
          <option value="por_aluno" ${profExistente?.tipoPagamento === "por_aluno" ? "selected" : ""}>Por Aluno</option>
          <option value="percentual" ${profExistente?.tipoPagamento === "percentual" ? "selected" : ""}>Percentual da Turma</option>
        </select>
      </div>

      <div class="field">
        <label>Valor Pagamento (R$ ou %)</label>
        <input id="valorPagamento" type="number" step="0.01" placeholder="0.00" value="${profExistente?.valorPagamento || ""}">
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
      alert("Nome e obrigatorio!");
      return;
    }

    const dados = {
      nome: nome,
      funcao: modal.querySelector("#funcao").value,
      telefone: modal.querySelector("#telefone").value,
      tipoPagamento: modal.querySelector("#tipoPagamento").value || null,
      valorPagamento: Number(modal.querySelector("#valorPagamento").value) || null,
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

  const btnDisparo = document.createElement("button");
  btnDisparo.className = "btn-secondary";
  btnDisparo.textContent = "Disparo Multiplo";
  btnDisparo.setAttribute("data-testid", "button-disparo-multiplo");
  btnDisparo.onclick = () => abrirModalDisparoMultiplo();
  header.appendChild(btnDisparo);

  const btnLimparPendentes = document.createElement("button");
  btnLimparPendentes.id = "btn-limpar-pendentes";
  btnLimparPendentes.className = "btn-secondary";
  btnLimparPendentes.style.cssText = "background: #fef2f2; color: #dc2626; border-color: #fecaca;";
  btnLimparPendentes.textContent = "Limpar Pendentes";
  btnLimparPendentes.setAttribute("data-testid", "button-limpar-pendentes");
  btnLimparPendentes.onclick = () => executarLimpezaPendentes();
  btnLimparPendentes.style.display = "none";
  header.appendChild(btnLimparPendentes);

  UI.content.appendChild(header);

  // Linha de filtros
  const filtrosDiv = document.createElement("div");
  filtrosDiv.style.cssText = "margin-bottom: 1rem; display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;";

  // Filtro Unidade
  const selectUnidade = document.createElement("select");
  selectUnidade.id = "filtro-unidade-mens";
  selectUnidade.setAttribute("data-testid", "select-filtro-unidade");
  selectUnidade.style.padding = "0.5rem";
  selectUnidade.innerHTML = '<option value="">Todas as unidades</option>';
  DataStore.state.data.unidades.filter(u => u.ativa !== false).forEach(u => {
    selectUnidade.innerHTML += `<option value="${u.id}">${u.nome}</option>`;
  });
  filtrosDiv.appendChild(selectUnidade);

  // Filtro Turma
  const selectTurma = document.createElement("select");
  selectTurma.id = "filtro-turma-mens";
  selectTurma.setAttribute("data-testid", "select-filtro-turma");
  selectTurma.style.padding = "0.5rem";
  selectTurma.innerHTML = '<option value="">Todas as turmas</option>';
  DataStore.state.data.turmas.filter(t => t.ativa !== false).forEach(t => {
    selectTurma.innerHTML += `<option value="${t.id}">${t.nome}</option>`;
  });
  filtrosDiv.appendChild(selectTurma);

  // Filtro Status
  const selectStatus = document.createElement("select");
  selectStatus.id = "filtro-status-mens";
  selectStatus.setAttribute("data-testid", "select-filtro-status");
  selectStatus.style.padding = "0.5rem";
  selectStatus.innerHTML = `
    <option value="todos">Todos</option>
    <option value="pendente">Pendentes</option>
    <option value="paga">Pagas</option>
  `;
  filtrosDiv.appendChild(selectStatus);

  // Atualizar turmas quando unidade mudar
  selectUnidade.onchange = () => {
    const unidadeId = selectUnidade.value;
    selectTurma.innerHTML = '<option value="">Todas as turmas</option>';
    let turmasFiltradas = DataStore.state.data.turmas.filter(t => t.ativa !== false);
    if (unidadeId) {
      turmasFiltradas = turmasFiltradas.filter(t => t.unidade_id === unidadeId);
    }
    turmasFiltradas.forEach(t => {
      selectTurma.innerHTML += `<option value="${t.id}">${t.nome}</option>`;
    });
    aplicarFiltrosMensalidades();
  };

  selectTurma.onchange = () => aplicarFiltrosMensalidades();
  selectStatus.onchange = () => aplicarFiltrosMensalidades();

  UI.content.appendChild(filtrosDiv);

  const container = document.createElement("div");
  container.id = "mensalidades-container";
  UI.content.appendChild(container);

  aplicarFiltrosMensalidades();
}

/** Aplica filtros e renderiza mensalidades */
function aplicarFiltrosMensalidades() {
  const unidadeId = document.getElementById("filtro-unidade-mens")?.value || "";
  const turmaId = document.getElementById("filtro-turma-mens")?.value || "";
  const statusFiltro = document.getElementById("filtro-status-mens")?.value || "todos";
  renderCardsMensalidades(statusFiltro, unidadeId, turmaId);
}

/** Executa limpeza de mensalidades pendentes (soft delete) */
function executarLimpezaPendentes() {
  const unidadeId = document.getElementById("filtro-unidade-mens")?.value || "";
  const turmaId = document.getElementById("filtro-turma-mens")?.value || "";
  
  // Obter mensalidades pendentes conforme filtros
  let pendentes = DataStore.state.data.mensalidades.filter(m => m.status === "pendente");
  
  // Aplicar filtros de unidade/turma
  if (unidadeId || turmaId) {
    pendentes = pendentes.filter(m => {
      const aluno = DataStore.findById("alunos", m.aluno_id);
      if (!aluno) return false;
      
      if (turmaId) {
        return alunoEmTurma(aluno, turmaId);
      }
      
      if (unidadeId) {
        const turmasDoAluno = getTurmasIds(aluno);
        return turmasDoAluno.some(tid => {
          const turma = DataStore.findById("turmas", tid);
          return turma && turma.unidade_id === unidadeId;
        });
      }
      
      return true;
    });
  }
  
  if (pendentes.length === 0) {
    alert("Nenhuma mensalidade pendente encontrada com os filtros atuais.");
    return;
  }
  
  // Confirmacao
  const confirmMsg = `Voce esta prestes a cancelar ${pendentes.length} mensalidade(s) pendente(s).\n\nEsta acao nao pode ser desfeita.\n\nDeseja continuar?`;
  if (!confirm(confirmMsg)) {
    return;
  }
  
  // Executar cancelamento
  let canceladas = 0;
  pendentes.forEach(mens => {
    // Atualizar status para cancelada
    mens.status = "cancelada";
    
    // Registrar no historico do aluno
    adicionarEventoAluno(mens.aluno_id, `Mensalidade cancelada - competencia ${mens.mes}/${mens.ano}`);
    
    canceladas++;
  });
  
  // Salvar
  DataStore.save();
  
  // Feedback
  alert(`${canceladas} mensalidade(s) cancelada(s) com sucesso.`);
  
  // Atualizar lista
  aplicarFiltrosMensalidades();
}

/** Renderiza cards de mensalidades */
function renderCardsMensalidades(statusFiltro, unidadeId = "", turmaId = "") {
  const container = document.getElementById("mensalidades-container");
  container.innerHTML = "";

  let mensalidades = [...DataStore.state.data.mensalidades];

  // Filtro por status
  if (statusFiltro !== "todos") {
    mensalidades = mensalidades.filter(m => m.status === statusFiltro);
  }

  // Filtro por unidade/turma (via aluno)
  if (unidadeId || turmaId) {
    mensalidades = mensalidades.filter(m => {
      const aluno = DataStore.findById("alunos", m.aluno_id);
      if (!aluno) return false;

      if (turmaId) {
        return alunoEmTurma(aluno, turmaId);
      }

      if (unidadeId) {
        const turmasDoAluno = getTurmasIds(aluno);
        return turmasDoAluno.some(tid => {
          const turma = DataStore.findById("turmas", tid);
          return turma && turma.unidade_id === unidadeId;
        });
      }

      return true;
    });
  }

  mensalidades.sort((a, b) => {
    const dataA = `${a.ano}-${String(a.mes).padStart(2, "0")}`;
    const dataB = `${b.ano}-${String(b.mes).padStart(2, "0")}`;
    return dataB.localeCompare(dataA);
  });

  // Separar pagas e pendentes (excluir canceladas)
  const pendentes = mensalidades.filter(m => m.status === "pendente");
  const pagas = mensalidades.filter(m => m.status === "paga");

  // Atualizar visibilidade do botao Limpar Pendentes
  const btnLimpar = document.getElementById("btn-limpar-pendentes");
  if (btnLimpar) {
    btnLimpar.style.display = pendentes.length > 0 ? "inline-block" : "none";
  }

  if (mensalidades.length === 0 || (pendentes.length === 0 && pagas.length === 0)) {
    container.innerHTML = '<p style="color: #64748b;">Nenhuma mensalidade encontrada com os filtros aplicados.</p>';
    return;
  }

  // Renderizar pendentes em lista simples
  if (pendentes.length > 0 && statusFiltro !== "paga") {
    const secaoPendentes = document.createElement("div");
    secaoPendentes.innerHTML = `<h3 style="font-size: 1rem; margin-bottom: 0.75rem; color: #dc2626;">Pendentes (${pendentes.length})</h3>`;
    const gridPendentes = criarGridCards();
    pendentes.forEach(mens => {
      gridPendentes.appendChild(criarCardMensalidade(mens));
    });
    secaoPendentes.appendChild(gridPendentes);
    container.appendChild(secaoPendentes);
  }

  // Renderizar pagas agrupadas por competencia
  if (pagas.length > 0 && statusFiltro !== "pendente") {
    const secaoPagas = document.createElement("div");
    secaoPagas.style.marginTop = pendentes.length > 0 ? "2rem" : "0";
    secaoPagas.innerHTML = `<h3 style="font-size: 1rem; margin-bottom: 0.75rem; color: #16a34a;">Pagas (${pagas.length})</h3>`;

    // Agrupar por competencia
    const grupos = {};
    pagas.forEach(m => {
      const chave = `${m.ano}-${String(m.mes).padStart(2, "0")}`;
      if (!grupos[chave]) grupos[chave] = [];
      grupos[chave].push(m);
    });

    // Ordenar competencias
    const chavesOrdenadas = Object.keys(grupos).sort((a, b) => b.localeCompare(a));

    chavesOrdenadas.forEach(chave => {
      const [ano, mes] = chave.split("-");
      const itens = grupos[chave];
      const totalGrupo = itens.reduce((acc, m) => acc + (parseFloat(m.valor) || 0), 0);

      const pasta = document.createElement("div");
      pasta.className = "summary-card";
      pasta.style.marginBottom = "0.75rem";

      const cabecalho = document.createElement("div");
      cabecalho.setAttribute("data-testid", `pasta-competencia-${mes}-${ano}`);
      cabecalho.style.cssText = "display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 0.5rem 0;";
      cabecalho.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="pasta-icone" style="font-weight: bold; color: #3b82f6; font-size: 0.9rem;">+</span>
          <strong>${mes}/${ano}</strong>
          <span style="font-size: 0.8rem; color: #64748b;">(${itens.length} mensalidade${itens.length > 1 ? "s" : ""})</span>
        </div>
        <span style="font-weight: 600; color: #16a34a;">${formatarReais(totalGrupo)}</span>
      `;

      const conteudo = document.createElement("div");
      conteudo.style.display = "none";
      conteudo.style.marginTop = "0.75rem";
      conteudo.style.paddingTop = "0.75rem";
      conteudo.style.borderTop = "1px solid var(--border-color, #e2e8f0)";

      const gridItens = criarGridCards();
      itens.forEach(m => {
        gridItens.appendChild(criarCardMensalidade(m));
      });
      conteudo.appendChild(gridItens);

      cabecalho.onclick = () => {
        const icone = cabecalho.querySelector(".pasta-icone");
        if (conteudo.style.display === "none") {
          conteudo.style.display = "block";
          icone.textContent = "-";
        } else {
          conteudo.style.display = "none";
          icone.textContent = "+";
        }
      };

      pasta.appendChild(cabecalho);
      pasta.appendChild(conteudo);
      secaoPagas.appendChild(pasta);
    });

    container.appendChild(secaoPagas);
  }
}

/** Cria card de mensalidade individual */
function criarCardMensalidade(mens) {
  const aluno = DataStore.findById("alunos", mens.aluno_id);
  const isPaga = mens.status === "paga";
  
  // Obter turmas do aluno (multi-turma)
  let turmasNomes = "";
  if (aluno) {
    const turmasIds = getTurmasIds(aluno);
    const nomes = turmasIds.map(tid => {
      const t = DataStore.findById("turmas", tid);
      return t ? t.nome : null;
    }).filter(Boolean);
    turmasNomes = nomes.join(", ");
  }

  const card = document.createElement("div");
  card.className = "summary-card";
  card.setAttribute("data-testid", `card-mensalidade-${mens.id}`);
  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: start;">
      <strong style="font-size: 1.1rem;">${aluno?.nome || "Aluno nao encontrado"}</strong>
      <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; background: ${isPaga ? "#f0fdf4" : "#fef2f2"}; color: ${isPaga ? "#16a34a" : "#dc2626"};">
        ${isPaga ? "Paga" : "Pendente"}
      </span>
    </div>
    <p style="margin: 0.5rem 0; color: #64748b; font-size: 0.9rem;">
      Competencia: ${mens.mes}/${mens.ano}<br>
      Valor: ${formatarReais(mens.valor)}<br>
      ${turmasNomes ? `Turma: ${turmasNomes}<br>` : ""}
      Forma: ${mens.forma_pagamento || "-"}
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

  return card;
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
  const inputValor = modal.querySelector("#valor");
  
  DataStore.state.data.alunos
    .filter(a => a.status === "ativo" && !isBolsista(a))
    .forEach(aluno => {
      const option = document.createElement("option");
      option.value = aluno.id;
      option.textContent = aluno.nome;
      if (mensExistente?.aluno_id === aluno.id) option.selected = true;
      selectAluno.appendChild(option);
    });

  // Calcular valor automatico baseado nas turmas do aluno
  selectAluno.onchange = () => {
    if (isEdicao) return; // Nao alterar valor em edicao
    const alunoId = selectAluno.value;
    if (!alunoId) {
      inputValor.value = "";
      return;
    }
    const aluno = DataStore.findById("alunos", alunoId);
    if (!aluno) return;

    const turmasIds = getTurmasIds(aluno);
    let valorTotal = 0;

    if (turmasIds.length > 1) {
      // MULTI-TURMA: Somar valores de todas as turmas
      turmasIds.forEach(turmaId => {
        const turma = DataStore.findById("turmas", turmaId);
        if (turma && turma.ativa !== false) {
          valorTotal += parseFloat(turma.valor) || 0;
        }
      });
    } else {
      // SINGLE-TURMA: Usar mensalidade do aluno
      valorTotal = parseFloat(aluno.mensalidade) || 0;
    }

    inputValor.value = valorTotal > 0 ? valorTotal : "";
  };

  // Disparar calculo inicial se editando
  if (mensExistente?.aluno_id) {
    selectAluno.value = mensExistente.aluno_id;
  }

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

    if (mensalidade.aluno_id) {
      adicionarEventoAluno(mensalidade.aluno_id, `Mensalidade paga - ${mensalidade.mes}/${mensalidade.ano}`);
    }

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

/** Modal para disparo múltiplo de mensalidades */
function abrirModalDisparoMultiplo() {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";
  modal.style.maxWidth = "700px";

  const mesAtual = String(new Date().getMonth() + 1).padStart(2, "0");
  const anoAtual = String(new Date().getFullYear());

  const unidades = DataStore.state.data.unidades.filter(u => u.ativa !== false);
  const turmas = DataStore.state.data.turmas.filter(t => t.ativa !== false);

  modal.innerHTML = `
    <h2 class="modal-title">Disparo Multiplo de Mensalidades</h2>

    <div class="modal-grid">
      <div class="field">
        <label>Tipo de Disparo *</label>
        <select id="tipo-disparo" data-testid="select-tipo-disparo">
          <option value="">Selecione</option>
          <option value="turma">Por Turma</option>
          <option value="unidade">Por Unidade</option>
        </select>
      </div>

      <div class="field" id="container-selecao" style="display: none;">
        <label id="label-selecao">Selecione</label>
        <select id="selecao-disparo" data-testid="select-selecao-disparo">
          <option value="">Selecione</option>
        </select>
      </div>

      <div class="field">
        <label>Competencia (Mes/Ano) *</label>
        <div style="display: flex; gap: 0.5rem;">
          <select id="mes-disparo" style="flex: 1;" data-testid="select-mes-disparo">
            ${["01","02","03","04","05","06","07","08","09","10","11","12"].map(m => 
              `<option value="${m}" ${mesAtual === m ? "selected" : ""}>${m}</option>`
            ).join("")}
          </select>
          <input id="ano-disparo" type="number" style="flex: 1;" value="${anoAtual}" data-testid="input-ano-disparo">
        </div>
      </div>
    </div>

    <div id="previa-disparo" style="margin-top: 1.5rem; display: none;">
      <h3 style="margin-bottom: 1rem; font-size: 1rem; color: #374151;">Pre-visualizacao</h3>
      <div id="lista-previa"></div>
      <div id="resumo-previa" style="margin-top: 1rem; padding: 1rem; background: #f0f9ff; border-radius: 8px;"></div>
    </div>

    <div style="display: flex; gap: 1rem; margin-top: 1.5rem; justify-content: flex-end; flex-wrap: wrap;">
      <button class="btn-secondary" id="btn-preview-disparo" style="display: none;" data-testid="button-preview-disparo">Gerar Pre-visualizacao</button>
      <button class="btn-primary" id="btn-confirmar-disparo" style="display: none;" data-testid="button-confirmar-disparo">Confirmar Disparo</button>
      <button class="btn-secondary" id="btn-cancelar-disparo" data-testid="button-cancelar-disparo">Cancelar</button>
    </div>
  `;

  const selectTipo = modal.querySelector("#tipo-disparo");
  const containerSelecao = modal.querySelector("#container-selecao");
  const labelSelecao = modal.querySelector("#label-selecao");
  const selectSelecao = modal.querySelector("#selecao-disparo");
  const btnPreview = modal.querySelector("#btn-preview-disparo");
  const btnConfirmar = modal.querySelector("#btn-confirmar-disparo");
  const btnCancelar = modal.querySelector("#btn-cancelar-disparo");
  const previaDiv = modal.querySelector("#previa-disparo");
  const listaPrevia = modal.querySelector("#lista-previa");
  const resumoPrevia = modal.querySelector("#resumo-previa");

  let dadosPrevia = null;

  // Atualizar opcoes conforme tipo
  selectTipo.onchange = () => {
    const tipo = selectTipo.value;
    previaDiv.style.display = "none";
    btnConfirmar.style.display = "none";
    dadosPrevia = null;

    if (!tipo) {
      containerSelecao.style.display = "none";
      btnPreview.style.display = "none";
      return;
    }

    containerSelecao.style.display = "block";
    btnPreview.style.display = "inline-block";

    if (tipo === "turma") {
      labelSelecao.textContent = "Turma *";
      selectSelecao.innerHTML = `<option value="">Selecione a turma</option>` +
        turmas.map(t => {
          const unidade = DataStore.findById("unidades", t.unidade_id);
          return `<option value="${t.id}">${t.nome} - ${t.nivel}${unidade ? ` (${unidade.nome})` : ""}</option>`;
        }).join("");
    } else {
      labelSelecao.textContent = "Unidade *";
      selectSelecao.innerHTML = `<option value="">Selecione a unidade</option>` +
        unidades.map(u => `<option value="${u.id}">${u.nome}</option>`).join("");
    }
  };

  // Gerar pre-visualizacao
  btnPreview.onclick = () => {
    const tipo = selectTipo.value;
    const selecaoId = selectSelecao.value;
    const mes = modal.querySelector("#mes-disparo").value;
    const ano = modal.querySelector("#ano-disparo").value;

    if (!tipo || !selecaoId || !mes || !ano) {
      alert("Preencha todos os campos obrigatorios.");
      return;
    }

    dadosPrevia = calcularDisparoMensalidades(tipo, selecaoId, mes, ano);
    renderizarPrevia(dadosPrevia, listaPrevia, resumoPrevia);
    previaDiv.style.display = "block";
    btnConfirmar.style.display = dadosPrevia.elegiveis.length > 0 ? "inline-block" : "none";
  };

  // Confirmar disparo
  btnConfirmar.onclick = () => {
    if (!dadosPrevia || dadosPrevia.elegiveis.length === 0) {
      alert("Nenhum aluno elegivel para disparo.");
      return;
    }

    if (!confirm(`Confirmar geracao de ${dadosPrevia.elegiveis.length} mensalidade(s)?`)) {
      return;
    }

    try {
      executarDisparoMensalidades(dadosPrevia);
      overlay.remove();
      alert(`${dadosPrevia.elegiveis.length} mensalidade(s) gerada(s) com sucesso!`);
      UI.navigate("mensalidades");
    } catch (err) {
      console.error("Erro no disparo:", err);
      alert("Erro ao gerar mensalidades. Verifique o console.");
    }
  };

  btnCancelar.onclick = () => overlay.remove();

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/** Calcula alunos elegiveis para disparo de mensalidades */
function calcularDisparoMensalidades(tipo, selecaoId, mes, ano) {
  const alunos = DataStore.state.data.alunos;
  const mensalidades = DataStore.state.data.mensalidades;
  const turmas = DataStore.state.data.turmas;

  const elegiveis = [];
  const ignorados = [];

  // Selecionar alunos conforme tipo
  let alunosCandidatos = [];

  if (tipo === "turma") {
    // Alunos vinculados a esta turma
    alunosCandidatos = alunos.filter(a => alunoEmTurma(a, selecaoId));
  } else {
    // Alunos vinculados a turmas desta unidade
    const turmasDaUnidade = turmas.filter(t => t.unidade_id === selecaoId && t.ativa !== false);
    const alunosSet = new Set();
    turmasDaUnidade.forEach(turma => {
      alunos.forEach(a => {
        if (alunoEmTurma(a, turma.id) && !alunosSet.has(a.id)) {
          alunosSet.add(a.id);
          alunosCandidatos.push(a);
        }
      });
    });
  }

  alunosCandidatos.forEach(aluno => {
    // Verificar status
    if (aluno.status !== "ativo") {
      ignorados.push({ aluno, motivo: aluno.status === "trancado" ? "Trancado" : "Inativo" });
      return;
    }

    // Verificar bolsista
    if (isBolsista(aluno)) {
      ignorados.push({ aluno, motivo: "Bolsista" });
      return;
    }

    // Verificar duplicidade
    const jaPossuiMensalidade = mensalidades.some(m => 
      m.aluno_id === aluno.id && 
      m.mes === mes && 
      m.ano === ano
    );

    if (jaPossuiMensalidade) {
      ignorados.push({ aluno, motivo: "Ja possui mensalidade" });
      return;
    }

    // Calcular valor baseado nas turmas do aluno
    const turmasIds = getTurmasIds(aluno);
    let valorTotal = 0;
    const nomesTurmas = [];

    if (turmasIds.length > 1) {
      // MULTI-TURMA: Somar valores das turmas (usa turma.valor, nao aluno.mensalidade)
      turmasIds.forEach(turmaId => {
        const turma = DataStore.findById("turmas", turmaId);
        if (turma && turma.ativa !== false) {
          const valorTurma = parseFloat(turma.valor) || 0;
          valorTotal += valorTurma;
          nomesTurmas.push(turma.nome);
        }
      });
    } else {
      // SINGLE-TURMA: Usar mensalidade definida no aluno
      valorTotal = parseFloat(aluno.mensalidade) || 0;
      const turma = DataStore.findById("turmas", aluno.turma);
      if (turma && turma.ativa !== false) {
        nomesTurmas.push(turma.nome);
      }
    }

    if (valorTotal <= 0) {
      ignorados.push({ aluno, motivo: "Valor nao definido" });
      return;
    }

    elegiveis.push({
      aluno,
      valor: valorTotal,
      turmas: nomesTurmas,
      descricao: nomesTurmas.length > 1 
        ? `Mensalidade - Turmas: ${nomesTurmas.join(", ")}`
        : `Mensalidade - ${nomesTurmas[0] || "Turma"}`
    });
  });

  return { elegiveis, ignorados, mes, ano };
}

/** Renderiza pre-visualizacao do disparo */
function renderizarPrevia(dados, listaContainer, resumoContainer) {
  listaContainer.innerHTML = "";

  if (dados.elegiveis.length === 0 && dados.ignorados.length === 0) {
    listaContainer.innerHTML = '<p style="color: #64748b;">Nenhum aluno encontrado.</p>';
    resumoContainer.innerHTML = "";
    return;
  }

  // Lista de elegiveis
  if (dados.elegiveis.length > 0) {
    const secaoElegiveis = document.createElement("div");
    secaoElegiveis.innerHTML = `<h4 style="font-size: 0.9rem; color: #16a34a; margin-bottom: 0.5rem;">Alunos que receberao mensalidade (${dados.elegiveis.length})</h4>`;
    
    const listaElegiveis = document.createElement("div");
    listaElegiveis.style.cssText = "max-height: 200px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px;";

    dados.elegiveis.forEach(item => {
      const linha = document.createElement("div");
      linha.style.cssText = "padding: 0.5rem 0.75rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between;";
      linha.innerHTML = `
        <span>${item.aluno.nome}</span>
        <span style="font-weight: 500;">${formatarReais(item.valor)}</span>
      `;
      listaElegiveis.appendChild(linha);
    });

    secaoElegiveis.appendChild(listaElegiveis);
    listaContainer.appendChild(secaoElegiveis);
  }

  // Lista de ignorados
  if (dados.ignorados.length > 0) {
    const secaoIgnorados = document.createElement("div");
    secaoIgnorados.style.marginTop = "1rem";
    secaoIgnorados.innerHTML = `<h4 style="font-size: 0.9rem; color: #dc2626; margin-bottom: 0.5rem;">Alunos ignorados (${dados.ignorados.length})</h4>`;
    
    const listaIgnorados = document.createElement("div");
    listaIgnorados.style.cssText = "max-height: 150px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px;";

    dados.ignorados.forEach(item => {
      const linha = document.createElement("div");
      linha.style.cssText = "padding: 0.5rem 0.75rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between;";
      linha.innerHTML = `
        <span>${item.aluno.nome}</span>
        <span style="font-size: 0.85rem; color: #94a3b8;">${item.motivo}</span>
      `;
      listaIgnorados.appendChild(linha);
    });

    secaoIgnorados.appendChild(listaIgnorados);
    listaContainer.appendChild(secaoIgnorados);
  }

  // Resumo
  const totalGeral = dados.elegiveis.reduce((sum, item) => sum + item.valor, 0);
  resumoContainer.innerHTML = `
    <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
      <div>
        <strong>Competencia:</strong> ${dados.mes}/${dados.ano}
      </div>
      <div>
        <strong>Total de mensalidades:</strong> ${dados.elegiveis.length}
      </div>
      <div>
        <strong>Valor total:</strong> ${formatarReais(totalGeral)}
      </div>
    </div>
  `;
}

/** Executa o disparo de mensalidades */
function executarDisparoMensalidades(dados) {
  dados.elegiveis.forEach(item => {
    const novaMensalidade = {
      id: crypto.randomUUID(),
      aluno_id: item.aluno.id,
      mes: dados.mes,
      ano: dados.ano,
      valor: item.valor,
      status: "pendente",
      forma_pagamento: "",
      descricao: item.descricao,
      createdAt: new Date().toISOString()
    };

    DataStore.state.data.mensalidades.push(novaMensalidade);

    // Registrar no historico do aluno
    adicionarEventoAluno(item.aluno.id, `Mensalidade gerada: ${dados.mes}/${dados.ano} - ${formatarReais(item.valor)}`);
  });

  DataStore.save();
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
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();

  // Estado do filtro (usa variáveis locais que serão capturadas no closure)
  let mesSelecionado = mesAtual;
  let anoSelecionado = anoAtual;

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

  // Filtro por período
  const filtroContainer = document.createElement("div");
  filtroContainer.style.cssText = "margin-bottom: 1.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;";
  filtroContainer.innerHTML = `
    <label style="font-weight: 500; color: var(--color-text-primary);">Periodo:</label>
    <select id="filtroMes" data-testid="select-filter-month" style="padding: 0.5rem; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-input); color: var(--color-text-primary);">
      <option value="0">Todos os meses</option>
      <option value="1">Janeiro</option>
      <option value="2">Fevereiro</option>
      <option value="3">Marco</option>
      <option value="4">Abril</option>
      <option value="5">Maio</option>
      <option value="6">Junho</option>
      <option value="7">Julho</option>
      <option value="8">Agosto</option>
      <option value="9">Setembro</option>
      <option value="10">Outubro</option>
      <option value="11">Novembro</option>
      <option value="12">Dezembro</option>
    </select>
    <select id="filtroAno" data-testid="select-filter-year" style="padding: 0.5rem; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-input); color: var(--color-text-primary);">
      <option value="0">Todos os anos</option>
    </select>
    <select id="filtroTipo" data-testid="select-filter-type" style="padding: 0.5rem; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-input); color: var(--color-text-primary);">
      <option value="todos">Todos os tipos</option>
      <option value="entrada">Entradas</option>
      <option value="saida">Saidas</option>
    </select>
    <label style="margin-left: 1rem; display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
      <input type="checkbox" id="mostrarCancelados" data-testid="checkbox-show-cancelled" style="cursor: pointer;">
      <span style="font-size: 0.9rem; color: var(--color-text-muted);">Mostrar cancelados</span>
    </label>
  `;
  UI.content.appendChild(filtroContainer);

  const selectMes = filtroContainer.querySelector("#filtroMes");
  const selectAno = filtroContainer.querySelector("#filtroAno");
  const selectTipo = filtroContainer.querySelector("#filtroTipo");
  const checkMostrarCancelados = filtroContainer.querySelector("#mostrarCancelados");

  // Popular anos (do ano atual até 5 anos atrás)
  for (let ano = anoAtual; ano >= anoAtual - 5; ano--) {
    const option = document.createElement("option");
    option.value = ano;
    option.textContent = ano;
    selectAno.appendChild(option);
  }

  // Selecionar mês e ano atual por padrão
  selectMes.value = mesAtual;
  selectAno.value = anoAtual;

  // Container para resumo (será atualizado)
  const resumoContainer = document.createElement("div");
  resumoContainer.id = "caixa-resumo";
  UI.content.appendChild(resumoContainer);

  // Container para lançamentos (será atualizado)
  const lancamentosContainer = document.createElement("div");
  lancamentosContainer.id = "caixa-lancamentos";
  UI.content.appendChild(lancamentosContainer);

  // Função para atualizar a visualização
  function atualizarCaixa() {
    mesSelecionado = parseInt(selectMes.value);
    anoSelecionado = parseInt(selectAno.value);
    const mostrarCancelados = checkMostrarCancelados.checked;

    // Filtrar lançamentos pelo período
    let lancamentosFiltrados = [...DataStore.state.data.caixa];

    if (mesSelecionado > 0 || anoSelecionado > 0) {
      lancamentosFiltrados = lancamentosFiltrados.filter(lanc => {
        const dataLanc = new Date(lanc.data);
        const mesLanc = dataLanc.getMonth() + 1;
        const anoLanc = dataLanc.getFullYear();
        
        const mesOk = mesSelecionado === 0 || mesLanc === mesSelecionado;
        const anoOk = anoSelecionado === 0 || anoLanc === anoSelecionado;
        
        return mesOk && anoOk;
      });
    }

    // Filtrar por status (se não mostrar cancelados)
    if (!mostrarCancelados) {
      lancamentosFiltrados = lancamentosFiltrados.filter(lanc => lanc.status !== "cancelado");
    }

    // Filtrar por tipo (entrada/saida)
    const tipoSelecionado = selectTipo.value;
    if (tipoSelecionado !== "todos") {
      lancamentosFiltrados = lancamentosFiltrados.filter(lanc => lanc.tipo === tipoSelecionado);
    }

    // Calcular totais do período (APENAS lançamentos ativos)
    const lancamentosAtivos = lancamentosFiltrados.filter(l => l.status !== "cancelado");
    
    const totalEntradas = lancamentosAtivos
      .filter(l => l.tipo === "entrada")
      .reduce((sum, l) => sum + (l.valor || 0), 0);

    const totalSaidas = lancamentosAtivos
      .filter(l => l.tipo === "saida")
      .reduce((sum, l) => sum + (l.valor || 0), 0);

    const saldo = totalEntradas - totalSaidas;

    // Texto do período
    const meses = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
                   "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    let periodoTexto = "";
    if (mesSelecionado > 0 && anoSelecionado > 0) {
      periodoTexto = `${meses[mesSelecionado]}/${anoSelecionado}`;
    } else if (mesSelecionado > 0) {
      periodoTexto = meses[mesSelecionado];
    } else if (anoSelecionado > 0) {
      periodoTexto = `Ano ${anoSelecionado}`;
    } else {
      periodoTexto = "Todo o período";
    }

    // Atualizar resumo
    resumoContainer.innerHTML = "";
    const resumoGrid = document.createElement("div");
    resumoGrid.className = "dashboard-cards";
    resumoGrid.style.marginBottom = "1.5rem";
    resumoGrid.innerHTML = `
      <div class="summary-card">
        <span class="card-title">Entradas (${periodoTexto})</span>
        <span class="card-value" style="color: #16a34a;">${formatarReais(totalEntradas)}</span>
      </div>
      <div class="summary-card">
        <span class="card-title">Saídas (${periodoTexto})</span>
        <span class="card-value" style="color: #dc2626;">${formatarReais(totalSaidas)}</span>
      </div>
      <div class="summary-card">
        <span class="card-title">Saldo (${periodoTexto})</span>
        <span class="card-value" style="color: ${saldo >= 0 ? "#16a34a" : "#dc2626"};">${formatarReais(saldo)}</span>
      </div>
    `;
    resumoContainer.appendChild(resumoGrid);

    // Atualizar lista de lançamentos
    lancamentosContainer.innerHTML = "";

    const lancamentosOrdenados = lancamentosFiltrados.sort((a, b) => 
      new Date(b.data) - new Date(a.data)
    );

    if (lancamentosOrdenados.length === 0) {
      lancamentosContainer.innerHTML = '<p style="color: #64748b;">Nenhum lançamento no período selecionado.</p>';
      return;
    }

    const grid = criarGridCards();

    lancamentosOrdenados.forEach(lanc => {
      const isEntrada = lanc.tipo === "entrada";
      const isCancelado = lanc.status === "cancelado";

      const card = document.createElement("div");
      card.className = "summary-card";
      if (isCancelado) {
        card.style.opacity = "0.6";
        card.style.background = "#fef2f2";
      }
      
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 0.5rem;">
          <strong>${lanc.descricao || (isEntrada ? "Entrada" : "Saída")}</strong>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            ${isCancelado ? `<span style="background: #dc2626; color: white; font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 600;">CANCELADO</span>` : ""}
            <span style="color: ${isCancelado ? "#9ca3af" : (isEntrada ? "#16a34a" : "#dc2626")}; font-weight: 600; ${isCancelado ? "text-decoration: line-through;" : ""}">
              ${isEntrada ? "+" : "-"}${formatarReais(lanc.valor)}
            </span>
          </div>
        </div>
        <p style="margin: 0.5rem 0; color: #64748b; font-size: 0.9rem;">
          Data: ${formatarData(lanc.data)}<br>
          ${lanc.categoria ? `Categoria: ${formatarCategoria(lanc.categoria)}<br>` : ""}
          ${lanc.aluno_nome ? `Aluno: ${lanc.aluno_nome}<br>` : ""}
          Pagamento: ${lanc.forma_pagamento || "-"}
          ${lanc.telefone ? `<br>Tel: ${lanc.telefone}` : ""}
          ${lanc.editadoEm ? `<br><em style="font-size: 0.8rem;">Editado em: ${new Date(lanc.editadoEm).toLocaleDateString("pt-BR")}</em>` : ""}
          ${isCancelado && lanc.dataCancelamento ? `<br><em style="font-size: 0.8rem; color: #dc2626;">Cancelado em: ${new Date(lanc.dataCancelamento).toLocaleDateString("pt-BR")}</em>` : ""}
          ${isCancelado && lanc.motivoCancelamento ? `<br><em style="font-size: 0.8rem; color: #dc2626;">Motivo: ${lanc.motivoCancelamento}</em>` : ""}
        </p>
        <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;"></div>
      `;

      const acoes = card.querySelector("div:last-child");
      
      const btnEditar = document.createElement("button");
      btnEditar.className = "btn-secondary";
      btnEditar.textContent = "Editar";
      if (isCancelado) {
        btnEditar.disabled = true;
        btnEditar.style.opacity = "0.5";
        btnEditar.style.cursor = "not-allowed";
      } else {
        btnEditar.onclick = () => abrirModalEditarLancamento(lanc, atualizarCaixa);
      }
      acoes.appendChild(btnEditar);

      if (!isCancelado) {
        const btnCancelar = document.createElement("button");
        btnCancelar.className = "btn-secondary";
        btnCancelar.style.background = "#fef2f2";
        btnCancelar.style.color = "#dc2626";
        btnCancelar.textContent = "Cancelar";
        btnCancelar.onclick = () => abrirModalCancelarLancamento(lanc, atualizarCaixa);
        acoes.appendChild(btnCancelar);
      }

      grid.appendChild(card);
    });

    lancamentosContainer.appendChild(grid);
  }

  // Event listeners para os filtros
  selectMes.onchange = atualizarCaixa;
  selectAno.onchange = atualizarCaixa;
  selectTipo.onchange = atualizarCaixa;
  checkMostrarCancelados.onchange = atualizarCaixa;

  // Renderizar inicial
  atualizarCaixa();
}

/** Modal para entrada ou saída no caixa */
function abrirModalCaixa(tipo) {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";

  const isEntrada = tipo === "entrada";

  const categoriasEntrada = [
    { value: "mensalidade", label: "Mensalidade" },
    { value: "aula_avulsa", label: "Aula Avulsa" },
    { value: "outros", label: "Outros" },
  ];
  const categoriasSaida = [
    { value: "despesa", label: "Despesa" },
    { value: "outros", label: "Outros" },
  ];
  const categorias = isEntrada ? categoriasEntrada : categoriasSaida;

  modal.innerHTML = `
    <h2 class="modal-title">${isEntrada ? "Nova Entrada" : "Nova Saída"}</h2>

    <div class="modal-grid">
      <div class="field">
        <label>Descrição *</label>
        <input id="descricao" placeholder="Descrição do lançamento">
      </div>

      <div class="field">
        <label>Categoria</label>
        <select id="categoria">
          ${categorias.map(c => `<option value="${c.value}">${c.label}</option>`).join("")}
        </select>
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
      categoria: modal.querySelector("#categoria").value,
      descricao: descricao,
      valor: valor,
      forma_pagamento: modal.querySelector("#forma").value,
      status: "ativo",
    });

    DataStore.save();
    overlay.remove();
    UI.navigate("caixa");
  };

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/** Modal para editar lançamento do caixa */
function abrirModalEditarLancamento(lancamento, callback) {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";

  const isEntrada = lancamento.tipo === "entrada";
  const dataFormatada = lancamento.data 
    ? (lancamento.data.includes("T") ? lancamento.data.split("T")[0] : lancamento.data)
    : new Date().toISOString().split("T")[0];

  const categoriasEntrada = [
    { value: "mensalidade", label: "Mensalidade" },
    { value: "aula_avulsa", label: "Aula Avulsa" },
    { value: "outros", label: "Outros" },
  ];
  const categoriasSaida = [
    { value: "despesa", label: "Despesa" },
    { value: "outros", label: "Outros" },
  ];
  const categorias = isEntrada ? categoriasEntrada : categoriasSaida;

  modal.innerHTML = `
    <h2 class="modal-title">Editar ${isEntrada ? "Entrada" : "Saída"}</h2>

    <div class="modal-grid">
      <div class="field">
        <label>Descrição *</label>
        <input id="descricao" placeholder="Descrição do lançamento" value="${lancamento.descricao || ""}">
      </div>

      <div class="field">
        <label>Categoria</label>
        <select id="categoria">
          ${categorias.map(c => `<option value="${c.value}" ${lancamento.categoria === c.value ? "selected" : ""}>${c.label}</option>`).join("")}
        </select>
      </div>

      <div class="field">
        <label>Valor (R$) *</label>
        <input id="valor" type="number" placeholder="0.00" value="${lancamento.valor || ""}">
      </div>

      <div class="field">
        <label>Data</label>
        <input id="data" type="date" value="${dataFormatada}">
      </div>

      <div class="field">
        <label>Forma de Pagamento</label>
        <select id="forma">
          <option value="Pix" ${lancamento.forma_pagamento === "Pix" ? "selected" : ""}>Pix</option>
          <option value="Dinheiro" ${lancamento.forma_pagamento === "Dinheiro" ? "selected" : ""}>Dinheiro</option>
          <option value="Cartão" ${lancamento.forma_pagamento === "Cartão" ? "selected" : ""}>Cartão</option>
          <option value="Transferência" ${lancamento.forma_pagamento === "Transferência" ? "selected" : ""}>Transferência</option>
        </select>
      </div>

      ${lancamento.aluno_nome ? `
      <div class="field">
        <label>Aluno</label>
        <input readonly style="background: #f1f5f9;" value="${lancamento.aluno_nome}">
      </div>
      ` : ""}
    </div>

    <p style="margin-top: 1rem; color: #6b7280; font-size: 0.85rem;">
      <em>Nota: A edição não altera recibos já emitidos.</em>
    </p>

    <div class="modal-actions">
      <button class="modal-btn-secondary">Cancelar</button>
      <button class="modal-btn-primary">Salvar Alterações</button>
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

    // Atualizar o lançamento
    lancamento.descricao = descricao;
    lancamento.valor = valor;
    lancamento.categoria = modal.querySelector("#categoria").value;
    lancamento.data = modal.querySelector("#data").value || lancamento.data;
    lancamento.forma_pagamento = modal.querySelector("#forma").value;
    lancamento.editadoEm = new Date().toISOString();

    DataStore.save();
    overlay.remove();
    
    // Chamar callback para atualizar a visualização
    if (callback) {
      callback();
    }
  };

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/** Modal para cancelar lançamento do caixa */
function abrirModalCancelarLancamento(lancamento, callback) {
  const overlay = criarOverlay();
  const modal = document.createElement("div");
  modal.className = "modal-card";

  const isEntrada = lancamento.tipo === "entrada";

  modal.innerHTML = `
    <h2 class="modal-title" style="color: #dc2626;">Cancelar ${isEntrada ? "Entrada" : "Saída"}</h2>

    <p style="margin-bottom: 1rem;">
      Você está cancelando o lançamento:<br>
      <strong>${lancamento.descricao || (isEntrada ? "Entrada" : "Saída")}</strong> - ${formatarReais(lancamento.valor)}
    </p>

    <div class="modal-grid">
      <div class="field">
        <label>Motivo do cancelamento (opcional)</label>
        <textarea id="motivo" rows="3" placeholder="Ex: Lançamento duplicado, valor incorreto..." style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px; resize: vertical;"></textarea>
      </div>
    </div>

    <p style="margin-top: 1rem; color: #dc2626; font-size: 0.85rem;">
      <strong>Atenção:</strong> Lançamentos cancelados não entram no cálculo de saldo e não aparecem em relatórios.
    </p>

    <div class="modal-actions">
      <button class="modal-btn-secondary">Voltar</button>
      <button class="modal-btn-primary" style="background: #dc2626;">Confirmar Cancelamento</button>
    </div>
  `;

  modal.querySelector(".modal-btn-secondary").onclick = () => overlay.remove();

  modal.querySelector(".modal-btn-primary").onclick = () => {
    const motivo = modal.querySelector("#motivo").value.trim();

    // Atualizar o lançamento
    lancamento.status = "cancelado";
    lancamento.dataCancelamento = new Date().toISOString();
    if (motivo) {
      lancamento.motivoCancelamento = motivo;
    }

    DataStore.save();
    overlay.remove();
    
    // Chamar callback para atualizar a visualização
    if (callback) {
      callback();
    }
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
   PRESENCA (FREQUENCIA)
========================= */

/** Renderiza pagina de presenca */
function renderPresenca() {
  const turmas = DataStore.state.data.turmas.filter(t => t.ativa !== false);
  
  if (turmas.length === 0) {
    UI.content.innerHTML = `
      <div class="empty-state">
        <h3>Nenhuma turma cadastrada</h3>
        <p>Cadastre pelo menos uma turma para registrar presencas.</p>
      </div>
    `;
    return;
  }

  // Tabs
  const tabsContainer = document.createElement("div");
  tabsContainer.style.cssText = "display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 2px solid var(--color-border); padding-bottom: 0.5rem;";
  
  const tabRegistrar = document.createElement("button");
  tabRegistrar.className = "btn-primary";
  tabRegistrar.textContent = "Registrar Presenca";
  tabRegistrar.id = "tab-registrar";
  tabRegistrar.setAttribute("data-testid", "tab-register-attendance");
  
  const tabConsultar = document.createElement("button");
  tabConsultar.className = "btn-secondary";
  tabConsultar.textContent = "Consultar Presencas";
  tabConsultar.id = "tab-consultar";
  tabConsultar.setAttribute("data-testid", "tab-query-attendance");
  
  tabsContainer.appendChild(tabRegistrar);
  tabsContainer.appendChild(tabConsultar);
  UI.content.appendChild(tabsContainer);
  
  // Content container
  const contentContainer = document.createElement("div");
  contentContainer.id = "presenca-content";
  UI.content.appendChild(contentContainer);
  
  // Tab handlers
  tabRegistrar.onclick = () => {
    tabRegistrar.className = "btn-primary";
    tabConsultar.className = "btn-secondary";
    renderRegistrarPresenca(contentContainer);
  };
  
  tabConsultar.onclick = () => {
    tabConsultar.className = "btn-primary";
    tabRegistrar.className = "btn-secondary";
    renderConsultarPresenca(contentContainer);
  };
  
  // Start with registrar tab
  renderRegistrarPresenca(contentContainer);
}

/** Renderiza aba de registrar presenca */
function renderRegistrarPresenca(container) {
  container.innerHTML = "";
  
  const turmas = DataStore.state.data.turmas.filter(t => t.ativa !== false);
  const hoje = new Date().toISOString().slice(0, 10);
  
  // Header with filters
  const header = document.createElement("div");
  header.style.cssText = "display: flex; gap: 1rem; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap;";
  
  // Turma select
  const fieldTurma = document.createElement("div");
  fieldTurma.className = "field";
  fieldTurma.innerHTML = `<label>Turma *</label>`;
  const selectTurma = document.createElement("select");
  selectTurma.id = "presenca-turma";
  selectTurma.setAttribute("data-testid", "select-attendance-class");
  selectTurma.style.cssText = "padding: 0.5rem; min-width: 200px;";
  selectTurma.innerHTML = '<option value="">Selecione uma turma</option>';
  turmas.forEach(t => {
    selectTurma.innerHTML += `<option value="${t.id}">${t.nome}</option>`;
  });
  fieldTurma.appendChild(selectTurma);
  header.appendChild(fieldTurma);
  
  // Date input
  const fieldData = document.createElement("div");
  fieldData.className = "field";
  fieldData.innerHTML = `<label>Data *</label>`;
  const inputData = document.createElement("input");
  inputData.type = "date";
  inputData.id = "presenca-data";
  inputData.setAttribute("data-testid", "input-attendance-date");
  inputData.value = hoje;
  inputData.style.cssText = "padding: 0.5rem;";
  fieldData.appendChild(inputData);
  header.appendChild(fieldData);
  
  // Load button
  const btnCarregar = document.createElement("button");
  btnCarregar.className = "btn-primary";
  btnCarregar.textContent = "Carregar Alunos";
  btnCarregar.style.marginTop = "1.25rem";
  btnCarregar.setAttribute("data-testid", "button-load-students");
  header.appendChild(btnCarregar);
  
  container.appendChild(header);
  
  // Alunos container
  const alunosContainer = document.createElement("div");
  alunosContainer.id = "presenca-alunos-container";
  container.appendChild(alunosContainer);
  
  // Load button handler
  btnCarregar.onclick = () => {
    const turmaId = selectTurma.value;
    const data = inputData.value;
    
    if (!turmaId || !data) {
      alert("Selecione uma turma e data.");
      return;
    }
    
    renderAlunosPresenca(alunosContainer, turmaId, data);
  };
}

/** Renderiza lista de alunos para marcar presenca */
function renderAlunosPresenca(container, turmaId, data) {
  container.innerHTML = "";
  
  const turma = DataStore.findById("turmas", turmaId);
  if (!turma) return;
  
  // Buscar alunos ativos da turma (incluindo bolsistas com multi-turma)
  const alunos = DataStore.state.data.alunos.filter(a => 
    a.status === "ativo" && alunoEmTurma(a, turmaId)
  );
  
  if (alunos.length === 0) {
    container.innerHTML = '<p style="color: var(--color-text-secondary);">Nenhum aluno ativo nesta turma.</p>';
    return;
  }
  
  // Buscar presencas existentes para esta turma/data
  const presencasExistentes = DataStore.state.data.presencas.filter(p => 
    p.turma_id === turmaId && p.data === data
  );
  
  // Info header
  const infoHeader = document.createElement("div");
  infoHeader.className = "summary-card";
  infoHeader.style.marginBottom = "1rem";
  infoHeader.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
      <div>
        <strong>${turma.nome}</strong>
        <span style="color: var(--color-text-secondary); margin-left: 0.5rem;">${formatarData(data)}</span>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <span class="badge badge-success" id="count-presentes">0 Presentes</span>
        <span class="badge badge-danger" id="count-faltas">0 Faltas</span>
        <span class="badge badge-warning" id="count-justificadas">0 Justificadas</span>
      </div>
    </div>
  `;
  container.appendChild(infoHeader);
  
  // Quick actions
  const quickActions = document.createElement("div");
  quickActions.style.cssText = "display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;";
  
  const btnTodosPresentes = document.createElement("button");
  btnTodosPresentes.className = "btn-secondary btn-sm";
  btnTodosPresentes.textContent = "Marcar Todos Presentes";
  btnTodosPresentes.setAttribute("data-testid", "button-mark-all-present");
  quickActions.appendChild(btnTodosPresentes);
  
  const btnTodosFaltaram = document.createElement("button");
  btnTodosFaltaram.className = "btn-secondary btn-sm";
  btnTodosFaltaram.textContent = "Marcar Todos Falta";
  btnTodosFaltaram.setAttribute("data-testid", "button-mark-all-absent");
  quickActions.appendChild(btnTodosFaltaram);
  
  container.appendChild(quickActions);
  
  // Alunos list
  const grid = document.createElement("div");
  grid.className = "dashboard-cards";
  grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(300px, 1fr))";
  
  alunos.forEach(aluno => {
    const presencaExistente = presencasExistentes.find(p => p.aluno_id === aluno.id);
    const statusAtual = presencaExistente?.status || "";
    const tipoMatricula = aluno.tipoMatricula || "regular";
    
    const card = document.createElement("div");
    card.className = "summary-card";
    card.dataset.alunoId = aluno.id;
    card.dataset.presencaId = presencaExistente?.id || "";
    
    const tipoLabel = tipoMatricula === "bolsista" ? 
      '<span class="badge badge-warning" style="margin-left: 0.5rem;">Bolsista</span>' : "";
    
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
        <div>
          <strong style="font-size: 1rem;">${aluno.nome}</strong>${tipoLabel}
        </div>
      </div>
      <div class="presenca-buttons" style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
        <button class="btn-presenca btn-presente ${statusAtual === "presente" ? "active" : ""}" data-status="presente" data-testid="btn-presente-${aluno.id}">
          [P] Presente
        </button>
        <button class="btn-presenca btn-falta ${statusAtual === "falta" ? "active" : ""}" data-status="falta" data-testid="btn-falta-${aluno.id}">
          [F] Falta
        </button>
        <button class="btn-presenca btn-justificada ${statusAtual === "justificada" ? "active" : ""}" data-status="justificada" data-testid="btn-justificada-${aluno.id}">
          [J] Justificada
        </button>
      </div>
    `;
    
    // Button handlers
    card.querySelectorAll(".btn-presenca").forEach(btn => {
      btn.onclick = () => {
        const novoStatus = btn.dataset.status;
        registrarPresenca(aluno.id, turmaId, data, novoStatus, tipoMatricula, card);
        
        // Update visual
        card.querySelectorAll(".btn-presenca").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        atualizarContadores(container);
      };
    });
    
    grid.appendChild(card);
  });
  
  container.appendChild(grid);
  
  // Quick action handlers
  btnTodosPresentes.onclick = () => {
    grid.querySelectorAll(".summary-card").forEach(card => {
      const alunoId = card.dataset.alunoId;
      const aluno = DataStore.findById("alunos", alunoId);
      const tipoMatricula = aluno?.tipoMatricula || "regular";
      registrarPresenca(alunoId, turmaId, data, "presente", tipoMatricula, card);
      card.querySelectorAll(".btn-presenca").forEach(b => b.classList.remove("active"));
      card.querySelector('[data-status="presente"]').classList.add("active");
    });
    atualizarContadores(container);
  };
  
  btnTodosFaltaram.onclick = () => {
    grid.querySelectorAll(".summary-card").forEach(card => {
      const alunoId = card.dataset.alunoId;
      const aluno = DataStore.findById("alunos", alunoId);
      const tipoMatricula = aluno?.tipoMatricula || "regular";
      registrarPresenca(alunoId, turmaId, data, "falta", tipoMatricula, card);
      card.querySelectorAll(".btn-presenca").forEach(b => b.classList.remove("active"));
      card.querySelector('[data-status="falta"]').classList.add("active");
    });
    atualizarContadores(container);
  };
  
  // Initial count
  atualizarContadores(container);
  
  // Add CSS for presenca buttons
  adicionarEstilosPresenca();
}

/** Registra ou atualiza presenca de um aluno */
function registrarPresenca(alunoId, turmaId, data, status, tipo, card) {
  // Verificar se ja existe presenca para este aluno/turma/data
  const presencaExistente = DataStore.state.data.presencas.find(p => 
    p.aluno_id === alunoId && p.turma_id === turmaId && p.data === data
  );
  
  if (presencaExistente) {
    // Atualizar existente
    presencaExistente.status = status;
    presencaExistente.updatedAt = new Date().toISOString();
  } else {
    // Criar nova
    const novaPresenca = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      aluno_id: alunoId,
      turma_id: turmaId,
      data: data,
      status: status,
      tipo: tipo === "bolsista" ? "bolsista" : "regular",
      createdAt: new Date().toISOString()
    };
    DataStore.state.data.presencas.push(novaPresenca);
    
    // Atualizar dataset do card com novo ID
    if (card) {
      card.dataset.presencaId = novaPresenca.id;
    }
  }
  
  DataStore.save();
  
  // Adicionar ao historico do aluno
  const turma = DataStore.findById("turmas", turmaId);
  const statusLabel = status === "presente" ? "Presente" : status === "falta" ? "Falta" : "Falta Justificada";
  const eventoTexto = `Presenca: ${statusLabel} - ${turma?.nome || "Turma"} - ${formatarData(data)}`;
  adicionarEventoAluno(alunoId, eventoTexto);
}

/** Atualiza contadores de presenca */
function atualizarContadores(container) {
  const cards = container.querySelectorAll(".summary-card[data-aluno-id]");
  let presentes = 0, faltas = 0, justificadas = 0;
  
  cards.forEach(card => {
    const btnAtivo = card.querySelector(".btn-presenca.active");
    if (btnAtivo) {
      const status = btnAtivo.dataset.status;
      if (status === "presente") presentes++;
      else if (status === "falta") faltas++;
      else if (status === "justificada") justificadas++;
    }
  });
  
  const countPresentes = container.querySelector("#count-presentes");
  const countFaltas = container.querySelector("#count-faltas");
  const countJustificadas = container.querySelector("#count-justificadas");
  
  if (countPresentes) countPresentes.textContent = `${presentes} Presentes`;
  if (countFaltas) countFaltas.textContent = `${faltas} Faltas`;
  if (countJustificadas) countJustificadas.textContent = `${justificadas} Justificadas`;
}

/** Adiciona estilos CSS para botoes de presenca */
function adicionarEstilosPresenca() {
  if (document.getElementById("presenca-styles")) return;
  
  const style = document.createElement("style");
  style.id = "presenca-styles";
  style.textContent = `
    .btn-presenca {
      padding: 0.4rem 0.75rem;
      border-radius: 6px;
      border: 1px solid var(--color-border);
      background: var(--color-card);
      color: var(--color-text-secondary);
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 500;
      transition: all 0.15s ease;
    }
    .btn-presenca:hover {
      border-color: var(--color-text-muted);
    }
    .btn-presente.active {
      background: #dcfce7;
      border-color: #16a34a;
      color: #15803d;
    }
    .btn-falta.active {
      background: #fee2e2;
      border-color: #dc2626;
      color: #dc2626;
    }
    .btn-justificada.active {
      background: #fef3c7;
      border-color: #f59e0b;
      color: #b45309;
    }
    body.dark-mode .btn-presente.active {
      background: rgba(34, 197, 94, 0.2);
      color: #4ade80;
    }
    body.dark-mode .btn-falta.active {
      background: rgba(239, 68, 68, 0.2);
      color: #f87171;
    }
    body.dark-mode .btn-justificada.active {
      background: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
    }
  `;
  document.head.appendChild(style);
}

/** Renderiza aba de consultar presencas */
function renderConsultarPresenca(container) {
  container.innerHTML = "";
  
  const turmas = DataStore.state.data.turmas.filter(t => t.ativa !== false);
  const alunos = DataStore.state.data.alunos.filter(a => a.status === "ativo");
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();
  
  // Filters
  const filterContainer = document.createElement("div");
  filterContainer.style.cssText = "display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; align-items: flex-end;";
  
  // Turma filter
  const fieldTurma = document.createElement("div");
  fieldTurma.className = "field";
  fieldTurma.innerHTML = `<label>Turma</label>`;
  const selectTurma = document.createElement("select");
  selectTurma.id = "consulta-turma";
  selectTurma.style.cssText = "padding: 0.5rem; min-width: 180px;";
  selectTurma.innerHTML = '<option value="">Todas</option>';
  turmas.forEach(t => {
    selectTurma.innerHTML += `<option value="${t.id}">${t.nome}</option>`;
  });
  fieldTurma.appendChild(selectTurma);
  filterContainer.appendChild(fieldTurma);
  
  // Aluno filter
  const fieldAluno = document.createElement("div");
  fieldAluno.className = "field";
  fieldAluno.innerHTML = `<label>Aluno</label>`;
  const selectAluno = document.createElement("select");
  selectAluno.id = "consulta-aluno";
  selectAluno.style.cssText = "padding: 0.5rem; min-width: 180px;";
  selectAluno.innerHTML = '<option value="">Todos</option>';
  alunos.forEach(a => {
    selectAluno.innerHTML += `<option value="${a.id}">${a.nome}</option>`;
  });
  fieldAluno.appendChild(selectAluno);
  filterContainer.appendChild(fieldAluno);
  
  // Mes filter
  const fieldMes = document.createElement("div");
  fieldMes.className = "field";
  fieldMes.innerHTML = `<label>Mes</label>`;
  const selectMes = document.createElement("select");
  selectMes.id = "consulta-mes";
  selectMes.style.cssText = "padding: 0.5rem;";
  selectMes.innerHTML = `
    <option value="0">Todos</option>
    <option value="1">Janeiro</option>
    <option value="2">Fevereiro</option>
    <option value="3">Marco</option>
    <option value="4">Abril</option>
    <option value="5">Maio</option>
    <option value="6">Junho</option>
    <option value="7">Julho</option>
    <option value="8">Agosto</option>
    <option value="9">Setembro</option>
    <option value="10">Outubro</option>
    <option value="11">Novembro</option>
    <option value="12">Dezembro</option>
  `;
  selectMes.value = mesAtual;
  fieldMes.appendChild(selectMes);
  filterContainer.appendChild(fieldMes);
  
  // Ano filter
  const fieldAno = document.createElement("div");
  fieldAno.className = "field";
  fieldAno.innerHTML = `<label>Ano</label>`;
  const selectAno = document.createElement("select");
  selectAno.id = "consulta-ano";
  selectAno.style.cssText = "padding: 0.5rem;";
  for (let ano = anoAtual; ano >= anoAtual - 3; ano--) {
    selectAno.innerHTML += `<option value="${ano}">${ano}</option>`;
  }
  fieldAno.appendChild(selectAno);
  filterContainer.appendChild(fieldAno);
  
  // Tipo filter
  const fieldTipo = document.createElement("div");
  fieldTipo.className = "field";
  fieldTipo.innerHTML = `<label>Tipo</label>`;
  const selectTipo = document.createElement("select");
  selectTipo.id = "consulta-tipo";
  selectTipo.style.cssText = "padding: 0.5rem;";
  selectTipo.innerHTML = `
    <option value="">Todos</option>
    <option value="regular">Regular</option>
    <option value="bolsista">Bolsista</option>
    <option value="aula_avulsa">Aula Avulsa</option>
    <option value="reposicao">Reposicao</option>
  `;
  fieldTipo.appendChild(selectTipo);
  filterContainer.appendChild(fieldTipo);
  
  // Buscar button
  const btnBuscar = document.createElement("button");
  btnBuscar.className = "btn-primary";
  btnBuscar.textContent = "Buscar";
  btnBuscar.setAttribute("data-testid", "button-search-attendance");
  filterContainer.appendChild(btnBuscar);
  
  container.appendChild(filterContainer);
  
  // Results container
  const resultsContainer = document.createElement("div");
  resultsContainer.id = "consulta-results";
  container.appendChild(resultsContainer);
  
  // Buscar handler
  btnBuscar.onclick = () => {
    const filtros = {
      turmaId: selectTurma.value,
      alunoId: selectAluno.value,
      mes: parseInt(selectMes.value),
      ano: parseInt(selectAno.value),
      tipo: selectTipo.value
    };
    renderResultadosPresenca(resultsContainer, filtros);
  };
  
  // Initial load
  btnBuscar.click();
}

/** Renderiza resultados da consulta de presenca */
function renderResultadosPresenca(container, filtros) {
  container.innerHTML = "";
  
  let presencas = [...DataStore.state.data.presencas];
  
  // Apply filters
  if (filtros.turmaId) {
    presencas = presencas.filter(p => p.turma_id === filtros.turmaId);
  }
  if (filtros.alunoId) {
    presencas = presencas.filter(p => p.aluno_id === filtros.alunoId);
  }
  if (filtros.mes > 0) {
    presencas = presencas.filter(p => {
      const d = new Date(p.data);
      return d.getMonth() + 1 === filtros.mes;
    });
  }
  if (filtros.ano > 0) {
    presencas = presencas.filter(p => {
      const d = new Date(p.data);
      return d.getFullYear() === filtros.ano;
    });
  }
  if (filtros.tipo) {
    presencas = presencas.filter(p => p.tipo === filtros.tipo);
  }
  
  // Sort by date desc
  presencas.sort((a, b) => new Date(b.data) - new Date(a.data));
  
  // Summary
  const totalPresentes = presencas.filter(p => p.status === "presente").length;
  const totalFaltas = presencas.filter(p => p.status === "falta").length;
  const totalJustificadas = presencas.filter(p => p.status === "justificada").length;
  
  const summaryCard = document.createElement("div");
  summaryCard.className = "summary-card";
  summaryCard.style.marginBottom = "1.5rem";
  summaryCard.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
      <div>
        <strong style="font-size: 1.1rem;">Resumo do Periodo</strong>
        <p style="color: var(--color-text-secondary); margin-top: 0.25rem;">${presencas.length} registro(s) encontrado(s)</p>
      </div>
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <div style="text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 600; color: #16a34a;">${totalPresentes}</div>
          <div style="font-size: 0.8rem; color: var(--color-text-secondary);">Presentes</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 600; color: #dc2626;">${totalFaltas}</div>
          <div style="font-size: 0.8rem; color: var(--color-text-secondary);">Faltas</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 600; color: #f59e0b;">${totalJustificadas}</div>
          <div style="font-size: 0.8rem; color: var(--color-text-secondary);">Justificadas</div>
        </div>
      </div>
    </div>
    <div style="display: flex; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap;">
      <button class="btn-secondary btn-sm" id="btn-pdf-presenca" data-testid="button-export-pdf">Exportar PDF</button>
      <button class="btn-secondary btn-sm" id="btn-whatsapp-presenca" style="background: #25D366; color: white; border: none;" data-testid="button-share-whatsapp">Compartilhar WhatsApp</button>
    </div>
  `;
  container.appendChild(summaryCard);
  
  // PDF/WhatsApp handlers
  summaryCard.querySelector("#btn-pdf-presenca").onclick = () => {
    gerarPDFPresenca(presencas, filtros);
  };
  
  summaryCard.querySelector("#btn-whatsapp-presenca").onclick = () => {
    compartilharPresencaWhatsApp(presencas, filtros);
  };
  
  if (presencas.length === 0) {
    container.innerHTML += '<p style="color: var(--color-text-secondary);">Nenhuma presenca encontrada para os filtros selecionados.</p>';
    return;
  }
  
  // Group by date for display
  const groupedByDate = {};
  presencas.forEach(p => {
    if (!groupedByDate[p.data]) {
      groupedByDate[p.data] = [];
    }
    groupedByDate[p.data].push(p);
  });
  
  // Render grouped results
  Object.keys(groupedByDate).sort().reverse().forEach(data => {
    const presencasDia = groupedByDate[data];
    
    const dayCard = document.createElement("div");
    dayCard.className = "summary-card";
    dayCard.style.marginBottom = "0.75rem";
    
    const turma = DataStore.findById("turmas", presencasDia[0].turma_id);
    
    let alunosHtml = "";
    presencasDia.forEach(p => {
      const aluno = DataStore.findById("alunos", p.aluno_id);
      const statusClass = p.status === "presente" ? "badge-success" : p.status === "falta" ? "badge-danger" : "badge-warning";
      const statusLabel = p.status === "presente" ? "Presente" : p.status === "falta" ? "Falta" : "Justificada";
      alunosHtml += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0; border-bottom: 1px solid var(--color-border);">
          <span>${aluno?.nome || "Aluno removido"}</span>
          <span class="badge ${statusClass}">${statusLabel}</span>
        </div>
      `;
    });
    
    dayCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <strong>${formatarData(data)}</strong>
        <span style="color: var(--color-text-secondary);">${turma?.nome || "Turma"} - ${presencasDia.length} aluno(s)</span>
      </div>
      <div>${alunosHtml}</div>
    `;
    
    container.appendChild(dayCard);
  });
}

/** Gera PDF de relatorio de presenca */
function gerarPDFPresenca(presencas, filtros) {
  const totalPresentes = presencas.filter(p => p.status === "presente").length;
  const totalFaltas = presencas.filter(p => p.status === "falta").length;
  const totalJustificadas = presencas.filter(p => p.status === "justificada").length;
  
  let filtroTexto = "";
  if (filtros.turmaId) {
    const turma = DataStore.findById("turmas", filtros.turmaId);
    filtroTexto += `Turma: ${turma?.nome || "-"}\n`;
  }
  if (filtros.alunoId) {
    const aluno = DataStore.findById("alunos", filtros.alunoId);
    filtroTexto += `Aluno: ${aluno?.nome || "-"}\n`;
  }
  if (filtros.mes > 0) {
    const meses = ["", "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    filtroTexto += `Mes: ${meses[filtros.mes]}\n`;
  }
  if (filtros.ano > 0) {
    filtroTexto += `Ano: ${filtros.ano}\n`;
  }
  
  let conteudo = `
RELATORIO DE PRESENCA
Bailado Carioca
================================

${filtroTexto}
RESUMO:
- Presentes: ${totalPresentes}
- Faltas: ${totalFaltas}
- Justificadas: ${totalJustificadas}
- Total: ${presencas.length}

================================
DETALHAMENTO:
`;

  // Group by date
  const groupedByDate = {};
  presencas.forEach(p => {
    if (!groupedByDate[p.data]) {
      groupedByDate[p.data] = [];
    }
    groupedByDate[p.data].push(p);
  });

  Object.keys(groupedByDate).sort().reverse().forEach(data => {
    const presencasDia = groupedByDate[data];
    const turma = DataStore.findById("turmas", presencasDia[0].turma_id);
    conteudo += `\n${formatarData(data)} - ${turma?.nome || "Turma"}\n`;
    
    presencasDia.forEach(p => {
      const aluno = DataStore.findById("alunos", p.aluno_id);
      const statusLabel = p.status === "presente" ? "[P]" : p.status === "falta" ? "[F]" : "[J]";
      conteudo += `  ${statusLabel} ${aluno?.nome || "Aluno"}\n`;
    });
  });

  // Gerar PDF simples usando blob de texto
  const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `presenca_${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Compartilha relatorio de presenca via WhatsApp */
function compartilharPresencaWhatsApp(presencas, filtros) {
  const totalPresentes = presencas.filter(p => p.status === "presente").length;
  const totalFaltas = presencas.filter(p => p.status === "falta").length;
  const totalJustificadas = presencas.filter(p => p.status === "justificada").length;
  
  let texto = `*RELATORIO DE PRESENCA*\nBailado Carioca\n\n`;
  texto += `Presentes: ${totalPresentes}\n`;
  texto += `Faltas: ${totalFaltas}\n`;
  texto += `Justificadas: ${totalJustificadas}\n`;
  texto += `Total: ${presencas.length}`;
  
  const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  window.open(url, "_blank");
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

  const btnVerificar = document.createElement("button");
  btnVerificar.className = "btn-secondary";
  btnVerificar.textContent = "Verificar Inconsistencias";
  btnVerificar.style.marginLeft = "0.5rem";
  btnVerificar.setAttribute("data-testid", "button-verify-inconsistencies");
  btnVerificar.onclick = () => verificarInconsistencias(parseInt(selectMes.value), parseInt(inputAno.value));
  header.appendChild(btnVerificar);

  UI.content.appendChild(header);

  const container = document.createElement("div");
  container.id = "relatorio-container";
  UI.content.appendChild(container);

  gerarRelatorioMensal(mesAtual, anoAtual);
}

/** Verifica inconsistencias entre mensalidades e caixa */
function verificarInconsistencias(mes, ano) {
  const container = document.getElementById("relatorio-container");
  container.innerHTML = "";

  const meses = ["", "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", 
                 "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const mesStr = String(mes).padStart(2, "0");
  const anoStr = String(ano);
  const mesAnoStr = `${mesStr}/${anoStr}`;
  
  // Mensalidades pagas do periodo (mes/ano podem ser strings ou numeros)
  const mensalidadesPagas = DataStore.state.data.mensalidades.filter(m => {
    if (m.status !== "paga") return false;
    // Comparar mes e ano (podem estar em formatos diferentes)
    const mMes = String(m.mes).padStart(2, "0");
    const mAno = String(m.ano);
    return mMes === mesStr && mAno === anoStr;
  });
  
  // Entradas do caixa do periodo (entradas de mensalidade, ativas)
  const entradasCaixa = DataStore.state.data.caixa.filter(c => {
    if (c.status === "cancelado") return false;
    if (c.tipo !== "entrada") return false;
    // Identificar entradas de mensalidade por categoria OU por descricao contendo "Mensalidade"
    const isMensalidade = c.categoria === "mensalidade" || 
                          (c.descricao && c.descricao.toLowerCase().includes("mensalidade"));
    if (!isMensalidade) return false;
    const dataC = new Date(c.data);
    return (dataC.getMonth() + 1) === mes && dataC.getFullYear() === ano;
  });

  const totalMensalidades = mensalidadesPagas.reduce((sum, m) => sum + (m.valor || 0), 0);
  const totalEntradasCaixa = entradasCaixa.reduce((sum, c) => sum + (c.valor || 0), 0);
  const diferenca = totalMensalidades - totalEntradasCaixa;

  // Criar mapa de mensalidades por aluno_id
  const mensalidadesMap = new Map();
  mensalidadesPagas.forEach(m => {
    const key = m.aluno_id;
    if (!mensalidadesMap.has(key)) mensalidadesMap.set(key, []);
    mensalidadesMap.get(key).push(m);
  });

  // Criar mapa de entradas por aluno_id (usando descricao ou aluno_id se disponivel)
  const entradasMap = new Map();
  entradasCaixa.forEach(c => {
    const key = c.aluno_id || c.descricao;
    if (!entradasMap.has(key)) entradasMap.set(key, []);
    entradasMap.get(key).push(c);
  });

  // Identificar mensalidades sem entrada correspondente no caixa
  const semEntrada = [];
  mensalidadesPagas.forEach(m => {
    const aluno = DataStore.state.data.alunos.find(a => a.id === m.aluno_id);
    const nomeAluno = aluno ? aluno.nome : "Aluno nao encontrado";
    
    // Procurar entrada correspondente no caixa
    const entradaCorrespondente = entradasCaixa.find(c => 
      c.aluno_id === m.aluno_id || 
      (c.descricao && c.descricao.includes(nomeAluno) && c.descricao.includes(mesAnoStr))
    );
    
    if (!entradaCorrespondente) {
      semEntrada.push({
        mensalidade: m,
        nomeAluno: nomeAluno,
        valor: m.valor
      });
    }
  });

  // Montar relatorio
  let html = `
    <h2 style="margin-bottom: 1rem;">Verificacao de Inconsistencias - ${meses[mes]}/${ano}</h2>
    
    <div class="dashboard-cards" style="margin-bottom: 1.5rem;">
      <div class="summary-card">
        <span class="card-title">Mensalidades Pagas</span>
        <span class="card-value">${mensalidadesPagas.length}</span>
        <span style="font-size: 0.85rem; color: var(--color-text-muted);">${formatarReais(totalMensalidades)}</span>
      </div>
      <div class="summary-card">
        <span class="card-title">Entradas no Caixa</span>
        <span class="card-value">${entradasCaixa.length}</span>
        <span style="font-size: 0.85rem; color: var(--color-text-muted);">${formatarReais(totalEntradasCaixa)}</span>
      </div>
      <div class="summary-card">
        <span class="card-title">Diferenca</span>
        <span class="card-value" style="color: ${diferenca === 0 ? '#16a34a' : '#dc2626'};">${formatarReais(diferenca)}</span>
        <span style="font-size: 0.85rem; color: var(--color-text-muted);">${diferenca === 0 ? 'OK' : 'Verificar'}</span>
      </div>
    </div>
  `;

  if (semEntrada.length > 0) {
    html += `
      <div style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
        <h3 style="color: #dc2626; margin-bottom: 1rem;">Mensalidades pagas SEM entrada no Caixa (${semEntrada.length})</h3>
        <p style="color: var(--color-text-muted); margin-bottom: 1rem; font-size: 0.9rem;">
          Estas mensalidades foram marcadas como pagas, mas nao geraram lancamento no Caixa.
          Isso pode ocorrer se a mensalidade foi editada manualmente para "paga" sem usar o botao de pagamento.
        </p>
        <div class="cards-grid">
    `;
    
    semEntrada.forEach(item => {
      html += `
        <div class="student-card" style="border-left: 4px solid #dc2626;">
          <div class="card-header">
            <strong>${item.nomeAluno}</strong>
          </div>
          <div class="card-body">
            <p><strong>Valor:</strong> ${formatarReais(item.valor)}</p>
            <p><strong>Referencia:</strong> ${item.mensalidade.mesRef}</p>
            <p><strong>Data Pagamento:</strong> ${item.mensalidade.dataPagamento || 'N/A'}</p>
          </div>
          <div class="card-actions">
            <button class="btn-sm btn-primary" onclick="criarEntradaFaltante('${item.mensalidade.id}')">Criar Entrada no Caixa</button>
          </div>
        </div>
      `;
    });
    
    html += `</div></div>`;
  } else if (diferenca === 0) {
    html += `
      <div style="background: var(--color-card); border: 1px solid #16a34a; border-radius: 8px; padding: 1.5rem; text-align: center;">
        <h3 style="color: #16a34a;">Tudo certo!</h3>
        <p style="color: var(--color-text-muted);">Todas as mensalidades pagas tem entrada correspondente no Caixa.</p>
      </div>
    `;
  } else {
    html += `
      <div style="background: var(--color-card); border: 1px solid #f59e0b; border-radius: 8px; padding: 1.5rem;">
        <h3 style="color: #f59e0b; margin-bottom: 0.5rem;">Diferenca detectada</h3>
        <p style="color: var(--color-text-muted);">
          Existe uma diferenca de ${formatarReais(Math.abs(diferenca))} entre mensalidades e caixa.
          Pode haver entradas duplicadas ou valores diferentes.
        </p>
      </div>
    `;
  }

  container.innerHTML = html;
}

/** Cria entrada no caixa para mensalidade paga que nao gerou lancamento */
function criarEntradaFaltante(mensalidadeId) {
  const mensalidade = DataStore.state.data.mensalidades.find(m => m.id === mensalidadeId);
  if (!mensalidade) {
    alert("Mensalidade nao encontrada");
    return;
  }

  const aluno = DataStore.state.data.alunos.find(a => a.id === mensalidade.aluno_id);
  const nomeAluno = aluno ? aluno.nome : "Aluno";
  
  // Criar entrada no caixa
  DataStore.state.data.caixa.push({
    id: crypto.randomUUID(),
    tipo: "entrada",
    categoria: "mensalidade",
    descricao: `Mensalidade ${mensalidade.mesRef} - ${nomeAluno}`,
    valor: mensalidade.valor,
    data: mensalidade.dataPagamento || new Date().toISOString().split("T")[0],
    formaPagamento: mensalidade.formaPagamento || "dinheiro",
    aluno_id: mensalidade.aluno_id,
    createdAt: new Date().toISOString()
  });

  DataStore.save();
  alert("Entrada criada no Caixa com sucesso!");
  
  // Recarregar verificacao
  const mes = parseInt(document.getElementById("relatorio-mes").value);
  const ano = parseInt(document.getElementById("relatorio-ano").value);
  verificarInconsistencias(mes, ano);
}

/** Gera relatório mensal */
function gerarRelatorioMensal(mes, ano) {
  const container = document.getElementById("relatorio-container");
  container.innerHTML = "";

  const caixa = DataStore.state.data.caixa;
  // Filtrar por mês/ano E excluir cancelados
  const movimentosMes = caixa.filter(mov => {
    if (mov.status === "cancelado") return false;
    const data = new Date(mov.data);
    return data.getMonth() + 1 === mes && data.getFullYear() === ano;
  });

  const entradas = movimentosMes.filter(m => m.tipo === "entrada");
  const saidas = movimentosMes.filter(m => m.tipo === "saida");
  const totalEntradas = entradas.reduce((sum, m) => sum + (m.valor || 0), 0);
  const totalSaidas = saidas.reduce((sum, m) => sum + (m.valor || 0), 0);
  const saldo = totalEntradas - totalSaidas;

  // Usar categoria se disponível, senão fallback para descrição
  const mensalidadesEntradas = entradas.filter(m => 
    m.categoria === "mensalidade" || 
    (m.descricao && m.descricao.toLowerCase().includes("mensalidade"))
  );
  const aulasAvulsas = entradas.filter(m => 
    m.categoria === "aula_avulsa" || 
    (m.descricao && m.descricao.toLowerCase().includes("aula avulsa"))
  );
  const outrasEntradas = entradas.filter(m => 
    m.categoria === "outros" || 
    (!m.categoria && !m.descricao) || 
    (m.categoria !== "mensalidade" && m.categoria !== "aula_avulsa" && 
     !m.descricao?.toLowerCase().includes("mensalidade") && 
     !m.descricao?.toLowerCase().includes("aula avulsa"))
  );

  const meses = ["","Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const anoAnterior = mes === 1 ? ano - 1 : ano;
  const dadosAnterior = obterDadosMes(mesAnterior, anoAnterior);
  
  const compEntradas = formatarComparativo(totalEntradas, dadosAnterior.entradas);
  const compSaidas = formatarComparativo(totalSaidas, dadosAnterior.saidas);
  const compSaldo = formatarComparativo(saldo, dadosAnterior.saldo);

  const summaryCards = document.createElement("div");
  summaryCards.className = "dashboard-cards";
  summaryCards.innerHTML = `
    <div class="summary-card" style="border-left: 4px solid #16a34a;">
      <h4>Total de Entradas</h4>
      <p style="font-size: 1.5rem; font-weight: bold; color: #16a34a;">${formatarReais(totalEntradas)}</p>
      <span style="font-size: 0.8rem; color: ${compEntradas.cor};">${compEntradas.seta} ${compEntradas.texto}</span>
    </div>
    <div class="summary-card" style="border-left: 4px solid #dc2626;">
      <h4>Total de Saidas</h4>
      <p style="font-size: 1.5rem; font-weight: bold; color: #dc2626;">${formatarReais(totalSaidas)}</p>
      <span style="font-size: 0.8rem; color: ${compSaidas.cor};">${compSaidas.seta} ${compSaidas.texto}</span>
    </div>
    <div class="summary-card" style="border-left: 4px solid #3b82f6;">
      <h4>Saldo do Mes</h4>
      <p style="font-size: 1.5rem; font-weight: bold; color: ${saldo >= 0 ? "#16a34a" : "#dc2626"};">${formatarReais(saldo)}</p>
      <span style="font-size: 0.8rem; color: ${compSaldo.cor};">${compSaldo.seta} ${compSaldo.texto}</span>
    </div>
  `;
  container.appendChild(summaryCards);
  
  const mesesNome = ["","Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const comparativoSection = document.createElement("div");
  comparativoSection.className = "summary-card";
  comparativoSection.style.cssText = "margin-top: 1rem; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);";
  comparativoSection.innerHTML = `
    <h4 style="margin-bottom: 0.75rem; color: #475569;">Comparativo com ${mesesNome[mesAnterior]}/${anoAnterior}</h4>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
      <div>
        <div style="font-size: 0.85rem; color: #64748b;">Entradas</div>
        <div style="font-weight: 600; color: ${compEntradas.cor};">${compEntradas.seta} ${compEntradas.texto}</div>
        <div style="font-size: 0.75rem; color: #94a3b8;">Anterior: ${formatarReais(dadosAnterior.entradas)}</div>
      </div>
      <div>
        <div style="font-size: 0.85rem; color: #64748b;">Saidas</div>
        <div style="font-weight: 600; color: ${compSaidas.cor};">${compSaidas.seta} ${compSaidas.texto}</div>
        <div style="font-size: 0.75rem; color: #94a3b8;">Anterior: ${formatarReais(dadosAnterior.saidas)}</div>
      </div>
      <div>
        <div style="font-size: 0.85rem; color: #64748b;">Saldo</div>
        <div style="font-weight: 600; color: ${compSaldo.cor};">${compSaldo.seta} ${compSaldo.texto}</div>
        <div style="font-size: 0.75rem; color: #94a3b8;">Anterior: ${formatarReais(dadosAnterior.saldo)}</div>
      </div>
    </div>
  `;
  container.appendChild(comparativoSection);

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
        <img src="${window.location.origin}/logo.jpg" alt="Bailado Carioca" style="width: 200px; height: auto; margin-bottom: 15px;">
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
  const lixeiraAntiga = DataStore.state.data.lixeira || [];
  const alunosExcluidos = DataStore.state.data.alunos.filter(a => a.status === "excluido");

  const grid = criarGridCards();
  let temItens = false;

  alunosExcluidos.forEach(aluno => {
    temItens = true;
    const dataExclusao = aluno.dataExclusao 
      ? new Date(aluno.dataExclusao).toLocaleDateString("pt-BR") 
      : "N/A";

    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <strong>${aluno.nome}</strong>
        <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; background: #f1f5f9; color: #64748b;">
          Aluno
        </span>
      </div>
      <p style="margin: 0.5rem 0; color: #64748b; font-size: 0.85rem;">
        Excluido em: ${dataExclusao}
      </p>
      <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;"></div>
    `;

    const acoes = card.querySelector("div:last-child");

    const btnRestaurar = document.createElement("button");
    btnRestaurar.className = "btn-primary";
    btnRestaurar.textContent = "Restaurar";
    btnRestaurar.onclick = () => {
      const turma = DataStore.findById("turmas", aluno.turma);
      const turmaInfo = turma ? ` para a turma "${turma.nome}"` : "";
      
      if (confirm(`Restaurar aluno "${aluno.nome}"${turmaInfo}?\n\nO aluno voltará ao status ativo.`)) {
        aluno.status = "ativo";
        delete aluno.dataExclusao;
        DataStore.save();
        UI.navigate("lixeira");
      }
    };
    acoes.appendChild(btnRestaurar);

    const btnExcluirDef = document.createElement("button");
    btnExcluirDef.className = "btn-secondary";
    btnExcluirDef.textContent = "Excluir Definitivo";
    btnExcluirDef.onclick = () => {
      if (confirm("Excluir permanentemente? Esta acao nao pode ser desfeita.")) {
        const idx = DataStore.state.data.alunos.findIndex(a => a.id === aluno.id);
        if (idx !== -1) {
          DataStore.state.data.alunos.splice(idx, 1);
        }
        DataStore.save();
        UI.navigate("lixeira");
      }
    };
    acoes.appendChild(btnExcluirDef);

    grid.appendChild(card);
  });

  lixeiraAntiga.forEach((item, index) => {
    temItens = true;
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
        Excluido em: ${formatarData(item._deletadoEm)}
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
        } else if (entidade === "alunos") {
          itemOriginal.status = "ativo";
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
      if (confirm("Excluir permanentemente? Esta acao nao pode ser desfeita.")) {
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

  if (!temItens) {
    UI.content.innerHTML = `
      <div class="empty-state">
        <h3>Lixeira Vazia</h3>
        <p>Nenhum item excluido.</p>
      </div>
    `;
    return;
  }

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

    <hr style="margin: 2rem 0; border: none; border-top: 1px solid #e5e7eb;">

    <h3 style="margin-bottom: 1rem;">Seguranca / Alterar Senha</h3>
    <p style="color: #6b7280; margin-bottom: 1rem; font-size: 0.9rem;">
      Altere a senha do usuario logado. A nova senha sera valida no proximo login.
    </p>

    <div class="field" style="margin-bottom: 1rem;">
      <label>Senha Atual</label>
      <input type="password" id="senhaAtual" style="width: 100%; padding: 0.5rem;" placeholder="Digite sua senha atual">
    </div>

    <div class="field" style="margin-bottom: 1rem;">
      <label>Nova Senha</label>
      <input type="password" id="novaSenha" style="width: 100%; padding: 0.5rem;" placeholder="Digite a nova senha">
    </div>

    <div class="field" style="margin-bottom: 1rem;">
      <label>Confirmar Nova Senha</label>
      <input type="password" id="confirmarSenha" style="width: 100%; padding: 0.5rem;" placeholder="Confirme a nova senha">
    </div>

    <button class="btn-primary" id="btnAlterarSenha" data-testid="button-change-password">Alterar Senha</button>
    <span id="msgSenha" style="margin-left: 1rem; display: none;"></span>

    <hr style="margin: 2rem 0; border: none; border-top: 1px solid #e5e7eb;">

    <h3 style="margin-bottom: 1rem;">Backup e Restauracao</h3>
    <p style="color: #6b7280; margin-bottom: 1rem; font-size: 0.9rem;">
      Exporte seus dados para um arquivo JSON para fazer backup. Importe um arquivo de backup para restaurar os dados.
    </p>

    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
      <button class="btn-primary" id="btnExportarDados" data-testid="button-export-data" style="background: #16a34a;">
        Exportar Dados
      </button>
      <button class="btn-primary" id="btnImportarDados" data-testid="button-import-data" style="background: #2563eb;">
        Importar Dados
      </button>
      <input type="file" id="inputImportFile" accept=".json" style="display: none;">
    </div>
    <p id="msgBackup" style="margin-top: 1rem; color: #16a34a; display: none;"></p>
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

  // Alterar senha
  container.querySelector("#btnAlterarSenha").onclick = () => {
    const senhaAtual = container.querySelector("#senhaAtual").value;
    const novaSenha = container.querySelector("#novaSenha").value;
    const confirmarSenha = container.querySelector("#confirmarSenha").value;
    const msgSenha = container.querySelector("#msgSenha");

    // Limpar mensagem anterior
    msgSenha.style.display = "none";

    // Validacoes
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      msgSenha.textContent = "Preencha todos os campos";
      msgSenha.style.color = "#dc2626";
      msgSenha.style.display = "inline";
      return;
    }

    // Obter sessao atual
    const sessao = Auth.getSessao();
    if (!sessao) {
      msgSenha.textContent = "Sessao invalida. Faca login novamente.";
      msgSenha.style.color = "#dc2626";
      msgSenha.style.display = "inline";
      return;
    }

    // Verificar senha atual
    const usuario = Auth.usuarios.find(u => u.usuario === sessao.usuario);
    if (!usuario || usuario.senha !== senhaAtual) {
      msgSenha.textContent = "Senha atual incorreta";
      msgSenha.style.color = "#dc2626";
      msgSenha.style.display = "inline";
      return;
    }

    // Verificar confirmacao
    if (novaSenha !== confirmarSenha) {
      msgSenha.textContent = "As senhas nao conferem";
      msgSenha.style.color = "#dc2626";
      msgSenha.style.display = "inline";
      return;
    }

    // Verificar tamanho minimo
    if (novaSenha.length < 4) {
      msgSenha.textContent = "A senha deve ter pelo menos 4 caracteres";
      msgSenha.style.color = "#dc2626";
      msgSenha.style.display = "inline";
      return;
    }

    // Atualizar senha no array de usuarios
    usuario.senha = novaSenha;

    // Salvar usuarios no localStorage
    Auth.salvarUsuarios();

    // Limpar campos
    container.querySelector("#senhaAtual").value = "";
    container.querySelector("#novaSenha").value = "";
    container.querySelector("#confirmarSenha").value = "";

    // Sucesso
    msgSenha.textContent = "Senha alterada com sucesso!";
    msgSenha.style.color = "#16a34a";
    msgSenha.style.display = "inline";
    setTimeout(() => msgSenha.style.display = "none", 3000);
  };

  // Exportar dados
  container.querySelector("#btnExportarDados").onclick = () => {
    exportarDados();
  };

  // Importar dados
  const inputFile = container.querySelector("#inputImportFile");
  container.querySelector("#btnImportarDados").onclick = () => {
    inputFile.click();
  };

  inputFile.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      importarDados(file, container.querySelector("#msgBackup"));
    }
    inputFile.value = "";
  };

  UI.content.appendChild(container);
}

/** Exporta todos os dados para arquivo JSON */
function exportarDados() {
  const dados = DataStore.state.data;
  const dataStr = JSON.stringify(dados, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.toTimeString().slice(0, 5).replace(":", "");
  const filename = `bailado_backup_${dateStr}_${timeStr}.json`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Importa dados de arquivo JSON */
function importarDados(file, msgElement) {
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      const dados = JSON.parse(e.target.result);
      
      // Validar estrutura básica do arquivo
      if (!dados || typeof dados !== "object") {
        throw new Error("Arquivo invalido");
      }

      // Verificar se tem pelo menos algumas das entidades esperadas
      const entidadesEsperadas = ["alunos", "turmas", "unidades", "professores", "mensalidades", "recibos", "caixa", "presencas", "config"];
      const entidadesEncontradas = entidadesEsperadas.filter(e => dados[e] !== undefined);
      
      if (entidadesEncontradas.length === 0) {
        throw new Error("Arquivo nao contem dados do Bailado Carioca");
      }

      // Montar resumo dos dados a serem importados
      const resumo = [];
      if (dados.alunos) resumo.push(`${dados.alunos.length} aluno(s)`);
      if (dados.turmas) resumo.push(`${dados.turmas.length} turma(s)`);
      if (dados.unidades) resumo.push(`${dados.unidades.length} unidade(s)`);
      if (dados.professores) resumo.push(`${dados.professores.length} professor(es)`);
      if (dados.mensalidades) resumo.push(`${dados.mensalidades.length} mensalidade(s)`);
      if (dados.recibos) resumo.push(`${dados.recibos.length} recibo(s)`);
      if (dados.caixa) resumo.push(`${dados.caixa.length} lancamento(s)`);
      if (dados.presencas) resumo.push(`${dados.presencas.length} presenca(s)`);

      const confirmar = confirm(
        `ATENCAO: Isso vai SUBSTITUIR todos os dados atuais!\n\n` +
        `Dados a serem importados:\n` +
        `${resumo.join(", ")}\n\n` +
        `Deseja continuar?`
      );

      if (!confirmar) {
        if (msgElement) {
          msgElement.style.color = "#6b7280";
          msgElement.textContent = "Importacao cancelada.";
          msgElement.style.display = "block";
          setTimeout(() => msgElement.style.display = "none", 3000);
        }
        return;
      }

      // Fazer merge com estrutura padrão para garantir que todas as entidades existam
      const dadosCompletos = {
        alunos: dados.alunos || [],
        turmas: dados.turmas || [],
        unidades: dados.unidades || [],
        professores: dados.professores || [],
        mensalidades: dados.mensalidades || [],
        recibos: dados.recibos || [],
        caixa: dados.caixa || [],
        presencas: dados.presencas || [],
        lixeira: dados.lixeira || [],
        config: dados.config || { nomeProjeto: "Bailado Carioca", observacoes: "" },
      };

      // Salvar no localStorage
      DataStore.state.data = dadosCompletos;
      DataStore.save();

      // Migrar alunos para novo sistema de status se necessário
      DataStore.migrateAlunosStatus();

      alert("Dados importados com sucesso! A pagina sera recarregada.");
      location.reload();

    } catch (err) {
      console.error("Erro ao importar:", err);
      if (msgElement) {
        msgElement.style.color = "#dc2626";
        msgElement.textContent = "Erro: arquivo invalido ou corrompido.";
        msgElement.style.display = "block";
        setTimeout(() => msgElement.style.display = "none", 5000);
      }
    }
  };

  reader.onerror = () => {
    if (msgElement) {
      msgElement.style.color = "#dc2626";
      msgElement.textContent = "Erro ao ler o arquivo.";
      msgElement.style.display = "block";
      setTimeout(() => msgElement.style.display = "none", 5000);
    }
  };

  reader.readAsText(file);
}

/* =========================
   MANUAL DE USO
========================= */

/** Renderiza pagina do Manual de Uso */
function renderManual() {
  const container = document.createElement("div");
  container.className = "manual-container";
  container.innerHTML = `
    <div class="summary-card" style="max-width: 900px;">
      <h2 style="margin-bottom: 1.5rem; color: var(--text-primary);">Manual de Uso - Bailado Carioca</h2>

      <div class="manual-section">
        <h3>1. Introducao</h3>
        <p>O <strong>Sistema de Gestao do Bailado Carioca</strong> foi criado para facilitar o dia a dia da escola de danca. Com ele, voce pode:</p>
        <ul>
          <li>Cadastrar e gerenciar alunos</li>
          <li>Controlar turmas e unidades</li>
          <li>Registrar presenca</li>
          <li>Gerenciar bolsistas</li>
          <li>Controlar pagamentos e recibos</li>
          <li>Acompanhar o fluxo de caixa</li>
        </ul>
        <p>Todos os dados ficam salvos no seu navegador. Nao precisa de internet para usar o sistema apos carrega-lo.</p>
      </div>

      <div class="manual-section">
        <h3>2. Acesso ao Sistema</h3>
        <h4>Tela de Abertura</h4>
        <p>Ao abrir o sistema, voce vera a tela de boas-vindas com o botao <strong>"Entrar no Sistema"</strong>.</p>
        
        <h4>Login</h4>
        <p>Digite seu usuario e senha para entrar. Se errar, uma mensagem de erro aparecera.</p>
        
        <h4>Perfis de Acesso</h4>
        <ul>
          <li><strong>Admin:</strong> Acesso total a todas as funcoes, incluindo financeiro</li>
          <li><strong>Operacional:</strong> Acesso limitado a Alunos, Bolsistas, Presenca, Turmas, Unidades e Trancados</li>
        </ul>
        <p>Para alterar sua senha, acesse <strong>Configuracoes</strong> e use a secao "Seguranca".</p>
      </div>

      <div class="manual-section">
        <h3>3. Cadastro de Alunos</h3>
        <h4>Campos Obrigatorios</h4>
        <ul>
          <li>Nome completo</li>
          <li>Telefone de contato</li>
          <li>Turma</li>
          <li>Unidade</li>
        </ul>
        
        <h4>Campos Opcionais</h4>
        <ul>
          <li>Email</li>
          <li>CPF</li>
        </ul>
        
        <h4>Status do Aluno</h4>
        <ul>
          <li><strong>Ativo:</strong> Aluno regular, frequentando aulas</li>
          <li><strong>Trancado:</strong> Aluno com matricula suspensa temporariamente</li>
          <li><strong>Excluido:</strong> Aluno removido (vai para a Lixeira, pode ser restaurado)</li>
        </ul>
      </div>

      <div class="manual-section">
        <h3>4. Bolsistas</h3>
        <h4>O que e um Bolsista?</h4>
        <p>Bolsista e um aluno que recebe desconto total ou parcial na mensalidade.</p>
        
        <h4>Tipos de Bolsa</h4>
        <ul>
          <li><strong>Integral:</strong> 100% de desconto</li>
          <li><strong>Parcial:</strong> Desconto parcial</li>
          <li><strong>Apoio:</strong> Bolsa de apoio especial</li>
        </ul>
        
        <h4>Como Conceder Bolsa</h4>
        <ol>
          <li>Acesse a pagina <strong>Bolsistas</strong></li>
          <li>Clique em <strong>"Conceder Bolsa"</strong></li>
          <li>Selecione o aluno e o tipo de bolsa</li>
          <li>Adicione observacoes se necessario</li>
        </ol>
        
        <h4>Impacto Financeiro</h4>
        <p>Bolsistas <strong>nao aparecem</strong> na lista de mensalidades pendentes e nunca sao marcados como inadimplentes.</p>
      </div>

      <div class="manual-section">
        <h3>5. Presenca</h3>
        <h4>Registrar Presenca</h4>
        <ol>
          <li>Acesse a pagina <strong>Presenca</strong></li>
          <li>Selecione a turma e a data</li>
          <li>Para cada aluno, clique:
            <ul>
              <li><strong>[P]</strong> Presente</li>
              <li><strong>[F]</strong> Falta</li>
              <li><strong>[J]</strong> Justificada</li>
            </ul>
          </li>
        </ol>
        <p>Use os botoes "Marcar Todos Presentes" ou "Marcar Todos Falta" para agilizar.</p>
        
        <h4>Consultar Presenca</h4>
        <p>Na aba <strong>Consultar</strong>, filtre por turma, aluno, mes ou ano para ver o historico.</p>
        
        <h4>Exportar Relatorios</h4>
        <p>Apos consultar, use os botoes <strong>PDF</strong> ou <strong>WhatsApp</strong> para compartilhar.</p>
      </div>

      <div class="manual-section">
        <h3>6. Financeiro (Somente Admin)</h3>
        <p><em>Esta secao e visivel apenas para usuarios com perfil Admin.</em></p>
        
        <h4>Mensalidades</h4>
        <p>Registre pagamentos de alunos. O sistema mostra quem esta com pagamento pendente.</p>
        
        <h4>Caixa</h4>
        <p>Controle entradas e saidas de dinheiro. Categorias disponiveis:</p>
        <ul>
          <li>Mensalidade</li>
          <li>Aula Avulsa</li>
          <li>Despesa</li>
          <li>Outros</li>
        </ul>
        
        <h4>Recibos</h4>
        <p>Gere recibos profissionais para os alunos. Pode exportar em PDF ou enviar via WhatsApp.</p>
      </div>

      <div class="manual-section">
        <h3>7. Backup e Seguranca</h3>
        <h4>Exportar Dados</h4>
        <ol>
          <li>Acesse <strong>Configuracoes</strong></li>
          <li>Clique em <strong>"Exportar Dados"</strong></li>
          <li>Um arquivo JSON sera baixado com todos os dados</li>
        </ol>
        
        <h4>Importar Dados</h4>
        <ol>
          <li>Acesse <strong>Configuracoes</strong></li>
          <li>Clique em <strong>"Importar Dados"</strong></li>
          <li>Selecione um arquivo de backup</li>
          <li>Confirme a importacao (os dados atuais serao substituidos)</li>
        </ol>
        
        <h4>Alterar Senha</h4>
        <p>Em <strong>Configuracoes > Seguranca</strong>, voce pode alterar sua senha a qualquer momento.</p>
      </div>

      <div class="manual-section">
        <h3>8. Boas Praticas de Uso</h3>
        <ul>
          <li><strong>Faca backup regularmente:</strong> Exporte seus dados pelo menos uma vez por semana</li>
          <li><strong>Evite exclusoes definitivas:</strong> Use o "Trancar" ao inves de excluir quando possivel</li>
          <li><strong>Confira antes de salvar:</strong> Revise os dados antes de confirmar</li>
          <li><strong>Mantenha senhas seguras:</strong> Nao compartilhe sua senha com outras pessoas</li>
          <li><strong>Use a Lixeira:</strong> Itens excluidos podem ser restaurados pela Lixeira</li>
        </ul>
      </div>

      <div class="manual-section" style="background: var(--color-info-bg); padding: 1rem; border-radius: 8px;">
        <h4 style="margin-top: 0;">Precisa de Ajuda?</h4>
        <p style="margin-bottom: 0;">Se tiver duvidas sobre o uso do sistema, consulte este manual ou entre em contato com o administrador.</p>
      </div>
    </div>
  `;

  UI.content.appendChild(container);
}

/* =========================
   MOBILE SIDEBAR
========================= */
function initMobileSidebar() {
  const toggle = document.getElementById("sidebar-toggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  const menu = document.getElementById("menu");
  
  if (!toggle || !sidebar || !overlay) return;
  
  toggle.onclick = () => {
    sidebar.classList.add("open");
    overlay.classList.add("active");
  };
  
  overlay.onclick = () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
  };
  
  if (menu) {
    menu.onclick = (e) => {
      if (e.target.closest(".menu-item") && window.innerWidth <= 768) {
        sidebar.classList.remove("open");
        overlay.classList.remove("active");
      }
    };
  }
}

/* =========================
   START (Idempotent)
========================= */
function bootstrapApp() {
  if (AppState.initialized) {
    AppState.cleanup();
  }
  
  UI.menu = document.getElementById("menu");
  UI.title = document.getElementById("page-title");
  UI.content = document.getElementById("content-area");
  
  UI.init();
  initMobileSidebar();
  
  AppState.markInitialized();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapApp);
} else {
  bootstrapApp();
}
