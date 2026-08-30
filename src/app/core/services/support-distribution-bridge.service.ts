import { Injectable, inject, signal } from '@angular/core';
import { URL_CONTROLES_MENSUALES } from '../config/modulos';
import { AsignacionSoporteCompartida, SharedDistributionService } from './shared-distribution.service';
import { SupportDistributionService } from './support-distribution.service';

/**
 * PUENTE HACIA LA DISTRIBUCIÓN DE SOPORTES de SISGOST — Controles Mensuales.
 *
 * La distribución **se edita en Controles Mensuales** y este módulo la consume: de ella salen los
 * Técnicos de Configuración elegibles de cada requerimiento y el soporte responsable posterior.
 * Antes, Gestión de Equipos se quedaba con la copia que traía su propia semilla y un cambio hecho
 * en el otro módulo no llegaba nunca: al crear el expediente único seguía apareciendo la lista
 * vieja. Este servicio es lo que cierra ese hueco.
 *
 * Dos caminos, en este orden:
 *
 *  1. **Mismo origen.** Si los dos módulos se sirven desde el mismo origen, la clave compartida
 *     (`sisgost_support_distribution`) basta y se lee directamente.
 *  2. **Orígenes distintos.** En desarrollo corren en 4200 y 4300, y `localStorage` está aislado
 *     por origen. Entonces se carga un iframe oculto con `puente-distribucion.html` —una página
 *     que Controles Mensuales publica en SU origen— y se le pide la clave por `postMessage`.
 *
 * Si Controles Mensuales no está levantado, este módulo sigue con la distribución que ya tenía:
 * nunca se queda sin lista ni la borra.
 *
 * Todo esto ocurre solo. No hay —ni debe haber— un botón de sincronizar.
 */
@Injectable({ providedIn: 'root' })
export class SupportDistributionBridgeService {
  private readonly compartida = inject(SharedDistributionService);
  private readonly soportes = inject(SupportDistributionService);

  /** Estado del último intento, para poder mostrarlo y trazarlo. */
  readonly estado = signal<'sin-intentar' | 'consultando' | 'conectado' | 'sin-conexion' | 'local'>('sin-intentar');
  readonly actualizadoEl = signal('');
  readonly ultimaLectura = signal('');
  readonly recibidas = signal(0);

  /** Se dispara cuando una lectura trajo algo distinto de lo que había. */
  readonly cambios = signal(0);

  private readonly origenControles = new URL(URL_CONTROLES_MENSUALES).origin;
  private iframe?: HTMLIFrameElement;
  private secuencia = 0;
  private escuchando = false;
  private enCurso?: Promise<boolean>;

  // ------------------------------------------------------------------ consultas

  /** La distribución vigente tal como este módulo la conoce ahora mismo. */
  getCurrentDistribution(): AsignacionSoporteCompartida[] {
    return this.soportes.registros().map((d) => this.soportes.aCompartida(d));
  }

  /**
   * Técnicos de Soporte **activos** responsables de una Dirección/Registro, comparando por IDs
   * estables. Sin distribución para esa Dirección/Registro devuelve vacío: no hay lista de reserva.
   */
  getSupportTechniciansByDirectionUnit(direccionId: string, unidadId: string): AsignacionSoporteCompartida[] {
    const dir = this.soportes.idDireccion(direccionId);
    const uni = unidadId.includes('::') ? unidadId : this.soportes.idUnidad(direccionId, unidadId);
    return this.getCurrentDistribution()
      .filter((a) => a.activo && a.direccionId === dir && a.unidadId === uni);
  }

  /** ¿Este técnico puede atender esa Dirección/Registro? Por ID, nunca por el nombre visible. */
  canTechnicianSupportUnit(tecnicoId: string, direccionId: string, unidadId: string): boolean {
    const id = this.soportes.idTecnico(tecnicoId);
    return this.getSupportTechniciansByDirectionUnit(direccionId, unidadId).some((a) => a.tecnicoId === id);
  }

  // ------------------------------------------------------------------ lectura

  /**
   * Relee la distribución compartida y la adopta si cambió. Devuelve `true` solo cuando algo
   * cambió de verdad, para que quien llama recalcule únicamente entonces: esto se invoca muchas
   * veces —al arrancar, al enfocar la ventana, al abrir un formulario— y casi siempre no hay
   * novedad.
   *
   * Las llamadas simultáneas comparten la misma consulta en curso: abrir un formulario mientras
   * la ventana recupera el foco no debe abrir dos puentes.
   */
  refreshDistributionFromStorage(msEspera = 2500): Promise<boolean> {
    if (this.enCurso) return this.enCurso;
    this.enCurso = this.leer(msEspera).finally(() => { this.enCurso = undefined; });
    return this.enCurso;
  }

