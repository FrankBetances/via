//
//  CreditsView.swift
//  VIA+ — Créditos.
//
//  Portada de CreditosScreen (RN): presentación del proyecto "Quisqueya
//  Habla", equipo, colaboradores y sellos regulatorios. El CTA "Comenzar"
//  continúa a la selección de profesional.
//

import SwiftUI

struct CreditsView: View {
    @EnvironmentObject private var router: AppRouter

    private let year = Calendar.current.component(.year, from: Date())

    var body: some View {
        ZStack {
            VIA.cream.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 22) {
                    // Emblema
                    ViaIcon(size: 92, variant: .color)
                        .padding(.top, 24)

                    Text("VIA+ · EVALUACIÓN DE AUDICIÓN Y LENGUAJE")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(1.0)
                        .foregroundStyle(VIA.muted)

                    VStack(spacing: 4) {
                        Text("PROYECTO")
                            .font(.system(size: 11, weight: .bold))
                            .tracking(2)
                            .foregroundStyle(VIA.accent)
                        (Text("Quisqueya ").foregroundColor(VIA.ink)
                         + Text("Habla").foregroundColor(VIA.accent))
                            .font(.system(size: 30, weight: .bold))
                        Text("Detección temprana en salud pediátrica")
                            .font(.system(size: 14))
                            .foregroundStyle(VIA.muted)
                    }
                    .padding(.bottom, 4)

                    creditSection(label: "DESARROLLADO POR") {
                        personRow(badge: "FB", name: "Dr. Frank Betances",
                                  role: "Dirección clínica e investigación 🩺")
                    }

                    creditSection(label: "EN COLABORACIÓN CON") {
                        VStack(spacing: 10) {
                            personRow(badge: "E", name: "Earlify Health",
                                      role: "Tecnología e ingeniería")
                            personRow(badge: "A", name: "ACOPROS",
                                      role: "Apoyo y alianza institucional")
                        }
                    }

                    // Sellos regulatorios
                    HStack(spacing: 8) {
                        sealChip("SaMD · Clase IIa")
                        sealChip("MDR 2017/745")
                    }
                    sealChip("Lugo · Galicia · \(year)")

                    PrimaryButton(title: "Comenzar") {
                        router.push(.professionalSelection)
                    }
                    .padding(.top, 8)
                    .padding(.horizontal, 8)
                    .padding(.bottom, 28)
                }
                .padding(.horizontal, 24)
            }
        }
        .navigationBarBackButtonHidden(false)
    }

    // MARK: - Piezas

    private func creditSection<Content: View>(label: String,
                                              @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(label)
                .font(.system(size: 11, weight: .bold))
                .tracking(1.4)
                .foregroundStyle(VIA.muted)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func personRow(badge: String, name: String, role: String) -> some View {
        HStack(spacing: 14) {
            Text(badge)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 46, height: 46)
                .background(VIA.brandGradient)
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(VIA.ink)
                Text(role)
                    .font(.system(size: 13))
                    .foregroundStyle(VIA.muted)
            }
            Spacer()
        }
        .padding(14)
        .background(VIA.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func sealChip(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(VIA.inkSoft)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(VIA.creamDeep)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(VIA.placeholder.opacity(0.5), lineWidth: 1))
    }
}

#Preview {
    NavigationStack { CreditsView().environmentObject(AppRouter()) }
}
