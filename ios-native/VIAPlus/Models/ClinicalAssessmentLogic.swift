//
//  ClinicalAssessmentLogic.swift
//  VIA+ — Lógica clínica pura del Certificado de Aptitud para la Prueba (CAP).
//
//  Portada 1:1 desde `src/Screens/ClinicalAssessment/clinicalAssessmentResult.ts`.
//  Sin dependencias de UI ni de BD: el CAP certifica las condiciones MÍNIMAS de
//  viabilidad de la prueba en 4 dominios (otoscopia, capacidad visual, verbal y
//  motora) y deriva qué juegos quedan habilitados o bloqueados en la sesión.
//  No es un diagnóstico clínico.
//

import SwiftUI

// MARK: - Estados de dominio

/// Semáforo de un dominio (y del veredicto global).
enum DomainKind: String {
    case pending, ok, warn, block

    /// Etiqueta del chip (réplica de `DOMAIN_LABELS`).
    var label: String {
        switch self {
        case .pending: return "Pendiente"
        case .ok: return "Apto"
        case .warn: return "Restricción"
        case .block: return "Bloqueo"
        }
    }

    /// Tinta del texto (equivalente nativo de los tokens `$success700`…).
    var fg: Color {
        switch self {
        case .pending: return VIA.muted
        case .ok: return Color(hex: "#15803D")
        case .warn: return Color(hex: "#92400E")
        case .block: return Color(hex: "#B91C1C")
        }
    }

    /// Fondo suave del chip / tarjeta de resultado.
    var bg: Color {
        switch self {
        case .pending: return Color(hex: "#EFEBE2")
        case .ok: return Color(hex: "#F0FDF4")
        case .warn: return Color(hex: "#FFFBEB")
        case .block: return Color(hex: "#FEF2F2")
        }
    }

    /// Punto de color del selector de dominios.
    var dot: Color {
        switch self {
        case .pending: return Color(hex: "#D6D0C4")
        case .ok: return Color(hex: "#16A34A")
        case .warn: return Color(hex: "#D97706")
        case .block: return Color(hex: "#EF4444")
        }
    }
}

/// Veredicto global del certificado.
enum GlobalResult { case full, partial, blocked }

// MARK: - Otoscopia

/// Hallazgos otoscópicos seleccionables por oído (`FINDING_OPTIONS`).
enum EarFinding: String, CaseIterable, Identifiable {
    case normal = "Normal"
    case cerumen = "Cerumen"
    case oma = "OMA"
    case ome = "OME"
    case perforacion = "Perforación"
    case dtt = "DTT"
    case otro = "Otro"

    var id: String { rawValue }

    /// Hallazgos que bloquean por completo la audiometría de ese oído.
    static let blocking: Set<EarFinding> = [.cerumen, .oma, .perforacion]

    /// 1 = normal · 2 = restricción (OME, DTT, Otro) · 3 = bloqueo.
    var severity: Int { self == .normal ? 1 : (EarFinding.blocking.contains(self) ? 3 : 2) }

    /// Semáforo del chip del hallazgo.
    var kind: DomainKind { severity == 1 ? .ok : (severity == 2 ? .warn : .block) }

    /// El oído sigue siendo utilizable para la audiometría.
    var usable: Bool { !EarFinding.blocking.contains(self) }
}

/// Severidad de un hallazgo posiblemente sin marcar (0 = pendiente).
func earSeverity(_ finding: EarFinding?) -> Int { finding?.severity ?? 0 }

/// Oído explorado y no bloqueado.
func earUsable(_ finding: EarFinding?) -> Bool { finding?.usable ?? false }

// MARK: - Ítems de los dominios

struct DomainItem: Identifiable {
    let id: String
    let code: String
    let label: String
    var note: String? = nil
}

enum CAPItems {
    static let visual: [DomainItem] = [
        DomainItem(id: "V01", code: "V-01", label: "Fija la mirada en la pantalla de la tablet"),
        DomainItem(id: "V02", code: "V-02", label: "Distingue entre al menos dos imágenes en pantalla"),
        DomainItem(id: "V03", code: "V-03", label: "Señala o toca un objeto indicado en la pantalla"),
        DomainItem(id: "V04", code: "V-04", label: "Sin nistagmo marcado ni desviación ocular severa"),
    ]

    static let motor: [DomainItem] = [
        DomainItem(id: "M01", code: "M-01", label: "Realiza un tap en un objetivo de ≥4 cm"),
        DomainItem(id: "M02", code: "M-02", label: "Hace tap en dos objetivos distintos (sin perseveración)"),
        DomainItem(id: "M03", code: "M-03", label: "Realiza un gesto de arrastre (drag) de ≥3 cm",
                   note: "Solo limita los juegos con arrastre"),
        DomainItem(id: "M04", code: "M-04", label: "Sin movimientos involuntarios severos que impidan el control"),
    ]

