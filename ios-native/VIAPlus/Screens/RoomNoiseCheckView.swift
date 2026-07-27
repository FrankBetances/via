//
//  RoomNoiseCheckView.swift
//  VIA+ — Sonómetro ambiental (verificación de sala).
//
//  Portada de RoomNoiseCheckScreen (RN). Segundo prerrequisito: tras el CAP y
//  antes de la selección de pruebas, mide el ruido de fondo con el micrófono
//  del dispositivo y exige una checklist de acondicionamiento de la sala.
//
//  El gate es doble: veredicto de la medición == apta Y checklist completa.
//  No persiste resultado clínico (es un prerrequisito, no una prueba).
//

import SwiftUI

private let checklistItems = [
    "Puertas y ventanas cerradas",
    "Sin conversaciones ni personas ajenas a la prueba",
    "Climatización, ventiladores y equipos ruidosos apagados",
    "Móviles y notificaciones silenciados",
]

private let ringSize: CGFloat = 260
private let ringLineWidth: CGFloat = 16

struct RoomNoiseCheckView: View {
    /// Umbral de ruido apto en dB y duración de la medición (parámetros del RN).
    var threshold: Double = 45
    var testDurationSec: Int = 5

    @EnvironmentObject private var router: AppRouter
    @StateObject private var meter: NoiseMeter
    @State private var checked = Array(repeating: false, count: checklistItems.count)

    init(threshold: Double = 45, testDurationSec: Int = 5) {
        self.threshold = threshold
        self.testDurationSec = testDurationSec
        _meter = StateObject(wrappedValue: NoiseMeter(threshold: threshold, testDurationSec: testDurationSec))
    }

    private var allChecked: Bool { checked.allSatisfy { $0 } }
    private var canContinue: Bool { meter.verdict == .ok && allChecked }

    private var patientLine: String {
        guard let patient = router.activePatient else {
            return "Verificación de ruido ambiente antes de iniciar los ejercicios"
        }
        return patient.nhc.isEmpty ? patient.fullName : "\(patient.fullName) · NHC \(patient.nhc)"
    }

    private var sourceMeta: (kind: DomainKind, text: String) {
        switch meter.source {
        case .mic: return (.ok, "Micrófono en vivo")
        case .error: return (.block, "Micrófono no disponible")
        case .idle: return (.pending, "Micrófono inactivo")
        }
    }

    private var gate: (kind: DomainKind, text: String) {
        if canContinue { return (.ok, "TODO LISTO") }
        if meter.verdict != .ok { return (.pending, "FALTA MEDICIÓN") }
        return (.warn, "FALTAN CONDICIONES")
    }

    var body: some View {
        ZStack {
            VIA.creamDeep.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    gaugeCard
                    statsRow
                    if meter.testing { measurementProgress }
                    controls
                    if let error = meter.error { errorCard(error) }
                    verdictCard
                    checklistCard
                    gateCard
                }
                .padding(.horizontal, 24)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear { meter.stop() }
    }

    // MARK: - Cabecera

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Text("Sonómetro Ambiental")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(VIA.ink)
                Text("PRERREQUISITO · SALA")
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

    // MARK: - Gauge

    private var gaugeCard: some View {
        let db = meter.db
        let zoneColor = db == nil ? Color(hex: "#C9C2B6") : Color(hex: meter.zone.hex)
        let fraction = db.map { NoiseDSP.splFraction($0) } ?? 0
        let reading = db.map { "\(Int($0.rounded()))" } ?? "--"

        return card {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Nivel de ruido ambiente")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(VIA.ink)
                    Text("Mantenga la sala en silencio durante la medición")
                        .font(.system(size: 10))
                        .foregroundStyle(VIA.muted)
                }
                Spacer(minLength: 8)
                Text(sourceMeta.text)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(sourceMeta.kind.fg)
                    .padding(.horizontal, 10).padding(.vertical, 3)
                    .background(sourceMeta.kind.bg)
                    .clipShape(Capsule())
            }

