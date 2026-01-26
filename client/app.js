/**
 * Application Logic
 * Separates Data handling from UI rendering
 */

// --- Data Logic (In-Memory) ---
const DataStore = {
    state: {
        currentPage: 'dashboard',
        data: {
            alunos: [],
            turmas: [],
            unidades: [],
            professores: [],
            // ... other entities
        }
    },

    // Pages Configuration
    pages: [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'alunos', label: 'Alunos' },
        { id: 'turmas', label: 'Turmas' },
        { id: 'unidades', label: 'Unidades' },
        { id: 'professores', label: 'Professores' },
        { id: 'presenca', label: 'Presença' },
        { id: 'mensalidades', label: 'Mensalidades' },
        { id: 'caixa', label: 'Caixa' },
        { id: 'lixeira', label: 'Lixeira' },
        { id: 'configuracoes', label: 'Configurações' }
    ],

    // Actions
    setCurrentPage(pageId) {
        if (this.pages.find(p => p.id === pageId)) {
            this.state.currentPage = pageId;
            return true;
        }
        return false;
    },

    getCurrentPageInfo() {
        return this.pages.find(p => p.id === this.state.currentPage);
    }
};

// --- UI Rendering ---
const UI = {
    elements: {
        menu: document.getElementById('menu'),
        pageTitle: document.getElementById('page-title'),
        contentArea: document.getElementById('content-area')
    },

    init() {
        this.renderSidebar();
        this.navigateTo(DataStore.state.currentPage);
    },

    renderSidebar() {
        this.elements.menu.innerHTML = '';
        DataStore.pages.forEach(page => {
            const li = document.createElement('li');
            li.className = `menu-item ${page.id === DataStore.state.currentPage ? 'active' : ''}`;
            li.textContent = page.label;
            li.dataset.page = page.id;
            
            li.addEventListener('click', () => {
                this.navigateTo(page.id);
            });

            this.elements.menu.appendChild(li);
        });
    },

    navigateTo(pageId) {
        if (DataStore.setCurrentPage(pageId)) {
            // Update UI state
            this.updateSidebarActiveState(pageId);
            this.renderPageContent(pageId);
        }
    },

    updateSidebarActiveState(pageId) {
        const items = this.elements.menu.querySelectorAll('.menu-item');
        items.forEach(item => {
            if (item.dataset.page === pageId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    },

    renderPageContent(pageId) {
        const pageInfo = DataStore.getCurrentPageInfo();
        this.elements.pageTitle.textContent = pageInfo.label;
        
        // Clear current content
        this.elements.contentArea.innerHTML = '';

        // Render Empty State for now (as requested)
        const content = document.createElement('div');
        content.className = 'empty-state';
        content.innerHTML = `
            <h3>${pageInfo.label} Module</h3>
            <p>This is the empty state for the ${pageInfo.label.toLowerCase()} page.</p>
        `;
        
        this.elements.contentArea.appendChild(content);
    }
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
});
