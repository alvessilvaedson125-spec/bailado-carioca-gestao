/* ===============================
   DATA STORE
================================ */
const DataStore = {
  state: {
    currentPage: "dashboard",
    data: {
      alunos: [],
      turmas: [],
      unidades: [],
      professores: [],
      presenca: [],
      mensalidades: [],
      caixa: [],
    },
  },

  load() {
    const saved = localStorage.getItem("schoolAppData");
    if (saved) this.state.data = JSON.parse(saved);
  },

  save() {
    localStorage.setItem("schoolAppData", JSON.stringify(this.state.data));
  },

  getCount(entity) {
    if (entity === "alunos") {
      return this.state.data.alunos.filter(a => a.ativo).length;
    }
    return this.state.data[entity]?.length || 0;
  },

  getMensalidadesAbertasCount() {
    return this.state.data.mensalidades.filter(m => m.status === "aberta").length;
  },

  pages: [
    { id: "dashboard", label: "Dashboard" },
    { id: "alunos", label: "Alunos" },
    { id: "turmas", label: "Turmas" },
    { id: "unidades", label: "Unidades" },
    { id: "professores", label: "Professores" },
  ],

  setCurrentPage(id) {
    this.state.currentPage = id;
  },

  getCurrentPage() {
    return this.pages.find(p => p.id === this.state.currentPage);
  }
};

/* ===============================
   UI HELPERS (FORA DO OBJETO)
================================ */
function renderEmptyState(pageInfo) {
  const div = document.createElement("div");
  div.className = "empty-state";
  div.innerHTML = `
    <h3>${pageInfo.label}</h3>
    <p>Módulo em construção.</p>
  `;
  UI.elements.contentArea.appendChild(div);
}

/* ===============================
   UI
================================ */
const UI = {
  elements: {
    menu: document.getElementById("menu"),
    pageTitle: document.getElementById("page-title"),
    contentArea: document.getElementById("content-area"),
  },

  init() {
    this.renderSidebar();
    this.navigate(DataStore.state.currentPage);
  },

  renderSidebar() {
    this.elements.menu.innerHTML = "";
    DataStore.pages.forEach(p => {
      const li = document.createElement("li");
      li.textContent = p.label;
      li.className = "menu-item";
      li.onclick = () => this.navigate(p.id);
      this.elements.menu.appendChild(li);
    });
  },

  navigate(pageId) {
    DataStore.setCurrentPage(pageId);
    this.renderPage();
  },

  renderPage() {
    const page = DataStore.getCurrentPage();
    this.elements.pageTitle.textContent = page.label;
    this.elements.contentArea.innerHTML = "";

    switch (page.id) {
      case "dashboard":
        this.renderDashboard();
        break;
      case "alunos":
        this.renderAlunos();
        break;
      default:
        renderEmptyState(page);
    }
  },

  renderDashboard() {
    const div = document.createElement("div");
    div.innerHTML = `
      <h2>Resumo</h2>
      <p>Total alunos: ${DataStore.getCount("alunos")}</p>
    `;
    this.elements.contentArea.appendChild(div);
  },

  renderAlunos() {
    const div = document.createElement("div");
    div.innerHTML = `
      <h2>Alunos</h2>
      <button id="novo">Novo aluno</button>
    `;
    this.elements.contentArea.appendChild(div);
  }
};

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", () => {
  DataStore.load();
  UI.init();
});
