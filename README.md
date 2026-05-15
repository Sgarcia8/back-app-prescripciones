# Prescripciones — Backend (API)

API REST con NestJS para usuarios (admin, médico, paciente), autenticación JWT, prescripciones, PDF y QR. Persistencia con PostgreSQL vía Prisma.

## Stack

| Tecnología | Uso |
|------------|-----|
| [NestJS](https://nestjs.com) 11 | Framework HTTP, módulos, guards |
| [Prisma](https://www.prisma.io) 7 + PostgreSQL | ORM y migraciones |
| `pg` + `@prisma/adapter-pg` | Driver y adapter |
| [Passport JWT](https://docs.nestjs.com/security/authentication) | Validación de access token |
| `class-validator` / `class-transformer` | Validación de DTOs |
| `bcrypt` | Hash de contraseñas |
| [pdfkit](http://pdfkit.org/) | Generación de PDF de recetas |
| `qrcode` | Códigos QR en documentos |
| [@nestjs/swagger](https://docs.nestjs.com/openapi/introduction) | OpenAPI + UI Swagger |

## Requisitos

- **Node.js** ≥ 20.19 (ver `engines` en `package.json`)
- **PostgreSQL**
- **npm**

## Instalación

```bash
npm install
```

Definir variables de entorno (ver tabla siguiente). Crear la base y ejecutar migraciones:

```bash
npm run db:migrate
```

Opcional — datos de demo:

```bash
npm run db:seed
```

## Arranque

| Comando | Descripción |
|---------|-------------|
| `npm run start:dev` | Desarrollo con recarga |
| `npm run start` | Una ejecución sin watch |
| `npm run start:prod` | Producción (`node dist/main`) |
| `npm run build` | Compila a `dist/` |

### Puertos y convivencia con Next.js

Por defecto Nest escucha `PORT` o **3000**. El frontend de este monorepo suele usar **3000**, así que en local conviene levantar el API en otro puerto (p. ej. **3001**) y apuntar `NEXT_PUBLIC_API_URL` del front a esa URL.

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Cadena de conexión PostgreSQL (requerida para Prisma y seed). |
| `PORT` | Puerto HTTP (ej. `3001` en local junto a Next en 3000). |
| `CORS_ORIGIN` | Orígenes permitidos, separados por coma. Por defecto incluye `http://localhost:3000`. |
| `JWT_ACCESS_SECRET` | Secreto para firmar access tokens (en prod obligatorio cambiar el default). |
| `JWT_REFRESH_SECRET` | Secreto para refresh tokens. |
| `JWT_ACCESS_EXPIRES_SEC` | TTL access token en segundos (default 900). |
| `JWT_REFRESH_EXPIRES_SEC` | TTL refresh token en segundos (default 604800). |
| `FRONTEND_BASE_URL` | URL del front (enlaces / QR en prescripciones). |
| `ENABLE_SWAGGER` | Si es `true`, Swagger está activo aunque `NODE_ENV=production`. Si no se define: Swagger activo salvo en producción. |

## Documentación OpenAPI (Swagger)

Con el servidor en marcha:

- **URL**: `http://localhost:<PORT>/api`
- Incluye esquemas de bodies/query según DTOs y seguridad **Bearer JWT**.
- Tras `POST /auth/login`, copia el `accessToken` y en Swagger usa **Authorize** → esquema `JWT` → valor `Bearer <token>` o solo el token, según cómo muestre la UI.

En producción, Swagger queda deshabilitado salvo que definas `ENABLE_SWAGGER=true`.

La tabla de rutas de este README es un índice; el detalle vivo está en Swagger.

## Roles

Definidos en Prisma (`Role`): `admin`, `doctor`, `patient`.

## Rutas REST (resumen)

Prefijo global: ninguno (raíz `/`). Todas bajo el mismo `PORT`.

| Área | Método y ruta | Roles |
|------|----------------|-------|
| App | `GET /` | Público (saludo) |
| Auth | `POST /auth/register` | Público (solo registro `doctor` \| `patient`) |
| Auth | `POST /auth/login`, `POST /auth/refresh` | Público |
| Auth | `GET /auth/profile` | JWT |
| Admin | `GET /admin/prescriptions`, `GET /admin/metrics` | `admin` |
| Users | `GET /users`, `POST /users` | `admin` |
| Doctors | `GET /doctors` | `admin` |
| Patients | `GET /patients` | `admin`, `doctor` |
| Prescripciones | `POST /prescriptions`, `GET /prescriptions`, `GET /prescriptions/:id` | `doctor` |
| Prescripciones | `GET /prescriptions/:id/pdf`, `PUT /prescriptions/:id/consume` | `patient` |
| Paciente | `GET /me/prescriptions`, `GET /me/prescriptions/:id` | `patient` |

## Scripts de base de datos

| Comando | Descripción |
|---------|-------------|
| `npm run db:generate` | Genera el cliente Prisma |
| `npm run db:migrate` | Migraciones en desarrollo |
| `npm run db:migrate:deploy` | Migraciones en CI/producción |
| `npm run db:seed` | Ejecuta `prisma/seed.ts` |
| `npm run db:validate` | Valida el schema |

## Seed de desarrollo

El script `prisma/seed.ts` crea usuarios de prueba (solo para entornos locales):

| Email | Rol | Contraseña (demo) |
|-------|-----|-------------------|
| `admin@test.com` | admin | `admin123` |
| `dr@test.com` | doctor | `dr123` |
| `patient@test.com` | patient | `patient123` |

No usar estas credenciales en producción.

## Tests y calidad

```bash
npm run test        # unitarios (Jest)
npm run test:e2e    # e2e
npm run lint        # ESLint
```

## Licencia

`UNLICENSED` (proyecto privado).
