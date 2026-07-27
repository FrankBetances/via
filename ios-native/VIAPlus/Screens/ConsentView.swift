//
//  ConsentView.swift
//  VIA+ — Consentimiento informado (BLOQUEANTE).
//
//  Portada de ConsentimientoScreen (RN). Flujo: alta de paciente → AQUÍ →
//  pruebas. Reglas de firma según la edad del paciente:
//   · Menor de edad → firma padre/madre/tutor legal.
//   · Adulto        → firma el propio paciente, o un familiar/representante
//     si hay incapacidad para firmar (se registra el motivo).
//  Requiere leer la información, marcar las dos declaraciones y firmar en el
//  pad. La persistencia real (tabla informed_consent) se conecta más tarde.
//

import SwiftUI

/// Versión del texto legal mostrado (trazabilidad; portado del RN).
private let consentVersion = "1.0"

private let consentParagraphs = [
    "Se le propone realizar una evaluación de cribado de la audición, el habla, la voz y la deglución mediante la aplicación VIA+. La sesión incluye pruebas breves, no invasivas y sin riesgos conocidos: cuestionarios clínicos, audiometría de cribado, análisis acústico de la voz (con grabación de audio), exploración de la articulación y, si procede, exploración de la deglución.",
    "Los resultados tienen carácter de CRIBADO ORIENTATIVO: no constituyen por sí mismos un diagnóstico y pueden recomendar una valoración especializada posterior.",
    "Los datos y grabaciones se almacenan de forma local en este dispositivo, se utilizan únicamente para elaborar el informe clínico de esta evaluación y son tratados por el profesional responsable conforme a la normativa de protección de datos aplicable.",
    "La participación es voluntaria: puede negarse a realizar alguna prueba o retirar el consentimiento en cualquier momento sin perjuicio para la atención recibida.",
]

private let guardianRelations = ["Madre", "Padre", "Tutor/a legal"]

private let agreeItems = [
    "He leído y comprendido la información anterior y he podido resolver mis dudas con el profesional.",
    "Autorizo la realización de las pruebas y el registro de los datos y grabaciones necesarios para el informe clínico.",
]

enum SignerType: Hashable { case patient, guardian, family }

struct ConsentView: View {
    let next: ConsentNext
    @EnvironmentObject private var router: AppRouter

    @State private var signerType: SignerType = .guardian
    @State private var signerName = ""
    @State private var signerRelation = ""
    @State private var incapacityReason = ""
    @State private var agreed = [false, false]
    @State private var strokes: [[CGPoint]] = []
    @State private var didInit = false

    // Régimen de firma a partir de la edad del paciente activo.
    private var age: Int? { PatientDOB.ageYears(router.activePatient?.dob) }
    private var isMinor: Bool? { age.map { $0 < 18 } }

    private var signerOptions: [(type: SignerType, label: String)] {
        let guardian = (SignerType.guardian, "Padre/Madre/Tutor")
        let patient = (SignerType.patient, "El propio paciente")
        let family = (SignerType.family, "Familiar/representante")
        switch isMinor {
        case .some(true): return [guardian]
        case .some(false): return [patient, family]
        case .none: return [guardian, patient, family]
        }
    }

    private var needsRelation: Bool { signerType != .patient }
    private var needsReason: Bool { signerType == .family }
    private var hasSignature: Bool { strokes.contains { $0.count > 1 } }

    private var ready: Bool {
        !signerName.trimmingCharacters(in: .whitespaces).isEmpty
            && (!needsRelation || !signerRelation.trimmingCharacters(in: .whitespaces).isEmpty)
            && (!needsReason || !incapacityReason.trimmingCharacters(in: .whitespaces).isEmpty)
            && agreed.allSatisfy { $0 }
            && hasSignature
    }

