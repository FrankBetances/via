//
//  ModuleHubView.swift
//  VIA+ — Hub de ejercicios / módulos clínicos.
//
//  Portada de SeleccionEjerciciosScreen (RN): rejilla de módulos clínicos
//  seleccionables (voz, audición, lenguaje, deglución, cognición, conducta,
//  sueño). El CTA inicia la prueba o batería según la selección.
//

import SwiftUI

struct ModuleHubView: View {
    @EnvironmentObject private var router: AppRouter

    private let modules = SampleData.modules
    @State private var selected: Set<String> = []

    private var ctaLabel: String { selected.count > 1 ? "Iniciar batería" : "Iniciar prueba" }

    var body: some View {
        ZStack {
            VIA.creamDeep.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Batería de evaluación")
                            .font(.system(size: 26, weight: .bold))
                            .foregroundStyle(VIA.ink)
                        Text("Elige uno o varios módulos para este paciente")
                            .font(.system(size: 13))
                            .foregroundStyle(VIA.muted)
                    }
                    .padding(.top, 8)

                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 14),
                                        GridItem(.flexible(), spacing: 14)], spacing: 14) {
                        ForEach(modules) { module in
                            moduleCard(module)
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 120)
            }

            // Barra de acción fija
            VStack {
                Spacer()
                VStack(spacing: 8) {
                    if !selected.isEmpty {
                        Text("\(selected.count) módulo\(selected.count > 1 ? "s" : "") seleccionado\(selected.count > 1 ? "s" : "")")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(VIA.muted)
                    }
                    PrimaryButton(title: ctaLabel, systemIcon: "play.fill") {
                        // El arranque real de cada módulo se conecta más tarde.
                    }
                    .disabled(selected.isEmpty)
                    .opacity(selected.isEmpty ? 0.5 : 1)
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 20)
                .background(.ultraThinMaterial)
            }
        }
        .navigationTitle("Módulos")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func moduleCard(_ m: ClinicalModule) -> some View {
        let isOn = selected.contains(m.id)
        return Button {
            if isOn { selected.remove(m.id) } else { selected.insert(m.id) }
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Image(systemName: m.systemIcon)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(m.color)
                        .frame(width: 40, height: 40)
                        .background(m.soft)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    Spacer()
                    Image(systemName: isOn ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 20))
                        .foregroundStyle(isOn ? m.color : VIA.placeholder)
                }

                Text(m.tag)
                    .font(.system(size: 9, weight: .bold))
                    .tracking(0.8)
                    .foregroundStyle(m.color)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(m.soft)
                    .clipShape(Capsule())

                Text(m.title)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(VIA.ink)
                    .fixedSize(horizontal: false, vertical: true)

                Text(m.summary)
                    .font(.system(size: 11))
                    .foregroundStyle(VIA.muted)
                    .lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)

                Spacer(minLength: 0)

                HStack(spacing: 6) {
                    Label(m.duration, systemImage: "clock")
                    Text("·")
                    Text(m.ages)
                }
                .font(.system(size: 10))
                .foregroundStyle(VIA.muted)
                .lineLimit(1)
            }
            .padding(14)
            .frame(maxWidth: .infinity, minHeight: 190, alignment: .topLeading)
            .background(VIA.surface)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(isOn ? m.color : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(PressableButtonStyle())
    }
}

#Preview {
    NavigationStack { ModuleHubView().environmentObject(AppRouter()) }
}
