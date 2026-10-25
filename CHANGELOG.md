# Changelog

## Unreleased

### Security — 2026-10-25

- Update development dependencies to Vite 8.3.5 and Vitest/mocker 4.1.12,
  and refresh the transitive Zod dependency to 4.6.7.
- Resolve all npm audit findings in the complete dependency tree and fail CI
  on moderate or higher findings. Production dependencies are unchanged.