    static let visualKeys = visual.map(\.id)
    static let motorKeys = motor.map(\.id)
    static let verbalKeys = ["VB1", "VB2", "VB3"]
}

/// Rango de edad que adapta el criterio verbal.
enum AgeGroup: String, CaseIterable, Identifiable {
    case a = "A", b = "B", c = "C"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .a: return "Grupo A · 18 m – 2 a 11 m"
        case .b: return "Grupo B · 3 a – 4 a 11 m"
        case .c: return "Grupo C · 5 años y mayores"
        }
    }

    var items: [DomainItem] {
        switch self {
        case .a:
            return [
                DomainItem(id: "VB1", code: "VB-A-01", label: "Responde a su nombre cuando se le llama"),
                DomainItem(id: "VB2", code: "VB-A-02", label: "Señala o mira hacia una fuente sonora"),
                DomainItem(id: "VB3", code: "VB-A-03", label: "Comprende una instrucción simple (\"ven\", \"dame\")"),
            ]
        case .b:
            return [
                DomainItem(id: "VB1", code: "VB-B-01", label: "Comprende una instrucción de dos pasos"),
                DomainItem(id: "VB2", code: "VB-B-02", label: "Repite una sílaba o palabra simple a petición"),
                DomainItem(id: "VB3", code: "VB-B-03", label: "Responde verbalmente ante una pregunta simple"),
            ]
        case .c:
            return [
                DomainItem(id: "VB1", code: "VB-C-01", label: "Comprende las instrucciones tras una demostración"),
                DomainItem(id: "VB2", code: "VB-C-02", label: "Repite palabras bisílabas con claridad"),
                DomainItem(id: "VB3", code: "VB-C-03", label: "Mantiene la atención 2–3 min en una tarea"),
            ]
        }
    }

    /// Grupo sugerido a partir de la edad en años del paciente (nil → «B»).
    static func suggested(forAgeYears years: Int?) -> AgeGroup {
        guard let years else { return .b }
        if years < 3 { return .a }
        return years < 5 ? .b : .c
    }
}

// MARK: - Estado del formulario

/// Réplica de `ClinicalAssessmentState`. Una respuesta ausente en el
/// diccionario equivale al `null` del RN (ítem sin contestar).
struct ClinicalAssessmentState {
    var od: EarFinding?
    var oi: EarFinding?
    var odNotes = ""
    var oiNotes = ""
    var visual: [String: Bool] = [:]
    var verbal: [String: Bool] = [:]
    var motor: [String: Bool] = [:]
    var ageGroup: AgeGroup = .b
}

// MARK: - Análisis

/// Habilitación de un juego de la sesión.
struct GameGate: Identifiable {
    let code: String
    let title: String
    let active: Bool
    /// «Habilitado» o el motivo del bloqueo.
    let reason: String

    var id: String { code }
}

struct ClinicalAnalysis {
    let otoKind: DomainKind
    let visKind: DomainKind
    let verKind: DomainKind
    let motKind: DomainKind
    let anyEarOk: Bool
    let visualBlocked: Bool
    let verbalProdBlocked: Bool
    let motorAllBlocked: Bool
    let dragBlocked: Bool
    let games: [GameGate]
    let activeCount: Int
    let totalGames: Int
    let global: GlobalResult
    let globalLabel: String
    let globalDesc: String
    let globalKind: DomainKind
}

