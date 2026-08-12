import { Component, Pipe, PipeTransform, computed, input, output } from '@angular/core';
import { Equipo } from '../core/models/models';
import { IconComponent } from './icon';

/** Clasifica un estado libre en una variante visual del badge. */
export function estadoKind(estado: string): 'ok' | 'warn' | 'danger' | 'info' | 'gold' | 'neutral' {
  const e = (estado || '').toLowerCase();
  if (/(carga alta)/.test(e)) return 'danger';
  if (/(carga media)/.test(e)) return 'warn';
  if (/(carga baja)/.test(e)) return 'ok';
  // «No corregido» va antes que la rama «ok»: contiene «corregido» y se pintaba en verde.
  // «Pendiente de corrección de datos institucionales» es un error del dato de origen, no un paso
  // del proceso: va antes de la rama «pendiente», que lo pintaría como una espera normal.
  if (/corrección de datos institucionales/.test(e)) return 'danger';
  if (/(no conforme|vencid|falla|no encontrado|formato inválido|no corresponde|asociado a otro|no corregido)/.test(e)) return 'danger';
  // «Inactivo» va antes que la rama «ok»: contiene la subcadena «activo» y se pintaba en verde.
  // «Asignado sin Expediente único» va antes que la rama «asignad»: describe algo pendiente de
  // continuar, no un estado ya resuelto.
  if (/sin expediente único/.test(e)) return 'warn';
  // «Por vencer» avisa sin ser una falla: va antes de la rama «ok», donde «vigente» lo pintaría
  // de verde y escondería justamente lo que hay que mirar.
  if (/por vencer/.test(e)) return 'warn';
  // «Desactivada» contiene «activa» y «sin garantía de proveedor» no es un estado bueno ni malo:
  // ambos van antes de la rama «ok» para que no se pinten en verde.
  if (/(no asignado|bloquead|no aplica|inactivo|desactivad|sin garantía)/.test(e)) return 'neutral';
  if (/(completad|realizado|firmado|aceptado|vigente|entregado|anexado|generado|verificad|activo|activa|preparado|disponible|resuelto|finalizad|capturad|encontrado|instalado|corregido)/.test(e)) return 'ok';
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
  imports: [IconComponent],
  template: `
    <div class="modal-backdrop" (click)="cerrar.emit()">
      <div class="modal" [class.ancho]="ancho()" (click)="$event.stopPropagation()">
        <div class="card-head">
          <div>
            <h3>{{ titulo() }}</h3>
            @if (sub()) { <p class="sub">{{ sub() }}</p> }
          </div>
          <button class="btn btn-ghost btn-sm" type="button" (click)="cerrar.emit()">
            <ui-icon name="x" [size]="14" /> Cerrar
          </button>
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
  /** Modal ancho, para tablas que no caben en el ancho normal sin desplazamiento lateral. */
  readonly ancho = input(false);
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
