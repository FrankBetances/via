//
//  NoiseMeter.swift
//  VIA+ — Motor de captura del sonómetro ambiental.
//
//  Equivalente nativo de `useNoiseMeter` + `noiseMicAdapter` (RN): la captura
//  real vive en `NoiseCapture` (AVAudioEngine, hilo de audio) y el estado
//  observable de la UI en `NoiseMeter`, que muestrea el nivel cada ~90 ms
//  igual que el `setInterval` del hook.
//
//  Regla clínica heredada del RN: NUNCA se simulan lecturas. Sin micrófono o
//  sin permiso, el medidor pasa a `.error` y no emite veredicto; una medición
//  sin muestras reales tampoco lo emite (evita un falso «SALA APTA»).
//

import AVFoundation
import Foundation

// MARK: - Fuente y veredictos

enum NoiseSource { case idle, mic, error }

/// Zona del nivel instantáneo mostrado en el anillo.
enum NoiseZone {
    case ok, warn, block

    var label: String {
        switch self {
        case .ok: return "SILENCIO ADECUADO"
        case .warn: return "RUIDO MODERADO"
        case .block: return "RUIDO ALTO"
        }
    }

    var hex: String {
        switch self {
        case .ok: return "#1E8049"
        case .warn: return "#E0760C"
        case .block: return "#E63535"
        }
    }
}

/// Veredicto de la medición de 5 s.
enum NoiseVerdict {
    case pending, ok, warn, block

    var kind: DomainKind {
        switch self {
        case .pending: return .pending
        case .ok: return .ok
        case .warn: return .warn
        case .block: return .block
        }
    }

    var title: String {
        switch self {
        case .pending: return "PENDIENTE"
        case .ok: return "SALA APTA"
        case .warn: return "RUIDO LIMÍTROFE"
        case .block: return "DEMASIADO RUIDO"
        }
    }

    var desc: String {
        switch self {
        case .pending: return "Active el micrófono y ejecute la prueba de ruido para verificar la sala."
        case .ok: return "El ruido de fondo está dentro del límite. Puede iniciar los ejercicios."
        case .warn: return "El nivel está cerca del umbral. Reduzca el ruido y vuelva a medir."
        case .block: return "El ruido de fondo invalidaría las pruebas auditivas. Acondicione la sala y repita."
        }
    }
}

/// Zona de un nivel frente al umbral (port de `zoneOf`).
func noiseZone(db: Double, threshold: Double) -> NoiseZone {
    if db <= threshold { return .ok }
    return db <= threshold + 10 ? .warn : .block
}

// MARK: - Captura (AVAudioEngine)

/// Error de captura con mensaje ya redactado para la UI.
struct NoiseCaptureError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

/// Captura del micrófono y cálculo del nivel/espectro en el hilo de audio.
/// El acceso al estado compartido se serializa con un candado: la UI lo lee
/// desde el hilo principal cada ~90 ms.
final class NoiseCapture {
    private let engine = AVAudioEngine()
    private let lock = NSLock()

    private var leqMeanSquare: Double?
    private var bands: [Double]?
    private var running = false

    /// Peso del bloque nuevo en el Leq (≈0.8 s de constante de tiempo).
    private let alpha = 0.12

    /// Red de seguridad: si el medidor se destruye sin llamar a `stop()`, el
    /// motor de audio y la sesión se liberan igualmente.
    deinit { stop() }