/// Núcleo de la lógica: estado → semáforo por dominio, gating de juegos y
/// veredicto global. Port literal de `analyzeClinicalAssessment`.
func analyzeClinicalAssessment(_ s: ClinicalAssessmentState) -> ClinicalAnalysis {
    func allAnswered(_ rec: [String: Bool], _ keys: [String]) -> Bool {
        keys.allSatisfy { rec[$0] != nil }
    }

    // --- Otoscopia ---
    let so = earSeverity(s.od)
    let si = earSeverity(s.oi)
    let otoKind: DomainKind = {
        if so == 0 && si == 0 { return .pending }
        if so >= 3 && si >= 3 { return .block }
        return (so >= 2 || si >= 2) ? .warn : .ok
    }()
    let anyEarOk = earUsable(s.od) || earUsable(s.oi)

    // --- Visual ---
    let vKeys = CAPItems.visualKeys
    let vAnswered = allAnswered(s.visual, vKeys)
    let visualBlocked = s.visual["V02"] == false || s.visual["V03"] == false
    let visKind: DomainKind = {
        if !vAnswered { return .pending }
        if visualBlocked { return .block }
        return vKeys.allSatisfy { s.visual[$0] == true } ? .ok : .warn
    }()

    // --- Verbal ---
    let vbKeys = CAPItems.verbalKeys
    let vbAnswered = allAnswered(s.verbal, vbKeys)
    let vbTrue = vbKeys.filter { s.verbal[$0] == true }.count
    let verbalProdBlocked = vbAnswered && Double(vbTrue) / 3.0 < 0.5
    let verKind: DomainKind = {
        if !vbAnswered { return .pending }
        if verbalProdBlocked { return .block }
        return vbTrue == 3 ? .ok : .warn
    }()

    // --- Motor ---
    let mKeys = CAPItems.motorKeys
    let mAnswered = allAnswered(s.motor, mKeys)
    let motorAllBlocked = s.motor["M01"] == false
    let dragBlocked = s.motor["M03"] == false
    let motKind: DomainKind = {
        if !mAnswered { return .pending }
        if motorAllBlocked { return .block }
        return mKeys.allSatisfy { s.motor[$0] == true } ? .ok : .warn
    }()

    // --- Gating de juegos ---
    let audioReason: String = {
        if motorAllBlocked { return "Sin interacción táctil (M-01)" }
        if !anyEarOk { return "Ambos oídos bloqueados" }
        return visualBlocked ? "Capacidad visual insuficiente" : ""
    }()

    let attentionReason: String = {
        if motorAllBlocked { return "Sin interacción táctil (M-01)" }
        if dragBlocked { return "Requiere arrastre (M-03)" }
        return visualBlocked ? "Capacidad visual insuficiente" : ""
    }()

    let imitationReason: String = {
        if motorAllBlocked { return "Sin interacción táctil (M-01)" }
        if !anyEarOk { return "Ambos oídos bloqueados" }
        return verbalProdBlocked ? "Producción verbal insuficiente" : ""
    }()

    let touchReason: String = {
        if motorAllBlocked { return "Sin interacción táctil (M-01)" }
        return visualBlocked ? "Capacidad visual insuficiente" : ""
    }()

    let definitions: [(code: String, title: String, reason: String)] = [
        ("J01", "Atención y Memoria", attentionReason),
        ("J02", "Detección de Sonidos", audioReason),
        ("J03", "Comprensión de Palabras", audioReason),
        ("J04", "Imitación Verbal", imitationReason),
        ("J05", "Toca Solo Si…", touchReason),
    ]

    let games = definitions.map {
        GameGate(code: $0.code, title: $0.title,
                 active: $0.reason.isEmpty,
                 reason: $0.reason.isEmpty ? "Habilitado" : $0.reason)
    }
    let activeCount = games.filter(\.active).count
    let totalGames = games.count

    let global: GlobalResult = activeCount == totalGames ? .full : (activeCount == 0 ? .blocked : .partial)
    let globalLabel: String
    let globalDesc: String
    let globalKind: DomainKind
    switch global {
    case .full:
        globalLabel = "APTO · COMPLETO"
        globalDesc = "Todas las pruebas habilitadas para esta sesión."
        globalKind = .ok
    case .partial:
        globalLabel = "APTO PARCIAL"
        globalDesc = "\(activeCount) de \(totalGames) pruebas habilitadas. Revise las restricciones antes de continuar."
        globalKind = .warn
    case .blocked:
        globalLabel = "NO APTO"
        globalDesc = "Ninguna prueba viable hoy. Registre observaciones y reprograme la sesión."
        globalKind = .block
    }

    return ClinicalAnalysis(
        otoKind: otoKind, visKind: visKind, verKind: verKind, motKind: motKind,
        anyEarOk: anyEarOk, visualBlocked: visualBlocked,
        verbalProdBlocked: verbalProdBlocked, motorAllBlocked: motorAllBlocked,
        dragBlocked: dragBlocked, games: games,
        activeCount: activeCount, totalGames: totalGames,
        global: global, globalLabel: globalLabel, globalDesc: globalDesc, globalKind: globalKind
    )
}

// MARK: - Resumen persistible

/// Lo mínimo del CAP que la sesión conserva (equivalente al registro
/// `clinical_assessment` del RN). La persistencia real se conecta más tarde.
struct CAPSummary {
    let globalLabel: String
    let globalKind: DomainKind
    let activeGames: Int
    let totalGames: Int
    let evaluatorName: String
    let evaluatorLicense: String
    let completedAt: Date
}
