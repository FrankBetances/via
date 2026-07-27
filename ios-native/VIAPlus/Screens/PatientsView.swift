//
//  PatientsView.swift
//  VIA+ — Lista de pacientes.
//
//  Portada de PacientesScreen (RN): cabecera con el profesional en sesión,
//  buscador y lista de pacientes. "Nuevo paciente" y seleccionar un paciente
//  llevan al hub de ejercicios. El botón de sesión permite cerrar sesión.
//

import SwiftUI

struct PatientsView: View {
    @EnvironmentObject private var router: AppRouter

    @State private var query = ""
    private var patients: [Patient] { router.patients }

    private var filtered: [Patient] {
        guard !query.isEmpty else { return patients }
        let q = query.lowercased()
        return patients.filter { $0.fullName.lowercased().contains(q) || $0.nhc.lowercased().contains(q) }
    }

    var body: some View {
        ZStack {
            VIA.creamDeep.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    newPatientCard

                    HStack {
                        Text("PACIENTES")
                            .font(.system(size: 12, weight: .bold))
                            .tracking(1.2)
                            .foregroundStyle(VIA.inkSoft)
                        Spacer()
                        Text("\(filtered.count)")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(VIA.muted)
                    }
                    .padding(.top, 4)

                    searchField

                    ForEach(filtered) { patient in
                        // Abrir un expediente arranca la cadena de prerrequisitos:
                        // consentimiento → CAP → sonómetro → pruebas.
                        Button { router.openRecord(for: patient) } label: { patientRow(patient) }
                            .buttonStyle(PressableButtonStyle())
                    }

                    Text("Los datos se almacenan cifrados en este dispositivo (GDPR/LOPDGDD).")
                        .font(.system(size: 11))
                        .foregroundStyle(VIA.muted)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 12)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
        }
        .navigationBarBackButtonHidden(true)
    }

    // MARK: - Cabecera

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Pacientes")
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(VIA.ink)
                Text("Selecciona o registra para evaluar")
                    .font(.system(size: 13))
                    .foregroundStyle(VIA.muted)
            }
            Spacer()
            if let pro = router.activeProfessional {
                HStack(spacing: 8) {
                    VStack(alignment: .trailing, spacing: 1) {
                        Text(pro.fullName)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(VIA.inkSoft)
                        Text(pro.role.label)
                            .font(.system(size: 11))
                            .foregroundStyle(VIA.muted)
                    }
                    Text(pro.initials)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 40, height: 40)
                        .background(VIA.brandGradient)
                        .clipShape(Circle())
                }
                .contextMenu {
                    Button(role: .destructive) { router.logout() } label: {
                        Label("Cerrar sesión", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
            }
        }
        .padding(.top, 8)
    }

    private var newPatientCard: some View {
        Button { router.push(.patientRegistration) } label: {
            HStack(spacing: 14) {
                Image(systemName: "person.badge.plus.fill")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 46, height: 46)
                    .background(VIA.brandGradient)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Nuevo paciente")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(VIA.ink)
                    Text("Alta rápida antes de iniciar la evaluación")
                        .font(.system(size: 12))
                        .foregroundStyle(VIA.muted)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(VIA.placeholder)
            }
            .padding(16)
            .background(VIA.surface)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(PressableButtonStyle())
    }

    private var searchField: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass").foregroundStyle(VIA.placeholder)
            TextField("Buscar por nombre o NHC…", text: $query)
                .font(.system(size: 15))
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .background(VIA.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func patientRow(_ p: Patient) -> some View {
        HStack(spacing: 12) {
            Text(String(p.fullName.prefix(1)))
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(VIA.inkSoft)
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text(p.fullName)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(VIA.ink)
                Text("\(p.nhc) · \(p.ageLabel)")
                    .font(.system(size: 12).monospacedDigit())
                    .foregroundStyle(VIA.muted)
            }
            Spacer()
            Text(p.status.label)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(p.status.tint)
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(p.status.soft)
                .clipShape(Capsule())
        }
        .padding(14)
        .background(VIA.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

#Preview {
    let r = AppRouter()
    r.activeProfessional = SampleData.professionals[0]
    return NavigationStack { PatientsView().environmentObject(r) }
}
