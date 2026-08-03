import { Injectable, signal } from '@angular/core';

/**
 * Recuerda el último Expediente único (código de solicitud) que el usuario eligió, para que
 * al pasar de un módulo a otro del mismo caso (Expediente único → Configuración F0302 →
 * Entrega → Generador de documentos) no tenga que volver a buscarlo. Es solo una preferencia
 * de navegación: cada módulo sigue filtrando por rol y valida que el caso siga estando
 * disponible antes de usarlo (`*Visibles()` en DataService).
 */
@Injectable({ providedIn: 'root' })
export class CasoActivoService {
  readonly expediente = signal('');

  seleccionar(id: string): void {
    if (id) this.expediente.set(id);
  }
}
