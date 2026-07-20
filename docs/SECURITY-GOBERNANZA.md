# Gobernanza y seguridad del repositorio VIA+

Este documento reúne los controles que protegen el **código en GitHub** frente a
cambios no autorizados o accidentales. Se divide en dos partes:

1. **Controles versionados** — ficheros que ya viven en el repo.
2. **Controles de configuración** — ajustes que hay que activar en la interfaz
   de GitHub (no pueden estar en un fichero) y que **son los que realmente
   hacen cumplir** lo anterior.

---

## 1. Controles versionados (ya en el repo)

| Fichero | Qué hace |
|---|---|
| `.github/CODEOWNERS` | Define quién debe aprobar cada parte del código. Rutas sensibles (Firestore, auth, Database, telemetría, CI) exigen a `@FrankBetances`. |
| `.github/SECURITY.md` | Política de divulgación responsable de vulnerabilidades. |
| `.github/dependabot.yml` | Actualizaciones automáticas de dependencias npm y Actions + alertas de seguridad. |
| `.github/workflows/codeql.yml` | Análisis estático de seguridad (CodeQL) en cada push/PR a `main` y semanalmente. |
| `.github/pull_request_template.md` | Checklist de PR con verificación de seguridad/privacidad. |

---

## 2. Controles de configuración (activar en GitHub)

> ⚠️ **CODEOWNERS por sí solo no bloquea nada.** Solo surte efecto si se activa
> la protección de rama con "Require review from Code Owners". Sin esto, un
> administrador puede fusionar sin revisión.

### 2.1 Protección de la rama `main`

`Settings → Branches → Add branch ruleset` (o *Branch protection rule*) sobre
`main`:

- [ ] **Require a pull request before merging**
  - [ ] Require approvals: **1** (mínimo)
  - [ ] **Require review from Code Owners**
  - [ ] Dismiss stale approvals when new commits are pushed
- [ ] **Require status checks to pass before merging**
  - [ ] Require branches to be up to date before merging
  - [ ] Checks requeridos: `CodeQL`, `Markdown Lint` (y el build si procede)
- [ ] **Require conversation resolution before merging**
- [ ] **Require signed commits** (recomendado)
- [ ] **Do not allow bypassing the above settings** (aplica también a admins)
- [ ] **Restrict who can push to matching branches** (solo tú / equipo)
- [ ] Bloquear **force push** y **borrado** de la rama

### 2.2 Seguridad general del repositorio

`Settings → Advanced Security` / `Settings → Code security`:

- [ ] **Private vulnerability reporting**: ON
- [ ] **Dependabot alerts**: ON
- [ ] **Dependabot security updates**: ON
- [ ] **Secret scanning**: ON
- [ ] **Secret scanning push protection**: ON (impide subir claves por error)
- [ ] **Code scanning (CodeQL)**: se activa con el workflow ya incluido

### 2.3 Acceso y permisos

`Settings → Collaborators and teams` / organización:

- [ ] Principio de mínimo privilegio: colaboradores con rol `Write`, no `Admin`,
      salvo necesidad real.
- [ ] Exigir **2FA** a toda persona con acceso.
- [ ] Revisar colaboradores externos periódicamente.

### 2.4 Acciones y automatización

`Settings → Actions → General`:

- [ ] Permitir solo acciones verificadas o de propietarios de confianza.
- [ ] `Workflow permissions`: **Read repository contents** por defecto; elevar
      solo donde el workflow lo necesite (CodeQL ya declara sus permisos).
- [ ] Revisar que los secretos de firmado (`MYAPP_RELEASE_*`) están en
      *Actions secrets* y nunca en el código.

---

## Recordatorio

Los secretos (keystore, `google-services.json`, `.env`) **ya están** excluidos
por `.gitignore`. Antes de hacer público el repositorio o añadir colaboradores,
revisa el historial con `secret scanning` por si alguno se filtró en commits
antiguos.
