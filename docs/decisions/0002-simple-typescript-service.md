# ADR 0002: Start with a simple, modular AI service

**Status:** PROPOSED — must confirm backend team stack and deployment constraints  
**Date:** 2026-11-22

## Decision

Favor a small TypeScript/Node.js AI layer with typed tools, one provider SDK, tests and provider swap seam. Separate module boundaries in code; avoid multiple network microservices until needed. Use Zod and Vitest if implementation adopts TypeScript. No orchestration framework, RAG or extra DB by default.

## Why

The team prototype's role split mentions Node.js and .NET, but the actual code/repo has not been inspected. Simplicity lowers integration, debugging and team-ownership costs. We can change language after checking what the backend team supports.

## Consequences

Fast V1 and understandable tool/contract boundaries. For specialized OCR/ML, assess Python worker only when requirements/benchmarks justify it. Do not treat this as final stack approval before alignment.