            ZStack {
                Circle()
                    .stroke(Color(hex: "#F0EBE2"), lineWidth: ringLineWidth)
                Circle()
                    .trim(from: 0, to: fraction)
                    .stroke(zoneColor, style: StrokeStyle(lineWidth: ringLineWidth, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.easeOut(duration: 0.18), value: fraction)

                VStack(spacing: 2) {
                    HStack(alignment: .lastTextBaseline, spacing: 4) {
                        Text(reading)
                            .font(.system(size: 64, weight: .heavy))
                            .monospacedDigit()
                            .foregroundStyle(zoneColor)
                        Text("dB")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(VIA.placeholder)
                    }
                    Text(db == nil ? "MICRÓFONO INACTIVO" : meter.zone.label)
                        .font(.system(size: 12, weight: .bold))
                        .tracking(0.6)
                        .foregroundStyle(db == nil ? Color(hex: "#B0A89C") : zoneColor)
                }
            }
            .frame(width: ringSize, height: ringSize)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)

            // Espectro por bandas (FFT real; barras planas si no hay señal).
            HStack(alignment: .bottom, spacing: 4) {
                ForEach(meter.levels.indices, id: \.self) { i in
                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .fill(meter.running ? VIA.accent : Color(hex: "#E7E0D4"))
                        .frame(height: max(3, meter.levels[i] * 56))
                        .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 56, alignment: .bottom)
        }
    }

    // MARK: - Estadísticas y progreso

    private var statsRow: some View {
        HStack(spacing: 10) {
            statCard(label: "PROMEDIO \(testDurationSec) s", value: format(meter.avg), tint: VIA.ink)
            statCard(label: "PICO MÁX.", value: format(meter.peak), tint: VIA.ink)
            statCard(label: "UMBRAL APTO", value: "≤ \(Int(threshold))", tint: VIA.accent)
        }
    }

    private func statCard(label: String, value: String, tint: Color) -> some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.system(size: 9))
                .tracking(0.4)
                .foregroundStyle(VIA.placeholder)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text(value)
                .font(.system(size: 20, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(tint)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(VIA.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var measurementProgress: some View {
        VStack(spacing: 6) {
            HStack {
                Text("Midiendo ruido ambiente…")
                    .font(.system(size: 10))
                    .foregroundStyle(VIA.muted)
                Spacer(minLength: 0)
                Text("\(meter.testRemaining) s")
                    .font(.system(size: 10))
                    .monospacedDigit()
                    .foregroundStyle(VIA.muted)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color(hex: "#E7E0D4"))
                    Capsule().fill(VIA.accent)
                        .frame(width: geo.size.width * meter.testProgress)
                }
            }
            .frame(height: 8)
        }
    }

    // MARK: - Controles

    private var controls: some View {
        HStack(spacing: 10) {
            Button {
                if meter.running {
                    meter.stop()
                } else {
                    Task { await meter.start() }
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: meter.running ? "stop.fill" : "mic.fill")
                        .font(.system(size: 13, weight: .bold))
                    Text(meter.running ? "Detener" : "Activar micrófono")
                        .font(.system(size: 14, weight: .bold))
                }
                .foregroundStyle(meter.running ? Color(hex: "#EF4444") : VIA.accent)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(VIA.surface)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(meter.running ? Color(hex: "#EF4444") : VIA.accent, lineWidth: 1.5))
            }
            .buttonStyle(PressableButtonStyle())

            Button {
                meter.runTest()
            } label: {
                Text(measureLabel)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(VIA.brandGradient)
                    .clipShape(Capsule())
            }
            .buttonStyle(PressableButtonStyle())
            .disabled(meter.testing)
            .opacity(meter.testing ? 0.6 : 1)
        }
    }

    private var measureLabel: String {
        if meter.testing { return "Midiendo…" }
        return meter.verdict != .pending ? "Repetir medición" : "Medir \(testDurationSec) s"
    }

    private func errorCard(_ message: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 14))
                .foregroundStyle(Color(hex: "#DC2626"))
            VStack(alignment: .leading, spacing: 2) {
                Text("No se pudo medir")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color(hex: "#B91C1C"))
                Text(message)
                    .font(.system(size: 12))
                    .foregroundStyle(Color(hex: "#B91C1C"))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .background(Color(hex: "#FEF2F2"))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous)
            .stroke(Color(hex: "#FECACA"), lineWidth: 1))
    }

    // MARK: - Veredicto, checklist y gate

    private var verdictCard: some View {
        let kind = meter.verdict.kind
        return VStack(alignment: .leading, spacing: 3) {
            Text("CONDICIÓN ACÚSTICA")
                .font(.system(size: 9, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(kind.fg)
            Text(meter.verdict.title)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(kind.fg)
            Text(meter.verdict.desc)
                .font(.system(size: 12))
                .foregroundStyle(kind.fg.opacity(0.95))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(kind.bg)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private var checklistCard: some View {
        card {
            HStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(VIA.accent)
                Text("Condiciones de la sala")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(VIA.inkSoft)
            }

            VStack(spacing: 10) {
                ForEach(checklistItems.indices, id: \.self) { i in
                    Button { checked[i].toggle() } label: {
                        HStack(spacing: 10) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 7, style: .continuous)
                                    .fill(checked[i] ? Color(hex: "#16A34A") : VIA.surface)
                                    .frame(width: 22, height: 22)
                                RoundedRectangle(cornerRadius: 7, style: .continuous)
                                    .stroke(checked[i] ? Color(hex: "#16A34A") : Color(hex: "#DDD6C9"), lineWidth: 1.5)
                                    .frame(width: 22, height: 22)
                                if checked[i] {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 11, weight: .bold))
                                        .foregroundStyle(.white)
                                }
                            }
                            Text(checklistItems[i])
                                .font(.system(size: 13, weight: checked[i] ? .semibold : .regular))
                                .foregroundStyle(checked[i] ? VIA.inkSoft : Color(hex: "#6E6759"))
                                .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 0)
                        }
                        .padding(12)
                        .background(checked[i] ? Color(hex: "#F0FDF4") : VIA.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous)
                            .stroke(checked[i] ? Color(hex: "#BBF7D0") : Color(hex: "#EFEBE2"), lineWidth: 1.5))
                    }
                    .buttonStyle(.plain)
                }
            }

            Text("Las pruebas de discriminación auditiva requieren ≤ \(Int(threshold)) dB de ruido de fondo. Estimación relativa del micrófono del dispositivo; no sustituye un sonómetro calibrado.")
                .font(.system(size: 10))
                .foregroundStyle(VIA.muted)
                .fixedSize(horizontal: false, vertical: true)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(hex: "#FBF9F4"))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }

    private var gateCard: some View {
        card {
            HStack {
                Text("Requisitos")
                    .font(.system(size: 10))
                    .foregroundStyle(VIA.muted)
                Spacer(minLength: 0)
                Text(gate.text)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(gate.kind.fg)
                    .padding(.horizontal, 10).padding(.vertical, 3)
                    .background(gate.kind.bg)
                    .clipShape(Capsule())
            }

            PrimaryButton(title: "Continuar a los ejercicios") { proceed() }
                .disabled(!canContinue)
                .opacity(canContinue ? 1 : 0.5)
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

    private func format(_ value: Double?) -> String {
        value.map { "\(Int($0.rounded()))" } ?? "—"
    }

    private func proceed() {
        guard canContinue else { return }
        meter.stop()
        // El sonómetro es un gate, no una prueba: no persiste resultado clínico.
        router.roomNoiseVerified = true
        router.push(.moduleHub)
    }
}

#Preview {
    let router = AppRouter()
    router.activePatient = SampleData.patients[0]
    return NavigationStack { RoomNoiseCheckView().environmentObject(router) }
}
