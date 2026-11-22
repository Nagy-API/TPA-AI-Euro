# Diagram 04 — State lifecycle and V1 use cases

## Conversation/session states

```mermaid
stateDiagram-v2
    [*] --> NEW
    NEW --> AWAITING_IDENTIFIER: No trusted session
    NEW --> VERIFIED: Existing trusted app session
    AWAITING_IDENTIFIER --> CHALLENGE_PENDING: Identifier submitted
    CHALLENGE_PENDING --> VERIFIED: Valid challenge response
    CHALLENGE_PENDING --> AWAITING_IDENTIFIER: Failed/expired challenge (limited retries)
    VERIFIED --> EXPIRED: Session timeout
    VERIFIED --> REVOKED: Logout / security revoke
    EXPIRED --> AWAITING_IDENTIFIER: Reverify
    REVOKED --> AWAITING_IDENTIFIER: Reverify
```

## Scope/use-case map

```mermaid
flowchart LR
    Member[Member] --> Identify[Identify and verify]
    Member --> Coverage[Ask coverage question]
    Member --> Support[Request human support]
    Coverage --> Backend[Check trusted coverage engine]
    Employee[TPA staff] --> Support
    Doctor[Doctor] --> Clinical[Review and decide approval]
    AI[AI assistant] --> Coverage
    AI --> Summarize[Summarize for review - future]
    Summarize --> Clinical
```

These are conceptual diagrams; not a replacement for agreed TPA product use cases or a full enterprise ERD.
