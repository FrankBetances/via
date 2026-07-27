//
//  NoiseDSP.swift
//  VIA+ — DSP puro del sonómetro ambiental.
//
//  Portado de `src/Screens/RoomNoiseCheck/noiseDsp.ts`. Se mantiene separado
//  del motor de captura (`NoiseMeter`, que sí toca AVAudioEngine) para poder
//  razonar sobre el cálculo con PCM sintético, igual que en la app RN.
//
//  Dos decisiones heredadas del RN, ambas contra las «mediciones al azar»:
//   · Nivel: promedio ENERGÉTICO (Leq) entre bloques, no el RMS de un bloque
//     suelto — con el logaritmo, un bloque de 100 ms salta varios dB aunque el
//     ruido de sala sea estable.
//   · Espectro: FFT real por bandas log de frecuencia, no la envolvente
//     temporal del bloque (que para ruido parece aleatoria).
//

import Foundation

enum NoiseDSP {
    /// Nº de barras del espectro que consume la UI.
    static let bands = 24

    /// Suelo/techo de la escala mostrada (dB, relativos).
    static let dbMin: Double = 28
    static let dbMax: Double = 92

    /// Referencia de calibración RELATIVA: dB «SPL» orientativo asignado a
    /// 0 dBFS (fondo de escala del micrófono). No es calibración absoluta —el
    /// micrófono del dispositivo no está caracterizado— pero fija una escala
    /// ESTABLE y reproducible. Ajuste este único valor si dispone de un
    /// sonómetro de referencia para anclar la lectura.
    static let splAtFullScale: Double = 92

    /// Suelo de energía (evita log(0) en silencio digital).
    private static let minMeanSquare: Double = 1e-12

    static func clamp(_ v: Double, _ lo: Double, _ hi: Double) -> Double {
        min(max(v, lo), hi)
    }

    /// Energía media (mean square) de un bloque PCM.
    static func meanSquare(_ pcm: [Float]) -> Double {
        guard !pcm.isEmpty else { return 0 }
        var sum = 0.0
        for sample in pcm {
            let x = Double(sample)
            sum += x * x
        }
        return sum / Double(pcm.count)
    }

    /// Promedio energético exponencial (Leq): mezcla la energía nueva con la
    /// acumulada en el dominio de POTENCIA (promediar dB directamente
    /// subestima el nivel). Con bloques de ~100 ms, `alpha ≈ 0.12` da una
    /// constante de tiempo ≈0.8 s (respuesta «slow» de un sonómetro).
    static func updateLeqMeanSquare(previous: Double?, block: Double, alpha: Double) -> Double {
        guard let previous, previous > 0 else { return block }
        return previous * (1 - alpha) + block * alpha
    }

    /// Energía media (mean square) → dB «SPL» orientativo, acotado a la escala.
    static func meanSquareToSpl(_ ms: Double) -> Double {
        let dbfs = 10 * log10(max(minMeanSquare, ms)) // 10·log10(potencia) = 20·log10(rms)
        return clamp(splAtFullScale + dbfs, dbMin, dbMax)
    }

    /// Fracción 0..1 de un dB dentro de la escala (para el anillo del gauge).
    static func splFraction(_ db: Double) -> Double {
        clamp((db - dbMin) / (dbMax - dbMin), 0, 1)
    }

    // MARK: - FFT radix-2

    private static func nextPow2Floor(_ n: Int) -> Int {
        var p = 1
        while p * 2 <= n { p *= 2 }
        return p
    }

    /// FFT compleja in-place (Cooley-Tukey iterativa). `re.count` potencia de 2.
    private static func fftInPlace(_ re: inout [Double], _ im: inout [Double]) {
        let n = re.count
        var j = 0
        for i in 1..<n {
            var bit = n >> 1
            while j & bit != 0 {
                j ^= bit
                bit >>= 1
            }
            j ^= bit
            if i < j {
                re.swapAt(i, j)
                im.swapAt(i, j)
            }
        }
        var len = 2
        while len <= n {
            let ang = -2 * Double.pi / Double(len)
            let wr = cos(ang)
            let wi = sin(ang)
            let half = len >> 1
            var i = 0
            while i < n {
                var cwr = 1.0
                var cwi = 0.0
                for k in 0..<half {
                    let a = i + k
                    let b = a + half
                    let vr = re[b] * cwr - im[b] * cwi
                    let vi = re[b] * cwi + im[b] * cwr
                    re[b] = re[a] - vr
                    im[b] = im[a] - vi
                    re[a] += vr
                    im[a] += vi
                    let nwr = cwr * wr - cwi * wi
                    cwi = cwr * wi + cwi * wr
                    cwr = nwr
                }
                i += len
            }
            len <<= 1
        }
    }

    /// Espectro de magnitud por bandas LOG de frecuencia (0..1) de un bloque
    /// PCM: ventana de Hann + FFT, agrupando en `bandCount` bandas
    /// log-espaciadas (≈80 Hz → Nyquist·0.9). Un tono a frecuencia f produce
    /// un pico en SU banda y no en las demás.
    static func spectrumBands(_ pcm: [Float], sampleRate: Double, bandCount: Int = bands) -> [Double] {
        let flat = [Double](repeating: 0, count: bandCount)
        let n = nextPow2Floor(pcm.count)
        guard n >= 8 else { return flat }

        var re = [Double](repeating: 0, count: n)
        var im = [Double](repeating: 0, count: n)
        // Ventana de Hann (reduce la fuga espectral).
        for i in 0..<n {
            let w = 0.5 - 0.5 * cos(2 * Double.pi * Double(i) / Double(n - 1))
            re[i] = Double(pcm[i]) * w
        }
        fftInPlace(&re, &im)

        let half = n >> 1
        let binHz = sampleRate / Double(n)
        let fLow = 80.0
        let fHigh = min(sampleRate * 0.45, 16000)
        guard fHigh > fLow, binHz > 0 else { return flat }
        let logLo = log(fLow)
        let logHi = log(fHigh)

        var out = [Double](repeating: 0, count: bandCount)
        for band in 0..<bandCount {
            let f0 = exp(logLo + (logHi - logLo) * Double(band) / Double(bandCount))
            let f1 = exp(logLo + (logHi - logLo) * Double(band + 1) / Double(bandCount))
            let k0 = max(1, Int(floor(f0 / binHz)))
            let k1 = min(half, max(k0 + 1, Int(ceil(f1 / binHz))))
            guard k0 < k1 else { continue }
            var power = 0.0
            for k in k0..<k1 {
                // Magnitud normalizada por N (independiente del tamaño de ventana).
                let mr = re[k] / Double(n)
                let mi = im[k] / Double(n)
                power += mr * mr + mi * mi
            }
            let rms = sqrt(power / Double(k1 - k0)) * 2 // ×2: espectro unilateral
            // Nivel log a 0..1: −60 dB → 0, 0 dB → 1 (pendiente del gauge).
            let db = 20 * log10(max(1e-6, rms))
            out[band] = clamp((db + 60) / 60, 0.04, 1)
        }
        return out
    }

    /// Suaviza las barras del espectro entre frames (evita parpadeo).
    static func smoothBands(previous: [Double]?, next: [Double], alpha: Double = 0.5) -> [Double] {
        guard let previous, previous.count == next.count else { return next }
        return zip(previous, next).map { $0 * (1 - alpha) + $1 * alpha }
    }
}
