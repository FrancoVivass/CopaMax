# Copa Max

Sitio institucional y gestor de torneos de fútbol de Copa Max Dolores, hecho con Angular y Supabase. Incluye landing pública, directorio y fichas personalizadas de clubes, gestión de fase regular, copas Oro y Plata, sponsors, y paneles separados para administración y responsables de clubes.

## Ejecutar localmente

```bash
npm install
npm start
```

Angular sirve la aplicación en `http://localhost:4200`.

## Publicar en Cloudflare Pages

Este proyecto genera una aplicación estática en `dist/copa-max/browser`. Para conectarlo desde Cloudflare Pages:

1. Importá el repositorio desde **Workers & Pages → Create application → Pages → Connect to Git**.
2. Configurá el directorio raíz como `/`, el comando de build como `npm run build` y el directorio de salida como `dist/copa-max/browser`.
3. Usá la rama de producción del repositorio (por ejemplo, `main`) y elegí **Save and Deploy**.

El archivo `.node-version` fija Node 22, compatible con Angular y el entorno de build de Pages. Cloudflare Pages sirve las rutas de esta SPA desde la raíz, así que funcionan las páginas internas como `/admin` y `/equipos` al abrirlas directamente. Para una carga manual, ejecutá `npm run build` y subí el contenido de `dist/copa-max/browser` con Wrangler Pages.

La aplicación usa la URL y la clave pública de Supabase definidas en `src/environments/environment.ts`; esa clave publicable forma parte del cliente web. No agregues una clave `service_role` al build ni a variables del frontend.

## Conectar Supabase

1. Creá el proyecto de Supabase.
2. En **SQL Editor**, ejecutá [`supabase/schema.sql`](supabase/schema.sql). Si ya habías instalado una versión anterior, volvé a ejecutar el script actualizado: es idempotente y agrega las columnas y tablas nuevas de perfiles, copas y campeones.
3. En **Authentication → Users**, creá la cuenta administradora y agregá su UUID a `public.admins` con la sentencia indicada al final del esquema.
4. Revisá la URL y la clave **publishable** del proyecto en `src/environments/environment.ts`. No pongas nunca una clave `service_role` en Angular ni en el repositorio.

El esquema guarda los torneos por año y edición, calcula las posiciones desde resultados, asigna equipos a zonas y protege cambios con RLS. Al terminar la fase regular, los puestos 1.º a 4.º de cada zona clasifican automáticamente a Copa Oro; del 5.º al 8.º, a Copa Plata. El panel permite ajustar los participantes y cargar eliminatorias. El resultado de la final asigna el campeón a la copa vinculada al torneo de origen; si hay empate, se registra quién avanzó por penales.

## Páginas

- `/`: portada, tablas, fixture, copas de cierre y sponsors.
- `/equipos`: directorio por temporada.
- `/equipos/:slug`: página pública personalizada del equipo.
- `/admin`: administración de torneos, clubes, partidos, copas y accesos.
- `/club-admin`: edición del perfil público, plantel, cuerpo técnico e imágenes del club.

Las fichas de los clubes se adaptan a móvil y escritorio. Cada equipo puede elegir una de tres líneas visuales, un color de acento, escudo y banner. Se pueden cargar fotos opcionales para jugadores, DT, cuerpo técnico y logros.

## Imágenes

Los logos de clubes y sponsors se cargan desde el panel. Las fotos, escudos y banners de los perfiles se cargan desde el panel de cada club en PNG, JPG o WebP. Podés cambiar las fotografías de portada de la landing editando `src/app/landing-page.scss`.
