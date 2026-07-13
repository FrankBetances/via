//
//  ContentView.swift
//  VIA+ — Valoración Interactiva de Audición y Lenguaje
//
//  Pantalla raíz placeholder. Punto de partida para iterar la
//  usabilidad visual sobre dispositivos físicos.
//

import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "waveform.badge.mic")
                .font(.system(size: 64, weight: .regular))
                .foregroundStyle(.tint)

            Text("VIA+")
                .font(.largeTitle.bold())

            Text("Valoración Interactiva de Audición y Lenguaje")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
