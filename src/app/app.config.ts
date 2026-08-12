import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners
} from '@angular/core';

import { provideHttpClient } from '@angular/common/http';

import {
  provideRouter,
  withComponentInputBinding,
  withHashLocation
} from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    // El token del formulario externo llega como input() del componente.
    // Hash routing permite que las rutas funcionen correctamente en GitHub Pages.
    provideRouter(
      routes,
      withComponentInputBinding(),
      withHashLocation()
    ),

    // HttpClient solo lee los JSON simulados de assets/data.
    provideHttpClient()
  ]
};