# Diagram 01 — System context / trust boundaries

```mermaid
flowchart LR
  subgraph Actors[Channels / Actors]
    W[WhatsApp Member]
    M[Mobile/Web Member]
    D[Doctor/Staff]
  end
  subgraph Trusted[Trusted TPA environment]
    G[Channel Gateway]
    A[Identity / Auth Service]
    AI[AI Orchestrator]
    T[Allowlisted Tool Gateway]
    API[Authorized TPA APIs]
    P[Deterministic Policy Engine]
    H[Human Review Workflow]
  end
  L[External LLM Provider]
  W --> G
  M --> G
  G --> A
  A -->|verified session| AI
  AI <-->|minimal, redacted context| L
  AI --> T
  T --> API
  API --> P
  D --> H
  H --> API
  API -->|scoped result| T
  T --> AI
```

**Trust boundaries:** The external model is not a trusted authorization engine. The gateway checks identity, backend checks tenant/member scope and applies policy rules. Human doctor decisions remain in trusted business workflow.