    /// Arranca sesión + motor. Lanza si el permiso está denegado o el motor falla.
    func start() throws {
        guard !running else { return }

        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .measurement, options: [])
            try session.setActive(true, options: [])
        } catch {
            throw NoiseCaptureError(message: "No se pudo activar la sesión de audio: \(error.localizedDescription)")
        }

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else {
            throw NoiseCaptureError(message: "El dispositivo no expone una entrada de audio válida.")
        }

        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 4096, format: format) { [weak self] buffer, _ in
            self?.process(buffer: buffer, sampleRate: format.sampleRate)
        }

        engine.prepare()
        do {
            try engine.start()
        } catch {
            input.removeTap(onBus: 0)
            throw NoiseCaptureError(message: "No se pudo iniciar el micrófono: \(error.localizedDescription)")
        }
        running = true
    }

    func stop() {
        guard running else { return }
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        running = false
        lock.lock()
        leqMeanSquare = nil
        bands = nil
        lock.unlock()
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }

    /// Último nivel en dB «SPL» orientativo; `nil` mientras no hay señal.
    func read() -> Double? {
        lock.lock()
        defer { lock.unlock() }
        guard let leqMeanSquare else { return nil }
        return NoiseDSP.meanSquareToSpl(leqMeanSquare)
    }

    /// Últimas bandas del espectro (0..1); `nil` mientras no hay señal.
    func spectrum() -> [Double]? {
        lock.lock()
        defer { lock.unlock() }
        return bands
    }

    private func process(buffer: AVAudioPCMBuffer, sampleRate: Double) {
        guard let channel = buffer.floatChannelData?[0] else { return }
        let frames = Int(buffer.frameLength)
        guard frames > 0 else { return }
        let pcm = Array(UnsafeBufferPointer(start: channel, count: frames))

        let blockMS = NoiseDSP.meanSquare(pcm)
        let spectrum = NoiseDSP.spectrumBands(pcm, sampleRate: sampleRate)

        lock.lock()
        leqMeanSquare = NoiseDSP.updateLeqMeanSquare(previous: leqMeanSquare, block: blockMS, alpha: alpha)
        bands = NoiseDSP.smoothBands(previous: bands, next: spectrum)
        lock.unlock()
    }
}

// MARK: - Estado observable

@MainActor
final class NoiseMeter: ObservableObject {
    /// Umbral de ruido apto en dB.
    let threshold: Double
    /// Duración de la medición en segundos.
    let testDurationSec: Int

    @Published private(set) var source: NoiseSource = .idle
    @Published private(set) var error: String?
    @Published private(set) var db: Double?
    @Published private(set) var levels: [Double]
    @Published private(set) var avg: Double?
    @Published private(set) var peak: Double?
    @Published private(set) var verdict: NoiseVerdict = .pending
    @Published private(set) var testing = false
    @Published private(set) var testProgress: Double = 0
    @Published private(set) var testRemaining = 0

    var running: Bool { source == .mic }
    var zone: NoiseZone { db.map { noiseZone(db: $0, threshold: threshold) } ?? .ok }

    private let capture = NoiseCapture()
    private let bars: Int
    /// Cadencia de muestreo de la UI (el Leq se promedia en la captura).
    private let interval: TimeInterval = 0.09

    private var timer: Timer?
    private var smoothed: Double?
    private var testActive = false
    private var testSamples: [Double] = []
    private var testPeak: Double = 0
    private var testStart = Date()
    private var warmupTask: Task<Void, Never>?

    /// `nonisolated` para poder construirlo desde el `init` de la vista
    /// (`@StateObject`), que no está aislado al actor principal.
    nonisolated init(threshold: Double = 45, testDurationSec: Int = 5, bars: Int = NoiseDSP.bands) {
        self.threshold = threshold
        self.testDurationSec = testDurationSec
        self.bars = bars
        self.levels = Array(repeating: 0.04, count: bars)
    }

    // MARK: - Control

    /// Pide permiso, arranca la captura y devuelve si quedó operativa.
    @discardableResult
    func start() async -> Bool {
        if source == .mic { return true } // ya activo; permite reintentar desde .error
        error = nil

        guard await requestPermission() else {
            fail(with: "Permiso de micrófono denegado. Actívelo en Ajustes ▸ VIA+ ▸ Micrófono.")
            return false
        }

        do {
            try capture.start()
        } catch {
            fail(with: (error as? NoiseCaptureError)?.message
                 ?? "No se pudo iniciar el micrófono. Compruebe el permiso.")
            return false
        }

        source = .mic
        startLoop()
        return true
    }

    func stop() {
        teardown()
        source = .idle
        error = nil
        db = nil
        levels = Array(repeating: 0.04, count: bars)
        avg = nil
        peak = nil
        verdict = .pending
        testing = false
        testProgress = 0
        testRemaining = 0
    }

