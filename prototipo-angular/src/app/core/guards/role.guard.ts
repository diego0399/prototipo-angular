import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { rolesDeRuta } from '../config/permisos';

/**
 * Valida el acceso por URL directa: aunque un módulo esté oculto en el menú, la ruta también
 * queda bloqueada si el rol conectado no está autorizado. Usa la misma tabla de permisos que
 * construye el menú lateral (core/config/permisos.ts), así ambos nunca quedan desalineados.
 */
export const roleGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const clave = auth.usuario()?.clave;
  if (!clave) return router.parseUrl('/login');

  const roles = rolesDeRuta(state.url.split('?')[0]);
  if (!roles || roles.includes(clave)) return true;

  return router.parseUrl(`/acceso-restringido?ruta=${encodeURIComponent(state.url)}`);
};
