//
//  ClinicalAssessmentView.swift
//  VIA+ — Evaluación Clínica Previa (CAP).
//
//  Portada de ClinicalAssessmentScreen (RN). Prerrequisito entre el
//  consentimiento y las pruebas: certifica las condiciones MÍNIMAS de
//  viabilidad en 4 dominios (otoscopia, capacidad visual, verbal y motora) y
//  deriva qué juegos quedan habilitados. La lógica vive en
//  `ClinicalAssessmentLogic.swift`; aquí solo la interfaz.
//
//  Al confirmar se navega al sonómetro (verificación de sala), igual que el
//  RN. La persistencia real (tabla clinical_assessment) se conecta más tarde.
//

import SwiftUI

/// Dominios del certificado (pestañas del selector).
private enum CAPDomain: String, CaseIterable, Identifiable {
    case otoscopia, visual, verbal, motor

    var id: String { rawValue }

    var short: String {
        switch self {
        case .otoscopia: return "Otoscopia"
        case .visual: return "Visual"
        case .verbal: return "Verbal"
        case .motor: return "Motora"
        }
    }

    /// Etiqueta del resultado por dominio del perfil de aptitud.
    var resultLabel: String {
        self == .otoscopia ? "Otoscopia" : "Capacidad \(short.lowercased())"
    }

    var icon: String {
        switch self {
        case .otoscopia: return "ear.fill"
        case .visual: return "eye.fill"
        case .verbal: return "message.fill"
        case .motor: return "hand.point.up.left.fill"
        }
    }
}

struct ClinicalAssessmentView: View {
    @EnvironmentObject private var router: AppRouter

    @State private var activeDomain: CAPDomain = .otoscopia
    @State private var state = ClinicalAssessmentState()
    @State private var visualNotes = ""
    @State private var verbalNotes = ""
    @State private var motorNotes = ""
    @State private var otoscopyNotes = ""
    @State private var evaluatorName = ""
    @State private var evaluatorLicense = ""
    @State private var didInit = false

    private var analysis: ClinicalAnalysis { analyzeClinicalAssessment(state) }

    private func kind(of domain: CAPDomain) -> DomainKind {
        switch domain {
        case .otoscopia: return analysis.otoKind
        case .visual: return analysis.visKind
        case .verbal: return analysis.verKind
        case .motor: return analysis.motKind
        }
    }

    private var confirmReady: Bool {
        !evaluatorName.trimmingCharacters(in: .whitespaces).isEmpty
            && !evaluatorLicense.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private var patientLine: String {
        guard let patient = router.activePatient else {
            return "Certificado de Aptitud para la Prueba · condiciones mínimas de viabilidad"
        }
        return patient.nhc.isEmpty ? patient.fullName : "\(patient.fullName) · NHC \(patient.nhc)"
    }

    var body: some View {
        ZStack {
            VIA.creamDeep.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    dysphagiaShortcut
                    domainSelector

                    switch activeDomain {
                    case .otoscopia: otoscopyCard
                    case .visual: visualCard
                    case .verbal: verbalCard
                    case .motor: motorCard
                    }

                    aptitudeCard
                    evaluatorCard
                }
                .padding(.horizontal, 24)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            guard !didInit else { return }
            didInit = true
            // Grupo verbal sugerido por la edad y evaluador precargado con el
            // profesional de la sesión (réplica del RN).
            state.ageGroup = AgeGroup.suggested(forAgeYears: PatientDOB.ageYears(router.activePatient?.dob))
            evaluatorName = router.activeProfessional?.fullName ?? ""
            evaluatorLicense = router.activeProfessional?.licenseNumber ?? ""
        }
    }

