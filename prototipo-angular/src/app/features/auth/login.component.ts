import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { HelpTipComponent } from '../../shared/ui';

@Component({
  selector: 'app-login',
  imports: [FormsModule, HelpTipComponent],
  styles: `
    :host { display: grid; grid-template-columns: 1.05fr 1fr; min-height: 100vh; }

    /* ---------- Panel institucional ---------- */
    .hero {
      position: relative; overflow: hidden;
      background:
        radial-gradient(1100px 600px at -10% 110%, rgba(201, 162, 39, .16), transparent 55%),
        radial-gradient(900px 500px at 110% -10%, rgba(46, 111, 196, .32), transparent 60%),
        linear-gradient(160deg, var(--navy-950), var(--navy-900) 55%, var(--navy-800));
      color: var(--tx-inv);
      display: flex; flex-direction: column;
      padding: 40px 56px 28px;
    }
    .hero::after {
      content: ''; position: absolute; inset: 0;
      background-image: radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px);
      background-size: 26px 26px; pointer-events: none;
    }
    .hero-top {
      position: relative; z-index: 1;
      display: flex; align-items: center; gap: 14px;
      padding-bottom: 22px; border-bottom: 1px solid rgba(255,255,255,.10);
    }
    .hero-top img { height: 42px; width: auto; flex: none; }
    .hero-top .inst { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #b7c6de; line-height: 1.6; }

    /* Bloque central, verticalmente centrado y con ritmo uniforme */
    .hero-mid { position: relative; z-index: 1; max-width: 560px; margin: auto 0; padding: 34px 0; }
    .wordmark { font-family: var(--font-brand); font-size: 54px; color: #fff; letter-spacing: .02em; line-height: 1; }
    .wordmark .gold { color: var(--gold-500); }
    .wordmark-rule { width: 64px; height: 3px; background: var(--gold-500); border-radius: 3px; margin: 16px 0 14px; }
    .tagline { font-size: 17px; font-weight: 500; color: #e4ecf8; line-height: 1.45; }
    .hero-desc { font-size: 13.5px; color: #a9bbd6; margin-top: 12px; line-height: 1.7; max-width: 52ch; }

    /* Características: rejilla compacta de tarjetas, no lista dispersa */
    .hero-feats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 26px; }
    .feat {
      display: flex; gap: 11px; align-items: flex-start;
      background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.09);
      border-radius: 12px; padding: 12px 14px;
      font-size: 12.5px; color: #c9d6e9; line-height: 1.5;
    }
    .feat .f-dot {
      flex: none; width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center;
      background: rgba(201, 162, 39, .16); color: var(--gold-500);
      font-weight: 700; font-size: 12px; border: 1px solid rgba(201,162,39,.35);
    }
    .feat b { color: #fff; font-weight: 700; display: block; margin-bottom: 1px; }

    .hero-foot {
      position: relative; z-index: 1;
      display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
      padding-top: 16px; border-top: 1px solid rgba(255,255,255,.10);
      font-size: 11px; color: #7f95b6; letter-spacing: .03em;
    }

    /* ---------- Panel de acceso ---------- */
    .access {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background:
        radial-gradient(700px 380px at 85% 8%, rgba(46, 111, 196, .07), transparent 60%),
        var(--bg);
      padding: 40px 32px 28px; gap: 0;
    }
    .box { width: min(400px, 100%); margin: auto 0; }

    .acc-kicker {
      display: inline-flex; align-items: center; gap: 8px;
      font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
      color: var(--gold-600); margin-bottom: 8px;
    }
    .acc-kicker::before { content: ''; width: 22px; height: 2px; background: var(--gold-500); border-radius: 2px; }
    .box h1 { font-size: 24px; letter-spacing: -.2px; margin-bottom: 4px; }
    .box .sub { color: var(--tx-2); font-size: 13.5px; margin-bottom: 22px; }

    .login-card {
      background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg);
      box-shadow: var(--shadow-2); overflow: hidden;
    }
    .login-card::before { content: ''; display: block; height: 4px; background: linear-gradient(90deg, var(--gold-500), var(--blue-600)); }
    .login-card .lc-body { padding: 24px 24px 22px; display: grid; gap: 18px; }

    .role-note { margin-top: 16px; font-size: 12.5px; }

    .acc-foot { font-size: 11px; color: var(--tx-3); text-align: center; padding-top: 18px; letter-spacing: .03em; }

    /* ---------- Pantallas angostas ---------- */
    @media (max-width: 960px) {
      :host { grid-template-columns: 1fr; }
      .hero { padding: 28px 26px 20px; }
      .hero-mid { padding: 26px 0; margin: 0; }
      .wordmark { font-size: 42px; }
      .hero-feats { grid-template-columns: 1fr; }
      .hero-desc { max-width: none; }
      .access { padding: 32px 20px 22px; }
    }
  `,
  template: `
    <section class="hero">
      <div class="hero-top">
        <img src="assets/logos/LogoCNR_white.png" alt="CNR" />
        <div class="inst">Centro Nacional de Registros<br />Dirección de Tecnologías de la Información</div>
      </div>

      <div class="hero-mid">
        <div class="wordmark">SISGO<span class="gold">ST</span></div>
        <div class="wordmark-rule"></div>
        <div class="tagline">Sistema de Gestión y Seguimiento de Soporte Técnico</div>
        <p class="hero-desc">
          Gestión auditada del proceso de entrega de equipos: desde el inventario y la preparación
          técnica (F0288), pasando por la asignación y la configuración (F0302), hasta la
          conformidad del usuario final y el servicio de garantía.
        </p>
        <div class="hero-feats">
          <div class="feat"><span class="f-dot">1</span><span><b>Expediente único del equipo</b>Toda la documentación del proceso, consolidada.</span></div>
          <div class="feat"><span class="f-dot">2</span><span><b>Checklists digitales F0288 · F0302</b>Se completan en el sistema, con evidencias y firmas.</span></div>
          <div class="feat"><span class="f-dot">3</span><span><b>Conformidad por formulario externo</b>El usuario final responde desde su correo institucional.</span></div>
          <div class="feat"><span class="f-dot">4</span><span><b>Trazabilidad completa</b>Cada acción queda registrada para auditoría.</span></div>
        </div>
      </div>

      <div class="hero-foot">
        <span>Prototipo navegable · datos simulados (JSON)</span>
        <span>Sin backend ni base de datos</span>
      </div>
    </section>

    <section class="access">
      <div class="box">
        <div class="acc-kicker">Acceso al sistema</div>
        <h1>Iniciar sesión</h1>
        <p class="sub">Acceso exclusivo para el personal técnico autorizado.</p>

        <div class="login-card">
          <div class="lc-body">
            <div class="field">
              <label for="usuario">
                Usuario del sistema
                <ui-help texto="Solo los roles operativos inician sesión: Encargado y Técnico de Soporte, Encargado y Técnico de Hardware, y el Administrador. Dirección y Usuario Final participan en el proceso pero no acceden al sistema." />
              </label>
              <select id="usuario" class="control" [(ngModel)]="usuarioSel">
                <option value="" disabled>Seleccione su usuario…</option>
                @for (u of data.usuarios(); track u.usuario) {
                  <option [value]="u.usuario">{{ u.nombre }} — {{ u.rol }}</option>
                }
              </select>
            </div>

            <div class="field">
              <label for="clave">Contraseña</label>
              <input id="clave" class="control" type="password" placeholder="••••••••" [(ngModel)]="clave" (keydown.enter)="entrar()" />
              <span class="hint">Prototipo: cualquier contraseña es válida.</span>
            </div>

            <button class="btn btn-primary btn-lg" style="width: 100%" type="button" (click)="entrar()">
              Ingresar a SISGOST
            </button>
          </div>
        </div>

        <div class="alert role-note">
          <span class="alert-ico">i</span>
          <span>
            <b>Dirección</b> y <b>Usuario Final</b> no poseen usuario ni contraseña: la Dirección decide asignaciones
            que Soporte registra, y el usuario final responde su conformidad mediante un formulario externo.
          </span>
        </div>
      </div>

      <div class="acc-foot">Centro Nacional de Registros · Dirección de Tecnologías de la Información</div>
    </section>
  `
})
export class LoginComponent {
  protected readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected usuarioSel = signal('');
  protected clave = signal('');

  protected entrar(): void {
    const u = this.data.usuarios().find((x) => x.usuario === this.usuarioSel());
    if (!u) {
      this.toast.warn('Seleccione un usuario', 'Elija su usuario del sistema para continuar.');
      return;
    }
    this.auth.login(u);
    this.toast.ok(`Bienvenido, ${u.nombre}`, `${u.rol} · Unidad de ${u.unidad}`);
    this.router.navigateByUrl('/dashboard');
  }
}
