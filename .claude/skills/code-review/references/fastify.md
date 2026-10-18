# Fastify review reference

- Routes are grouped per resource in `src/routes/<resource>.ts` as plugins registered with a prefix.
- Every route declares zod `schema` for body / querystring / params / response via the zod type provider.
- Protected routes use `app.authenticate` as an `onRequest` hook (before validation); `userId` comes from `request.user.sub`.
- Status codes: 201 create, 200 read, 204 no content, 400 validation, 401 unauthenticated,
  404 not found or not owned, 409 conflict.
- Errors are thrown as `HttpError`s and mapped in the central error handler.
- Tests use `buildApp()` + `app.inject()` against the real test database.
