//
//  DomainModels.swift
//  VIA+ — Modelos de dominio para la capa visual.
//
//  Portados desde los modelos de la app RN (Professional, Patient) y el
//  catálogo de módulos clínicos de SeleccionEjercicios. En esta fase son
//  estructuras ligeras con datos de ejemplo; la persistencia real
//  (TypeORM/Firebase) se conecta en una fase posterior.
//

import SwiftUI

// MARK: - Profesional

enum ProfessionalRole: String, CaseIterable, Identifiable {
    case medico, logopeda, psicopedagogo, enfermero

    var id: String { rawValue }

    var label: String {
        switch self {
        case .medico: return "Médico"
        case .logopeda: return "Logopeda"
        case .psicopedagogo: return "Psicopedagogo/a"
        case .enfermero: return "Enfermería"
        }
    }

    var emoji: String {
        switch self {
        case .medico: return "🩺"
        case .logopeda: return "🗣️"
        case .psicopedagogo: return "🧠"
        case .enfermero: return "💉"
        }
    }
}

struct Professional: Identifiable {
    let id = UUID()
    var fullName: String
    var email: String
    var role: ProfessionalRole
    var licenseNumber: String

    /// Iniciales para el avatar (máx. 2 letras).
    var initials: String {
        let parts = fullName.split(separator: " ").prefix(2)
        return parts.map { String($0.prefix(1)) }.joined().uppercased()
    }
}

// MARK: - Paciente

enum PatientStatus {
    case pending, inProgress, done

    var label: String {
        switch self {
        case .pending: return "Pendiente"
        case .inProgress: return "En curso"
        case .done: return "Completado"
        }
    }

    var tint: Color {
        switch self {
        case .pending: return VIA.muted
        case .inProgress: return VIA.accent
        case .done: return Color(hex: "#059669")
        }
    }

    var soft: Color {
        switch self {
        case .pending: return Color(hex: "#EEEAE1")
        case .inProgress: return Color(hex: "#FFF1E2")
        case .done: return Color(hex: "#D1FAE5")
        }
    }
}

struct Patient: Identifiable {
    let id = UUID()
    var fullName: String
    var nhc: String
    var ageLabel: String
    var status: PatientStatus
    /// Fecha de nacimiento AAAA-MM-DD (para régimen de firma del consentimiento).
    var dob: String? = nil
    var sex: String? = nil
}

// MARK: - Módulo clínico (hub de ejercicios)

struct ClinicalModule: Identifiable {
    let id: String
    var title: String
    var summary: String
    var duration: String
    var ages: String
    var systemIcon: String
    var tag: String
    var color: Color
    var soft: Color
}

// MARK: - Datos de muestra (solo para iteración visual)

enum SampleData {
    static let professionals: [Professional] = [
        Professional(fullName: "Dr. Frank Betances", email: "frank@earlify.health",
                     role: .medico, licenseNumber: "36/07894"),
        Professional(fullName: "Lucía Fernández", email: "lucia.f@clinica.es",
                     role: .logopeda, licenseNumber: "LG-2231"),
    ]

    static let patients: [Patient] = [
        Patient(fullName: "Mateo R. G.", nhc: "NHC-004512", ageLabel: "4 a", status: .inProgress, dob: "2021-03-10", sex: "M"),
        Patient(fullName: "Sofía L. M.", nhc: "NHC-004498", ageLabel: "23 m", status: .pending, dob: "2023-08-02", sex: "F"),
        Patient(fullName: "Hugo P. S.", nhc: "NHC-004480", ageLabel: "6 a", status: .done, dob: "2019-06-21", sex: "M"),
        Patient(fullName: "Valentina C.", nhc: "NHC-004471", ageLabel: "3 a", status: .pending, dob: "2022-01-15", sex: "F"),
    ]

    /// Catálogo portado 1:1 desde SeleccionEjerciciosScreen (RN).
    static let modules: [ClinicalModule] = [
        ClinicalModule(id: "VoiceAnalysis", title: "Análisis Acústico de Voz",
                       summary: "Vocal sostenida /a/ · F0, jitter, shimmer, HNR.",
                       duration: "3–5 min", ages: "Todas las edades",
                       systemIcon: "mic.fill", tag: "VOZ",
                       color: Color(hex: "#7C3AED"), soft: Color(hex: "#F3E8FF")),
        ClinicalModule(id: "Audiometry", title: "Audiometría Infantil",
                       summary: "Audiometría tonal por juego (play audiometry).",
                       duration: "6–8 min", ages: "6 m – 5 a",
                       systemIcon: "headphones", tag: "AUDICIÓN",
                       color: Color(hex: "#0284C7"), soft: Color(hex: "#E0F2FE")),
        ClinicalModule(id: "AudiometryConditioned", title: "Audiometría Condicionada",
                       summary: "El Tren del Sonido · prueba automática con juego.",
                       duration: "8–10 min", ages: "2–6 a",
                       systemIcon: "tram.fill", tag: "AUDICIÓN",
                       color: Color(hex: "#0D9488"), soft: Color(hex: "#CCFBF1")),
        ClinicalModule(id: "VerbalAudiometry", title: "Audiometría Verbal",
                       summary: "Reconocimiento de palabras por tarjetas · campo libre.",
                       duration: "5–8 min", ages: "2 a – adulto",
                       systemIcon: "ear.fill", tag: "AUDICIÓN",
                       color: Color(hex: "#2563EB"), soft: Color(hex: "#DBEAFE")),
        ClinicalModule(id: "Articulation", title: "Articulación · T.A.R.",
                       summary: "Test de Articulación a la Repetición (SODA).",
                       duration: "8–12 min", ages: "3–7 a",
                       systemIcon: "waveform", tag: "LENGUAJE",
                       color: Color(hex: "#EA580C"), soft: Color(hex: "#FFEDD5")),
        ClinicalModule(id: "DysphagiaTest", title: "Exploración de Disfagia",
                       summary: "Cribado con pulsioximetría integrada.",
                       duration: "10–15 min", ages: "Pulsioximetría",
                       systemIcon: "drop.fill", tag: "DEGLUCIÓN",
                       color: Color(hex: "#DC2626"), soft: Color(hex: "#FEE2E2")),
        ClinicalModule(id: "ExecutiveFunctions", title: "Funciones Ejecutivas",
                       summary: "Cinco mini-juegos: atención, inhibición, flexibilidad…",
                       duration: "8–12 min", ages: "3–12 a",
                       systemIcon: "brain.head.profile", tag: "COGNICIÓN",
                       color: Color(hex: "#059669"), soft: Color(hex: "#D1FAE5")),
        ClinicalModule(id: "Mchat", title: "Cuestionario Autismo",
                       summary: "Cribado M-CHAT-R/F del espectro autista.",
                       duration: "5–10 min", ages: "16–30 m",
                       systemIcon: "puzzlepiece.fill", tag: "CONDUCTA",
                       color: Color(hex: "#DB2777"), soft: Color(hex: "#FCE7F3")),
        ClinicalModule(id: "SahsScreening", title: "Cribado SAHS Infantil",
                       summary: "PSQ de Chervin + exploración física.",
                       duration: "5–8 min", ages: "2–12 a",
                       systemIcon: "moon.stars.fill", tag: "SUEÑO",
                       color: Color(hex: "#4F46E5"), soft: Color(hex: "#E0E7FF")),
    ]
}
