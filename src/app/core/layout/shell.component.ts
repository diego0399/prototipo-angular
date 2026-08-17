import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { DataService } from '../services/data.service';
import { ToastService } from '../services/toast.service';
import { IconComponent } from '../../shared/icon';
import { NAVEGACION, NavGrupo } from '../config/permisos';
import { URL_CONTROLES_MENSUALES } from '../config/modulos';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  styles: `
    :host { display: grid; grid-template-columns: 268px 1fr; min-height: 100vh; }

    /* ------- Sidebar ------- */
    .side {
      background: linear-gradient(180deg, var(--navy-950) 0%, var(--navy-900) 55%, var(--navy-800) 100%);
      color: var(--tx-inv);
      display: flex; flex-direction: column;
      position: sticky; top: 0; height: 100vh; overflow-y: auto; overflow-x: hidden;
      border-right: 1px solid rgba(255,255,255,.06);
    }
    /* Marca vertical: logo CNR arriba, nombre del sistema debajo (evita competir por ancho). */
    .brand {
      display: flex; flex-direction: column; align-items: center; text-align: center;
      gap: 12px; padding: 24px 18px 16px;
    }
    .brand img { height: 40px; width: auto; max-width: 100%; }
    .brand .b-txt { min-width: 0; max-width: 100%; }
    .brand .b-name { font-family: var(--font-brand); font-size: 26px; letter-spacing: .06em; color: #fff; line-height: 1; }
    .brand .b-name .gold { color: var(--gold-500); }
    .brand .b-sub {
      font-size: 9px; letter-spacing: .08em; text-transform: uppercase; color: #9fb4d4;
      margin-top: 7px; line-height: 1.5; overflow-wrap: break-word;
    }
    .brand-rule { height: 2px; margin: 0 34px 6px; background: linear-gradient(90deg, transparent, var(--gold-500) 30%, var(--gold-500) 70%, transparent); border-radius: 2px; flex: none; }

    /* El selector de módulo del ecosistema vive en styles.css (presupuesto de CSS por componente). */
    nav { flex: 1; padding: 4px 14px 20px; }
    .nav-g { margin-top: 18px; }
    .nav-g:first-child { margin-top: 10px; }
    .nav-g > .g-title { font-size: 10px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #7e93b5; padding: 0 12px 7px; }
    .nav-a {
      display: flex; align-items: center; gap: 11px;
      padding: 9px 12px; margin: 2px 0; border-radius: 9px;
      color: #c7d4e8; font-size: 13px; font-weight: 500; text-decoration: none;
      transition: background .12s, color .12s;
    }
    .nav-a:hover { background: rgba(255, 255, 255, .07); color: #fff; text-decoration: none; }
    .nav-a.on { background: rgba(46, 111, 196, .32); color: #fff; box-shadow: inset 3px 0 0 var(--gold-500); }
    .nav-a span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .nav-a ui-icon { --icon-size: 17px; opacity: .85; flex: none; }
    .nav-a.on ui-icon { opacity: 1; }

    .side-foot {
      padding: 14px 20px 20px; border-top: 1px solid rgba(255,255,255,.08);
      font-size: 10.5px; line-height: 1.7; color: #8ba1c2; letter-spacing: .02em;
    }
    .side-foot b { display: block; font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #a9bbd6; margin-bottom: 3px; }

    /* ------- Zona principal ------- */
    .main { display: flex; flex-direction: column; min-width: 0; }
    .topbar {
      position: sticky; top: 0; z-index: 40;
      display: flex; align-items: center; gap: 16px;
      background: rgba(255, 255, 255, .92); backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--line);
      padding: 10px 28px; min-height: 62px;
    }
    .tb-title { font-size: 15.5px; font-weight: 700; color: var(--navy-900); line-height: 1.25; }
    .tb-crumb { font-size: 10.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--gold-600); }
    .tb-right { margin-left: auto; display: flex; align-items: center; gap: 14px; }

    .ver-como { display: flex; align-items: center; gap: 8px; }
    .ver-como label { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--tx-3); }
    .ver-como select {
      font-family: var(--font); font-size: 12.5px; font-weight: 500; color: var(--navy-800);
      border: 1px solid var(--line-strong); border-radius: 8px; padding: 6px 10px; background: var(--surface);
      max-width: 250px;
    }

    .user-chip { display: flex; align-items: center; gap: 10px; padding: 5px 6px 5px 14px; border-left: 1px solid var(--line); }
    .user-chip .u-name { font-size: 13px; font-weight: 700; color: var(--navy-900); line-height: 1.2; white-space: nowrap; }
    .user-chip .u-role { font-size: 11px; color: var(--tx-3); white-space: nowrap; }
    .avatar {
      width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center;
      background: var(--navy-800); color: var(--gold-500); font-size: 12px; font-weight: 700; flex: none;
      box-shadow: inset 0 0 0 1.5px rgba(201,162,39,.45);
    }
    .btn-out { border: 1px solid var(--line-strong); background: var(--surface); color: var(--tx-2); border-radius: 8px; padding: 7px 9px; cursor: pointer; display: grid; place-items: center; flex: none; }
    .btn-out:hover { color: var(--danger); border-color: var(--danger-line); background: var(--danger-bg); }

    .content { flex: 1; }

    /* ------- Pantallas angostas ------- */
    @media (max-width: 1180px) {
      :host { grid-template-columns: 232px 1fr; }
      .brand { padding: 20px 14px 14px; }
      .brand .b-name { font-size: 22px; }
      nav { padding: 4px 10px 16px; }
    }
    @media (max-width: 980px) {
      :host { grid-template-columns: 1fr; }
      .side { position: static; height: auto; }
      .brand { flex-direction: row; text-align: left; align-items: center; gap: 14px; padding: 16px 20px 12px; }
      .brand img { height: 34px; }
      .brand .b-sub br { display: none; }
      nav { display: flex; flex-wrap: wrap; gap: 2px 26px; padding: 2px 16px 14px; }
      .nav-g { margin-top: 10px; flex: 1 1 200px; min-width: 180px; }
      .side-foot { display: none; }
      .topbar { padding: 10px 16px; flex-wrap: wrap; }
      .ver-como label { display: none; }
      .user-chip .u-role { display: none; }
    }
  `,
  template: `
    <aside class="side">
      <div class="brand">
        <img src="assets/logos/LogoCNR_white.png" alt="Centro Nacional de Registros" />
        <div class="b-txt">
          <div class="b-name">SISGO<span class="gold">ST</span></div>
          <div class="b-sub">Gestión de Equipos<br />Sistema de Gestión y Seguimiento de Soporte Técnico</div>
        </div>
      </div>
      <div class="brand-rule"></div>

      <!-- Selector de módulo del ecosistema SISGOST -->
      <div class="mod-sel">
        <div class="mod-title">SISGOST</div>
        <div class="mod-a on"><ui-icon name="box" /><span>Gestión de Equipos</span></div>
        <a class="mod-a" [href]="urlControles"
          title="Ir a SISGOST — Controles Mensuales: controles normados, bitácora diaria, justificaciones e inventario operativo">
          <ui-icon name="clipboard" /><span>Ir a Controles Mensuales</span>
          <ui-icon name="external" [size]="12" />
        </a>
      </div>

      <nav>
        @for (g of grupos(); track g.titulo) {
          <div class="nav-g">
            <div class="g-title">{{ g.titulo }}</div>
            @for (item of g.items; track item.ruta) {
              <a class="nav-a" [routerLink]="item.ruta" routerLinkActive="on">
                <ui-icon [name]="item.icono" />
                <span>{{ item.titulo }}</span>
              </a>
            }
          </div>
        }
      </nav>

      <div class="side-foot">
        <b>Prototipo institucional</b>
        Datos simulados (JSON) · sin backend<br />
        Conectado con SISGOST — Controles Mensuales<br />
        Centro Nacional de Registros · DTI
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div>
          <div class="tb-crumb">{{ grupoActual() }}</div>
          <div class="tb-title">{{ tituloActual() }}</div>
        </div>

        <div class="tb-right">
          <div class="ver-como">
            <label for="vercomo">Ver como</label>
            <select id="vercomo" (change)="cambiarUsuario($event)">
              @for (u of data.usuarios(); track u.usuario) {
                <option [value]="u.usuario" [selected]="u.usuario === auth.usuario()?.usuario">{{ u.rol }} · {{ u.nombre }}</option>
              }
            </select>
          </div>
          <div class="user-chip">
            <div class="avatar">{{ auth.usuario()?.iniciales }}</div>
            <div>
              <div class="u-name">{{ auth.usuario()?.nombre }}</div>
              <div class="u-role">{{ auth.usuario()?.rol }} · {{ auth.usuario()?.unidad }}</div>
              @if (auth.usuario()?.direccionAsignada) { <div class="u-role">Dirección: {{ auth.usuario()?.direccionAsignada }}</div> }
            </div>
          </div>
          <button class="btn-out" type="button" (click)="salir()" title="Cerrar sesión">
            <ui-icon name="logout" />
          </button>
        </div>
      </header>

      <main class="content">
        <router-outlet />
      </main>
    </div>
  `
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly data = inject(DataService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Enlace al módulo hermano del ecosistema (ver core/config/modulos.ts). */
  protected readonly urlControles = URL_CONTROLES_MENSUALES;

  /**
   * Menú por rol (tabla en core/config/permisos.ts, compartida con el guard de rutas): los
   * Encargados ven los catálogos globales de sus módulos; los Técnicos solo los módulos donde
   * tienen tareas (sus listados se filtran por usuario conectado). Administración se oculta
   * por completo salvo para el rol Administrador.
   */
  protected readonly grupos = computed<NavGrupo[]>(() => {
    const clave = this.auth.usuario()?.clave;
    return NAVEGACION
      .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || (!!clave && i.roles.includes(clave))) }))
      .filter((g) => g.items.length > 0);
  });

  private readonly urlActual = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  protected readonly tituloActual = computed(() => {
    const url = this.urlActual();
    for (const g of this.grupos()) {
      const item = g.items.find((i) => url.startsWith(i.ruta));
      if (item) return item.titulo;
    }
    return 'SISGOST';
  });

  /** Etiqueta discreta del grupo activo (breadcrumb del topbar). */
  protected readonly grupoActual = computed(() => {
    const url = this.urlActual();
    for (const g of this.grupos()) {
      if (g.items.some((i) => url.startsWith(i.ruta))) return g.titulo;
    }
    return 'SISGOST';
  });

  protected cambiarUsuario(ev: Event): void {
    const usuario = (ev.target as HTMLSelectElement).value;
    const u = this.data.usuarios().find((x) => x.usuario === usuario);
    if (u) {
      this.auth.login(u);
      this.toast.info('Vista cambiada', `Ahora navegas como ${u.nombre} (${u.rol}).`);
    }
  }

  protected salir(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
