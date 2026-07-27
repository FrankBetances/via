//
//  ContentView.swift
//  VIA+ — Raíz de la app.
//
//  Host del enrutado: muestra el splash al arrancar y luego el flujo según
//  la sesión. Antes de iniciar sesión: Bienvenida → Créditos → Selección de
//  profesional. Con sesión abierta: Pacientes → Consentimiento → CAP →
//  Sonómetro → Hub de módulos. Replica el patrón "auth flow" del RootStack de
//  React Navigation.
//

import SwiftUI

struct ContentView: View {
    @StateObject private var router = AppRouter()
    @State private var booted = false

    var body: some View {
        Group {
            if !booted {
                SplashView { booted = true }
            } else if router.isLogged {
                NavigationStack(path: $router.path) {
                    PatientsView()
                        .navigationDestination(for: Route.self, destination: destination)
                }
            } else {
                NavigationStack(path: $router.path) {
                    WelcomeView()
                        .navigationDestination(for: Route.self, destination: destination)
                }
            }
        }
        .environmentObject(router)
        .animation(.easeInOut, value: router.isLogged)
        .animation(.easeInOut, value: booted)
    }

    @ViewBuilder
    private func destination(for route: Route) -> some View {
        switch route {
        case .credits: CreditsView()
        case .professionalSelection: ProfessionalSelectionView()
        case .professionalRegistration: ProfessionalRegistrationView()
        case .patients: PatientsView()
        case .patientRegistration: PatientRegistrationView()
        case .consent(let next): ConsentView(next: next)
        case .clinicalAssessment: ClinicalAssessmentView()
        case .roomNoiseCheck: RoomNoiseCheckView()
        case .moduleHub: ModuleHubView()
        }
    }
}

#Preview {
    ContentView()
}