    var body: some View {
        ZStack {
            VIA.creamDeep.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    stepper
                    infoCard
                    signerCard
                    signatureCard

                    PrimaryButton(title: next == .dysphagia ? "Firmar y continuar a disfagia"
                                                             : "Firmar y continuar al CAP") {
                        sign()
                    }
                    .disabled(!ready)
                    .opacity(ready ? 1 : 0.5)

                    Text("Sin consentimiento firmado no es posible iniciar las pruebas")
                        .font(.system(size: 11))
                        .foregroundStyle(VIA.muted)
                        .frame(maxWidth: .infinity)
                        .multilineTextAlignment(.center)
                        .padding(.bottom, 24)
                }
                .padding(.horizontal, 24)
                .padding(.top, 8)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            guard !didInit else { return }
            didInit = true
            // Firmante y nombre por defecto según edad.
            if isMinor == false {
                signerType = .patient
                signerName = router.activePatient?.fullName ?? ""
            } else {
                signerType = .guardian
            }
        }
    }

    // MARK: - Cabecera + stepper

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Text("Consentimiento informado")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(VIA.ink)
                Text("OBLIGATORIO")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(0.4)
                    .foregroundStyle(Color(hex: "#9A3412"))
                    .padding(.horizontal, 8).padding(.vertical, 2)
                    .background(VIA.accent.opacity(0.14))
                    .clipShape(Capsule())
            }
            Text(router.activePatient.map { "Paciente: \($0.fullName)" }
                 ?? "Debe firmarse antes de iniciar las pruebas")
                .font(.system(size: 12))
                .foregroundStyle(VIA.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 8)
    }

    private let steps: [(n: Int, label: String, done: Bool, active: Bool)] = [
        (1, "Paciente", true, false),
        (2, "Consent.", false, true),
        (3, "CAP", false, false),
        (4, "Sala", false, false),
        (5, "Pruebas", false, false),
    ]

    private var stepper: some View {
        HStack(spacing: 4) {
            ForEach(steps.indices, id: \.self) { idx in
                let step = steps[idx]
                HStack(spacing: 4) {
                    ZStack {
                        Circle()
                            .fill(step.active ? VIA.accent : (step.done ? Color(hex: "#059669") : VIA.surface))
                            .frame(width: 20, height: 20)
                        if !step.active && !step.done {
                            Circle().stroke(Color(hex: "#DDD6C9"), lineWidth: 1.5).frame(width: 20, height: 20)
                        }
                        if step.done {
                            Image(systemName: "checkmark").font(.system(size: 9, weight: .bold)).foregroundStyle(.white)
                        } else {
                            Text("\(step.n)")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(step.active ? .white : Color(hex: "#B8B2A7"))
                        }
                    }
                    Text(step.label)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(step.active ? VIA.inkSoft : Color(hex: "#B8B2A7"))
                }
                if idx < steps.count - 1 {
                    Rectangle().fill(Color(hex: "#E5DECF")).frame(height: 1).frame(maxWidth: .infinity)
                }
            }
        }
    }

    // MARK: - Información

    private var infoCard: some View {
        card {
            cardHeader(icon: "checkmark.shield.fill", tint: VIA.accent,
                       title: "Información de la evaluación",
                       subtitle: "Versión del documento \(consentVersion)")
            VStack(alignment: .leading, spacing: 8) {
                ForEach(consentParagraphs.indices, id: \.self) { i in
                    Text(consentParagraphs[i])
                        .font(.system(size: 12))
                        .foregroundStyle(Color(hex: "#5A544B"))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    // MARK: - Persona que firma

    private var signerCard: some View {
        card {
            cardHeader(icon: "person.2.fill", tint: VIA.accent,
                       title: "Persona que firma", subtitle: signerSubtitle)

            if signerOptions.count > 1 {
                HStack(spacing: 8) {
                    ForEach(signerOptions.indices, id: \.self) { idx in
                        let opt = signerOptions[idx]
                        let selected = signerType == opt.type
                        Button { setSignerMode(opt.type) } label: {
                            Text(opt.label)
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(selected ? Color(hex: "#C2410C") : Color(hex: "#B8B2A7"))
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 9).padding(.horizontal, 4)
                                .background(selected ? VIA.accent.opacity(0.10) : VIA.surface)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(selected ? VIA.accent : Color(hex: "#E9E2D5"), lineWidth: 1.5))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            if signerType == .family {
                Text("Firma en representación de un adulto que no puede hacerlo por sí mismo (p. ej., trastorno neurodegenerativo o incapacidad para firmar). Indique el motivo: quedará registrado en el consentimiento.")
                    .font(.system(size: 12))
                    .foregroundStyle(Color(hex: "#92400E"))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(12)
                    .background(Color(hex: "#FEF3C7"))
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }

            FormField(label: "Nombre y apellidos de quien firma",
                      placeholder: "Nombre completo", text: $signerName)

            if needsRelation {
                if signerType == .guardian {
                    VStack(alignment: .leading, spacing: 8) {
                        FieldLabel(text: "Relación con el paciente")
                        HStack(spacing: 8) {
                            ForEach(guardianRelations, id: \.self) { rel in
                                let selected = signerRelation == rel
                                Button { signerRelation = rel } label: {
                                    Text(rel)
                                        .font(.system(size: 12, weight: .bold))
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
                } else {
                    FormField(label: "Relación con el paciente",
                              placeholder: "Cónyuge, hijo/a, tutor/a…", text: $signerRelation)
                }
            }

            if needsReason {
                VStack(alignment: .leading, spacing: 7) {
                    FieldLabel(text: "Motivo por el que el paciente no firma")
                    TextField("P. ej., enfermedad de Alzheimer en fase moderada; incapacidad motora para firmar…",
                              text: $incapacityReason, axis: .vertical)
                        .font(.system(size: 15))
                        .foregroundStyle(VIA.inkSoft)
                        .lineLimit(2...4)
                        .viaInput()
                }
            }
        }
    }

    private var signerSubtitle: String {
        switch isMinor {
        case .some(true): return "Paciente menor de edad: firma su padre/madre o tutor legal"
        case .some(false): return "Paciente mayor de edad"
        case .none: return "No se pudo determinar la edad del paciente"
        }
    }

    // MARK: - Declaración y firma

    private var signatureCard: some View {
        card {
            Text("Declaración y firma")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(VIA.ink)

            VStack(spacing: 12) {
                ForEach(agreeItems.indices, id: \.self) { i in
                    Button { agreed[i].toggle() } label: {
                        HStack(alignment: .top, spacing: 10) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 7, style: .continuous)
                                    .fill(agreed[i] ? VIA.accent : VIA.surface)
                                    .frame(width: 22, height: 22)
                                RoundedRectangle(cornerRadius: 7, style: .continuous)
                                    .stroke(agreed[i] ? VIA.accent : Color(hex: "#DDD6C9"), lineWidth: 1.5)
                                    .frame(width: 22, height: 22)
                                if agreed[i] {
                                    Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(.white)
                                }
                            }
                            Text(agreeItems[i])
                                .font(.system(size: 12))
                                .foregroundStyle(Color(hex: "#5A544B"))
                                .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 0)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }

            FieldLabel(text: "Firma")
            SignaturePad(strokes: $strokes)
        }
    }

    // MARK: - Piezas de tarjeta

    private func card<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 14, content: content)
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(VIA.surface)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    private func cardHeader(icon: String, tint: Color, title: String, subtitle: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 40, height: 40)
                .background(tint.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 15, weight: .bold)).foregroundStyle(VIA.ink)
                Text(subtitle).font(.system(size: 11)).foregroundStyle(VIA.muted)
            }
            Spacer(minLength: 0)
        }
    }

    // MARK: - Acciones

    private func setSignerMode(_ type: SignerType) {
        signerType = type
        signerRelation = ""
        signerName = type == .patient ? (router.activePatient?.fullName ?? "") : ""
        if type == .patient { incapacityReason = "" }
    }

    private func sign() {
        guard ready else { return }
        // Persistencia real (informed_consent) pendiente; continúa a las pruebas.
        // Disfagia salta el CAP y el sonómetro (su módulo aún no está portado,
        // así que aterriza en el hub); el resto pasa por la Evaluación Clínica
        // Previa, que a su vez encadena el sonómetro de sala.
        router.path = next == .dysphagia ? [.moduleHub] : [.clinicalAssessment]
    }
}

#Preview {
    let r = AppRouter()
    r.activePatient = SampleData.patients[0]
    return NavigationStack { ConsentView(next: .cap).environmentObject(r) }
}
