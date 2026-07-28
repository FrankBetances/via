//
//  ProfessionalRegistrationView.swift
//  VIA+ — Alta de profesional.
//
//  Portada de RegistroProfesionalScreen (RN): crea el perfil del evaluador
//  responsable del dispositivo (una sola vez). Nombre, rol, email y
//  contraseña (≥6) son obligatorios; colegiado y centro son opcionales.
//  Incluye la vista previa EN VIVO del perfil y, al guardar, abre sesión y
//  aterriza en Pacientes.
//

import SwiftUI

/// Rol tal como se ofrece en los chips (varias etiquetas mapean al mismo
/// `ProfessionalRole` del modelo, p. ej. Otorrino/Pediatra → medico).
private struct RoleOption: Identifiable {
    let label: String
    let emoji: String
    let role: ProfessionalRole
    var id: String { label }
}

private let roleOptions: [RoleOption] = [
    RoleOption(label: "Médico", emoji: "🩺", role: .medico),
    RoleOption(label: "Otorrino", emoji: "👂", role: .medico),
    RoleOption(label: "Logopeda", emoji: "🗣️", role: .logopeda),
    RoleOption(label: "Enfermería", emoji: "💉", role: .enfermero),
    RoleOption(label: "Médico A. Primaria", emoji: "🏥", role: .medico),
    RoleOption(label: "Pediatra", emoji: "🧸", role: .medico),
    RoleOption(label: "Psicopedagogo/a", emoji: "🧠", role: .psicopedagogo),
]

struct ProfessionalRegistrationView: View {
    @EnvironmentObject private var router: AppRouter

    @State private var name = ""
    @State private var roleLabel: String?
    @State private var email = ""
    @State private var password = ""
    @State private var license = ""
    // El campo «Servicio» se retiró del alta: no se persistía en el perfil ni
    // se enviaba a ningún sitio, solo alargaba el formulario.
    @State private var center = ""

    private var selectedRole: RoleOption? { roleOptions.first { $0.label == roleLabel } }

