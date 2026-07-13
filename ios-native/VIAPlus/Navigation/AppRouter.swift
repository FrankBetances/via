//
//  AppRouter.swift
//  VIA+ — Enrutado nativo.
//
//  Portado del patrón "auth flow" del RootStack de React Navigation:
//  antes de iniciar sesión el flujo es Bienvenida → Créditos → Selección de
//  profesional; al autenticar, la raíz pasa a Pacientes → Hub de módulos.
//  Un `NavigationStack` con `path` tipado reemplaza al stack navigator.
//

import SwiftUI

/// Rutas de la fase visual. Se irán añadiendo los módulos clínicos reales.
enum Route: Hashable {
    case credits
    case professionalSelection
    case patients
    case moduleHub
}

@MainActor
final class AppRouter: ObservableObject {
    /// Sesión abierta. Cambia la raíz mostrada (acceso ↔ trabajo clínico).
    @Published var isLogged = false
    /// Pila de navegación del grupo activo.
    @Published var path: [Route] = []
    /// Profesional autenticado (dispara el saludo en Pacientes).
    @Published var activeProfessional: Professional?

    func push(_ route: Route) { path.append(route) }

    func login(as professional: Professional) {
        activeProfessional = professional
        isLogged = true
        path = []
    }

    func logout() {
        activeProfessional = nil
        isLogged = false
        path = []
    }
}
