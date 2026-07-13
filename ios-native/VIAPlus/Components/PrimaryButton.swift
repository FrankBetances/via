//
//  PrimaryButton.swift
//  VIA+ — Botón primario reutilizable.
//
//  CTA de marca portado del estilo de los botones "Comenzar" / "Acceder"
//  de la app RN: cápsula con gradiente naranja, texto blanco y una flecha.
//

import SwiftUI

struct PrimaryButton: View {
    var title: String
    var systemIcon: String? = "arrow.right"
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Text(title)
                    .font(.system(size: 17, weight: .semibold))
                if let systemIcon {
                    Image(systemName: systemIcon)
                        .font(.system(size: 15, weight: .bold))
                }
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background(VIA.brandGradient)
            .clipShape(Capsule())
            .shadow(color: VIA.accentC.opacity(0.35), radius: 14, x: 0, y: 8)
        }
        .buttonStyle(PressableButtonStyle())
    }
}

/// Escala ligeramente al pulsar (feedback táctil como el `pressed` de RN).
struct PressableButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.92 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

#Preview {
    PrimaryButton(title: "Comenzar") {}
        .padding()
        .background(VIA.cream)
}