    // MARK: - Cabecera

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Text("Evaluación Clínica Previa")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(VIA.ink)
                Text("PRERREQUISITO · CAP")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(0.4)
                    .foregroundStyle(Color(hex: "#9A3412"))
                    .padding(.horizontal, 8).padding(.vertical, 2)
                    .background(VIA.accent.opacity(0.14))
                    .clipShape(Capsule())
            }
            Text(patientLine)
                .font(.system(size: 12))
                .foregroundStyle(VIA.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 8)
    }

    /// La exploración de disfagia no requiere CAP ni sonómetro.
    private var dysphagiaShortcut: some View {
        Button {
            // El módulo de disfagia aún no está portado: se aterriza en el hub.
            router.path = [.moduleHub]
        } label: {
            HStack(spacing: 6) {
                Text("💧").font(.system(size: 13))
                Text("¿Solo disfagia? Ir directo — no requiere CAP ni sonómetro")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color(hex: "#0369A1"))
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 11)
            .background(Color(hex: "#F0F9FF"))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color(hex: "#BAE6FD"), lineWidth: 1.5))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Selector de dominios

    private var domainSelector: some View {
        HStack(spacing: 8) {
            ForEach(CAPDomain.allCases) { domain in
                let active = activeDomain == domain
                Button { activeDomain = domain } label: {
                    VStack(spacing: 5) {
                        Image(systemName: domain.icon)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(active ? VIA.accent : VIA.placeholder)
                        Text(domain.short)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(active ? Color(hex: "#C2410C") : VIA.muted)
                        Circle().fill(kind(of: domain).dot).frame(width: 7, height: 7)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(active ? VIA.accent.opacity(0.10) : VIA.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(active ? VIA.accent.opacity(0.55) : Color(hex: "#EFEBE2"), lineWidth: 1.5))
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Dominio 1 · Otoscopia

    private var otoscopyCard: some View {
        card {
            domainTitle("Otoscopia", kind: analysis.otoKind)
            Text("Seleccione el hallazgo de cada oído. A realizar por médico/ORL o enfermería con formación en otoscopia.")
                .font(.system(size: 12))
                .foregroundStyle(VIA.muted)
                .fixedSize(horizontal: false, vertical: true)

            earBlock(title: "Oído derecho · OD",
                     finding: $state.od, notes: $state.odNotes)
            earBlock(title: "Oído izquierdo · OI",
                     finding: $state.oi, notes: $state.oiNotes)

            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "info.circle.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(VIA.accent)
                Text("Cerumen oclusivo, OMA y perforación bloquean la audiometría tonal de ese oído. Ref.: protocolo de audiometría pediátrica del SNS · guías CODEPEH.")
                    .font(.system(size: 10))
                    .foregroundStyle(Color(hex: "#7C5B33"))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(12)
            .background(VIA.accent.opacity(0.07))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

            notesField(title: "Observaciones de la otoscopia", text: $otoscopyNotes)
        }
    }

    private func earBlock(title: String, finding: Binding<EarFinding?>, notes: Binding<String>) -> some View {
        let severityKind: DomainKind = {
            switch earSeverity(finding.wrappedValue) {
            case 0: return .pending
            case 1: return .ok
            case 2: return .warn
            default: return .block
            }
        }()

        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(VIA.inkSoft)
                Spacer(minLength: 0)
                StatusChip(kind: severityKind)
            }

            FlexibleWrap(EarFinding.allCases, spacing: 7) { option in
                let selected = finding.wrappedValue == option
                Button { finding.wrappedValue = option } label: {
                    Text(option.rawValue)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(selected ? .white : Color(hex: "#6E6759"))
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(selected ? option.kind.dot : VIA.surface)
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(selected ? option.kind.dot : Color(hex: "#E9E2D5"), lineWidth: 1.5))
                }
                .buttonStyle(.plain)
            }

            TextField("Observaciones libres…", text: notes)
                .font(.system(size: 14))
                .foregroundStyle(VIA.inkSoft)
                .viaInput()
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(hex: "#FBF9F4"))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
            .stroke(Color(hex: "#EFEBE2"), lineWidth: 1))
    }

    // MARK: - Dominio 2 · Visual

    private var visualCard: some View {
        card {
            domainTitle("Capacidad visual mínima", kind: analysis.visKind)
            Text("El niño debe distinguir estímulos de ≥5 cm en pantalla a 30–50 cm. Evaluación funcional mínima, no examen oftalmológico.")
                .font(.system(size: 12))
                .foregroundStyle(VIA.muted)
                .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: 0) {
                ForEach(CAPItems.visual) { item in
                    ItemRow(item: item, value: state.visual[item.id]) { answer in
                        state.visual[item.id] = answer
                    }
                }
            }

            notesField(title: "Observaciones del dominio", text: $visualNotes)

            footnote("Si V-02 o V-03 son «No» se bloquean las pruebas visuales. No se registran datos de agudeza visual.")
        }
    }

    // MARK: - Dominio 3 · Verbal

    private var verbalCard: some View {
        card {
            domainTitle("Capacidad verbal mínima", kind: analysis.verKind)
            Text("Comprensión de instrucciones sencillas y/o respuesta vocal o gestual. El criterio se adapta al rango de edad.")
                .font(.system(size: 12))
                .foregroundStyle(VIA.muted)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 8) {
                Text("Grupo de edad")
                    .font(.system(size: 10))
                    .foregroundStyle(VIA.muted)
                ForEach(AgeGroup.allCases) { group in
                    let selected = state.ageGroup == group
                    Button {
                        // Cambiar de grupo reinicia las respuestas verbales.
                        state.ageGroup = group
                        state.verbal = [:]
                    } label: {
                        Text(group.rawValue)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(selected ? .white : VIA.placeholder)
                            .padding(.horizontal, 14).padding(.vertical, 5)
                            .background(selected ? VIA.accent : VIA.surface)
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(selected ? VIA.accent : Color(hex: "#E9E2D5"), lineWidth: 1.5))
                    }
                    .buttonStyle(.plain)
                }
            }

            Text(state.ageGroup.label)
                .font(.system(size: 10))
                .foregroundStyle(VIA.placeholder)

            VStack(spacing: 0) {
                ForEach(state.ageGroup.items) { item in
                    ItemRow(item: item, value: state.verbal[item.id]) { answer in
                        state.verbal[item.id] = answer
                    }
                }
            }

            notesField(title: "Observaciones del dominio", text: $verbalNotes)

            footnote("Si <50% de los ítems son «Sí», se bloquean las pruebas con producción verbal. La discriminación auditiva pasiva permanece activa.")
        }
    }

    // MARK: - Dominio 4 · Motora

    private var motorCard: some View {
        card {
            domainTitle("Capacidad motora mínima", kind: analysis.motKind)
            Text("El niño debe interactuar con la pantalla táctil con al menos un dedo de forma intencional y reproducible.")
                .font(.system(size: 12))
                .foregroundStyle(VIA.muted)
                .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: 0) {
                ForEach(CAPItems.motor) { item in
                    ItemRow(item: item, value: state.motor[item.id]) { answer in
                        state.motor[item.id] = answer
                    }
                }
            }

            notesField(title: "Observaciones del dominio", text: $motorNotes)

            footnote("M-01 «No» bloquea todas las pruebas interactivas. M-03 «No» bloquea solo las pruebas con arrastre.")
        }
    }

    // MARK: - Perfil de aptitud

    private var aptitudeCard: some View {
        let result = analysis
        return card {
            HStack(spacing: 8) {
                Image(systemName: "checkmark.shield.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(VIA.accent)
                Text("PERFIL DE APTITUD")
                    .font(.system(size: 12, weight: .bold))
                    .tracking(0.4)
                    .foregroundStyle(VIA.inkSoft)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text("RESULTADO GLOBAL")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(0.4)
                    .foregroundStyle(result.globalKind.fg)
                Text(result.globalLabel)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(result.globalKind.fg)
                Text(result.globalDesc)
                    .font(.system(size: 12))
                    .foregroundStyle(result.globalKind.fg.opacity(0.95))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(result.globalKind.bg)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

            Text("RESULTADO POR DOMINIO")
                .font(.system(size: 9, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(VIA.placeholder)

            VStack(spacing: 0) {
                ForEach(CAPDomain.allCases) { domain in
                    HStack {
                        Circle().fill(kind(of: domain).dot).frame(width: 8, height: 8)
                        Text(domain.resultLabel)
                            .font(.system(size: 13))
                            .foregroundStyle(Color(hex: "#5A544B"))
                        Spacer(minLength: 0)
                        StatusChip(kind: kind(of: domain))
                    }
                    .padding(.vertical, 8)
                    Divider().background(Color(hex: "#F1ECE2"))
                }
            }

            HStack {
                Text("Pruebas de la sesión")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(VIA.inkSoft)
                Spacer(minLength: 0)
                Text("\(result.activeCount)/\(result.totalGames)")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color(hex: "#9A3412"))
                    .padding(.horizontal, 10).padding(.vertical, 3)
                    .background(VIA.accent.opacity(0.14))
                    .clipShape(Capsule())
            }

            VStack(spacing: 6) {
                ForEach(result.games) { game in
                    HStack(spacing: 10) {
                        Image(systemName: game.active ? "checkmark" : "xmark")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(game.active ? Color(hex: "#15803D") : Color(hex: "#EF4444"))
                            .frame(width: 28, height: 28)
                            .background(game.active ? Color(hex: "#F0FDF4") : Color(hex: "#FEE2E2"))
                            .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                        VStack(alignment: .leading, spacing: 1) {
                            HStack(spacing: 5) {
                                Text(game.code)
                                    .font(.system(size: 10))
                                    .foregroundStyle(VIA.placeholder)
                                Text(game.title)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(VIA.inkSoft)
                            }
                            Text(game.reason)
                                .font(.system(size: 10))
                                .foregroundStyle(game.active ? Color(hex: "#15803D") : VIA.muted)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(10)
                    .background(game.active ? Color(hex: "#FBF9F4") : Color(hex: "#FEF2F2"))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
        }
    }

    // MARK: - Evaluador y confirmación

    private var evaluatorCard: some View {
        card {
            Text("Evaluador responsable")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(VIA.inkSoft)

            HStack(alignment: .bottom, spacing: 10) {
                FormField(label: "Nombre", required: true, placeholder: "Nombre y apellidos", text: $evaluatorName)
                FormField(label: "Nº Colegiado", required: true, placeholder: "36/07894",
                          text: $evaluatorLicense, autocapitalization: .characters)
                    .frame(width: 120)
            }

            PrimaryButton(title: "Confirmar y generar CAP") { confirm() }
                .disabled(!confirmReady)
                .opacity(confirmReady ? 1 : 0.5)

            Text("Certifica únicamente las condiciones mínimas de viabilidad de la prueba. No constituye diagnóstico ni informe clínico.")
                .font(.system(size: 10))
                .foregroundStyle(VIA.placeholder)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Piezas comunes

    private func card<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 14, content: content)
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(VIA.surface)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    private func domainTitle(_ title: String, kind: DomainKind) -> some View {
        HStack {
            Text(title)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(VIA.ink)
            Spacer(minLength: 0)
            StatusChip(kind: kind)
        }
    }

    private func notesField(title: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title)
                .font(.system(size: 10))
                .foregroundStyle(VIA.muted)
            TextField("Anotaciones del profesional…", text: text, axis: .vertical)
                .font(.system(size: 14))
                .foregroundStyle(VIA.inkSoft)
                .lineLimit(2...4)
                .viaInput()
        }
    }

    private func footnote(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 10))
            .foregroundStyle(VIA.placeholder)
            .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - Acciones

    private func confirm() {
        guard confirmReady else { return }
        let result = analysis
        // Persistencia real (clinical_assessment) pendiente: por ahora el
        // resumen viaja en el router para el resto de la sesión.
        router.capSummary = CAPSummary(
            globalLabel: result.globalLabel,
            globalKind: result.globalKind,
            activeGames: result.activeCount,
            totalGames: result.totalGames,
            evaluatorName: evaluatorName.trimmingCharacters(in: .whitespaces),
            evaluatorLicense: evaluatorLicense.trimmingCharacters(in: .whitespaces),
            completedAt: Date()
        )
        // Tras el CAP debe verificarse la sala con el sonómetro ANTES de
        // acceder a la selección de pruebas (igual que en el RN).
        router.push(.roomNoiseCheck)
    }
}

// MARK: - Subcomponentes

/// Chip de estado de un dominio (réplica del `StatusChip` del RN).
private struct StatusChip: View {
    let kind: DomainKind

    var body: some View {
        Text(kind.label.uppercased())
            .font(.system(size: 9, weight: .bold))
            .tracking(0.3)
            .foregroundStyle(kind.fg)
            .padding(.horizontal, 10).padding(.vertical, 3)
            .background(kind.bg)
            .clipShape(Capsule())
    }
}

/// Fila de ítem: código, enunciado, aviso opcional y toggle Sí/No.
private struct ItemRow: View {
    let item: DomainItem
    let value: Bool?
    let onAnswer: (Bool) -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 10) {
                Text(item.code)
                    .font(.system(size: 9, weight: .semibold, design: .monospaced))
                    .foregroundStyle(VIA.muted)
                    .padding(.horizontal, 6).padding(.vertical, 3)
                    .background(Color(hex: "#F1ECE2"))
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    .padding(.top, 2)

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.label)
                        .font(.system(size: 13))
                        .foregroundStyle(Color(hex: "#5A544B"))
                        .fixedSize(horizontal: false, vertical: true)
                    if let note = item.note {
                        Text("⚠ \(note)")
                            .font(.system(size: 10))
                            .foregroundStyle(Color(hex: "#92400E"))
                    }
                }

                Spacer(minLength: 8)

                HStack(spacing: 8) {
                    answerButton(title: "Sí", answer: true, tint: Color(hex: "#16A34A"))
                    answerButton(title: "No", answer: false, tint: Color(hex: "#EF4444"))
                }
            }
            .padding(.vertical, 12)

            Divider().background(Color(hex: "#F1ECE2"))
        }
    }

    private func answerButton(title: String, answer: Bool, tint: Color) -> some View {
        let selected = value == answer
        return Button { onAnswer(answer) } label: {
            Text(title)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(selected ? .white : VIA.placeholder)
                .padding(.horizontal, 15).padding(.vertical, 6)
                .background(selected ? tint : VIA.surface)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(selected ? tint : Color(hex: "#E9E2D5"), lineWidth: 1.5))
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    let router = AppRouter()
    router.activePatient = SampleData.patients[0]
    router.activeProfessional = SampleData.professionals[0]
    return NavigationStack { ClinicalAssessmentView().environmentObject(router) }
}
