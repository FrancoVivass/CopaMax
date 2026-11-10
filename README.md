# Copa Max

Sitio institucional y gestor de torneos de fútbol de Copa Max Dolores, hecho con Angular y Supabase. Incluye landing pública, directorio y fichas personalizadas de clubes, gestión de fase regular, copas Oro y Plata, sponsors, y paneles separados para administración y responsables de clubes.

## Ejecutar localmente

```bash
npm install
npm start
```

Angular sirve la aplicación en `http://localhost:4200`.

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
