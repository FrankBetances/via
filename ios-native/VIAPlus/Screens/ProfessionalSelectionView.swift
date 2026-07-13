//
//  ProfessionalSelectionView.swift
//  VIA+ — Selección de profesional.
//
//  Portada de SeleccionProfesionalScreen (RN): "¿Quién va a evaluar hoy?".
//  Tarjeta para registrar un nuevo profesional + lista de perfiles del
//  dispositivo. Tocar un perfil abre el modal de acceso; al confirmar se
//  inicia sesión y la raíz pasa a Pacientes.
//

import SwiftUI

struct ProfessionalSelectionView: View {
    @EnvironmentObject private var router: AppRouter

    private let professionals = SampleData.professionals
    @State private var authTarget: Professional?
    @State private var password = ""
    @State private var authError = false

    var body: some View {
        ZStack {
            VIA.creamDeep.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Hola de nuevo 👋")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(VIA.muted)
                        Text("¿Quién va a evaluar hoy?")
                            .font(.system(size: 26, weight: .bold))
                            .foregroundStyle(VIA.ink)
                        Text("Elige tu perfil y accede con tu contraseña")
                            .font(.system(size: 14))
                            .foregroundStyle(VIA.muted)
                    }
                    .padding(.top, 12)

                    // Registrar nuevo
                    Button {
                        // El alta real se conecta más tarde; de momento entra directo.
                        router.login(as: professionals.first ?? SampleData.professionals[0])
                    } label: {
                        HStack(spacing: 14) {
                            Text("+")
                                .font(.system(size: 26, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 46, height: 46)
                                .background(VIA.brandGradient)
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Registrar nuevo profesional")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(VIA.ink)
                                Text("Crea tu perfil una sola vez en este dispositivo")
                                    .font(.system(size: 12))
                                    .foregroundStyle(VIA.muted)
                            }
                            Spacer()
                            Text("🧑‍⚕️").font(.system(size: 26))
                        }
                        .padding(16)
                        .background(VIA.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .stroke(VIA.accent.opacity(0.35), style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
                        )
                    }
                    .buttonStyle(PressableButtonStyle())

                    Text("PERFILES EN ESTE DISPOSITIVO")
                        .font(.system(size: 11, weight: .bold))
                        .tracking(1.2)
                        .foregroundStyle(VIA.muted)
                        .padding(.top, 4)

                    ForEach(professionals) { pro in
                        Button { openAuth(pro) } label: { professionalCard(pro) }
                            .buttonStyle(PressableButtonStyle())
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $authTarget) { pro in authSheet(for: pro) }
    }

    // MARK: - Tarjeta de perfil

    private func professionalCard(_ pro: Professional) -> some View {
        HStack(spacing: 14) {
            Text(pro.initials)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 48, height: 48)
                .background(VIA.brandGradient)
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 4) {
                Text(pro.fullName)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(VIA.ink)
                HStack(spacing: 8) {
                    Text("\(pro.role.emoji) \(pro.role.label)")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(VIA.inkSoft)
                        .padding(.horizontal, 10).padding(.vertical, 4)
                        .background(VIA.creamDeep)
                        .clipShape(Capsule())
                    Text("Col. \(pro.licenseNumber)")
                        .font(.system(size: 12))
                        .foregroundStyle(VIA.muted)
                }
            }
            Spacer()
            Image(systemName: "arrow.right")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 32, height: 32)
                .background(VIA.accent)
                .clipShape(Circle())
        }
        .padding(14)
        .background(VIA.surface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    // MARK: - Modal de acceso

    private func authSheet(for pro: Professional) -> some View {
        VStack(spacing: 16) {
            Capsule().fill(VIA.placeholder.opacity(0.5)).frame(width: 40, height: 5).padding(.top, 10)
            Text(pro.initials)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 64, height: 64)
                .background(VIA.brandGradient)
                .clipShape(Circle())
                .padding(.top, 8)
            Text(pro.fullName).font(.system(size: 18, weight: .bold)).foregroundStyle(VIA.ink)
            Text(pro.email).font(.system(size: 13)).foregroundStyle(VIA.muted)

            SecureField("Contraseña", text: $password)
                .textInputAutocapitalization(.never)
                .padding(14)
                .background(VIA.creamDeep)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .padding(.horizontal, 24)
                .padding(.top, 8)

            if authError {
                Text("Contraseña incorrecta")
                    .font(.system(size: 13)).foregroundStyle(Color(hex: "#DC2626"))
            }

            PrimaryButton(title: "Acceder") {
                // Validación real pendiente; cualquier contraseña no vacía entra.
                if password.isEmpty { authError = true }
                else { router.login(as: pro) }
            }
            .padding(.horizontal, 24)

            Button("Cancelar") { authTarget = nil }
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(VIA.muted)
                .padding(.bottom, 20)
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.hidden)
        .background(VIA.cream)
    }

    private func openAuth(_ pro: Professional) {
        password = ""
        authError = false
        authTarget = pro
    }
}

#Preview {
    NavigationStack { ProfessionalSelectionView().environmentObject(AppRouter()) }
}