    // Validación (idéntica al RN).
    private var nameOk: Bool { !name.trimmingCharacters(in: .whitespaces).isEmpty }
    private var roleOk: Bool { roleLabel != nil }
    private var emailOk: Bool {
        email.trimmingCharacters(in: .whitespaces).range(of: #"^\S+@\S+\.\S+$"#, options: .regularExpression) != nil
    }
    private var passwordOk: Bool { password.count >= 6 }
    private var ready: Bool { nameOk && roleOk && emailOk && passwordOk }
    private var requiredCount: Int { [nameOk, roleOk, emailOk, passwordOk].filter { $0 }.count }

    private var previewInitials: String {
        let parts = name.split(whereSeparator: { $0.isWhitespace }).prefix(2)
        return parts.map { String($0.prefix(1)).uppercased() }.joined()
    }

    var body: some View {
        ZStack {
            VIA.creamDeep.ignoresSafeArea()
            decorativeBlobs

            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        header
                        previewCard
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

    // MARK: - Cabecera

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("PERFIL PROFESIONAL · UNA SOLA VEZ")
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .tracking(1.6)
                .foregroundStyle(Color(hex: "#B3A791"))
            Text("Crea tu perfil")
                .font(.system(size: 28, weight: .heavy))
                .foregroundStyle(VIA.inkSoft)
            Text("Responsable de las evaluaciones de este dispositivo")
                .font(.system(size: 13))
                .foregroundStyle(Color(hex: "#8A8274"))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Preview en vivo

    private var previewCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 7) {
                Circle().fill(VIA.accent).frame(width: 7, height: 7)
                Text("ASÍ SE VERÁ TU PERFIL")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .tracking(1.4)
                    .foregroundStyle(Color(hex: "#B3A791"))
            }
            HStack(spacing: 13) {
                ZStack {
                    Circle().stroke(VIA.accent, lineWidth: 2).frame(width: 56, height: 56)
                    Text(previewInitials.isEmpty ? "🧑‍⚕️" : previewInitials)
                        .font(.system(size: 16, weight: .heavy))
                        .foregroundStyle(.white)
                        .frame(width: 46, height: 46)
                        .background(VIA.accent)
                        .clipShape(Circle())
                }
                VStack(alignment: .leading, spacing: 5) {
                    Text(nameOk ? name.trimmingCharacters(in: .whitespaces) : "Tu nombre y apellidos")
                        .font(.system(size: 16, weight: nameOk ? .heavy : .semibold))
                        .foregroundStyle(nameOk ? .white : Color(hex: "#8A8274"))
                    HStack(spacing: 8) {
                        Text(selectedRole.map { "\($0.emoji) \($0.label)" } ?? "Elige tu rol")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(roleOk ? Color(hex: "#FFB566") : Color(hex: "#8A8274"))
                            .padding(.horizontal, 10).padding(.vertical, 3)
                            .background((roleOk ? VIA.accent.opacity(0.25) : Color.white.opacity(0.12)))
                            .clipShape(Capsule())
                        if !license.trimmingCharacters(in: .whitespaces).isEmpty {
                            Text("Col. \(license.trimmingCharacters(in: .whitespaces))")
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundStyle(Color(hex: "#B3A791"))
                        }
                    }
                }
                Spacer(minLength: 0)
            }
        }
        .padding(16)
        .background(VIA.inkSoft)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: .black.opacity(0.18), radius: 14, x: 0, y: 8)
    }

    // MARK: - Formulario

    private var formCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            FormField(label: "Nombre y apellidos", required: true,
                      placeholder: "Ej. Elena Ruiz Soto", text: $name)

            VStack(alignment: .leading, spacing: 8) {
                FieldLabel(text: "Rol profesional", required: true)
                FlowChips(options: roleOptions, selection: $roleLabel)
            }

            FormField(label: "Email", required: true, placeholder: "nombre@centro.es",
                      text: $email, keyboard: .emailAddress, autocapitalization: .never)

            FormField(label: "Contraseña", required: true, placeholder: "Mínimo 6 caracteres",
                      text: $password, secure: true, autocapitalization: .never)

            FormField(label: "Nº colegiado · opcional", placeholder: "28/1234", text: $license)

            FormField(label: "Centro de trabajo · opcional",
                      placeholder: "Hospital / Centro de salud", text: $center)

            HStack(alignment: .top, spacing: 9) {
                Text("💡").font(.system(size: 15))
                Text("Este registro se realiza una sola vez y crea tu cuenta segura. Después bastará con tocar tu perfil e introducir tu contraseña en la pantalla de acceso.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Color(hex: "#8A6A46"))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(12)
            .background(VIA.accent.opacity(0.07))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .padding(18)
        .background(VIA.surface)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(Color(hex: "#EFE8DB"), lineWidth: 1))
    }

    // MARK: - Footer

    private var footer: some View {
        VStack(spacing: 10) {
            HStack(spacing: 6) {
                progressSeg(nameOk)
                progressSeg(roleOk)
                progressSeg(emailOk)
                progressSeg(passwordOk)
                Text("\(requiredCount)/4 obligatorios")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color(hex: "#A89F93"))
                    .padding(.leading, 6)
            }
            PrimaryButton(title: "Guardar y continuar") {
                guard ready else { return }
                router.registerProfessional(
                    fullName: name.trimmingCharacters(in: .whitespaces),
                    role: selectedRole?.role ?? .medico,
                    email: email,
                    licenseNumber: license.trimmingCharacters(in: .whitespaces))
            }
            .disabled(!ready)
            .opacity(ready ? 1 : 0.5)
        }
        .padding(.horizontal, 24)
        .padding(.top, 10)
        .padding(.bottom, 26)
    }

    private func progressSeg(_ done: Bool) -> some View {
        RoundedRectangle(cornerRadius: 3)
            .fill(done ? VIA.accent : Color(hex: "#E5DECF"))
            .frame(height: 5)
            .frame(maxWidth: .infinity)
    }

    private var decorativeBlobs: some View {
        ZStack {
            Circle().fill(VIA.accent.opacity(0.18)).frame(width: 380, height: 380)
                .offset(x: 150, y: -260)
            Circle().fill(Color(hex: "#FFCC80").opacity(0.14)).frame(width: 360, height: 360)
                .offset(x: -150, y: 320)
        }
        .allowsHitTesting(false)
    }
}

/// Chips de rol con salto de línea (equivalente a flexWrap).
private struct FlowChips: View {
    let options: [RoleOption]
    @Binding var selection: String?

    var body: some View {
        FlexibleWrap(options) { opt in
            let selected = selection == opt.label
            Button { selection = opt.label } label: {
                HStack(spacing: 6) {
                    Text(opt.emoji).font(.system(size: 15))
                    Text(opt.label)
                        .font(.system(size: 12.5, weight: selected ? .heavy : .semibold))
                        .foregroundStyle(selected ? Color(hex: "#C2410C") : Color(hex: "#6E6759"))
                }
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(selected ? VIA.accent.opacity(0.08) : VIA.surface)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(selected ? VIA.accent : Color(hex: "#E9E2D5"), lineWidth: 1.5))
            }
            .buttonStyle(.plain)
        }
    }
}

#Preview {
    NavigationStack { ProfessionalRegistrationView().environmentObject(AppRouter()) }
}
