//
//  VIAPlusApp.swift
//  VIA+ — Valoración Interactiva de Audición y Lenguaje
//
//  Punto de entrada @main de la app nativa SwiftUI.
//  Port nativo enfocado en iteración visual y distribución vía
//  Firebase App Distribution.
//

import SwiftUI
import FirebaseCore

/// AppDelegate mínimo únicamente para arrancar Firebase en el momento
/// correcto del ciclo de vida. Se mantiene deliberadamente ligero:
/// la arquitectura profunda no es el objetivo de esta fase.
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        FirebaseBootstrap.configureIfPossible()
        return true
    }
}

@main
struct VIAPlusApp: App {
    // Conecta el AppDelegate para la inicialización de Firebase.
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

/// Arranque defensivo de Firebase.
///
/// `FirebaseApp.configure()` aborta la app si no encuentra un
/// `GoogleService-Info.plist` válido en el bundle. Como el plist se
/// añadirá manualmente más tarde, aquí sólo configuramos si el archivo
/// está presente. Así la app sigue siendo ejecutable para iterar sobre
/// las pantallas sin bloquear la compilación ni el arranque.
enum FirebaseBootstrap {
    static func configureIfPossible() {
        guard Bundle.main.url(forResource: "GoogleService-Info", withExtension: "plist") != nil else {
            #if DEBUG
            print("[VIA+] GoogleService-Info.plist ausente — Firebase NO inicializado. " +
                  "Añádelo al target para habilitar App Distribution / Analytics.")
            #endif
            return
        }
        FirebaseApp.configure()
        #if DEBUG
        print("[VIA+] Firebase inicializado correctamente.")
        #endif
    }
}
