//
//  WelcomeView.swift
//  VIA+ — Bienvenida.
//
//  Portada de BienvenidaScreen (RN): el relato "del ruido a la información".
//  La animación de partículas del original se sintetiza aquí con anillos
//  pulsantes y una onda senoidal bajo el isotipo — suficiente para validar
//  el tono visual en dispositivo sin el coste de reanimated.
//

import SwiftUI

struct WelcomeView: View {
    @EnvironmentObject private var router: AppRouter
    @State private var animate = false

    var body: some View {
        ZStack {
            VIA.cream.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Etapas del relato
                HStack {
                    stageLabel("VOZ CON RUIDO")
                    Spacer()
                    stageLabel("INFORMACIÓN CLÍNICA")
                }
                .padding(.horizontal, 8)
                .padding(.bottom, 28)

                // Isotipo con anillos
                ZStack {
                    ForEach(0..<2) { i in
                        Circle()
                            .stroke(VIA.accent.opacity(0.18), lineWidth: 2)
                            .frame(width: 150 + CGFloat(i) * 60, height: 150 + CGFloat(i) * 60)
                            .scaleEffect(animate ? 1.08 : 0.92)
                            .opacity(animate ? 0.2 : 0.6)
                            .animation(.easeInOut(duration: 1.8).repeatForever(autoreverses: true)
                                .delay(Double(i) * 0.3), value: animate)
                    }
                    ViaIcon(size: 128, variant: .color)
                        .offset(y: animate ? -6 : 6)
                        .animation(.easeInOut(duration: 2.2).repeatForever(autoreverses: true), value: animate)
                }
                .frame(height: 230)

                SineWave()
                    .stroke(VIA.accent.opacity(0.55), style: StrokeStyle(lineWidth: 3, lineCap: .round))
                    .frame(height: 40)
                    .padding(.horizontal, 40)
                    .padding(.top, 8)

                // Titular
                (Text("Del ruido a la ")
                    .foregroundColor(VIA.ink)
                 + Text("información")
                    .foregroundColor(VIA.accent))
                    .font(.system(size: 30, weight: .bold))
                    .multilineTextAlignment(.center)
                    .padding(.top, 36)
                    .padding(.horizontal, 24)

                Text("VIA+ procesa cada voz y la convierte en medidas clínicas objetivas.")
                    .font(.system(size: 15))
                    .foregroundStyle(VIA.muted)
                    .multilineTextAlignment(.center)
                    .padding(.top, 12)
                    .padding(.horizontal, 40)

                Spacer()

                PrimaryButton(title: "Comenzar") { router.push(.credits) }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 24)
            }
        }
        .onAppear { animate = true }
    }

    private func stageLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 10, weight: .bold))
            .tracking(1.2)
            .foregroundStyle(VIA.muted)
    }
}

/// Onda senoidal decorativa (la "señal ordenada").
struct SineWave: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let midY = rect.midY
        let amp = rect.height / 2.4
        let steps = 60
        for i in 0...steps {
            let x = rect.width * CGFloat(i) / CGFloat(steps)
            let y = midY - sin(CGFloat(i) / CGFloat(steps) * .pi * 4) * amp
            if i == 0 { path.move(to: CGPoint(x: x, y: y)) }
            else { path.addLine(to: CGPoint(x: x, y: y)) }
        }
        return path
    }
}

#Preview {
    WelcomeView().environmentObject(AppRouter())
}
