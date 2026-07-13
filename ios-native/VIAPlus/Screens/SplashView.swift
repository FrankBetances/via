//
//  SplashView.swift
//  VIA+ — Splash.
//
//  Portado de SplashScreen (RN): fondo crema, isotipo e indicador de carga
//  mientras arranca la app. Aquí simula la inicialización (antes: DataSource
//  de TypeORM) con un breve retardo antes de mostrar Bienvenida.
//

import SwiftUI

struct SplashView: View {
    var onFinish: () -> Void

    @State private var pulse = false

    var body: some View {
        ZStack {
            VIA.cream.ignoresSafeArea()

            VStack(spacing: 20) {
                ViaIcon(size: 108, variant: .color)
                    .scaleEffect(pulse ? 1.04 : 0.96)
                    .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: pulse)

                Text("VIA+")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(VIA.ink)

                ProgressView()
                    .tint(VIA.accent)
                    .padding(.top, 4)
            }
        }
        .onAppear {
            pulse = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { onFinish() }
        }
    }
}

#Preview {
    SplashView(onFinish: {})
}
