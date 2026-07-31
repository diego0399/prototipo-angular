import { Injectable, computed, signal } from '@angular/core';
import { UsuarioSistema } from '../models/models';

const STORAGE_KEY = 'sisgost.sesion';

/**
 * Sesión simulada de SISGOST. Solo los roles operativos inician sesión:
 * Encargado/Técnico de Soporte, Encargado/Técnico de Hardware y Administrador.
 * Dirección y Usuario Final NO tienen acceso: participan solo como datos del proceso.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly usuario = signal<UsuarioSistema | null>(this.leerSesion());

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

  private leerSesion(): UsuarioSistema | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as UsuarioSistema) : null;
    } catch {
      return null;
    }
  }

  login(u: UsuarioSistema): void {
    this.usuario.set(u);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  }

  logout(): void {
    this.usuario.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }
}
