# Bailado Carioca - Dance School Management System

## Overview

This is a management system for a dance school (Bailado Carioca) built as a **pure vanilla JavaScript** single-page application. The system uses **localStorage** for data persistence (no backend database). It handles student management, class scheduling, teacher registration, enrollment tracking, and financial operations.

## User Preferences

- Preferred communication style: Simple, everyday language.
- **NO frameworks** (React, Vue, Next.js explicitly excluded)
- Card-based UI design
- Do NOT invent features or generate sample data
- **NO emojis** anywhere in the application

## System Architecture

### Frontend Architecture
- **Framework**: Pure vanilla JavaScript (NO React, Vue, or any framework)
- **Routing**: Custom hash-based routing via UI.navigate()
- **State Management**: Centralized DataStore pattern with localStorage persistence
- **UI Components**: Custom card-based components rendered via DOM manipulation
- **Styling**: Custom CSS with CSS variables for theming (dark/light mode)

### Data Layer
- **Storage**: localStorage with JSON serialization
- **Key**: "bailadoData" stores all application data
- **Key**: "bailadoTheme" stores theme preference (light/dark)
- **Key**: "bailadoSessao" stores user session (authentication)

### Authentication System (Version 7)
- **Welcome Screen**: Initial screen with logo and "Entrar no Sistema" button
- **Login**: Local authentication with username/password
- **Session**: Stored in localStorage (usuario, nome, perfil, loginEm)
- **Profiles**:
  - **admin**: Full access to all modules
  - **operacional**: Limited to Alunos, Bolsistas, Presenca, Turmas, Unidades, Trancados
- **Default Users**:
  - edson / bailado2024 (admin)
  - livia / bailado2024 (admin)
  - operador / op2024 (operacional)
- **Logout**: Clears session only, preserves all data

### Project Structure
```
client/
├── index.html    # Main HTML file with sidebar structure
├── app.js        # All application logic (DataStore, UI, modules)
└── style.css     # All styling with CSS variables for theming
```

### Key Design Patterns
1. **Soft Delete**: Students use `status` field (ativo/trancado/excluido), other entities use `ativo`/`ativa` boolean
2. **DataStore Pattern**: Centralized state management with auto-save to localStorage
3. **Modal System**: Reusable modal pattern for forms and dialogs
4. **Card-based UI**: All data displayed in summary cards with consistent styling
5. **Single Source of Truth**: ALUNO is the ONLY source of truth for class enrollment - turma does NOT store alunos

### Data Model for Class Enrollment (Version 9)
- **REGRA ABSOLUTA**: ALUNO e a UNICA fonte da verdade
- **Turma NAO armazena alunos** - calculo sempre dinamico
- **getAlunosDaTurma(turmaId)**: Funcao central que deriva alunos dinamicamente
- Verifica: `aluno.status === "ativo" && alunoEmTurma(aluno, turmaId)`
- **alunoEmTurma(aluno, turmaId)**: Verifica se aluno pertence a turma (via turma ou turmas_ids)
- Evita desalinhamento, duplicacao, e dados fantasma

## Modules

1. **Dashboard**: Overview with summary statistics
2. **Alunos (Students)**: Student management with fields: nome, telefone, email, cpf, turma, unidade, tipoMatricula, mensalidade
3. **Bolsistas (Scholarships)**: Scholarship student management with filters by turma and status
4. **Trancados (Suspended)**: View and manage suspended students
5. **Turmas (Classes)**: Class management showing enrolled students
6. **Unidades (Units)**: Location/unit management
7. **Professores (Teachers)**: Teacher and monitor registration
8. **Mensalidades (Tuition)**: Payment tracking and receipts (excludes bolsistas)
9. **Recibos (Receipts)**: Professional receipt generation (text, PDF, WhatsApp)
10. **Caixa (Cash Flow)**: Financial entries with categoria (mensalidade, aula_avulsa, despesa, outros)
11. **Presenca (Attendance)**: Student attendance tracking with reports
12. **Relatorio Mensal**: Monthly financial report with PDF/print export
13. **Lixeira (Trash)**: View and restore deleted items
14. **Configuracoes (Settings)**: Data import/export and preferences

## Recent Changes (Version 9.1)

### Controlled Cleanup Tools (Admin Only)
- **Limpar Mensalidades**: Button in Mensalidades page (admin only)
  - Modal with competencia selection (MM/AAAA)
  - Status filter: pendentes, pagas, todas
  - Preview of items to be removed
  - Double confirmation (checkbox + button)
  - Does NOT affect alunos, turmas, or caixa
- **Limpar Recibos**: Button in Recibos page (admin only)
  - Modal with competencia selection (MM/AAAA)
  - Type filter: mensalidade, aula_avulsa, todos
  - Preview of items to be removed
  - Double confirmation (checkbox + button)
  - Does NOT alter Caixa or recreate mensalidades

## Previous Changes (Version 4)

### Dashboard Charts (Chart.js)
- Toggle button "Exibir Graficos" / "Ocultar Graficos" on dashboard
- Bar chart showing Entradas x Saidas for last 6 months
- Line chart showing Saldo evolution
- Chart lifecycle management to prevent canvas reuse errors
- Respects dark/light mode for colors

### Delinquency Notifications
- Badge "Pendente" shown on student cards when unpaid mensalidade exists for previous month
- Alert card on dashboard listing all inadimplent students with quick access to payments
- contarInadimplentes() and alunoInadimplente() functions for checking status

