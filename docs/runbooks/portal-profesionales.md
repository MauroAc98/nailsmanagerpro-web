# Portal de profesionales (profesionales.turnetto.com) - runbook operativo

Estado al 2026-10-17. Ningun paso de este documento lo ejecuta un agente: lo corre el mantenedor.
Mergear no implica desplegar; el deploy se decide aparte.

## 1. Que es y como esta aislado

Portal de solo lectura para profesionales invitadas por la persona titular de un negocio (login, elegir negocio, agenda dia/mes con filtros, detalle de turno).

- Host propio: `profesionales.turnetto.com` (`PRO_HOST` en `lib/hosts.ts`). El middleware (`middleware.ts`) reescribe las rutas del host a `/pro/...` (grupo `app/(profesionales)`); `/pro` devuelve 404 en los hosts app, admin y reservar.
- Manifest e iconos propios: en ese host `/manifest.json`, `/icon-192.png` e `/icon-512.png` se sirven desde `public/pro-manifest.json`, `public/pro-icon-192.png` y `public/pro-icon-512.png` (`PRO_ASSET_MAP`).
- Cliente HTTP y store propios (`lib/pro/`), separados de los del negocio. En ese origen no se registra service worker (se desregistra uno heredado) ni se pide permiso de push.
- Backend: rutas `/api/pro/*` detras del flag `PORTAL_PROFESIONALES_HABILITADO`. Con el flag apagado responden 404.

## 2. Estado de la infraestructura (ya hecho, no repetir)

- nginx: bloque `/etc/nginx/sites-available/profesionales-turnetto` (copia de reservar: proxy a `localhost:3000`, Host pasante), habilitado.
- TLS: certificado de certbot emitido el 2026-10-17, vence el 2027-01-15, renovacion automatica.
- CORS (`config/cors.php` del backend): origen `https://profesionales.turnetto.com` permitido, `X-Vinculo-Id` cubierto por `allowed_headers: *`, `Retry-After` expuesto. Backup: `cors.php.bak-20261017-profesionales`.
- Backend desplegado de `e4cf2f5` a `a4647dd` (13 commits del portal), 5 migraciones aplicadas, `PORTAL_PROFESIONALES_URL=https://profesionales.turnetto.com` y `PORTAL_PROFESIONALES_HABILITADO=false` en el `.env` (backup `.env.bak-20261017-profesionales`), caches regenerados, php-fpm recargado, worker reiniciado. Backup de la base previo al deploy hecho.
- Flag: APAGADO. Hasta desplegar el frontend, el host nuevo sirve la app de negocios y `POST /api/pro/login` da 404.

## 3. Checklist de rollout (orden estricto)

1. **Deploy del frontend**: `npm run deploy` (`scripts/deploy.sh`: build, sube tarball a `/var/www/pwa/releases/<ts>`, cambia el symlink `current`, `pm2 reload pwa`, conserva 2 releases). Su health check solo mira `https://app.turnetto.com/`; correr tambien `curl -s -o /dev/null -w '%{http_code}\n' https://profesionales.turnetto.com/`.
2. **Verificar el host**: `https://profesionales.turnetto.com/` muestra el login del portal (no la app de negocios); con el flag apagado debe verse el aviso de portal no disponible. `/manifest.json` (nombre "Turnetto Profesionales"), `/icon-192.png` e `/icon-512.png` devuelven 200. `/pro` en app, admin y reservar da 404.
3. **Prerrequisitos antes del flag** (verificados el 2026-10-17, sin cambios necesarios):
   - IP real del cliente: la API no tiene proxy ni CDN delante (nginx pasa a php-fpm por FastCGI), asi que `REMOTE_ADDR` es la IP real y el bloqueo por email + IP funciona. No hace falta `trustProxies`; si algun dia se agrega un CDN o balanceador delante de la API, hay que configurarlo.
   - Hosts desconocidos: `/etc/nginx/sites-enabled/00-default-https` es un `default_server` en el 443 que responde 444 (probado con dominio inventado, `Host: localhost:3000` y `Host: evil.example.com`). En el puerto 80 un Host falso recibe la pagina estatica por defecto de nginx; no llega a Next ni a la API.
4. **Activar el flag**: en el `.env` del backend en el VPS poner `PORTAL_PROFESIONALES_HABILITADO=true` (hacer backup del `.env` antes), luego `php artisan config:cache` y recargar php-fpm (`php8.2-fpm`).
5. **Smoke end to end con una profesional real invitada**: llega el mail de invitacion; cambio de contrasena forzado; login; elegir negocio (y cambiar de negocio); agenda dia, mes, filtros y detalle de turno; logout (probar tambien con 2 pestanas abiertas); olvide mi contrasena y reset.
6. **Chequeos manuales en dispositivo**: instalar la PWA desde ese host en Android (Chrome) e iOS (agregar a inicio) y revisar icono, nombre y color; en DevTools > Application no debe haber service worker registrado ni pedido de permiso de push; descartar un SW viejo de visitas previas; el aviso "solo celular" con anchos 599, 600 y 1024 px; el apple-touch-icon muestra el icono del portal.

## 4. Rollback

- Flag a `false` + `php artisan config:cache` + recargar php-fpm: el portal queda apagado (`/api/pro/*` = 404). Es el primer recurso.
- Host apagado: quitar la rama `PRO_HOST` del middleware y redesplegar. DNS y nginx no se tocan.
- Rollback del frontend: `ssh -i <clave> root@<vps> "ln -sfn /var/www/pwa/releases/<release-anterior> /var/www/pwa/current && pm2 reload pwa"`. Antes verificar con `ls /var/www/pwa/releases` que el destino exista: el deploy conserva solo 2 releases y borra el antepenultimo.

## 5. Limitaciones conocidas y seguimientos

- Falta un header `Referrer-Policy` en `next.config.ts` para la pagina de reset (el token viaja en la URL).
- Los hosts admin y reservar tambien sirven paginas de negocio con rutas tipo `/agenda/1.x` (bypass por punto en el chequeo de archivos estaticos compartido). Ya preexistente; en el host del portal se corrigio.
- nginx: 444 para Host desconocido (ver paso 3).
- El icono del portal no tiene variante maskable.
- El aviso "Turnetto es para celular" conserva el texto del negocio (aceptado).
- La rama de reservar `/pro/login` se reescribe a `/reservar/pro/login` (puede existir un slug `pro`): decidido mantenerlo; el escenario S3 de HR-3 de la spec quedo desactualizado.
- La pantalla de la persona titular para invitar y gestionar el acceso es un cambio SEPARADO: `acceso-profesionales-titular-frontend` (rebanadas O1-O5). Hasta entonces las invitaciones solo se pueden hacer por API.
