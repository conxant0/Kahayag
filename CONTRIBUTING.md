# Contributing

## Branches

Branch names follow the [Conventional Branch](https://conventional-branch.github.io/)
specification: `<type>/<description>`, lowercase and hyphen-separated.

| Type | Use |
| --- | --- |
| `feature/` | New capability |
| `bugfix/` | Fix for a defect |
| `hotfix/` | Urgent production fix |
| `release/` | Release preparation |
| `chore/` | Tooling, dependencies, housekeeping |

Include the ticket id when there is one: `feature/kah-21-assessment-form`.

Branch from `main`. Keep branches short-lived.

## Commits

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <description>

[optional body]
```

Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`.
Scope is usually `frontend`, `backend`, or a feature name.

Every commit must be **atomic and revertible**. Reverting, cherry-picking, or
bisecting one change must not drag in unrelated work. If a change touches both
applications for one reason, that is one commit; if it touches one application
for two reasons, that is two.

Write the description in the imperative mood and explain *why* in the body when
the reason is not obvious from the diff.

## Pull Requests

- One logical change per pull request.
- The description states what changed, why, and how it was verified.
- All verification commands in [SETUP.md](SETUP.md) pass for the code you touched.
- Link the ticket.

## Code Expectations

- Frontend code is TypeScript in strict mode. No new `.js` or `.jsx` source files.
- Keep feature code inside its feature directory. Promote to `shared/` only when
  more than one feature genuinely uses it.
- Keep the backend solar domain free of FastAPI and vendor SDKs.
- Vendor access goes behind an adapter in `integrations/`. Provider-specific
  objects stop at that boundary.
- Technical and financial values are computed in the deterministic backend
  domain. AI explains them; it never calculates or alters them.
- Never commit `.env` files, API keys, or tokens. Add new variables to the
  matching `.env.example` instead.

## Tests

Non-trivial logic ships with a test. Backend tests live in `backend/tests/`,
frontend unit and integration tests in `frontend/tests/`, and browser flows in
`frontend/e2e/`.
