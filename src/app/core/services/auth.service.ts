import { Injectable, computed, signal } from '@angular/core';
import { UsuarioSistema } from '../models/models';
import {
  ClaveRolSistema, RolSistema, claveDeRol, etiquetaRoles, nombreRol, normalizaRoles, ordenaRoles,
  rolDeClave, rolPrincipal
} from '../models/roles';

const STORAGE_KEY = 'sisgost.sesion';

/**
 * Sesión simulada de SISGOST — Gestión de Equipos.
 *
 * **Un usuario puede tener más de un rol.** La sesión guarda todos (`usuario().roles`) y, además,
 * cuál está **activo**: el rol activo ordena el menú, el panel y las acciones a la vista; los
 * demás no se pierden, y `tieneRol()` sigue respondiendo por todos (§6).
 *
 * `usuario().clave` y `usuario().rol` reflejan **el rol activo**, así que todas las pantallas que
 * ya los leían siguen funcionando y pasan a responder al rol elegido.
 *
 * Dirección/Registro y Usuario Final NO son roles: participan solo como datos del proceso.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly usuario = signal<UsuarioSistema | null>(this.leerSesion());

  /** Todos los roles del usuario conectado, en orden de mando. */
  readonly roles = computed<RolSistema[]>(() => this.usuario()?.roles ?? []);

  /** Rol activo de la sesión. */
  readonly rolActivo = computed<RolSistema | undefined>(() => rolDeClave(this.usuario()?.clave));

  /** ¿Tiene más de un rol? Solo entonces aparece el selector de rol activo. */
  readonly multirol = computed(() => this.roles().length > 1);

  /** «Encargado de Soporte · Técnico de Soporte», para la ficha del usuario y la trazabilidad. */
  readonly etiquetaRoles = computed(() => etiquetaRoles(this.roles()));

  // --------------------------------------------------------- rol activo (lo que se ve)

  readonly esEncargadoSoporte = computed(() => this.usuario()?.clave === 'enc-soporte');
  readonly esEncargadoHardware = computed(() => this.usuario()?.clave === 'enc-hardware');
  readonly esAdmin = computed(() => this.usuario()?.clave === 'admin');

  /** Encargados: ven catálogos globales dentro de los módulos que les corresponden. */
  readonly esEncargado = computed(() => this.esEncargadoSoporte() || this.esEncargadoHardware());
  /** Técnicos: nunca ven catálogos globales; solo los procesos asignados o donde participaron. */
  readonly esTecnico = computed(() => {
    const c = this.usuario()?.clave;
    return c === 'tec-soporte' || c === 'tec-hardware';
  });
  /** Unidad Hardware (Encargado o Técnico): en Generador de documentos solo ve F0288. */
  readonly esHardware = computed(() => {
    const c = this.usuario()?.clave;
    return c === 'enc-hardware' || c === 'tec-hardware';
  });

  // --------------------------------------------------------- permisos combinados (lo que se puede)

  /** ¿El usuario tiene ese rol, esté activo o no? Es la base de los permisos combinados (§6). */
  tieneRol(rol: RolSistema): boolean { return this.roles().includes(rol); }

  /** ¿Tiene alguno de estos roles? */
  tieneAlguno(...roles: RolSistema[]): boolean { return roles.some((r) => this.tieneRol(r)); }

  /** Puede administrar aunque ahora mismo esté mirando el sistema con otro rol activo. */
  readonly puedeAdministrar = computed(() => this.roles().includes('ADMINISTRADOR'));

  /** Tiene responsabilidades técnicas de soporte, aunque su rol activo sea otro. */
  readonly esTambienTecnico = computed(() => this.roles().includes('TECNICO_SOPORTE'));

  // --------------------------------------------------------- sesión

  private leerSesion(): UsuarioSistema | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? this.normalizar(JSON.parse(raw) as UsuarioSistema) : null;
    } catch {
      return null;
    }
  }

  /**
   * Deja el usuario con sus roles resueltos y un rol activo coherente. Acepta un registro
   * heredado —el que solo traía `clave`— para que una sesión anterior a este cambio siga
   * abriendo sin dejar a nadie fuera.
   */
  private normalizar(u: UsuarioSistema, activo?: RolSistema): UsuarioSistema {
    const roles = ordenaRoles(normalizaRoles(u));
    const elegido = activo && roles.includes(activo)
      ? activo
      : (rolDeClave(u.clave) && roles.includes(rolDeClave(u.clave)!) ? rolDeClave(u.clave)! : rolPrincipal(roles));
    return {
      ...u,
      roles,
      clave: (elegido ? claveDeRol(elegido) : u.clave) as ClaveRolSistema,
      rol: elegido ? nombreRol(elegido) : u.rol
    };
  }

  login(u: UsuarioSistema, rolInicial?: RolSistema): void {
    const listo = this.normalizar(u, rolInicial);
    this.usuario.set(listo);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(listo));
  }

  /**
   * Cambia el rol activo **sin cerrar sesión**. Devuelve el rol que estaba activo antes, o `null`
   * si no hubo cambio: quien llama lo usa para registrar la trazabilidad con estado anterior y
   * nuevo.
   */
  cambiarRolActivo(rol: RolSistema): RolSistema | null {
    const u = this.usuario();
    if (!u || !u.roles.includes(rol)) return null;
    const anterior = rolDeClave(u.clave);
    if (anterior === rol) return null;
    const listo = this.normalizar(u, rol);
    this.usuario.set(listo);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(listo));
    return anterior ?? null;
  }

  /**
   * Adopta la ficha actualizada del usuario conectado cuando el Administrador le cambia los
   * roles: si el rol activo dejó de existir, se pasa al de mayor alcance que le quede.
   */
  refrescar(u: UsuarioSistema): void {
    if (this.usuario()?.usuario !== u.usuario) return;
    const activo = rolDeClave(this.usuario()!.clave);
    this.login(u, activo && u.roles?.includes(activo) ? activo : undefined);
  }

  logout(): void {
    this.usuario.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }
}