  private async leer(msEspera: number): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    // 1. Mismo origen: la clave compartida se ve directamente. Una copia de una versión anterior
    // del contrato describe la organización previa a la estructura territorial, así que se ignora
    // y se pregunta al módulo que la edita, que devolverá la vigente.
    const propias = this.compartida.vigente() ? this.compartida.leer() : [];
    if (propias.length) {
      this.estado.set('local');
      this.actualizadoEl.set(this.compartida.actualizadoEl());
      this.recibidas.set(propias.length);
      return this.aplicar(propias);
    }
    // 2. Orígenes distintos: se pregunta al módulo que la edita.
    this.estado.set('consultando');
    try {
      const respuesta = await this.pedir(msEspera);
      this.ultimaLectura.set(new Date().toTimeString().slice(0, 5));
      if (!respuesta || !respuesta.asignaciones.length) {
        this.estado.set('sin-conexion');
        this.recibidas.set(0);
        return false;
      }
      this.estado.set('conectado');
      this.actualizadoEl.set(respuesta.actualizadoEl);
      this.recibidas.set(respuesta.asignaciones.length);
      return this.aplicar(respuesta.asignaciones);
    } catch {
      this.estado.set('sin-conexion');
      return false;
    }
  }

  /** Adopta lo recibido; si no cambió nada, no toca las señales y nadie recalcula de más. */
  private aplicar(lista: AsignacionSoporteCompartida[]): boolean {
    const cambio = this.soportes.adoptar(lista);
    if (cambio) this.cambios.update((n) => n + 1);
    return cambio;
  }

  /**
   * Se suscribe a todo lo que puede avisar de un cambio: el evento `storage` (otra pestaña del
   * mismo origen), el evento propio del ecosistema (esta misma pestaña), el aviso que empuja el
   * puente cuando la clave cambia en el otro origen, y el foco de la ventana —el caso real:
   * se edita en Controles Mensuales y se vuelve a esta pestaña—.
   */
  listenForDistributionChanges(alCambiar?: (motivo: string) => void): void {
    if (this.escuchando || typeof window === 'undefined') return;
    this.escuchando = true;
    const releer = (motivo: string) => {
      void this.refreshDistributionFromStorage().then((cambio) => { if (cambio) alCambiar?.(motivo); });
    };
    this.compartida.escuchar((motivo) => releer(motivo));
    window.addEventListener('message', (ev: MessageEvent) => {
      if (ev.origin !== this.origenControles) return;
      if ((ev.data ?? {}).tipo === 'sisgost:distribucion-cambiada') releer('puente');
    });
    // Volver a esta pestaña también se comprueba con `visibilitychange`: hay navegadores que no
    // emiten `focus` cuando se cambia de pestaña, solo al recuperar la ventana.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') releer('visibilidad');
    });
  }

  // ------------------------------------------------------------------ puente entre orígenes

  /** Una consulta al iframe puente. Resuelve `null` si no contesta dentro del plazo. */
  private pedir(msEspera: number): Promise<{ asignaciones: AsignacionSoporteCompartida[]; actualizadoEl: string } | null> {
    const peticion = ++this.secuencia;
    return new Promise((resolve) => {
      let terminado = false;
      const cerrar = (valor: { asignaciones: AsignacionSoporteCompartida[]; actualizadoEl: string } | null) => {
        if (terminado) return;
        terminado = true;
        window.removeEventListener('message', escucha);
        clearTimeout(temporizador);
        resolve(valor);
      };
      const escucha = (ev: MessageEvent) => {
        if (ev.origin !== this.origenControles) return;
        const datos = ev.data ?? {};
        if (datos.tipo === 'sisgost:puente-distribucion-listo') { this.preguntar(peticion); return; }
        if (datos.tipo === 'sisgost:distribucion' && datos.peticion === peticion) {
          cerrar({
            asignaciones: Array.isArray(datos.asignaciones) ? datos.asignaciones : [],
            actualizadoEl: datos.actualizadoEl ?? ''
          });
        }
      };
      const temporizador = setTimeout(() => cerrar(null), msEspera);
      window.addEventListener('message', escucha);
      this.asegurarIframe();
      // Si el puente ya estaba cargado de una consulta anterior, no habrá «puente-listo».
      this.preguntar(peticion);
    });
  }

  private preguntar(peticion: number): void {
    this.iframe?.contentWindow?.postMessage({ tipo: 'sisgost:leer-distribucion', peticion }, this.origenControles);
  }

  /** Crea el iframe oculto la primera vez; después se reutiliza. */
  private asegurarIframe(): void {
    if (this.iframe?.isConnected) return;
    const marco = document.createElement('iframe');
    marco.src = `${this.origenControles}/puente-distribucion.html`;
    marco.setAttribute('aria-hidden', 'true');
    marco.setAttribute('title', 'Puente de la distribución de soportes de Controles Mensuales');
    marco.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(marco);
    this.iframe = marco;
  }
}
