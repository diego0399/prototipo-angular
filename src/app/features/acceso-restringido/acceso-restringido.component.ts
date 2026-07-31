import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { IconComponent } from '../../shared/icon';

/**
 * Pantalla mostrada cuando el guard de rol bloquea el acceso por URL directa a un módulo
 * restringido (aunque no aparezca en el menú). El texto es específico para Administración
 * y genérico para el resto de los módulos restringidos.
 */
@Component({
  selector: 'app-acceso-restringido',
  imports: [IconComponent],
  styles: `
    .wrap { display: grid; place-items: center; min-height: calc(100vh - 62px); padding: 40px 20px; }
    .box { max-width: 460px; text-align: center; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); box-shadow: var(--shadow-1); padding: 40px 34px; }
    .ico { width: 56px; height: 56px; border-radius: 50%; background: var(--danger-bg); color: var(--danger); display: grid; place-items: center; margin: 0 auto 18px; }
    .ico ui-icon { --icon-size: 28px; }
    h1 { font-size: 19px; color: var(--navy-900); margin-bottom: 10px; }
    p { font-size: 13.5px; color: var(--tx-2); line-height: 1.6; margin-bottom: 24px; }
  `,
  template: `
    <div class="wrap">
      <div class="box">
        <div class="ico"><ui-icon name="alert" /></div>
        <h1>Acceso restringido</h1>
        <p>{{ mensaje() }}</p>
        <button class="btn btn-primary" type="button" (click)="volver()">Volver al panel</button>
      </div>
    </div>
  `
})
export class AccesoRestringidoComponent {
  private readonly router = inject(Router);

  /** Llega como query param (?ruta=) desde el guard de rol. */
  readonly ruta = input<string>();

  protected readonly mensaje = computed(() =>
    (this.ruta() ?? '').startsWith('/administracion')
      ? 'Solo el usuario Administrador puede acceder al módulo de Administración.'
      : 'No tiene permisos para acceder a este módulo con el rol actual.'
  );

  protected volver(): void {
    this.router.navigateByUrl('/dashboard');
  }
}