    /// Arranca la medición; si el micrófono está apagado lo enciende y deja
    /// ~350 ms de calentamiento antes de empezar a acumular muestras.
    func runTest() {
        guard !testActive else { return }
        if source == .mic {
            beginTest()
            return
        }
        warmupTask?.cancel()
        warmupTask = Task { [weak self] in
            guard let self, await self.start() else { return }
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard !Task.isCancelled, self.source == .mic else { return }
            self.beginTest()
        }
    }

    // MARK: - Internos

    private func requestPermission() async -> Bool {
        if #available(iOS 17.0, *) {
            if AVAudioApplication.shared.recordPermission == .granted { return true }
            return await AVAudioApplication.requestRecordPermission()
        }
        let session = AVAudioSession.sharedInstance()
        if session.recordPermission == .granted { return true }
        return await withCheckedContinuation { continuation in
            session.requestRecordPermission { granted in continuation.resume(returning: granted) }
        }
    }

    private func fail(with message: String) {
        teardown()
        source = .error
        db = nil
        testing = false
        testProgress = 0
        testRemaining = 0
        error = message
    }

    private func startLoop() {
        guard timer == nil else { return }
        let timer = Timer(timeInterval: interval, repeats: true) { [weak self] scheduled in
            // Si el medidor ya no existe, el temporizador se retira solo.
            guard self != nil else { scheduled.invalidate(); return }
            Task { @MainActor [weak self] in self?.tick() }
        }
        RunLoop.main.add(timer, forMode: .common)
        self.timer = timer
    }

    private func teardown() {
        warmupTask?.cancel()
        warmupTask = nil
        timer?.invalidate()
        timer = nil
        capture.stop()
        smoothed = nil
        testActive = false
    }

    private func beginTest() {
        testSamples = []
        testPeak = 0
        testStart = Date()
        testActive = true
        testing = true
        error = nil
        verdict = .pending
        testRemaining = testDurationSec
        testProgress = 0
    }

    private func tick() {
        if let raw = capture.read() {
            // La captura ya entrega un nivel promediado energéticamente (Leq);
            // esta EMA ligera solo suaviza el refresco de la UI.
            let clamped = NoiseDSP.clamp(raw, NoiseDSP.dbMin, NoiseDSP.dbMax)
            smoothed = smoothed.map { $0 * 0.78 + clamped * 0.22 } ?? clamped
            if let value = smoothed {
                db = value
                levels = sampleSpectrum()
                if testActive {
                    testSamples.append(value)
                    testPeak = max(testPeak, value)
                }
            }
        }

        guard testActive else { return }
        let elapsed = Date().timeIntervalSince(testStart)
        let duration = Double(testDurationSec)
        testProgress = min(1, elapsed / duration)
        testRemaining = max(0, Int(ceil(duration - elapsed)))
        guard elapsed >= duration else { return }

        testActive = false
        finishTest()
    }

    private func finishTest() {
        // Sin ~1 s de señal real no hay veredicto: promediar 0 muestras daría
        // 0 dB y un falso «SALA APTA».
        let minSamples = max(5, Int(ceil(1.0 / interval)))
        if testSamples.count < minSamples {
            avg = nil
            peak = nil
            verdict = .pending
            error = "El micrófono no entregó señal durante la medición. Compruebe el permiso de micrófono y repita."
        } else {
            let mean = testSamples.reduce(0, +) / Double(testSamples.count)
            avg = mean
            peak = testPeak
            if mean <= threshold && testPeak <= threshold + 12 {
                verdict = .ok
            } else if mean <= threshold + 8 {
                verdict = .warn
            } else {
                verdict = .block
            }
        }
        testing = false
        testProgress = 1
    }

    /// Espectro REAL de la captura. Sin señal, barras planas al suelo: nunca se
    /// sintetizan valores (el `Math.random()` del RN se percibía como medición
    /// falsa y se eliminó allí también).
    private func sampleSpectrum() -> [Double] {
        guard source == .mic, let spectrum = capture.spectrum(), !spectrum.isEmpty else {
            return Array(repeating: 0.04, count: bars)
        }
        return (0..<bars).map { i in
            let idx = min(spectrum.count - 1, Int(Double(i) / Double(bars) * Double(spectrum.count)))
            return NoiseDSP.clamp(spectrum[idx], 0.04, 1)
        }
    }
}
