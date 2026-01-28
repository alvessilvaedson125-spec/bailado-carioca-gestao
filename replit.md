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
- **Key**: "bailadoCariocaData" stores all application data
- **Theme**: "bailadoTheme" stores theme preference (light/dark)

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

## Modules

1. **Dashboard**: Overview with summary statistics
2. **Alunos (Students)**: Student management with fields: nome, telefone, email, cpf, turma, unidade, tipoMatricula, mensalidade
3. **Trancados (Suspended)**: View and manage suspended students
4. **Turmas (Classes)**: Class management showing enrolled students
5. **Unidades (Units)**: Location/unit management
6. **Professores (Teachers)**: Teacher and monitor registration
7. **Mensalidades (Tuition)**: Payment tracking and receipts
8. **Recibos (Receipts)**: Professional receipt generation (text, PDF, WhatsApp)
9. **Caixa (Cash Flow)**: Financial entries with categoria (mensalidade, aula_avulsa, despesa, outros)
10. **Relatorio Mensal**: Monthly financial report with PDF/print export
11. **Lixeira (Trash)**: View and restore deleted items
12. **Configuracoes (Settings)**: Data import/export and preferences

## Recent Changes (Version 4)

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