### Monthly Report Comparison
- Comparative section showing current vs previous month metrics
- Entradas, Saidas, and Saldo with percentage change
- Color-coded arrows: green [+] for increase, red [-] for decrease, gray [=] for stable

### Teacher Payment/Commission System
- tipoPagamento field: "fixo" (fixed monthly), "por_aluno" (per student), "percentual" (percentage of class revenue)
- valorPagamento field for storing the payment value
- "Relatorio de Pagamentos" modal in Professores showing automatic calculations
- Calculates based on assigned classes and active students

### Student Timeline (Historico)
- Automatic historico array on each student tracking all events
- Events recorded: Matricula criada, Trancamento, Reativacao, Exclusao, Pagamentos
- "Historico" button on student cards to view complete timeline
- Events sorted by most recent first with date/time display

### Structured Weekdays for Classes
- diasSemana array storing selected days (seg, ter, qua, qui, sex, sab, dom)
- Checkboxes in Turma modal for each day of the week
- Separate horarioTempo field for time (e.g., "19:00 - 20:30")
- Combined horario field for display compatibility

### Bolsistas (Scholarship Students) - Version 8
- New `bolsa` field on student data: ativa (boolean), tipo (integral/parcial/apoio), observacao
- **Multi-Turma Support**: Bolsistas can be linked to multiple turmas
  - `turmas_ids`: array of turma IDs
  - `turma`: first turma ID (for backward compatibility)
  - Helper functions: getTurmasIds(), setTurmasIds(), alunoEmTurma()
  - Automatic migration from single turma to array
- **Bolsistas Page**: List only students with bolsa.ativa === true
- Filters by turma (with nome + nivel display) and status (ativo/trancado)
- Card display: name, badges (Bolsista, Type, Status), all turmas with "Nome - Nivel" format, observation
- Actions: Historico, Presenca, Editar Bolsa, Remover Bolsa
- Modal "Conceder Bolsa" to grant scholarship to regular students
- Modal "Editar Bolsa" to update scholarship type, manage turmas (add/remove/clear), and observation
- Modal "Novo Bolsista" for direct registration with multi-turma selection
- Remove bolsa keeps student in system (only removes scholarship)
- **Integration with Mensalidades**: Bolsistas excluded from payment selection
- **Integration with Inadimplentes**: Bolsistas never marked as delinquent
- **Integration with Presenca**: Bolsistas appear in ALL linked turmas
- **Historico Events**: "Bolsa concedida", "Bolsa atualizada", "Bolsa removida", "Bolsista vinculado a turma X - Nivel", "Bolsista removido da turma X - Nivel"
- isBolsista(aluno) helper function for checking scholarship status
- Zero impact on Caixa, financial reports, or receipts

### Attendance System (Presenca) - Version 5
- New `presencas` entity in DataStore for tracking attendance
- Data model: id, aluno_id, turma_id, data (YYYY-MM-DD), status (presente/falta/justificada), tipo (regular/bolsista/aula_avulsa/reposicao), createdAt
- **Register Tab**: Select turma + date, list students with quick buttons [P] Presente / [F] Falta / [J] Justificada
- Quick actions: "Marcar Todos Presentes" and "Marcar Todos Falta" buttons
- Real-time counters showing present/absent/justified counts
- **Query Tab**: Filter by turma, aluno, mes, ano, tipo
- Summary card with totals and PDF/WhatsApp export
- Grouped results by date with student status badges
- Integration with student historico (events logged automatically)
- Bolsista badge shown on attendance cards
- One attendance record per student per turma per date (no duplicates)
- Presenca does NOT affect financeiro or student status (tracking only)
- Export included in backup/restore system

### UX/Layout Improvements (Post Version 4)
- Fixed dashboard charts: Fixed height containers (220px), no more infinite growth
- Professional student cards: Header with name/badges, structured body with icons, footer with grouped actions
- Full responsiveness: Mobile sidebar toggle, tablet/mobile breakpoints, fluid grids
- Visual consistency: Badge system (success/warning/danger/muted), button variants (sm/muted), dark mode support
- Mobile-first: Collapsible sidebar at 768px breakpoint, stacked cards on small screens

## Previous Changes (Version 3)

- Added optional email and CPF fields to student registration
- Added categoria field to Caixa entries for better classification
- Professional receipt template with phone, proper formatting, "Nao informado" fallbacks
- Monthly report excludes cancelled entries (status === "cancelado")
- Dark/light theme toggle with localStorage persistence
- Improved Lixeira with confirmation when restoring students
- Fixed all undefined values in receipts (PDF title, text, WhatsApp)
- Text-based theme toggle icons (no emojis)

## Theme System

The application supports dark/light mode:
- Toggle button in sidebar bottom
- CSS variables for seamless color switching
- Preference persisted to localStorage key "bailadoTheme"
- Body class "dark-mode" controls theme

## Documentation

### Manual de Uso
- **Arquivo**: `MANUAL_SISTEMA_BAILADO.md`
- Checklist funcional validado
- Testes manuais documentados
- Manual interno para equipe
- Feedback profissional

### Status do Sistema
- **Versao**: 9.0
- **Status**: PRONTO PARA USO DIARIO
- **Validado em**: Janeiro 2026
