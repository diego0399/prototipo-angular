import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { DataService } from '../services/data.service';
import { rolesDeRuta } from '../config/permisos';

/**
 * Valida el acceso por URL directa: aunque un módulo esté oculto en el menú, la ruta también
 * queda bloqueada si el **rol activo** no está autorizado. Usa la misma tabla de permisos que
 * construye el menú lateral (core/config/permisos.ts), así ambos nunca quedan desalineados.
 *
 * Con usuarios multirrol, el bloqueo no significa «no puede»: significa «con este rol activo, no».
 * Quien tiene además el rol que la ruta pide solo necesita cambiar de rol activo, sin cerrar
 * sesión. Por eso el intento queda trazado con el rol activo y con todos los roles del usuario.
 */
export const roleGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const data = inject(DataService);
  const router = inject(Router);

  const clave = auth.usuario()?.clave;
  if (!clave) return router.parseUrl('/login');

  const roles = rolesDeRuta(state.url.split('?')[0]);
  if (!roles || roles.includes(clave)) return true;

  data.registrarAccesoDenegado(state.url);
  return router.parseUrl(`/acceso-restringido?ruta=${encodeURIComponent(state.url)}`);
};
