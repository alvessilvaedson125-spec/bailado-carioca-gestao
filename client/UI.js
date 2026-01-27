const { DataStore } = require("./app");

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
            this.updateSidebarActiveState(pageId);
            this.renderPageContent(pageId);
        }
    },

    updateSidebarActiveState(pageId) {
        const items = this.elements.menu.querySelectorAll('.menu-item');
        items.forEach(item => {
            item.classList.toggle('active', item.dataset.page === pageId);
        });
    },

    pageRenderers: {
        dashboard() {
            UI.renderDashboard();
        },
        alunos() {
            UI.renderAlunosPage();
        },
        turmas(pageInfo) {
            UI.renderEmptyState(pageInfo);
        },
        unidades(pageInfo) {
            UI.renderEmptyState(pageInfo);
        },
        professores(pageInfo) {
            UI.renderEmptyState(pageInfo);
        },
        presenca(pageInfo) {
            UI.renderEmptyState(pageInfo);
        },
        mensalidades(pageInfo) {
            UI.renderEmptyState(pageInfo);
        },
        caixa(pageInfo) {
            UI.renderEmptyState(pageInfo);
        },
        lixeira(pageInfo) {
            UI.renderEmptyState(pageInfo);
        },
        configuracoes(pageInfo) {
            UI.renderEmptyState(pageInfo);
        }
    },

    renderPageContent(pageId) {
        const pageInfo = DataStore.getCurrentPageInfo();
        this.elements.pageTitle.textContent = pageInfo.label;
        this.elements.contentArea.innerHTML = '';

        const renderer = this.pageRenderers[pageId];
        renderer ? renderer(pageInfo) : this.renderEmptyState(pageInfo);
    },

    renderDashboard() {
        const container = document.createElement('div');
        container.className = 'dashboard-cards';

        const cards = [
            { title: 'Total Alunos', value: DataStore.getCount('alunos') },
            { title: 'Total Turmas', value: DataStore.getCount('turmas') },
            { title: 'Total Unidades', value: DataStore.getCount('unidades') },
            { title: 'Mensalidades em Aberto', value: DataStore.getMensalidadesAbertasCount() }
        ];

        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'summary-card';
            cardEl.innerHTML = `
                <span class="card-title">${card.title}</span>
                <span class="card-value">${card.value}</span>
            `;
            container.appendChild(cardEl);
        });

        this.elements.contentArea.appendChild(container);
    },

    renderAlunosPage() {
        const container = document.createElement('div');

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '1.5rem';

        const title = document.createElement('h2');
        title.textContent = 'Alunos';

        const button = document.createElement('button');
        button.textContent = 'Novo Aluno';
        button.addEventListener('click', () => this.renderNovoAlunoForm());

        header.appendChild(title);
        header.appendChild(button);
        container.appendChild(header);

        const alunosAtivos = DataStore.state.data.alunos.filter(a => a.ativo);

        if (alunosAtivos.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.innerHTML = `
                <h3>Nenhum aluno cadastrado</h3>
                <p>Cadastre alunos para começar.</p>
            `;
            container.appendChild(empty);
        } else {
            const list = document.createElement('ul');
            list.style.listStyle = 'none';
            list.style.padding = '0';

            alunosAtivos.forEach(aluno => {
                const item = document.createElement('li');
                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.padding = '0.75rem';
                item.style.borderBottom = '1px solid #e2e8f0';

                const name = document.createElement('span');
                name.textContent = aluno.nome;

                item.appendChild(name);
                list.appendChild(item);
            });

            container.appendChild(list);
        }

        this.elements.contentArea.appendChild(container);
    },
    renderNovoAlunoForm() {
        this.elements.contentArea.innerHTML = '';

        const form = document.createElement('form');
        form.style.maxWidth = '420px';

        const title = document.createElement('h2');
        title.textContent = 'Novo Aluno';
        title.style.marginBottom = '1rem';

        const createInput = (labelText, type = 'text') => {
            const wrapper = document.createElement('div');
            wrapper.style.marginBottom = '0.75rem';

            const label = document.createElement('label');
            label.textContent = labelText;
            label.style.display = 'block';
            label.style.marginBottom = '0.25rem';

            const input = document.createElement('input');
            input.type = type;
            input.required = true;
            input.style.width = '100%';
            input.style.padding = '0.5rem';

            wrapper.appendChild(label);
            wrapper.appendChild(input);

            return { wrapper, input };
        };

        const nome = createInput('Nome');
        const telefone = createInput('Telefone');
        const nivel = createInput('Turma / Nível');
        const valor = createInput('Valor da mensalidade', 'number');
        const dataMatricula = createInput('Data da matrícula', 'date');

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '0.5rem';
        actions.style.marginTop = '1rem';

        const salvar = document.createElement('button');
        salvar.textContent = 'Salvar';
        salvar.type = 'submit';

        const cancelar = document.createElement('button');
        cancelar.textContent = 'Cancelar';
        cancelar.type = 'button';
        cancelar.addEventListener('click', () => this.renderAlunosPage());

        actions.appendChild(salvar);
        actions.appendChild(cancelar);

        form.append(
            title,
            nome.wrapper,
            telefone.wrapper,
            nivel.wrapper,
            valor.wrapper,
            dataMatricula.wrapper,
            actions
        );

        form.addEventListener('submit', e => {
            e.preventDefault();

            DataStore.state.data.alunos.push({
                id: crypto.randomUUID(),
                nome: nome.input.value,
                telefone: telefone.input.value,
                nivel: nivel.input.value,
                mensalidade_valor: Number(valor.input.value),
                data_matricula: dataMatricula.input.value,
                ativo: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

            DataStore.save();
            this.renderAlunosPage();
            this.renderSidebar();
        });

        this.elements.contentArea.appendChild(form);
    },

    // --- Initialization ---
    document, : .addEventListener('DOMContentLoaded', () => {
        DataStore.load();
        UI.init();
    })
};
