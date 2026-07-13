//
//  PatientRegistrationView.swift
//  VIA+ — Alta de paciente.
//
//  Portada de RegistroPacienteScreen (RN): alta sociodemográfica de un
//  paciente para la sesión. Nombre, fecha de nacimiento (AAAA-MM-DD válida y
//  no futura), sexo y NHC son obligatorios. Al confirmar registra el paciente
//  y continúa (en el RN: al consentimiento informado; aquí, al hub de
//  módulos, pendiente de portar Consentimiento/CAP).
//

import SwiftUI

private struct SexOption: Identifiable {
    let value: String   // "F" | "M" | "O"
    let label: String
    var id: String { value }
}

private let sexOptions: [SexOption] = [
    SexOption(value: "F", label: "Femenino"),
    SexOption(value: "M", label: "Masculino"),
    SexOption(value: "O", label: "Otro"),
]

struct PatientRegistrationView: View {
    @EnvironmentObject private var router: AppRouter

    @State private var firstName = ""
    @State private var lastName = ""
    @State private var dob = ""
    @State private var sex: String?
    @State private var nhc = ""
    @State private var language = "Español"

    // Validación (portada del RN).
    private var dobValid: Bool { PatientDOB.isValid(dob) }
    private var ageLabel: String { dobValid ? PatientDOB.ageLabel(dob) : "—" }
    private var dobError: Bool { !dob.trimmingCharacters(in: .whitespaces).isEmpty && !dobValid }

    private var requiredCount: Int {
        var n = 0
        if !firstName.trimmingCharacters(in: .whitespaces).isEmpty { n += 1 }
        if dobValid { n += 1 }
        if sex != nil { n += 1 }
        if !nhc.trimmingCharacters(in: .whitespaces).isEmpty { n += 1 }
        return n
    }
    private var ready: Bool { requiredCount == 4 }

    var body: some View {
        ZStack {
            VIA.creamDeep.ignoresSafeArea()

            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        header
                        stepper
                        formCard
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 8)
                    .padding(.bottom, 24)
                }
                footer
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Cabecera + stepper

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Nuevo paciente")
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(VIA.ink)
            Text("Registro sociodemográfico para esta sesión")
                .font(.system(size: 12))
                .foregroundStyle(VIA.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 8)
    }

    private let steps: [(n: Int, label: String)] = [
        (1, "Paciente"), (2, "Consent."), (3, "CAP"), (4, "Sala"), (5, "Pruebas"),
    ]

    private var stepper: some View {
        HStack(spacing: 4) {
            ForEach(steps.indices, id: \.self) { idx in
                let step = steps[idx]
                let active = step.n == 1
                HStack(spacing: 4) {
                    Text("\(step.n)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(active ? .white : Color(hex: "#B8B2A7"))
                        .frame(width: 20, height: 20)
                        .background(active ? VIA.accent : VIA.surface)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(active ? Color.clear : Color(hex: "#DDD6C9"), lineWidth: 1.5))
                    Text(step.label)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(active ? VIA.inkSoft : Color(hex: "#B8B2A7"))
                }
                if idx < steps.count - 1 {
                    Rectangle().fill(Color(hex: "#E5DECF")).frame(height: 1).frame(maxWidth: .infinity)
                }
            }
        }
    }

    // MARK: - Formulario

    private var formCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Nombre + apellidos
            HStack(alignment: .top, spacing: 10) {
                FormField(label: "Nombre", placeholder: "Nombre", text: $firstName)
                FormField(label: "Apellidos", placeholder: "Apellidos", text: $lastName)
            }

            // Fecha de nacimiento + edad
            HStack(alignment: .top, spacing: 10) {
                FormField(label: "Fecha de nacimiento", placeholder: "AAAA-MM-DD",
                          text: $dob, keyboard: .numbersAndPunctuation,
                          autocapitalization: .never, monospaced: true, errorBorder: dobError)
                VStack(alignment: .leading, spacing: 7) {
                    FieldLabel(text: "Edad")
                    Text(ageLabel)
                        .font(.system(size: 15, design: .monospaced))
                        .foregroundStyle(VIA.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 14).padding(.vertical, 12)
                        .background(Color(hex: "#FAF7F1"))
                        .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous)
                            .stroke(Color(hex: "#EFE8DB"), lineWidth: 1))
                }
            }
            if dobError {
                Text("Introduce una fecha válida con formato AAAA-MM-DD (no futura).")
                    .font(.system(size: 11))
                    .foregroundStyle(Color(hex: "#DC2626"))
            }

            // Sexo
            VStack(alignment: .leading, spacing: 8) {
                FieldLabel(text: "Sexo")
                HStack(spacing: 8) {
                    ForEach(sexOptions) { opt in
                        let selected = sex == opt.value
                        Button { sex = opt.value } label: {
                            Text(opt.label)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(selected ? Color(hex: "#C2410C") : Color(hex: "#B8B2A7"))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 9)
                                .background(selected ? VIA.accent.opacity(0.10) : VIA.surface)
                                .clipShape(Capsule())
                                .overlay(Capsule().stroke(selected ? VIA.accent : Color(hex: "#E9E2D5"), lineWidth: 1.5))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            FormField(label: "Número de historia clínica (NHC)", placeholder: "PT-0000",
                      text: $nhc, autocapitalization: .characters, monospaced: true)

            FormField(label: "Lengua materna", placeholder: "Español", text: $language)
        }
        .padding(18)
        .background(VIA.surface)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    // MARK: - Footer

    private var footer: some View {
        VStack(spacing: 10) {
            Text("\(requiredCount)/4 campos obligatorios completados")
                .font(.system(size: 11))
                .foregroundStyle(VIA.muted)

            PrimaryButton(title: "Continuar al consentimiento") { submit(.cap) }
                .disabled(!ready)
                .opacity(ready ? 1 : 0.5)

            Button { submit(.dysphagia) } label: {
                HStack(spacing: 6) {
                    Text("💧")
                    Text("Ir directo a exploración de disfagia")
                        .font(.system(size: 14, weight: .bold))
                }
                .foregroundStyle(ready ? Color(hex: "#0E7490") : Color(hex: "#B8B2A7"))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(ready ? Color(hex: "#ECFEFF") : VIA.surface)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(ready ? Color(hex: "#A5F3FC") : Color(hex: "#E9E2D5"), lineWidth: 1.5))
            }
            .buttonStyle(.plain)
            .disabled(!ready)
            .opacity(ready ? 1 : 0.5)

            Text("La disfagia no requiere CAP ni sonómetro de sala (el consentimiento sí)")
                .font(.system(size: 11))
                .foregroundStyle(VIA.muted)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 24)
        .padding(.top, 10)
        .padding(.bottom, 26)
    }

    private func submit(_ next: ConsentNext) {
        guard ready else { return }
        let full = "\(firstName.trimmingCharacters(in: .whitespaces)) \(lastName.trimmingCharacters(in: .whitespaces))"
            .trimmingCharacters(in: .whitespaces)
        let patient = Patient(fullName: full,
                              nhc: nhc.trimmingCharacters(in: .whitespaces),
                              ageLabel: ageLabel,
                              status: .inProgress,
                              dob: dob.trimmingCharacters(in: .whitespaces),
                              sex: sex)
        router.registerPatient(patient)
        router.activePatient = patient
        // Consentimiento informado: paso bloqueante antes de las pruebas.
        router.push(.consent(next))
    }
}

