import { Component, Pipe, PipeTransform, computed, input, output } from '@angular/core';
import { Equipo } from '../core/models/models';

/** Clasifica un estado libre en una variante visual del badge. */
export function estadoKind(estado: string): 'ok' | 'warn' | 'danger' | 'info' | 'gold' | 'neutral' {
  const e = (estado || '').toLowerCase();
  if (/(carga alta)/.test(e)) return 'danger';
  if (/(carga media)/.test(e)) return 'warn';
  if (/(carga baja)/.test(e)) return 'ok';
  if (/(no conforme|vencid|falla|no encontrado|formato inválido|no corresponde)/.test(e)) return 'danger';
  // «Inactivo» va antes que la rama «ok»: contiene la subcadena «activo» y se pintaba en verde.
  if (/(no asignado|bloquead|no aplica|inactivo)/.test(e)) return 'neutral';
  if (/(completad|realizado|firmado|aceptado|vigente|entregado|anexado|generado|verificad|activo|preparado|disponible|resuelto|finalizad|capturad|encontrado)/.test(e)) return 'ok';
  if (/(pendiente|por generar|no enviado|no iniciada|caso abierto|revisión|abierto)/.test(e)) return 'warn';
  if (/entrante/.test(e)) return 'gold';
  if (/(en configuración|en preparación|en solicitud|asignad|enviado|en curso|en proceso)/.test(e)) return 'info';
  return 'neutral';
}

@Component({
  selector: 'ui-badge',
  template: `<span [class]="'badge ' + kind()">{{ estado() }}</span>`
})
export class BadgeComponent {
  readonly estado = input.required<string>();
  protected readonly kind = computed(() => estadoKind(this.estado()));
}

/** Icono «?» con tooltip discreto: la regla aparece solo cuando el usuario la necesita. */
@Component({
  selector: 'ui-help',
  template: `
    <span class="helptip">
      <button type="button" aria-label="Ver ayuda">?</button>
      <span class="tip" role="tooltip">{{ texto() }}</span>
    </span>
  `
})
export class HelpTipComponent {
  readonly texto = input.required<string>();
}

/** Ventana modal simple para detalles y vistas previas de documentos. */
@Component({
  selector: 'ui-modal',
  template: `
    <div class="modal-backdrop" (click)="cerrar.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="card-head">
          <div>
            <h3>{{ titulo() }}</h3>
            @if (sub()) { <p class="sub">{{ sub() }}</p> }
          </div>
          <button class="btn btn-ghost btn-sm" type="button" (click)="cerrar.emit()">✕ Cerrar</button>
        </div>
        <div class="card-body">
          <ng-content />
        </div>
      </div>
    </div>
  `
})
export class ModalComponent {
  readonly titulo = input.required<string>();
  readonly sub = input('');
  readonly cerrar = output<void>();
}

/** Muestra marca y modelo como un solo dato legible: «HP EliteBook 845 G11». */
@Pipe({ name: 'marcaModelo' })
export class MarcaModeloPipe implements PipeTransform {
  transform(equipo: Equipo | null | undefined): string {
    return equipo ? `${equipo.marca} ${equipo.modelo}` : '—';
  }
}

/** Etiqueta visible del tipo de requerimiento («Requerimiento de Laptop» / «Requerimiento de CPU»; con `corto` solo «Laptop» / «CPU»). */
@Pipe({ name: 'tipoRequerimiento' })
export class TipoRequerimientoPipe implements PipeTransform {
  transform(tipoEquipo: 'Laptop' | 'Desktop' | null | undefined, corto = false): string {
    const base = tipoEquipo === 'Desktop' ? 'CPU' : 'Laptop';
    return corto ? base : `Requerimiento de ${base}`;
  }
}
