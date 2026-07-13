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

/// Destino tras firmar el consentimiento (réplica del `next` del RN).
enum ConsentNext: Hashable { case cap, dysphagia }

/// Rutas de la fase visual. Se irán añadiendo los módulos clínicos reales.
enum Route: Hashable {
    case credits
    case professionalSelection
    case professionalRegistration
    case patients
    case patientRegistration
    case consent(ConsentNext)
    case moduleHub
}

/// Router + store compartido de la fase visual. Además de la navegación
/// mantiene las colecciones en memoria (profesionales y pacientes) para que
/// los formularios de alta sean funcionales dentro de la sesión. La
/// persistencia real (SQLite/Firebase) se conecta en una fase posterior.
@MainActor
final class AppRouter: ObservableObject {
    /// Sesión abierta. Cambia la raíz mostrada (acceso ↔ trabajo clínico).
    @Published var isLogged = false
    /// Pila de navegación del grupo activo.
    @Published var path: [Route] = []
    /// Profesional autenticado (dispara el saludo en Pacientes).
    @Published var activeProfessional: Professional?

    /// Perfiles dados de alta en este dispositivo.
    @Published var professionals: [Professional] = SampleData.professionals
    /// Pacientes registrados (los más recientes primero).
    @Published var patients: [Patient] = SampleData.patients
    /// Paciente en curso (contexto del consentimiento y las pruebas).
    @Published var activePatient: Patient?

    // MARK: - Navegación

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

    // MARK: - Altas

    /// Registra un profesional (o reutiliza uno existente con el mismo email)
    /// y abre sesión. Réplica del "una sola vez por dispositivo" del RN.
    func registerProfessional(fullName: String, role: ProfessionalRole,
                              email: String, licenseNumber: String) {
        let normalizedEmail = email.trimmingCharacters(in: .whitespaces).lowercased()
        if let existing = professionals.first(where: { $0.email.lowercased() == normalizedEmail }) {
            login(as: existing)
            return
        }
        let pro = Professional(fullName: fullName, email: normalizedEmail,
                               role: role, licenseNumber: licenseNumber)
        professionals.insert(pro, at: 0)
        login(as: pro)
    }

    /// Da de alta un paciente nuevo al principio de la lista.
    func registerPatient(_ patient: Patient) {
        patients.insert(patient, at: 0)
    }
}