/// Validación y cálculo de edad de la fecha de nacimiento (portado del RN).
enum PatientDOB {
    /// Válida: formato AAAA-MM-DD, fecha real (sin normalizaciones) y no futura.
    static func isValid(_ input: String) -> Bool {
        let value = input.trimmingCharacters(in: .whitespaces)
        guard value.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil else { return false }
        let parts = value.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return false }
        var comps = DateComponents()
        comps.year = parts[0]; comps.month = parts[1]; comps.day = parts[2]
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC") ?? .current
        guard let date = cal.date(from: comps) else { return false }
        // Rechaza normalizaciones tipo 2024-02-31 → 2024-03-02.
        let back = cal.dateComponents([.year, .month, .day], from: date)
        guard back.year == parts[0], back.month == parts[1], back.day == parts[2] else { return false }
        return date <= Date()
    }

    /// Años cumplidos a partir de AAAA-MM-DD; `nil` si no es interpretable.
    static func ageYears(_ input: String?) -> Int? {
        guard let input, isValid(input) else { return nil }
        let parts = input.trimmingCharacters(in: .whitespaces).split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var comps = DateComponents()
        comps.year = parts[0]; comps.month = parts[1]; comps.day = parts[2]
        let cal = Calendar(identifier: .gregorian)
        guard let dob = cal.date(from: comps) else { return nil }
        return cal.dateComponents([.year], from: dob, to: Date()).year
    }

    /// "N m" (meses) para menores de 2 años, "N a" (años) en adelante.
    static func ageLabel(_ input: String) -> String {
        let value = input.trimmingCharacters(in: .whitespaces)
        let parts = value.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return "—" }
        var comps = DateComponents()
        comps.year = parts[0]; comps.month = parts[1]; comps.day = parts[2]
        let cal = Calendar(identifier: .gregorian)
        guard let dob = cal.date(from: comps) else { return "—" }
        let diff = cal.dateComponents([.year, .month], from: dob, to: Date())
        let years = diff.year ?? 0
        let months = diff.month ?? 0
        if years < 2 { return "\(years * 12 + months) m" }
        return "\(years) a"
    }
}

#Preview {
    NavigationStack { PatientRegistrationView().environmentObject(AppRouter()) }
}
