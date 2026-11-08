# gastos-scraper

Scraper diario de consumos de tarjeta (Santander, Galicia) → estima el próximo resumen → lo escribe en Firestore (`users/{uid}/data/cards`) para que lo muestre la app.

Corre en tu Mac con Playwright. **Todos los comandos se corren en tu propia terminal**, no a través de Claude.

## Privacidad

| Qué | Dónde | Quién lo ve |
| --- | --- | --- |
| Credenciales del banco | Llavero de macOS (`gastos-scraper.<banco>`) | Solo el script, al correr |
| Perfil del navegador (cookies) | `~/.gastos-scraper/profiles/` | Nadie más |
| Clave de Firebase (service account) | `~/.gastos-scraper/service-account.json` | Nadie más |
| Capturas de `discover` | `scraper/.discover/` (gitignored) | Enmascaradas: estructura + labels, sin montos/fechas/nombres/comercios |
| Log diario | `~/.gastos-scraper/logs/scrape.log` | Solo cantidades y errores |

## Setup (una vez)

```bash
cd scraper && npm install && npx playwright install chromium
```

1. **Clave de Firebase**: Firebase console → ⚙️ Project settings → Service accounts → *Generate new private key*. Guardala como `~/.gastos-scraper/service-account.json` y `chmod 600`. Da acceso total al proyecto: no la subas a ningún lado.
2. **Config + credenciales**: `npm run setup`. Te pide tu uid de Firebase (Authentication → Users) y, por cada banco, los datos de login con prompts ocultos de macOS.

## Discover (para escribir los selectores)

```bash
npm run discover santander
```

Se abre una ventana. Enter antes de escribir nada (captura del login), logueate **a mano**, navegá a consumos pendientes, cuotas y último resumen, Enter en cada pantalla, `q` para salir. Revisá `scraper/.discover/` si querés y pasáselo a Claude. Repetir con `galicia`.

## Correr

```bash
npm run scrape -- --force --show --bank=galicia   # una corrida a mano (montos solo en tu terminal)
npm run launchd:install                           # automático + botones de la app
```

`launchd:install` instala dos agentes:

- `com.gastos.scraper`: al iniciar sesión y cada hora; como mucho una corrida OK cada 20 h por banco. Si la Mac dormía, corre al despertar. Log: `~/.gastos-scraper/logs/scrape.log`.
- `com.gastos.scraper-watch`: siempre activo; escucha `users/{uid}/data/scrapeRequests`, que escribe el botón "Actualizar" de la app, y corre ese banco en el momento (mínimo 6 min entre corridas del mismo banco). Log: `watch.log`.

Modo de navegador: primero sin ventana; si el banco lo rechaza (Santander), reintenta con una ventana real minimizada al Dock y recuerda ese modo. Cada corrida cierra sesión al final para no bloquear el próximo login.

Si algo falla, el error dice el paso y queda una captura enmascarada en `~/.gastos-scraper/logs/fail-<banco>.txt`.

## Qué escribe en Firestore (`users/{uid}/data/cards`)

- `<banco>`: la última lectura (tarjetas, consumos del ciclo abierto, estimado, fechas, consumos nuevos).
- `ciclos.<banco>_<últimos4>_<YYYY-MM>`: un registro por tarjeta y **mes de pago** (mes del vencimiento). Mientras el ciclo está abierto se pisa el estimado; cuando el banco publica el resumen cerrado se agrega `final` con el total real. La app crea ese mes si no existe y llena la cuenta del banco.

## Cálculo

Estimado = suma de los consumos del ciclo abierto (con cuotas del período, devoluciones y autorizaciones pendientes), ARS y USD por separado; la app pesifica los USD al dólar del mes. Cuando cierra el resumen se usa el total real del banco (Galicia; Santander pendiente).
