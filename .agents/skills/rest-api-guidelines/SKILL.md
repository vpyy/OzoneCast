---
name: rest-api-guidelines
description: Design, review, and draft consistent HTTP+JSON REST APIs using resource-oriented design and long-term compatibility rules. Use when Codex needs to define or critique REST endpoints, OpenAPI contracts, URI and resource naming, HTTP method and PATCH semantics, status codes, pagination, versioning, error formats, or backward and forward compatibility policies.
---

# REST API Guidelines

Apply consistent default decisions for HTTP+JSON REST APIs. Favor predictability, interoperability, retry safety, and long-term compatibility over stylistic purity.

## Overview

Use this skill for three kinds of work:

1. Design a new REST API or refine an existing design.
2. Review an API, OpenAPI spec, or endpoint proposal for rule violations and compatibility risks.
3. Draft endpoint contracts with example request and response shapes.

## Workflow

1. Classify the request as `design`, `review`, or `draft`.
2. Start from the default decisions in this file unless the user or existing platform conventions require otherwise.
3. Read only the reference files needed for the task.
4. State any deviation from the defaults explicitly and explain why it is justified.
5. Keep the contract internally consistent across naming, methods, status codes, pagination, error format, and versioning.

### Design

- Prefer the simplest resource-oriented model that fits the behavior.
- Model actions as standard CRUD first; use custom actions only when the behavior does not fit a resource shape naturally.
- Choose one default pattern per concern and apply it consistently across the API.
- Return concrete endpoint, request, response, and error examples when they help remove ambiguity.

### Review

- Present findings first.
- For each issue, identify the violated guideline, the concrete risk, and the recommended fix.
- Prioritize breaking changes, interoperability hazards, retry/idempotency problems, and compatibility risks over style-only issues.
- Call out ambiguous semantics even when they may still work in one framework.

### Draft

- Produce endpoint contracts that include method, path, request body shape when applicable, success status codes, representative error responses, and relevant headers.
- Show the chosen defaults in the contract rather than describing them only abstractly.
- Explain major tradeoffs only when the design deviates from the default path.

## Default Decisions

- Use resource-oriented URIs with noun-based paths.
- Use path major versioning such as `/v1/users`.
- Use `PATCH` as the default update method.
- Use `application/merge-patch+json` for ordinary partial updates.
- Interpret repeated fields in PATCH as whole-list replacement unless the API exposes a dedicated subresource or alternate contract.
- Use token or cursor pagination with `pageSize`, `pageToken`, and `nextPageToken`.
- Use `application/problem+json` for structured errors.
- Use opaque external string identifiers instead of exposing internal sequential IDs.
- Use RFC 3339 timestamps and prefer UTC.
- Treat new fields as additive and safe, but treat removals, renames, semantic changes, and enum value removals as breaking changes.

## Review Output Rules

- Put findings before summary text.
- Name the exact endpoint, field, or pattern that is problematic.
- Distinguish clearly between a hard interoperability or compatibility problem and a softer consistency recommendation.
- When there is no issue, say so explicitly and mention any remaining assumptions or unreviewed areas.

## Reference Map

- Read [references/resource-design.md](references/resource-design.md) for resource modeling, URI naming, JSON representation, CRUD and PATCH strategy, status codes, and relationship modeling.
- Read [references/list-and-operation-patterns.md](references/list-and-operation-patterns.md) for pagination, sorting, filtering, search, batch APIs, and long-running operations.
- Read [references/compatibility-and-contracts.md](references/compatibility-and-contracts.md) for errors, security, versioning, observability, documentation, numeric and money rules, and enum or state policies.
- Read [references/file-transfer.md](references/file-transfer.md) for upload and download design.
